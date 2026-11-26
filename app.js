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
  "193 sayılı Gelir Vergisi Kanunu - Serbest Meslek Kazançları ve Stopaj Uygulaması (GVK m. 65-68, 94)",
  "193 sayılı Gelir Vergisi Kanunu - Gayrimenkul Sermaye İradı İstisnası ve Götürü Gider (GVK m. 21, 70, 74)",
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
  topic: GIB_MEVZUAT_POOL[3],
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

function pickRandomGibTopic(currentValue = "") {
  const candidates = GIB_MEVZUAT_POOL.filter((item) => item !== currentValue);
  const pool = candidates.length ? candidates : GIB_MEVZUAT_POOL;
  const chosen = pool[Math.floor(Math.random() * pool.length)];
  const input = document.getElementById("topicInput");
  if (input) input.value = chosen;
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
        extracted = ct.includes("text/html") || /<html[\s>]/i.test(body) ? htmlToPlainText(body
