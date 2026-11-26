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

window.__memStore = window.__memStore || {};

function safeGetStorage(key, fallback = "") {
  try {
    const val = window.localStorage.getItem(key);
    if (val !== null) {
      window.__memStore[key] = val;
      return val;
    }
  } catch {
    // Bellek yedeğine düş
  }
  return Object.prototype.hasOwnProperty.call(window.__memStore, key)
    ? window.__memStore[key]
    : fallback;
}

function safeSetStorage(key, value) {
  const strVal = String(value ?? "");
  window.__memStore[key] = strVal;
  try {
    window.localStorage.setItem(key, strVal);
    return { ok: true, persisted: true };
  } catch {
    return { ok: true, persisted: false };
  }
}

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
  if (typeof window.__coreSwitchTab === "function") {
    window.__coreSwitchTab(tab);
    return;
  }
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
}
window.switchTab = switchTab;

document.addEventListener("vergi:tabchanged", (e) => {
  const tab = e.detail?.tab;
  if (tab === "hatalar") renderMistakes();
  if (tab === "konu") renderTopicStats();
});

function loadStoredState() {
  try {
    stats = JSON.parse(safeGetStorage(STORAGE_KEYS.stats, '{"correct":0,"total":0,"byTopic":{}}'));
  } catch {
    stats = { correct: 0, total: 0, byTopic: {} };
  }
  try {
    mistakes = JSON.parse(safeGetStorage(STORAGE_KEYS.mistakes, "[]"));
    if (!Array.isArray(mistakes)) mistakes = [];
  } catch {
    mistakes = [];
  }
}

if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

function cleanMarkdownAndUrls(text) {
  return String(text || "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/[_next\/static\/media\/\S]+/gi, " ")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/[*_`~]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isNoisyScrapedItem(line) {
  const lower = String(line || "").toLocaleLowerCase("tr");
  if (!line || line.length < 8 || line.length > 165) return true;
  if (
    lower.includes("son gün ") ||
    lower.includes("vergi-takvimi") ||
    lower.includes("selecteddate=") ||
    lower.includes("image ") ||
    lower.includes("_next/static") ||
    lower.includes("en güncel vergi kanunlarına bu alandan") ||
    lower.includes("çerez") ||
    lower.includes("cookie") ||
    lower.includes("telif") ||
    lower.includes("gizlilik politikası")
  ) {
    return true;
  }
  return false;
}

function inferCategoryFromLine(line, fallbackCategory = null) {
  const lower = String(line || "").toLocaleLowerCase("tr");
  if (lower.includes("yönetmelik") || lower.includes("yonetmelik")) return "yonetmelikler";
  if (lower.includes("sirküler") || lower.includes("sirkuler")) return "sirkulerler";
  if (lower.includes("özelge") || lower.includes("ozelge")) return "ozelgeler";
  if (lower.includes("tebliğ") || lower.includes("teblig")) return "tebligler";
  if (lower.includes("kanun")) return "kanunlar";
  return fallbackCategory;
}

function extractItemsFromPoolText(rawText, defaultCategory = null) {
  const buckets = {
    kanunlar: [],
    tebligler: [],
    ozelgeler: [],
    sirkulerler: [],
    yonetmelikler: []
  };

  let currentSectionCategory = defaultCategory;
  const rawLines = String(rawText || "").split(/\r?\n/);

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("--- Kaynak:")) {
      currentSectionCategory = inferCategoryFromLine(trimmed, defaultCategory);
      continue;
    }

    const cleaned = cleanMarkdownAndUrls(trimmed)
      .replace(/^[\s\-*•▪▸►◦·\d.)]+/, "")
      .trim();

    if (isNoisyScrapedItem(cleaned)) continue;

    const headingCat = inferCategoryFromLine(cleaned, null);
    if (headingCat && cleaned.length <= 120) {
      currentSectionCategory = headingCat;
    }

    const targetCat = headingCat || currentSectionCategory;
    if (!targetCat || !buckets[targetCat]) continue;

    const hasRelevantKeyword =
      /\b\d{3,4}\s*sayılı/i.test(cleaned) ||
      /(kanun|tebliğ|teblig|özelge|ozelge|sirküler|sirkuler|yönetmelik|yonetmelik|madde|m\.|kdv|kvk|vuk|gvk)/i.test(cleaned);

    if (!hasRelevantKeyword) continue;

    if (!buckets[targetCat].includes(cleaned)) {
      buckets[targetCat].push(cleaned);
    }
  }

  return buckets;
}

function getCategoryPool(category = activeCategory) {
  const base = MEVZUAT_BY_CATEGORY[category] || MEVZUAT_BY_CATEGORY.kanunlar;
  const lawText = safeGetStorage(STORAGE_KEYS.lawText, "");
  const extra = (extractItemsFromPoolText(lawText)[category] || []).filter(
    (item) => !base.some((b) => b.toLocaleLowerCase("tr") === item.toLocaleLowerCase("tr"))
  );
  return [...base, ...extra];
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
    badge.style.background = "#eef2ff";
    badge.style.color = "#4338ca";
  } else {
    badge.textContent = "Manuel Seçim";
    badge.style.background = "#0f172a";
    badge.style.color = "#ffffff";
  }
}

function applyChosenTopicFromList(chosen) {
  const clean = String(chosen || "").trim();
  if (!clean) return;
  const tInput = document.getElementById("topicInput");
  if (tInput) {
    tInput.value = clean;
    tInput.dispatchEvent(new Event("input", { bubbles: true }));
  }
  const autoCb = document.getElementById("autoRandomOnGenerate");
  if (autoCb) autoCb.checked = false;
  syncSelectionModeBadge();
  closeLawPickerPanel();
}
window.applyChosenTopicFromList = applyChosenTopicFromList;

function populateGibTopicSelect(selectedTopic = "", filterText = "") {
  const listEl = document.getElementById("gibTopicList");
  if (!listEl) return;
  const pool = getCategoryPool(activeCategory);
  const q = String(filterText || "").trim().toLocaleLowerCase("tr");
  const list = q
    ? pool.filter((item) => item.toLocaleLowerCase("tr").includes(q))
    : pool;

  if (!list.length) {
    listEl.innerHTML = `<div style="padding:10px;font-size:12px;color:#64748b;">Bu bölümde eşleşen kayıt bulunamadı.</div>`;
    return;
  }

  listEl.innerHTML = "";
  list.forEach((item) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = item === selectedTopic ? "law-pick-item is-selected" : "law-pick-item";
    btn.textContent = item;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      applyChosenTopicFromList(item);
    });
    listEl.appendChild(btn);
  });
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
  const savedUrl = (safeGetStorage(STORAGE_KEYS.lawUrl, "") || document.getElementById("lawUrlInput")?.value || "").trim();
  if (savedUrl) {
    await fetchTextFromUrl(savedUrl);
    return;
  }
  const lawText = safeGetStorage(STORAGE_KEYS.lawText, "");
  const buckets = extractItemsFromPoolText(lawText);
  syncCategoryUi();
  populateGibTopicSelect(
    document.getElementById("topicInput")?.value.trim() || "",
    document.getElementById("lawSearchInput")?.value || ""
  );
  setLawStatus(
    `Havuz tarandı: Kanun (${buckets.kanunlar.length}), Tebliğ (${buckets.tebligler.length}), Özelge (${buckets.ozelgeler.length}), Sirküler (${buckets.sirkulerler.length}), Yönetmelik (${buckets.yonetmelikler.length}).`
  );
}
window.syncPoolToActiveCategory = syncPoolToActiveCategory;

function saveAllState() {
  safeSetStorage(STORAGE_KEYS.stats, JSON.stringify(stats));
  safeSetStorage(STORAGE_KEYS.mistakes, JSON.stringify(mistakes));
}

function setLawStatus(msg, isError = false) {
  const el = document.getElementById("lawSourceStatus");
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? "#e11d48" : "#047857";
  el.style.fontWeight = "600";
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
  safeSetStorage(STORAGE_KEYS.lawText, merged);
  const buckets = extractItemsFromPoolText(merged);
  syncCategoryUi();
  populateGibTopicSelect(
    document.getElementById("topicInput")?.value.trim() || "",
    document.getElementById("lawSearchInput")?.value || ""
  );
  setLawStatus(
    `"${sourceLabel}" aktarıldı${trimmedNote} — Kanun: ${buckets.kanunlar.length}, Tebliğ: ${buckets.tebligler.length}, Özelge: ${buckets.ozelgeler.length}, Sirküler: ${buckets.sirkulerler.length}, Yönetmelik: ${buckets.yonetmelikler.length}.`
  );
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

  safeSetStorage(STORAGE_KEYS.lawUrl, url);
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
    badge.style.background = "rgba(6, 78, 59, 0.7)";
    badge.style.color = "#6ee7b7";
    if (dot) dot.style.background = "#34d399";
    if (text) text.textContent = "Çevrimiçi";
  } else {
    badge.style.background = "rgba(127, 29, 29, 0.75)";
    badge.style.color = "#fca5a5";
    if (dot) dot.style.background = "#f87171";
    if (text) text.textContent = "Çevrimdışı";
  }
}

window.addEventListener("online", updateNetworkStatus);
window.addEventListener("offline", updateNetworkStatus);

function updateBadges(key) {
  const badge = document.getElementById("modeBadge");
  const activeKey = (key ?? safeGetStorage(STORAGE_KEYS.apiKey, "") ?? "").trim();
  if (badge) {
    if (activeKey.length > 8) {
      badge.textContent = "Canlı Gemini API Aktif";
      badge.style.color = "#34d399";
    } else {
      badge.textContent = "Demo Modu (Ayarlardan API Anahtarı Ekleyin)";
      badge.style.color = "#fbbf24";
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
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;gap:8px;">
      <span style="font-weight:600;color:#0f172a;">${escapeHtml(topic)}</span>
      <span style="font-size:12px;color:#475569;">${d.correct}/${d.total} (%${rate})</span>
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
    return `<div style="border:1px solid #fecdd3;background:#fff1f2;border-radius:12px;padding:12px;margin-bottom:10px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;">
        <span style="font-size:12px;font-weight:700;color:#9f1239;">${escapeHtml(m.topic)}</span>
        <button onclick="removeMistake(${realIndex})" type="button" style="border:0;background:transparent;font-size:12px;color:#047857;font-weight:700;cursor:pointer;">Tekrar Çözdüm / Sil</button>
      </div>
      <p style="margin:0 0 6px;font-weight:600;color:#0f172a;">${escapeHtml(m.question)}</p>
      <p style="margin:0 0 4px;font-size:12px;color:#334155;"><strong>Doğru Cevap:</strong> ${escapeHtml(m.correctOption || "")}</p>
      <p style="margin:0 0 8px;font-size:12px;color:#475569;">${escapeHtml(m.explanation || "")}</p>
      <textarea rows="2" placeholder="Kendi kısa notunuz..." onchange="updateMistakeNote(${realIndex}, this.value)">${escapeHtml(m.note || "")}</textarea>
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
    btn.style.cssText = "width:100%;text-align:left;border:1px solid #cbd5e1;background:#fff;border-radius:12px;padding:12px 14px;font-size:13px;cursor:pointer;";
    btn.textContent = opt;
    btn.onclick = () => {
      selectedOptionIndex = idx;
      [...container.children].forEach((c, i) => {
        c.style.border = i === idx ? "2px solid #4f46e5" : "1px solid #cbd5e1";
        c.style.background = i === idx ? "#eef2ff" : "#fff";
        c.style.fontWeight = i === idx ? "600" : "400";
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
  const lawText = safeGetStorage(STORAGE_KEYS.lawText, "").trim();
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
  const apiKey = safeGetStorage(STORAGE_KEYS.apiKey, "").trim();
  const model = safeGetStorage(STORAGE_KEYS.model, "gemini-3.8-flash");
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
      const sumEl = document.getElementById("lessonSummary");
      const critEl = document.getElementById("lessonCritical");
      const basisEl = document.getElementById("lessonBasis");
      if (titleEl) titleEl.textContent = parsed.lessonTitle || topic;
      if (sumEl) sumEl.textContent = parsed.lessonSummary || "";
      if (critEl) critEl.innerHTML = `<strong>Kritik Ayrım:</strong> ${escapeHtml(parsed.lessonCritical || "")}`;
      if (basisEl) basisEl.textContent = `Dayanak (${catLabel}): ${parsed.lessonBasis || topic}`;
    }

    const opts = Array.isArray(parsed.options) && parsed.options.length >= 2
      ? parsed.options.slice(0, 4)
      : ["A) Seçenek 1", "B) Seçenek 2", "C) Seçenek 3", "D) Seçenek 4"];

    renderQuestion({
      topic: `${catLabel} — ${topic}`,
      question: parsed.question || `${topic} kapsamındaki vaka sorusu`,
      options: opts,
      answerIndex: Math.min(Math.max(Number(parsed.answerIndex) || 0, 0), opts.length - 1),
      explanation: parsed.explanation || ""
    });

    if (onlyQuestion) switchTab("soru");
  } catch (err) {
    alert("Hata: " + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = prevText;
    }
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
  if (box) box.classList.remove("hidden");

  if (isCorrect) {
    stats.correct += 1;
    stats.byTopic[currentQuestion.topic].correct += 1;
    if (box) {
      box.style.cssText = "border-radius:12px;padding:14px;font-size:13px;background:#ecfdf5;border:1px solid #a7f3d0;color:#064e3b;";
      box.innerHTML = `<p style="margin:0 0 6px;font-weight:700;">Doğru Yanıt!</p><p style="margin:0;">${escapeHtml(currentQuestion.explanation)}</p>`;
    }
  } else {
    if (box) {
      box.style.cssText = "border-radius:12px;padding:14px;font-size:13px;background:#fff1f2;border:1px solid #fecdd3;color:#881337;";
      box.innerHTML = `<p style="margin:0 0 6px;font-weight:700;">Yanlış Yanıt — Doğru Seçenek: ${escapeHtml(currentQuestion.options[currentQuestion.answerIndex] || "")}</p><p style="margin:0;">${escapeHtml(currentQuestion.explanation)}</p>`;
    }
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

function appendUserChatMessage(text) {
  const wrap = document.getElementById("chatMessages");
  if (!wrap) return;
  const div = document.createElement("div");
  div.style.cssText = "background:#020617;color:#fff;border-radius:14px;padding:12px 14px;font-size:13px;margin-left:28px;";
  div.textContent = text;
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
}

function createAssistantChatCard() {
  const wrap = document.getElementById("chatMessages");
  const card = document.createElement("div");
  card.style.cssText = "border:1px solid #e2e8f0;background:#fff;border-radius:14px;padding:14px;font-size:13px;color:#1e293b;margin-right:16px;";
  card.innerHTML = `<p style="margin:0;font-size:12px;color:#64748b;">Mevzuat bağlantıları ve yorum hazırlanıyor...</p>`;
  if (wrap) {
    wrap.appendChild(card);
    wrap.scrollTop = wrap.scrollHeight;
  }
  return card;
}

function renderStructuredAdvisorCard(card, data) {
  const bulletsHtml = (items) => {
    const arr = Array.isArray(items) && items.length ? items : ["Bu başlık için ayrıca teyit edilmesi gereken özel bir bağlantı belirtilmemiştir."];
    return `<ul style="margin:4px 0 0;padding-left:18px;font-size:12px;color:#334155;line-height:1.5;">${arr.map((i) => `<li style="margin-bottom:4px;">${escapeHtml(i)}</li>`).join("")}</ul>`;
  };

  const cautionBlock = data.caution
    ? `<div style="margin-top:10px;border:1px solid #fde68a;background:#fffbeb;border-radius:10px;padding:10px;font-size:12px;color:#451a03;">
         <strong>Teyit / Sınır Notu:</strong> ${escapeHtml(data.caution)}
       </div>`
    : "";

  card.innerHTML = `
    <div style="margin-bottom:8px;">
      <strong style="font-size:12px;text-transform:uppercase;color:#0f172a;">1. Mevzuat Yorumu</strong>
      <p style="margin:4px 0 0;font-size:12px;color:#334155;line-height:1.55;white-space:pre-line;">${escapeHtml(data.comment || "")}</p>
    </div>
    <div style="margin-top:8px;padding-top:8px;border-top:1px solid #f1f5f9;">
      <strong style="font-size:12px;text-transform:uppercase;color:#0f172a;">2. Kanunlar Arası Bağlantılar</strong>
      ${bulletsHtml(data.crossLawLinks)}
    </div>
    <div style="margin-top:8px;padding-top:8px;border-top:1px solid #f1f5f9;">
      <strong style="font-size:12px;text-transform:uppercase;color:#0f172a;">3. Sizi Yönlendiren Adımlar</strong>
      ${bulletsHtml(data.guidance)}
    </div>
    ${cautionBlock}
  `;
}

async function handleChatSend(overrideQuestion = "") {
  const input = document.getElementById("chatInput");
  const q = String(overrideQuestion || (input ? input.value : "") || "").trim();
  if (!q) return;
  if (!overrideQuestion && input) input.value = "";

  appendUserChatMessage(q);
  const card = createAssistantChatCard();
  const wrap = document.getElementById("chatMessages");
  if (wrap) wrap.scrollTop = wrap.scrollHeight;

  const advisorPrompt = `Kullanıcı sorusu / vakası: "${q}"

Görevlerin:
1. "comment": Mevzuat yorumu yap. Kesin hükümleri net açıkla; uydurma numara, madde, oran/tutar veya kesin olmayan yargı üretme.
2. "crossLawLinks": İlgili kanunlar, tebliğler, yönetmelikler veya tahsil/usul hükümleri arasındaki somut bağlantıları madde/kavram düzeyinde listele (yalnızca gerçek ve emin olunan bağlantıları yaz).
3. "guidance": Kullanıcıyı bir sonraki adımda neyi kontrol etmesi, hangi ayrımı netleştirmesi veya hangi kaynağı incelemesi gerektiği konusunda somut ve yönlendirici maddelerle yönlendir.
4. "caution": Eğer soruda güncel/dönemsel had-oran-tebliğ teyidi gerekiyorsa, Mevzuat Havuzu'nda kaynak eksikse veya belirsizlik varsa bunu açıkça yaz; her şey netse boş bırak "".

Yalnızca şu JSON şemasında yanıt ver (iç metinlerde çift tırnak yerine tek tırnak kullan):
{
  "comment": "...",
  "crossLawLinks": ["...", "..."],
  "guidance": ["...", "..."],
  "caution": "..."
}`;

  try {
    const raw = await callGemini(advisorPrompt, true);
    const parsed = parseJsonLoose(raw);
    renderStructuredAdvisorCard(card, parsed);
  } catch (err) {
    card.innerHTML = `<p style="margin:0;font-size:12px;color:#9f1239;"><strong>Hata:</strong> ${escapeHtml(err.message)}</p>`;
  } finally {
    if (wrap) wrap.scrollTop = wrap.scrollHeight;
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

document.addEventListener("click", (e) => {
  const catBtn = e.target.closest(".law-cat-btn");
  if (catBtn) {
    e.preventDefault();
    selectCategoryFromUi(catBtn.dataset.category || "kanunlar");
    return;
  }

  const quickBtn = e.target.closest(".chat-quick-btn");
  if (quickBtn) {
    e.preventDefault();
    const prompt = quickBtn.dataset.prompt || "";
    if (prompt) handleChatSend(prompt);
    return;
  }

  const presetBtn = e.target.closest(".preset-btn");
  if (presetBtn) {
    e.preventDefault();
    const text = PRESETS[presetBtn.dataset.preset] || "";
    const ta = document.getElementById("lawTextInput");
    if (ta) ta.value = ta.value ? `${ta.value}\n\n${text}` : text;
  }
});

function handleSaveSettings() {
  const apiInput = document.getElementById("apiKeyInput");
  const modelSel = document.getElementById("modelSelect");
  const st = document.getElementById("settingsStatus");

  const rawKey = apiInput ? apiInput.value.trim() : "";
  const model = modelSel ? modelSel.value : "gemini-3.8-flash";

  const resKey = safeSetStorage(STORAGE_KEYS.apiKey, rawKey);
  safeSetStorage(STORAGE_KEYS.model, model);
  updateBadges(rawKey);

  if (st) {
    st.classList.remove("hidden");
    if (!rawKey) {
      st.style.color = "#b45309";
      st.textContent = "API anahtarı alanı boş bırakıldı; model ayarı kaydedildi.";
    } else if (resKey.persisted) {
      st.style.color = "#047857";
      st.textContent = `API anahtarı ve model (${model}) cihaza kaydedildi.`;
    } else {
      st.style.color = "#b45309";
      st.textContent = "Tarayıcı kalıcı depolaması kısıtlı; oturum süresince aktif olarak kaydedildi.";
    }
    clearTimeout(window.__settingsTimer);
    window.__settingsTimer = setTimeout(() => st.classList.add("hidden"), 3500);
  }
}

function bindDirectListeners() {
  const searchInput = document.getElementById("lawSearchInput");
  if (searchInput) {
    searchInput.oninput = (e) => {
      populateGibTopicSelect(document.getElementById("topicInput")?.value.trim() || "", e.target.value);
    };
  }

  const autoRandomEl = document.getElementById("autoRandomOnGenerate");
  if (autoRandomEl) autoRandomEl.onchange = syncSelectionModeBadge;

  const saveSettingsBtn = document.getElementById("saveSettingsBtn");
  if (saveSettingsBtn) {
    saveSettingsBtn.onclick = handleSaveSettings;
  }

  const apiKeyInput = document.getElementById("apiKeyInput");
  if (apiKeyInput) {
    apiKeyInput.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSaveSettings();
      }
    };
  }

  const saveLawBtn = document.getElementById("saveLawBtn");
  if (saveLawBtn) {
    saveLawBtn.onclick = () => {
      const law = document.getElementById("lawTextInput")?.value.trim() || "";
      safeSetStorage(STORAGE_KEYS.lawText, law);
      syncCategoryUi();
      populateGibTopicSelect(
        document.getElementById("topicInput")?.value.trim() || "",
        document.getElementById("lawSearchInput")?.value || ""
      );
      setLawStatus("Mevzuat metni kaydedildi ve bölümlere işlendi.");
    };
  }

  const fetchUrlBtn = document.getElementById("fetchUrlBtn");
  if (fetchUrlBtn) {
    fetchUrlBtn.onclick = () => fetchTextFromUrl(document.getElementById("lawUrlInput")?.value || "");
  }

  const pdfFileInput = document.getElementById("pdfFileInput");
  if (pdfFileInput) {
    pdfFileInput.onchange = (e) => {
      const file = e.target.files?.[0];
      extractTextFromPdfFile(file);
      e.target.value = "";
    };
  }

  const generateBtn = document.getElementById("generateBtn");
  if (generateBtn) generateBtn.onclick = () => generateLessonAndQuestion(false);

  const newQuestionBtn = document.getElementById("newQuestionBtn");
  if (newQuestionBtn) newQuestionBtn.onclick = () => generateLessonAndQuestion(true);

  const wrongQuizBtn = document.getElementById("wrongQuizBtn");
  if (wrongQuizBtn) wrongQuizBtn.onclick = startWrongQuiz;

  const checkAnswerBtn = document.getElementById("checkAnswerBtn");
  if (checkAnswerBtn) checkAnswerBtn.onclick = checkAnswer;

  const sendChatBtn = document.getElementById("sendChatBtn");
  if (sendChatBtn) sendChatBtn.onclick = () => handleChatSend();

  const chatInput = document.getElementById("chatInput");
  if (chatInput) {
    chatInput.onkeydown = (e) => { if (e.key === "Enter") handleChatSend(); };
  }

  const clearChatBtn = document.getElementById("clearChatBtn");
  if (clearChatBtn) {
    clearChatBtn.onclick = () => {
      const wrap = document.getElementById("chatMessages");
      if (wrap) {
        wrap.innerHTML = `<div style="border:1px solid #e2e8f0;background:#f8fafc;border-radius:14px;padding:12px;font-size:13px;color:#334155;">Sohbet temizlendi.</div>`;
      }
    };
  }

  const mistakeFilter = document.getElementById("mistakeFilter");
  if (mistakeFilter) mistakeFilter.onchange = renderMistakes;

  const clearMistakesBtn = document.getElementById("clearMistakesBtn");
  if (clearMistakesBtn) {
    clearMistakesBtn.onclick = () => {
      mistakes = [];
      saveAllState();
      renderMistakes();
    };
  }

  const resetStatsBtn = document.getElementById("resetStatsBtn");
  if (resetStatsBtn) {
    resetStatsBtn.onclick = () => {
      stats = { correct: 0, total: 0, byTopic: {} };
      saveAllState();
      updateBadges();
      renderTopicStats();
    };
  }

  const exportBackupBtn = document.getElementById("exportBackupBtn");
  if (exportBackupBtn) {
    exportBackupBtn.onclick = () => {
      const payload = {
        exportedAt: new Date().toISOString(),
        stats,
        mistakes,
        lawText: safeGetStorage(STORAGE_KEYS.lawText, ""),
        lawUrl: safeGetStorage(STORAGE_KEYS.lawUrl, "")
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "vergi-asistani-yedek.json";
      a.click();
      URL.revokeObjectURL(url);
    };
  }

  const importBackupInput = document.getElementById("importBackupInput");
  if (importBackupInput) {
    importBackupInput.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(String(reader.result || "{}"));
          if (data.stats) stats = data.stats;
          if (Array.isArray(data.mistakes)) mistakes = data.mistakes;
          if (typeof data.lawText === "string") {
            safeSetStorage(STORAGE_KEYS.lawText, data.lawText);
            const lawTa = document.getElementById("lawTextInput");
            if (lawTa) lawTa.value = data.lawText;
          }
          if (typeof data.lawUrl === "string") {
            safeSetStorage(STORAGE_KEYS.lawUrl, data.lawUrl);
            const urlEl = document.getElementById("lawUrlInput");
            if (urlEl) urlEl.value = data.lawUrl;
          }
          saveAllState();
          updateBadges();
          renderTopicStats();
          renderMistakes();
          syncCategoryUi();
          populateGibTopicSelect(document.getElementById("topicInput")?.value.trim() || "", "");
          alert("Yedek başarıyla geri yüklendi.");
        } catch {
          alert("Geçersiz JSON yedek dosyası.");
        }
      };
      reader.readAsText(file);
    };
  }
}

function initApp() {
  try {
    loadStoredState();
    bindDirectListeners();

    const apiInput = document.getElementById("apiKeyInput");
    if (apiInput) apiInput.value = safeGetStorage(STORAGE_KEYS.apiKey, "");

    const savedModel = safeGetStorage(STORAGE_KEYS.model, "");
    const modelSel = document.getElementById("modelSelect");
    if (savedModel && modelSel && [...modelSel.options].some((o) => o.value === savedModel)) {
      modelSel.value = savedModel;
    }

    const lawTa = document.getElementById("lawTextInput");
    if (lawTa) lawTa.value = safeGetStorage(STORAGE_KEYS.lawText, "");

    const lawUrlInput = document.getElementById("lawUrlInput");
    if (lawUrlInput) lawUrlInput.value = safeGetStorage(STORAGE_KEYS.lawUrl, "");

    syncCategoryUi();
    populateGibTopicSelect("", "");
    syncSelectionModeBadge();

    updateNetworkStatus();
    updateBadges();
    renderTopicStats();
    renderMistakes();
    renderQuestion(currentQuestion);
  } catch (err) {
    console.error("initApp hatası:", err);
  }

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
    }).catch(() => {});

    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}

function showUpdateBanner(worker) {
  const banner = document.getElementById("updateBanner");
  if (!banner) return;
  banner.classList.remove("hidden");
  const reloadBtn = document.getElementById("reloadUpdateBtn");
  if (reloadBtn) {
    reloadBtn.onclick = () => {
      worker.postMessage({ type: "SKIP_WAITING" });
    };
  }
}
