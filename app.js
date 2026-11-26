const ALL_TABS = ["konu", "soru", "sohbet", "hatalar", "ayarlar"];
const STORAGE_KEYS = {
  apiKey: "vergi_pwa_api_key",
  model: "vergi_pwa_model",
  lawText: "vergi_pwa_law_text",
  stats: "vergi_pwa_stats",
  mistakes: "vergi_pwa_mistakes"
};
const MAX_LAW_CHARS = 25000;

const GIB_MEVZUAT_POOL = [
  "193 sayılı Gelir Vergisi Kanunu - Ticari Kazancın Tespiti ve İndirilecek Giderler (GVK m. 38-40)",
  "193 sayılı Gelir Vergisi Kanunu - Ücret İstisnaları ve Vergi Tarifesi (GVK m. 23, 103)",
  "193 sayılı Gelir Vergisi Kanunu - Serbest Meslek Kazançları ve Stopaj Uygulaması (GVK m. 65-68, 94)",
  "193 sayılı Gelir Vergisi Kanunu - Gayrimenkul Sermaye İradı İstisnası ve Götürü Gider (GVK m. 21, 70, 74)",
  "193 sayılı Gelir Vergisi Kanunu - Menkul Sermaye İratları ve Değer Artışı Kazançları (GVK m. 75, Mük. 80)",
  "5520 sayılı Kurumlar Vergisi Kanunu - İştirak Kazançları İstisnası (KVK m. 5/1-a)",
  "5520 sayılı Kurumlar Vergisi Kanunu - Taşınmaz ve İştirak Hissesi Satış Kazancı İstisnası (KVK m. 5/1-e)",
  "5520 sayılı Kurumlar Vergisi Kanunu - Ar-Ge ve Tasarım İndirimi ile Yatırım İndirimi (KVK m. 10)",
  "5520 sayılı Kurumlar Vergisi Kanunu - Kabul Edilmeyen İndirimler ve Örtülü Sermaye (KVK m. 11-12)",
  "5520 sayılı Kurumlar Vergisi Kanunu - Transfer Fiyatlandırması Yoluyla Örtülü Kazanç Dağıtımı (KVK m. 13)",
  "3065 sayılı Katma Değer Vergisi Kanunu - Teslim ve Hizmet Sayılan Haller ile Vergiyi Doğuran Olay (KDV m. 1-5, 10)",
  "3065 sayılı Katma Değer Vergisi Kanunu - Mal ve Hizmet İhracatı İstisnası ve İadesi (KDV m. 11-12, 32)",
  "3065 sayılı Katma Değer Vergisi Kanunu - İndirim Hakkı ve İndirilmeyecek KDV (KDV m. 29-30)",
  "3065 sayılı Katma Değer Vergisi Kanunu - Tevkifat Uygulaması ve Sorumluluk (KDV m. 9)",
  "213 sayılı Vergi Usul Kanunu - Vergi Hataları ve Düzeltme Usulleri (VUK m. 116-126)",
  "213 sayılı Vergi Usul Kanunu - Tarh ve Tebliğ Zamanaşımı (VUK m. 113-115)",
  "213 sayılı Vergi Usul Kanunu - Vergi Ziyaı, Usulsüzlük Cezaları ve Uzlaşma (VUK m. 341-376, Ek m. 1-11)",
  "213 sayılı Vergi Usul Kanunu - Değerleme Ölçüleri, Amortisman ve Karşılıklar (VUK m. 258-329)",
  "6183 sayılı Amme Alacaklarının Tahsil Usulü Hakkında Kanun - Kanuni Temsilcilerin Sorumluluğu ve Haciz (6183 m. Mük. 35, 62)",
  "488 sayılı Damga Vergisi Kanunu - Kağıt Kavramı, Nispi ve Maktu Vergi ile İstisnalar (DV m. 1-14)",
  "7338 sayılı Veraset ve İntikal Vergisi Kanunu - İstisnalar ve Matrahın Tespiti (VİV m. 4, 10)"
];

const PRESETS = {
  kvk51a: "5520 sayılı KVK Madde 5/1-a: Kurumların, başka bir kurumun sermayesine katılmasından elde ettikleri kazançlar (tam mükellef kurumlardan elde edilen kâr payları ile yatırım fonu/ortaklığı katılma payları/hisselerine ilişkin hükümler) vergiden istisnadır.",
  kdv30: "3065 sayılı KDV Kanunu Madde 30: Vergiye tabi olmayan veya vergiden istisna edilmiş bulunan teslim ve hizmetlerle ilgili alış vesikalarında gösterilen veya hesaplanan KDV, mükellefin vergiye tabi işlemleri üzerinden hesaplanan KDV'den indirilemez.",
  vuk114: "213 sayılı VUK Madde 114: Vergi alacağının doğduğu takvim yılını takip eden yıldan başlayarak beş yıl içinde tarh ve mükellefe tebliğ edilmeyen vergiler zamanaşımına uğrar."
};

let stats = JSON.parse(localStorage.getItem(STORAGE_KEYS.stats) || '{"correct":0,"total":0,"byTopic":{}}');
let mistakes = JSON.parse(localStorage.getItem(STORAGE_KEYS.mistakes) || "[]");
let currentQuestion = {
  topic: GIB_MEVZUAT_POOL[5],
  question: "Tam mükellef (X) A.Ş., tam mükellef (Y) A.Ş.'nin sermayesine iştirak etmekte ve (Y) A.Ş.'den nakit kâr payı almaktadır. Bu kazancın kurumlar vergisi karşısındaki durumu nedir?",
  options: [
    "A) Kurumlar vergisinden istisnadır.",
    "B) %50 oranında vergiye tabidir.",
    "C) Tamamı ticari kazanç olarak vergilendirilir.",
    "D) Yalnızca yurt dışı dağıtımlarda istisnadır."
  ],
  answerIndex: 0,
  explanation: "5520 sayılı KVK m. 5/1-a uyarınca tam mükellef kurumların başka bir tam mükellef kurumdan elde ettikleri kâr payları istisna kapsamındadır."
};
let selectedOptionIndex = null;
let timerInterval = null;
let remainingSeconds = 0;

if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

function populateGibTopicSelect(selectedTopic = "") {
  const sel = document.getElementById("gibTopicSelect");
  if (!sel) return;
  sel.innerHTML = GIB_MEVZUAT_POOL.map(
    (item) => `<option value="${escapeAttr(item)}">${escapeHtml(item)}</option>`
  ).join("");
  if (selectedTopic && GIB_MEVZUAT_POOL.includes(selectedTopic)) {
    sel.value = selectedTopic;
  }
}

function pickRandomGibTopic(currentValue = "") {
  const candidates = GIB_MEVZUAT_POOL.filter((item) => item !== currentValue);
  const pool = candidates.length ? candidates : GIB_MEVZUAT_POOL;
  const chosen = pool[Math.floor(Math.random() * pool.length)];
  const input = document.getElementById("topicInput");
  if (input) input.value = chosen;
  const sel = document.getElementById("gibTopicSelect");
  if (sel) sel.value = chosen;
  return chosen;
}

function saveAllState() {
  localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(stats));
  localStorage.setItem(STORAGE_KEYS.mistakes, JSON.stringify(mistakes));
}

function setLawStatus(msg, isError = false) {
  const el = document.getElementById("lawSourceStatus");
  el.textContent = msg;
  el.className = isError
    ? "text-xs text-rose-600 font-medium"
    : "text-xs text-emerald-700 font-medium";
  el.classList.remove("hidden");
}

function appendLawText(incoming, sourceLabel) {
  const cleaned = String(incoming || "")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  if (!cleaned) throw new Error("Kaynakta okunabilir metin bulunamadı.");

  const ta = document.getElementById("lawTextInput");
  const header = `--- Kaynak: ${sourceLabel} ---\n`;
  let merged = ta.value.trim()
    ? `${ta.value.trim()}\n\n${header}${cleaned}`
    : `${header}${cleaned}`;

  let trimmedNote = "";
  if (merged.length > MAX_LAW_CHARS) {
    merged = merged.slice(0, MAX_LAW_CHARS);
    trimmedNote = ` (${MAX_LAW_CHARS.toLocaleString("tr-TR")} karakter sınırı uygulandı)`;
  }

  ta.value = merged;
  localStorage.setItem(STORAGE_KEYS.lawText, merged);
  setLawStatus(`"${sourceLabel}" metni aktarıldı ve kaydedildi${trimmedNote}.`);
}

function htmlToPlainText(htmlString) {
  const doc = new DOMParser().parseFromString(htmlString, "text/html");
  doc.querySelectorAll("script, style, noscript, svg, nav, footer, header").forEach((n) => n.remove());
  return (doc.body?.innerText || doc.body?.textContent || "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchTextFromUrl(rawUrl) {
  const url = (rawUrl || "").trim();
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("Lütfen http:// veya https:// ile başlayan geçerli bir bağlantı girin.");
  }

  const btn = document.getElementById("fetchUrlBtn");
  const prev = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Çekiliyor...";

  try {
    let extracted = "";
    try {
      const directRes = await fetch(url);
      if (directRes.ok) {
        const ct = directRes.headers.get("content-type") || "";
        const body = await directRes.text();
        extracted = ct.includes("text/html") || /<html[\s>]/i.test(body) ? htmlToPlainText(body) : body;
      }
    } catch {
      // CORS engeli durumunda okuyucu katmanına düş
    }

    if (!extracted || extracted.length < 40) {
      const readerUrl = `https://r.jina.ai/${url}`;
      const rRes = await fetch(readerUrl);
      if (!rRes.ok) {
        throw new Error("Bağlantıdaki içerik okunamadı (site erişimi engelliyor olabilir).");
      }
      extracted = await rRes.text();
    }

    appendLawText(extracted, url);
  } catch (err) {
    setLawStatus("Link hatası: " + err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = prev;
  }
}

async function extractTextFromPdfFile(file) {
  if (!file) return;
  if (!window.pdfjsLib) {
    setLawStatus("PDF okuyucu kütüphanesi yüklenemedi. İnternet bağlantınızı kontrol edin.", true);
    return;
  }

  document.getElementById("pdfFileName").textContent = `${file.name} okunuyor...`;
  setLawStatus("PDF sayfalarından metin çıkarılıyor...");

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages = [];

    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item) => item.str).join(" ").trim();
      if (pageText) pages.push(`[Sayfa ${i}]\n${pageText}`);
      if (pages.join("\n\n").length >= MAX_LAW_CHARS) break;
    }

    document.getElementById("pdfFileName").textContent = `${file.name} (${pdf.numPages} sayfa)`;
    appendLawText(pages.join("\n\n"), file.name);
  } catch (err) {
    document.getElementById("pdfFileName").textContent = "PDF okunamadı";
    setLawStatus("PDF okuma hatası: " + (err?.message || "Dosya şifreli veya taranmış görsel olabilir."), true);
  }
}

function updateNetworkStatus() {
  const online = navigator.onLine;
  const badge = document.getElementById("netBadge");
  const dot = document.getElementById("netDot");
  const text = document.getElementById("netText");
  if (online) {
    badge.className = "text-[11px] px-2 py-1 rounded-full border flex items-center gap-1.5 bg-emerald-950/70 text-emerald-300 border-emerald-700/60";
    dot.className = "w-2 h-2 rounded-full bg-emerald-400";
    text.textContent = "Çevrimiçi";
  } else {
    badge.className = "text-[11px] px-2 py-1 rounded-full border flex items-center gap-1.5 bg-rose-950/70 text-rose-300 border-rose-700/60";
    dot.className = "w-2 h-2 rounded-full bg-rose-400";
    text.textContent = "Çevrimdışı";
  }
}

window.addEventListener("online", updateNetworkStatus);
window.addEventListener("offline", updateNetworkStatus);

function updateBadges(key) {
  const badge = document.getElementById("modeBadge");
  const activeKey = (key ?? localStorage.getItem(STORAGE_KEYS.apiKey) ?? "").trim();
  if (activeKey.length > 10) {
    badge.textContent = "Canlı Gemini API Aktif";
    badge.className = "text-[11px] text-emerald-400 truncate";
  } else {
    badge.textContent = "Demo Modu (Ayarlardan API Anahtarı Ekleyin)";
    badge.className = "text-[11px] text-amber-400 truncate";
  }
  document.getElementById("scoreBadge").textContent = `Doğru: ${stats.correct} / ${stats.total}`;
}

function renderTopicStats() {
  const el = document.getElementById("topicStatsList");
  const entries = Object.entries(stats.byTopic || {});
  if (!entries.length) {
    el.textContent = "Henüz soru çözülmedi. Soru çözdükçe konu bazlı doğru/yanlış dağılımı burada görünecek.";
    return;
  }
  el.innerHTML = entries.map(([topic, d]) => {
    const rate = d.total ? Math.round((d.correct / d.total) * 100) : 0;
    return `<div class="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0 gap-2">
      <span class="truncate font-medium text-slate-800">${escapeHtml(topic)}</span>
      <span class="text-xs shrink-0 text-slate-600">${d.correct}/${d.total} (%${rate})</span>
    </div>`;
  }).join("");
}

function renderMistakes() {
  const listEl = document.getElementById("mistakesList");
  const filterEl = document.getElementById("mistakeFilter");
  const currentFilter = filterEl.value || "ALL";
  const topics = ["ALL", ...new Set(mistakes.map((m) => m.topic))];
  filterEl.innerHTML = topics.map((t) => `<option value="${escapeAttr(t)}">${t === "ALL" ? "Tüm Konular" : escapeHtml(t)}</option>`).join("");
  filterEl.value = topics.includes(currentFilter) ? currentFilter : "ALL";

  const filtered = mistakes.filter((m) => filterEl.value === "ALL" || m.topic === filterEl.value);
  if (!filtered.length) {
    listEl.textContent = "Bu filtrede kayıtlı yanlış soru yok.";
    return;
  }

  listEl.innerHTML = filtered.map((m) => {
    const realIndex = mistakes.indexOf(m);
    return `<div class="rounded-xl border border-rose-200 bg-rose-50/50 p-3.5 space-y-2">
      <div class="flex items-center justify-between gap-2">
        <span class="text-xs font-semibold text-rose-800">${escapeHtml(m.topic)}</span>
        <button onclick="removeMistake(${realIndex})" class="text-xs text-emerald-700 font-semibold hover:underline">Tekrar Çözdüm / Sil</button>
      </div>
      <p class="font-medium text-slate-900">${escapeHtml(m.question)}</p>
      <p class="text-xs text-slate-600"><strong>Doğru Cevap:</strong> ${escapeHtml(m.correctOption || "")}</p>
      <p class="text-xs text-slate-700">${escapeHtml(m.explanation || "")}</p>
      <textarea rows="2" placeholder="Kendi kısa notunuz veya kanun/tebliğ notu..."
        onchange="updateMistakeNote(${realIndex}, this.value)"
        class="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-800">${escapeHtml(m.note || "")}</textarea>
    </div>`;
  }).join("");
}

function updateMistakeNote(index, note) {
  if (!mistakes[index]) return;
  mistakes[index].note = note;
  saveAllState();
}

function removeMistake(index) {
  mistakes.splice(index, 1);
  saveAllState();
  renderMistakes();
}

function switchTab(tab) {
  ALL_TABS.forEach((t) => {
    document.getElementById("tab-" + t).classList.toggle("hidden", t !== tab);
    const nav = document.getElementById("nav-" + t);
    nav.className = t === tab
      ? "flex flex-col items-center text-[11px] font-bold text-slate-900"
      : "flex flex-col items-center text-[11px] font-medium text-slate-400";
  });
  if (tab === "hatalar") renderMistakes();
  if (tab === "konu") renderTopicStats();
}

function renderQuestion(q) {
  currentQuestion = q;
  selectedOptionIndex = null;
  document.getElementById("questionText").textContent = q.question;
  document.getElementById("feedbackBox").classList.add("hidden");
  document.getElementById("feedbackBox").innerHTML = "";

  const container = document.getElementById("optionsContainer");
  container.innerHTML = "";
  q.options.forEach((opt, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "w-full text-left rounded-xl border border-slate-300 px-4 py-3 text-sm hover:bg-slate-50 transition";
    btn.textContent = opt;
    btn.onclick = () => {
      selectedOptionIndex = idx;
      [...container.children].forEach((c, i) => {
        c.className = i === idx
          ? "w-full text-left rounded-xl border-2 border-indigo-600 bg-indigo-50 px-4 py-3 text-sm font-medium transition"
          : "w-full text-left rounded-xl border border-slate-300 px-4 py-3 text-sm hover:bg-slate-50 transition";
      });
    };
    container.appendChild(btn);
  });

  startTimerIfConfigured();
}

function startTimerIfConfigured() {
  if (timerInterval) clearInterval(timerInterval);
  const mins = parseInt(document.getElementById("timerMinutes").value || "0", 10);
  const display = document.getElementById("timerDisplay");
  if (!mins || mins <= 0) {
    display.classList.add("hidden");
    return;
  }
  remainingSeconds = mins * 60;
  display.classList.remove("hidden");
  const tick = () => {
    const m = String(Math.floor(remainingSeconds / 60)).padStart(2, "0");
    const s = String(remainingSeconds % 60).padStart(2, "0");
    display.textContent = `${m}:${s}`;
    if (remainingSeconds <= 0) {
      clearInterval(timerInterval);
      display.textContent = "Süre Doldu";
      return;
    }
    remainingSeconds -= 1;
  };
  tick();
  timerInterval = setInterval(tick, 1000);
}

async function callGemini(promptText) {
  const apiKey = (localStorage.getItem(STORAGE_KEYS.apiKey) || "").trim();
  const model = localStorage.getItem(STORAGE_KEYS.model) || "gemini-3.8-flash";
  const lawText = (localStorage.getItem(STORAGE_KEYS.lawText) || "").trim();
  if (!apiKey) throw new Error("API anahtarı kayıtlı değil. Ayarlar sekmesinden ekleyin.");

  const systemRule = lawText
    ? `Türk vergi mevzuatı uzmanı olarak yanıt ver. Şu mevzuat metnini öncelikli kaynak al:\n${lawText}\n\n`
    : "Türk vergi mevzuatı uzmanı olarak net, dayanaklı ve sınav/uygulama odaklı yanıt ver.\n\n";

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: systemRule + promptText }] }]
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `HTTP ${res.status}`);
  }
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

function parseJsonLoose(raw) {
  const cleaned = raw.replace(/```json|```/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("JSON formatı ayrıştırılamadı.");
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function generateLessonAndQuestion(onlyQuestion = false) {
  const topicInput = document.getElementById("topicInput");
  const autoRandom = document.getElementById("autoRandomOnGenerate")?.checked;
  let topic = topicInput.value.trim();

  if (autoRandom && !onlyQuestion) {
    topic = pickRandomGibTopic(topic);
  } else if (!topic) {
    topic = pickRandomGibTopic("");
  }

  const difficulty = document.getElementById("difficultySelect").value || "Vaka";
  const btn = document.getElementById(onlyQuestion ? "newQuestionBtn" : "generateBtn");
  const prevText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Üretiliyor...";

  try {
    const prompt = `Kaynak bağlam: gib.gov.tr mevzuatı | Konu: "${topic}" | Zorluk: "${difficulty}".
Yalnızca geçerli JSON döndür:
{
  "lessonTitle": "...",
  "lessonSummary": "...",
  "lessonCritical": "...",
  "lessonBasis": "...",
  "question": "...",
  "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
  "answerIndex": 0,
  "explanation": "..."
}`;
    const text = await callGemini(prompt);
    const parsed = parseJsonLoose(text);

    if (!onlyQuestion) {
      document.getElementById("lessonTitle").textContent = parsed.lessonTitle || topic;
      document.getElementById("lessonSummary").textContent = parsed.lessonSummary || "";
      document.getElementById("lessonCritical").innerHTML = `<strong>Kritik Ayrım:</strong> ${escapeHtml(parsed.lessonCritical || "")}`;
      document.getElementById("lessonBasis").textContent = `Dayanak: ${parsed.lessonBasis || "gib.gov.tr Mevzuat"}`;
    }

    renderQuestion({
      topic,
      question: parsed.question,
      options: parsed.options,
      answerIndex: Number(parsed.answerIndex) || 0,
      explanation: parsed.explanation || ""
    });

    if (onlyQuestion) switchTab("soru");
  } catch (err) {
    alert("Hata: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = prevText;
  }
}

function startWrongQuiz() {
  if (!mistakes.length) {
    alert("Hata defterinde tekrar edilecek soru bulunmuyor.");
    return;
  }
  const picked = mistakes[Math.floor(Math.random() * mistakes.length)];
  const opts = picked.options && picked.options.length === 4
    ? picked.options
    : ["A) Doğru değerlendirme", "B) İstisna kapsamında değildir", "C) Tamamı matraha eklenir", "D) Zamanaşımına uğramıştır"];
  renderQuestion({
    topic: picked.topic,
    question: picked.question,
    options: opts,
    answerIndex: typeof picked.answerIndex === "number" ? picked.answerIndex : 0,
    explanation: picked.explanation || ""
  });
  switchTab("soru");
}

function checkAnswer() {
  if (selectedOptionIndex === null) {
    alert("Lütfen önce bir şık seçin.");
    return;
  }
  if (timerInterval) clearInterval(timerInterval);

  const isCorrect = selectedOptionIndex === currentQuestion.answerIndex;
  stats.total += 1;
  if (!stats.byTopic[currentQuestion.topic]) {
    stats.byTopic[currentQuestion.topic] = { correct: 0, total: 0 };
  }
  stats.byTopic[currentQuestion.topic].total += 1;

  const box = document.getElementById("feedbackBox");
  box.classList.remove("hidden");

  if (isCorrect) {
    stats.correct += 1;
    stats.byTopic[currentQuestion.topic].correct += 1;
    box.className = "rounded-xl p-4 text-sm space-y-2 border bg-emerald-50 border-emerald-200 text-emerald-950";
    box.innerHTML = `<p class="font-bold">Doğru Yanıt!</p><p>${escapeHtml(currentQuestion.explanation)}</p>`;
  } else {
    box.className = "rounded-xl p-4 text-sm space-y-2 border bg-rose-50 border-rose-200 text-rose-950";
    box.innerHTML = `<p class="font-bold">Yanlış Yanıt — Doğru Seçenek: ${escapeHtml(currentQuestion.options[currentQuestion.answerIndex] || "")}</p><p>${escapeHtml(currentQuestion.explanation)}</p>`;
    mistakes.unshift({
      topic: currentQuestion.topic,
      question: currentQuestion.question,
      options: currentQuestion.options,
      answerIndex: currentQuestion.answerIndex,
      correctOption: currentQuestion.options[currentQuestion.answerIndex] || "",
      explanation: currentQuestion.explanation,
      note: ""
    });
  }

  saveAllState();
  updateBadges();
  renderTopicStats();
  renderMistakes();
}

function appendChatMessage(role, text) {
  const wrap = document.getElementById("chatMessages");
  const div = document.createElement("div");
  div.className = role === "user"
    ? "bg-slate-900 text-white rounded-xl p-3 text-sm ml-8"
    : "bg-slate-100 text-slate-800 rounded-xl p-3 text-sm mr-8 whitespace-pre-line";
  div.textContent = text;
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
}

async function handleChatSend() {
  const input = document.getElementById("chatInput");
  const q = input.value.trim();
  if (!q) return;
  input.value = "";
  appendChatMessage("user", q);
  appendChatMessage("assistant", "Yanıt hazırlanıyor...");
  const loadingBubble = document.getElementById("chatMessages").lastChild;

  try {
    const answer = await callGemini(q);
    loadingBubble.textContent = answer;
  } catch (err) {
    loadingBubble.textContent = "Hata: " + err.message;
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));
}

function escapeAttr(str) {
  return String(str).replace(/"/g, "&quot;");
}

document.getElementById("toggleLawPickerBtn").onclick = () => {
  document.getElementById("lawPickerPanel").classList.toggle("hidden");
};

document.getElementById("closeLawPickerBtn").onclick = () => {
  document.getElementById("lawPickerPanel").classList.add("hidden");
};

document.getElementById("gibTopicSelect").onchange = (e) => {
  const chosen = e.target.value;
  if (!chosen) return;
  document.getElementById("topicInput").value = chosen;
  const autoCb = document.getElementById("autoRandomOnGenerate");
  if (autoCb) autoCb.checked = false;
  document.getElementById("lawPickerPanel").classList.add("hidden");
};

document.getElementById("randomGibTopicBtn").onclick = () => {
  const autoCb = document.getElementById("autoRandomOnGenerate");
  if (autoCb) autoCb.checked = true;
  pickRandomGibTopic(document.getElementById("topicInput").value.trim());
};

document.getElementById("saveSettingsBtn").onclick = () => {
  const key = document.getElementById("apiKeyInput").value.trim();
  const model = document.getElementById("modelSelect").value;
  localStorage.setItem(STORAGE_KEYS.apiKey, key);
  localStorage.setItem(STORAGE_KEYS.model, model);
  updateBadges(key);
  const st = document.getElementById("settingsStatus");
  st.classList.remove("hidden");
  setTimeout(() => st.classList.add("hidden"), 2500);
};

document.getElementById("saveLawBtn").onclick = () => {
  const law = document.getElementById("lawTextInput").value.trim();
  localStorage.setItem(STORAGE_KEYS.lawText, law);
  setLawStatus("Mevzuat metni kaydedildi.");
};

document.getElementById("fetchUrlBtn").onclick = () => {
  fetchTextFromUrl(document.getElementById("lawUrlInput").value);
};

document.getElementById("pdfFileInput").onchange = (e) => {
  const file = e.target.files?.[0];
  extractTextFromPdfFile(file);
  e.target.value = "";
};

document.querySelectorAll(".preset-btn").forEach((btn) => {
  btn.onclick = () => {
    const text = PRESETS[btn.dataset.preset] || "";
    const ta = document.getElementById("lawTextInput");
    ta.value = ta.value ? `${ta.value}\n\n${text}` : text;
  };
});

document.getElementById("generateBtn").onclick = () => generateLessonAndQuestion(false);
document.getElementById("newQuestionBtn").onclick = () => generateLessonAndQuestion(true);
document.getElementById("wrongQuizBtn").onclick = startWrongQuiz;
document.getElementById("checkAnswerBtn").onclick = checkAnswer;
document.getElementById("sendChatBtn").onclick = handleChatSend;
document.getElementById("chatInput").onkeydown = (e) => { if (e.key === "Enter") handleChatSend(); };
document.getElementById("clearChatBtn").onclick = () => {
  document.getElementById("chatMessages").innerHTML = `<div class="bg-slate-100 rounded-xl p-3 text-sm text-slate-700">Sohbet temizlendi. Yeni sorunuzu yazabilirsiniz.</div>`;
};
document.getElementById("mistakeFilter").onchange = renderMistakes;
document.getElementById("clearMistakesBtn").onclick = () => {
  mistakes = [];
  saveAllState();
  renderMistakes();
};
document.getElementById("resetStatsBtn").onclick = () => {
  stats = { correct: 0, total: 0, byTopic: {} };
  saveAllState();
  updateBadges();
  renderTopicStats();
};

document.getElementById("exportBackupBtn").onclick = () => {
  const payload = {
    exportedAt: new Date().toISOString(),
    stats,
    mistakes,
    lawText: localStorage.getItem(STORAGE_KEYS.lawText) || ""
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "vergi-asistani-yedek.json";
  a.click();
  URL.revokeObjectURL(url);
};

document.getElementById("importBackupInput").onchange = (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result || "{}"));
      if (data.stats) stats = data.stats;
      if (Array.isArray(data.mistakes)) mistakes = data.mistakes;
      if (typeof data.lawText === "string") {
        localStorage.setItem(STORAGE_KEYS.lawText, data.lawText);
        document.getElementById("lawTextInput").value = data.lawText;
      }
      saveAllState();
      updateBadges();
      renderTopicStats();
      renderMistakes();
      alert("Yedek başarıyla geri yüklendi.");
    } catch {
      alert("Geçersiz JSON yedek dosyası.");
    }
  };
  reader.readAsText(file);
};

(function init() {
  const initialTopic = pickRandomGibTopic("");
  populateGibTopicSelect(initialTopic);
  document.getElementById("apiKeyInput").value = localStorage.getItem(STORAGE_KEYS.apiKey) || "";
  const savedModel = localStorage.getItem(STORAGE_KEYS.model);
  if (savedModel) {
    const sel = document.getElementById("modelSelect");
    if ([...sel.options].some((o) => o.value === savedModel)) sel.value = savedModel;
  }
  document.getElementById("lawTextInput").value = localStorage.getItem(STORAGE_KEYS.lawText) || "";
  updateNetworkStatus();
  updateBadges();
  renderTopicStats();
  renderMistakes();
  renderQuestion(currentQuestion);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").then((reg) => {
      if (reg.waiting) showUpdateBanner(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) {
            showUpdateBanner(nw);
          }
        });
      });
    });
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }
})();

function showUpdateBanner(worker) {
  const banner = document.getElementById("updateBanner");
  banner.classList.remove("hidden");
  document.getElementById("reloadUpdateBtn").onclick = () => {
    worker.postMessage({ type: "SKIP_WAITING" });
  };
}
