const ALL_TABS = ["konu", "soru", "sohbet", "hatalar", "ayarlar"];
const STORAGE_KEYS = {
  apiKey: "vergi_pwa_api_key",
  model: "vergi_pwa_model",
  lawText: "vergi_pwa_law_text",
  lawUrl: "vergi_pwa_law_url",
  stats: "vergi_pwa_stats",
  mistakes: "vergi_pwa_mistakes"
};
const MAX_LAW_CHARS = 25000;

const CATEGORY_LABELS = {
  kanunlar: "Kanunlar",
  tebligler: "Tebliğler",
  ozelgeler: "Özelgeler",
  sirkulerler: "Sirkülerler",
  yonetmelikler: "Yönetmelikler"
};

const MEVZUAT_BY_CATEGORY = {
  kanunlar: [
    "193 sayılı Gelir Vergisi Kanunu",
    "213 sayılı Vergi Usul Kanunu",
    "3065 sayılı Katma Değer Vergisi Kanunu",
    "5520 sayılı Kurumlar Vergisi Kanunu",
    "6183 sayılı Amme Alacaklarının Tahsil Usulü Hakkında Kanunu",
    "488 sayılı Damga Vergisi Kanunu",
    "492 sayılı Harçlar Kanunu",
    "7338 sayılı Veraset ve İntikal Vergisi Kanunu",
    "1319 sayılı Emlak Vergisi Kanunu",
    "4760 sayılı Özel Tüketim Vergisi Kanunu",
    "197 sayılı Motorlu Taşıtlar Vergisi Kanunu",
    "6802 sayılı Gider Vergileri Kanunu",
    "2464 sayılı Belediye Gelirleri Kanunu",
    "4691 sayılı Teknoloji Geliştirme Bölgeleri Kanunu",
    "5746 sayılı Araştırma, Geliştirme ve Tasarım Faaliyetlerinin Desteklenmesi Hakkında Kanun",
    "3218 sayılı Serbest Bölgeler Kanunu"
  ],
  tebligler: [
    "KDV Genel Uygulama Tebliği",
    "Kurumlar Vergisi Genel Tebliği (Seri No: 1)",
    "Vergi Usul Kanunu Genel Tebliği (Sıra No: 509 - e-Belge Uygulamaları)",
    "Transfer Fiyatlandırması Yoluyla Örtülü Kazanç Dağıtımı Hakkında Genel Tebliğ (Seri No: 1)",
    "Gelir Vergisi Genel Tebliği (Seri No: 311 - Ücret İstisnası ve Uygulaması)",
    "Tahsilat Genel Tebliği (Seri No: A/1)",
    "Özel Tüketim Vergisi (I), (II), (III) ve (IV) Sayılı Liste Uygulama Genel Tebliğleri"
  ],
  ozelgeler: [
    "GİB Özelgeleri - İştirak ve Taşınmaz Satış Kazancı İstisnası (KVK m. 5)",
    "GİB Özelgeleri - KDV İndirimi, İadesi ve Sorumlu Sıfatıyla Tevkifat (KDV m. 9, 29, 32)",
    "GİB Özelgeleri - Belge Düzeni, Değerleme, Amortisman ve Düzeltme (VUK)",
    "GİB Özelgeleri - Serbest Meslek, Ücret ve Gayrimenkul Sermaye İradı (GVK)",
    "GİB Özelgeleri - Kanuni Temsilci Sorumluluğu ve Haciz Uygulamaları (6183 sayılı Kanun)"
  ],
  sirkulerler: [
    "Vergi Usul Kanunu Sirküleri - Elektronik Belge ve Beyan Uygulamaları",
    "Kurumlar Vergisi Sirküleri - İstisnalar, Geçici Vergi ve Matrah Uygulamaları",
    "Katma Değer Vergisi Sirküleri - Tevkifat, İndirim ve İade Usulleri",
    "Gelir Vergisi Sirküleri - Tevkifat, İstisna ve Beyan Uygulamaları",
    "Tahsilat Sirküleri - Tecil, Taksitlendirme ve Amme Alacağı Takibi"
  ],
  yonetmelikler: [
    "Transfer Fiyatlandırması Yoluyla Örtülü Kazanç Dağıtımı Hakkında Yönetmelik",
    "Vergi Usul Kanunu Uyarınca Defter ve Belgelerin Elektronik Ortamda Tutulması/Düzenlenmesi Yönetmeliği",
    "Vergi Cezalarında Uzlaşma Yönetmeliği / Tarhiyat Öncesi Uzlaşma Yönetmeliği",
    "Amme Alacaklarının Tahsil Usulü Hakkında Kanun Uygulama Yönetmeliği",
    "Mal ve Hizmetlere Uygulanacak Katma Değer Vergisi Oranlarının Tespitine İlişkin Karar/Düzenlemeler"
  ]
};

const PRESETS = {
  kvk51a: "5520 sayılı KVK Madde 5/1-a: Kurumların, başka bir kurumun sermayesine katılmasından elde ettikleri kazançlar (tam mükellef kurumlardan elde edilen kâr payları ile yatırım fonu/ortaklığı katılma payları/hisselerine ilişkin hükümler) vergiden istisnadır.",
  kdv30: "3065 sayılı KDV Kanunu Madde 30: Vergiye tabi olmayan veya vergiden istisna edilmiş bulunan teslim ve hizmetlerle ilgili alış vesikalarında gösterilen veya hesaplanan KDV, mükellefin vergiye tabi işlemleri üzerinden hesaplanan KDV'den indirilemez.",
  vuk114: "213 sayılı VUK Madde 114: Vergi alacağının doğduğu takvim yılını takip eden yıldan başlayarak beş yıl içinde tarh ve mükellefe tebliğ edilmeyen vergiler zamanaşımına uğrar."
};

let activeCategory = "kanunlar";
let stats = { correct: 0, total: 0, byTopic: {} };
let mistakes = [];
let currentQuestion = {
  topic: MEVZUAT_BY_CATEGORY.kanunlar[3],
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

function switchTab(tab) {
  const target = ALL_TABS.includes(tab) ? tab : "konu";
  ALL_TABS.forEach((t) => {
    const sec = document.getElementById("tab-" + t);
    if (sec) sec.classList.toggle("hidden", t !== target);
    const nav = document.getElementById("nav-" + t);
    if (nav) {
      nav.className = t === target
        ? "flex flex-col items-center justify-center py-1 text-[11px] font-bold text-slate-900"
        : "flex flex-col items-center justify-center py-1 text-[11px] font-medium text-slate-500";
    }
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (target === "hatalar") renderMistakes();
  if (target === "konu") renderTopicStats();
}
window.switchTab = switchTab;

function loadStoredState() {
  try {
    stats = JSON.parse(localStorage.getItem(STORAGE_KEYS.stats) || '{"correct":0,"total":0,"byTopic":{}}');
  } catch {
    stats = { correct: 0, total: 0, byTopic: {} };
  }
  try {
    mistakes = JSON.parse(localStorage.getItem(STORAGE_KEYS.mistakes) || "[]");
    if (!Array.isArray(mistakes)) mistakes = [];
  } catch {
    mistakes = [];
  }
}

if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

function inferCategoryFromLine(line) {
  const lower = String(line || "").toLocaleLowerCase("tr");
  if (lower.includes("yönetmelik")) return "yonetmelikler";
  if (lower.includes("sirküler")) return "sirkulerler";
  if (lower.includes("özelge")) return "ozelgeler";
  if (lower.includes("tebliğ")) return "tebligler";
  if (lower.includes("kanun")) return "kanunlar";
  return null;
}

function extractItemsFromPoolText(rawText) {
  const buckets = {
    kanunlar: [],
    tebligler: [],
    ozelgeler: [],
    sirkulerler: [],
    yonetmelikler: []
  };

  const lines = String(rawText || "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s\-*•\d.)]+/, "").trim())
    .filter((l) => l.length >= 12 && l.length <= 220 && !l.startsWith("--- Kaynak:"));

  for (const line of lines) {
    const cat = inferCategoryFromLine(line);
    if (cat && !buckets[cat].includes(line)) {
      buckets[cat].push(line);
    }
  }

  return buckets;
}

function getCategoryPool(category = activeCategory) {
  const base = MEVZUAT_BY_CATEGORY[category] || MEVZUAT_BY_CATEGORY.kanunlar;
  const lawText = localStorage.getItem(STORAGE_KEYS.lawText) || "";
  const extra = extractItemsFromPoolText(lawText)[category] || [];
  return [...new Set([...extra, ...base])];
}

function syncCategoryUi() {
  document.querySelectorAll(".law-cat-btn").forEach((btn) => {
    const isSelected = btn.dataset.category === activeCategory;
    btn.className = isSelected
      ? "law-cat-btn cursor-pointer rounded-lg py-2 px-1 text-[11px] font-bold bg-slate-900 text-white shadow-xs transition truncate"
      : "law-cat-btn cursor-pointer rounded-lg py-2 px-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 transition truncate";
  });

  const label = CATEGORY_LABELS[activeCategory] || "Kanunlar";
  const pool = getCategoryPool(activeCategory);
  const titleEl = document.getElementById("pickerPanelTitle");
  const countEl = document.getElementById("categoryCountBadge");
  const catLabelEl = document.getElementById("lessonCategoryLabel");

  if (titleEl) titleEl.textContent = `GİB ${label} Listesi`;
  if (countEl) countEl.textContent = `${label} (${pool.length} kayıt)`;
  if (catLabelEl) catLabelEl.textContent = label;
}

function syncSelectionModeBadge() {
  const badge = document.getElementById("activeSelectionBadge");
  const autoCb = document.getElementById("autoRandomOnGenerate");
  if (!badge) return;
  if (autoCb && autoCb.checked) {
    badge.textContent = "Rastgele Mod";
    badge.className = "text-[11px] font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/80 shrink-0";
  } else {
    badge.textContent = "Manuel Seçim";
    badge.className = "text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-900 text-white border border-slate-900 shrink-0";
  }
}

function populateGibTopicSelect(selectedTopic = "", filterText = "") {
  const sel = document.getElementById("gibTopicSelect");
  if (!sel) return;
  const pool = getCategoryPool(activeCategory);
  const q = String(filterText || "").trim().toLocaleLowerCase("tr");
  const list = q
    ? pool.filter((item) => item.toLocaleLowerCase("tr").includes(q))
    : pool;

  sel.innerHTML = list.length
    ? list.map((item) => `<option value="${escapeAttr(item)}">${escapeHtml(item)}</option>`).join("")
    : `<option disabled value="">Bu bölümde eşleşen kayıt bulunamadı</option>`;

  if (selectedTopic && list.includes(selectedTopic)) {
    sel.value = selectedTopic;
  }
}

function pickRandomGibTopic(currentValue = "") {
  const poolAll = getCategoryPool(activeCategory);
  const candidates = poolAll.filter((item) => item !== currentValue);
  const pool = candidates.length ? candidates : poolAll;
  const chosen = pool[Math.floor(Math.random() * pool.length)];

  const input = document.getElementById("topicInput");
  if (input) input.value = chosen;
  const searchInput = document.getElementById("lawSearchInput");
  if (searchInput) searchInput.value = "";
  syncCategoryUi();
  populateGibTopicSelect(chosen, "");
  const sel = document.getElementById("gibTopicSelect");
  if (sel) sel.value = chosen;
  return chosen;
}

function selectCategoryFromUi(category) {
  activeCategory = CATEGORY_LABELS[category] ? category : "kanunlar";
  syncCategoryUi();
  const autoCb = document.getElementById("autoRandomOnGenerate");
  const isRandom = Boolean(autoCb && autoCb.checked);
  const currentTopicInput = document.getElementById("topicInput");

  if (isRandom) {
    pickRandomGibTopic(currentTopicInput ? currentTopicInput.value.trim() : "");
  } else {
    const pool = getCategoryPool(activeCategory);
    if (pool.length && currentTopicInput) {
      currentTopicInput.value = pool[0];
    }
    populateGibTopicSelect(currentTopicInput ? currentTopicInput.value.trim() : "", "");
  }
}
window.selectCategoryFromUi = selectCategoryFromUi;

function toggleLawPickerPanel() {
  const panel = document.getElementById("lawPickerPanel");
  if (!panel) return;
  panel.classList.toggle("hidden");
  if (!panel.classList.contains("hidden")) {
    const search = document.getElementById("lawSearchInput");
    if (search) search.value = "";
    syncCategoryUi();
    populateGibTopicSelect(document.getElementById("topicInput")?.value.trim() || "", "");
    if (search) search.focus();
  }
}
window.toggleLawPickerPanel = toggleLawPickerPanel;

function closeLawPickerPanel() {
  const panel = document.getElementById("lawPickerPanel");
  if (panel) panel.classList.add("hidden");
}
window.closeLawPickerPanel = closeLawPickerPanel;

function handleRandomGibTopicClick() {
  const autoCb = document.getElementById("autoRandomOnGenerate");
  if (autoCb) autoCb.checked = true;
  syncSelectionModeBadge();
  pickRandomGibTopic(document.getElementById("topicInput")?.value.trim() || "");
}
window.handleRandomGibTopicClick = handleRandomGibTopicClick;

async function syncPoolToActiveCategory() {
  const savedUrl = (localStorage.getItem(STORAGE_KEYS.lawUrl) || document.getElementById("lawUrlInput")?.value || "").trim();
  if (savedUrl) {
    await fetchTextFromUrl(savedUrl);
  } else {
    syncCategoryUi();
    populateGibTopicSelect(
      document.getElementById("topicInput")?.value.trim() || "",
      document.getElementById("lawSearchInput")?.value || ""
    );
    setLawStatus("Mevzuat Havuzu metnindeki eşleşen başlıklar aktif kategori listesine senkronize edildi.");
  }
}
window.syncPoolToActiveCategory = syncPoolToActiveCategory;

function saveAllState() {
  localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(stats));
  localStorage.setItem(STORAGE_KEYS.mistakes, JSON.stringify(mistakes));
}

function setLawStatus(msg, isError = false) {
  const el = document.getElementById("lawSourceStatus");
  if (!el) return;
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
  if (!ta) return;
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
  syncCategoryUi();
  populateGibTopicSelect(
    document.getElementById("topicInput")?.value.trim() || "",
    document.getElementById("lawSearchInput")?.value || ""
  );
  setLawStatus(`"${sourceLabel}" verisi aktarıldı, kaydedildi ve mevzuat listelerine işlendi${trimmedNote}.`);
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

  localStorage.setItem(STORAGE_KEYS.lawUrl, url);
  const btn = document.getElementById("fetchUrlBtn");
  const prev = btn ? btn.textContent : "";
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Çekiliyor...";
  }

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
    if (btn) {
      btn.disabled = false;
      btn.textContent = prev;
    }
  }
}

async function extractTextFromPdfFile(file) {
  if (!file) return;
  if (!window.pdfjsLib) {
    setLawStatus("PDF okuyucu kütüphanesi yüklenemedi. İnternet bağlantınızı kontrol edin.", true);
    return;
  }

  const fileNameEl = document.getElementById("pdfFileName");
  if (fileNameEl) fileNameEl.textContent = `${file.name} okunuyor...`;
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

    if (fileNameEl) fileNameEl.textContent = `${file.name} (${pdf.numPages} sayfa)`;
    appendLawText(pages.join("\n\n"), file.name);
  } catch (err) {
    if (fileNameEl) fileNameEl.textContent = "PDF okunamadı";
    setLawStatus("PDF okuma hatası: " + (err?.message || "Dosya şifreli veya taranmış görsel olabilir."), true);
  }
}

function updateNetworkStatus() {
  const online = navigator.onLine;
  const badge = document.getElementById("netBadge");
  const dot = document.getElementById("netDot");
  const text = document.getElementById("netText");
  if (!badge || !dot || !text) return;
  if (online) {
    badge.className = "text-[11px] px-2.5 py-1 rounded-full border flex items-center gap-1.5 bg-emerald-950/70 text-emerald-300 border-emerald-700/60";
    dot.className = "w-2 h-2 rounded-full bg-emerald-400";
    text.textContent = "Çevrimiçi";
  } else {
    badge.className = "text-[11px] px-2.5 py-1 rounded-full border flex items-center gap-1.5 bg-rose-950/70 text-rose-300 border-rose-700/60";
    dot.className = "w-2 h-2 rounded-full bg-rose-400";
    text.textContent = "Çevrimdışı";
  }
}

window.addEventListener("online", updateNetworkStatus);
window.addEventListener("offline", updateNetworkStatus);

function updateBadges(key) {
  const badge = document.getElementById("modeBadge");
  const activeKey = (key ?? localStorage.getItem(STORAGE_KEYS.apiKey) ?? "").trim();
  if (badge) {
    if (activeKey.length > 10) {
      badge.textContent = "Canlı Gemini API Aktif";
      badge.className = "text-[11px] text-emerald-400 truncate mt-0.5";
    } else {
      badge.textContent = "Demo Modu (Ayarlardan API Anahtarı Ekleyin)";
      badge.className = "text-[11px] text-amber-400 truncate mt-0.5";
    }
  }
  const scoreEl = document.getElementById("scoreBadge");
  if (scoreEl) scoreEl.textContent = `${stats.correct} / ${stats.total}`;
}

function renderTopicStats() {
  const el = document.getElementById("topicStatsList");
  if (!el) return;
  const entries = Object.entries(stats.byTopic || {});
  if (!entries.length) {
    el.textContent = "Henüz soru çözülmedi. Soru çözdükçe mevzuat bazlı doğru/yanlış dağılımı burada görünecek.";
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
  if (!listEl || !filterEl) return;
  const currentFilter = filterEl.value || "ALL";
  const topics = ["ALL", ...new Set(mistakes.map((m) => m.topic))];
  filterEl.innerHTML = topics.map((t) => `<option value="${escapeAttr(t)}">${t === "ALL" ? "Tüm Mevzuatlar" : escapeHtml(t)}</option>`).join("");
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
        <button onclick="removeMistake(${realIndex})" type="button" class="text-xs text-emerald-700 font-semibold hover:underline">Tekrar Çözdüm / Sil</button>
      </div>
      <p class="font-medium text-slate-900">${escapeHtml(m.question)}</p>
      <p class="text-xs text-slate-600"><strong>Doğru Cevap:</strong> ${escapeHtml(m.correctOption || "")}</p>
      <p class="text-xs text-slate-700">${escapeHtml(m.explanation || "")}</p>
      <textarea rows="2" placeholder="Kendi kısa notunuz veya mevzuat/tebliğ notu..."
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
window.updateMistakeNote = updateMistakeNote;

function removeMistake(index) {
  mistakes.splice(index, 1);
  saveAllState();
  renderMistakes();
}
window.removeMistake = removeMistake;

function renderQuestion(q) {
  currentQuestion = q;
  selectedOptionIndex = null;
  const qTextEl = document.getElementById("questionText");
  if (qTextEl) qTextEl.textContent = q.question;
  const fb = document.getElementById("feedbackBox");
  if (fb) {
    fb.classList.add("hidden");
    fb.innerHTML = "";
  }

  const container = document.getElementById("optionsContainer");
  if (!container) return;
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
  const mins = parseInt(document.getElementById("timerMinutes")?.value || "0", 10);
  const display = document.getElementById("timerDisplay");
  if (!display) return;
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

function buildStrictTaxAdvisorInstruction() {
  const lawText = (localStorage.getItem(STORAGE_KEYS.lawText) || "").trim();
  const activeTopic = (document.getElementById("topicInput")?.value || "").trim();
  const catLabel = CATEGORY_LABELS[activeCategory] || "Kanunlar";
  const todayStr = new Date().toLocaleDateString("tr-TR");

  const honestyGuardrail = [
    "KESİN DOĞRULUK VE UYDURMAMA KURALI:",
    "- Asla kanun/tebliğ/özelge/sirküler/yönetmelik numarası, madde, oran, tutar veya süre uydurma; emin olmadığın hiçbir bilgiyi kesinmiş gibi sunma.",
    "- Mevzuat Havuzu'nda kaynak metin verilmişse öncelikle o metindeki hükümlere sadık kal; metinde yer almayan veya belirsiz kalan noktalarda 'Mevzuat Havuzu'nda yer almıyor / teyit edilmelidir' diye açıkça belirt.",
    "- Güncel/dönemsel tutar, had, oran veya sonradan değişmiş olabilecek düzenlemeler konusunda tam kesinlik yoksa veya güncel Resmî Gazete/GİB teyidi gerekiyorsa tahmin yürütme; ilgili mevzuat mantığını açıklayıp güncel teyit gerektirdiğini net yaz.",
    `- Bugünün tarihi: ${todayStr}. Aktif mevzuat bölümü: ${catLabel} | Seçili başlık: ${activeTopic || "Belirtilmedi"}.`
  ].join("\n");

  if (lawText) {
    return `Sen Türk vergi mevzuatı alanında çalışan kıdemli bir danışman ve çalışma rehberisin.\n${honestyGuardrail}\n\nÖNCELİKLİ MEVZUAT KAYNAĞI:\n${lawText}\n\n`;
  }
  return `Sen Türk vergi mevzuatı alanında çalışan kıdemli bir danışman ve çalışma rehberisin.\n${honestyGuardrail}\n\n`;
}

async function callGemini(promptText, expectJson = false, customPrefix = "") {
  const apiKey = (localStorage.getItem(STORAGE_KEYS.apiKey) || "").trim();
  const model = localStorage.getItem(STORAGE_KEYS.model) || "gemini-3.8-flash";
  if (!apiKey) throw new Error("API anahtarı kayıtlı değil. Ayarlar sekmesinden ekleyin.");

  const prefix = customPrefix || buildStrictTaxAdvisorInstruction();
  const body = {
    contents: [{ role: "user", parts: [{ text: prefix + promptText }] }]
  };
  if (expectJson) {
    body.generationConfig = { responseMimeType: "application/json" };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `HTTP ${res.status}`);
  }
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || "").join("\n").trim();
}

function parseJsonLoose(raw) {
  let cleaned = String(raw || "")
    .replace(/```json|```/gi, "")
    .replace(/[“”]/g, '"')
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model geçerli JSON döndürmedi. Tekrar deneyin.");
  }

  cleaned = cleaned.slice(start, end + 1).replace(/,\s*([}\]])/g, "$1");
  try {
    return JSON.parse(cleaned);
  } catch {
    const sanitized = cleaned.replace(/[\u0000-\u001F]+/g, " ");
    return JSON.parse(sanitized);
  }
}

async function generateLessonAndQuestion(onlyQuestion = false) {
  const topicInput = document.getElementById("topicInput");
  const autoRandom = document.getElementById("autoRandomOnGenerate")?.checked;
  const catLabel = CATEGORY_LABELS[activeCategory] || "Kanunlar";
  let topic = topicInput ? topicInput.value.trim() : "";

  if (autoRandom && !onlyQuestion) {
    topic = pickRandomGibTopic(topic);
  } else if (!topic) {
    topic = pickRandomGibTopic("");
  }

  const difficulty = document.getElementById("difficultySelect")?.value || "Vaka";
  const btn = document.getElementById(onlyQuestion ? "newQuestionBtn" : "generateBtn");
  const prevText = btn ? btn.textContent : "";
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Üretiliyor...";
  }

  try {
    const prompt = `Kaynak bağlam: gib.gov.tr mevzuatı | Mevzuat Bölümü: "${catLabel}" | Seçili Başlık: "${topic}" | Zorluk: "${difficulty}".
Bu bölüm ve başlık kapsamından önemli bir konu veya vaka seçerek konu özeti, kritik ayrım ve 4 şıklı çoktan seçmeli soru üret. Uydurma numara, madde veya oran kullanma; Mevzuat Havuzu metni varsa ona dayan.
Yalnızca şu şemada tek bir JSON nesnesi döndür (iç metinlerde çift tırnak yerine tek tırnak kullan):
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
    const text = await callGemini(prompt, true);
    const parsed = parseJsonLoose(text);

    if (!onlyQuestion) {
      const titleEl = document.getElementById("lessonTitle");
      const sumEl = document
