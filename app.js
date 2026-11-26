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

function switchTab(tab) {
  const target = ALL_TABS.includes(tab) ? tab : "konu";
  ALL_TABS.forEach((t) => {
    const sec = document.getElementById("tab-" + t);
    if (sec) sec.classList.toggle("hidden", t !== target);
    const nav = document.getElementById("nav-" + t);
    if (nav) {
      nav.className = t === target
        ? "flex flex-col items-center text-[11px] font-bold text-slate-900"
        : "flex flex-col items-center text-[11px] font-medium text-slate-400";
    }
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (target === "hatalar") renderMistakes();
  if (target === "konu") renderTopicStats();
}
window.switchTab = switchTab;

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
    badge.className = "text-[11px] px-2.5 py-1 rounded-full border flex items-center gap-1.5 bg-rose-950/70 text-rose
