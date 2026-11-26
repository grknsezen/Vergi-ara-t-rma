const ALL_TABS = ["konu", "soru", "chat", "hata", "ayar"];  
const DEFAULT_TOPIC = "Kurumlar Vergisi - İştirak Kazançları İstisnası (KVK m.5/1-a)";  
  
let currentTopic = DEFAULT_TOPIC;  
let currentQuiz = {  
  topic: DEFAULT_TOPIC,  
  fromErrorBookId: null,  
  question: "Tam mükellef (A) A.Ş., %15 oranında iştirak ettiği tam mükellef (B) Ltd. Şti.’nden 2026 yılında 1.000.000 TL kâr payı elde etmiştir. (A) A.Ş. bu iştirak hisselerini 6 aydır aktifinde tutmaktadır. Kurumlar vergisi istisnası açısından doğru değerlendirme hangisidir?",  
  options: [  
    "İstisnadan yararlanılamaz; en az 2 tam yıl aktifte tutulma şartı vardır.",  
    "İstisnadan tam olarak yararlanılır; iştirak oranına ve elde tutma süresine bakılmaz.",  
    "İştirak oranı %25'in altında olduğu için yalnızca %50 istisna uygulanır.",  
    "Sadece anonim şirketlerden alınan kâr payları istisna kapsamındadır."  
  ],  
  correctIndex: 1,  
  explanation: "KVK m. 5/1-a uyarınca tam mükellef kurumlardan elde edilen iştirak kazançları istisnası için asgari iştirak oranı veya aktifte elde tutma süresi şartı aranmaz (2 yıl şartı iştirak hissesi satış kazancı istisnası olan m. 5/1-e içindir)."  
};  
  
let selectedOption = null;  
let stats = JSON.parse(localStorage.getItem("vergi_stats") || '{"correct":0,"total":0}');  
let errorBook = JSON.parse(localStorage.getItem("vergi_error_book") || "[]");  
let topicStats = JSON.parse(localStorage.getItem("vergi_topic_stats") || "{}");  
  
function init() {  
  const key = localStorage.getItem("gemini_key") || "";  
  const model = localStorage.getItem("gemini_model") || "gemini-4-hydrogen";  
  const law = localStorage.getItem("vergi_law") || "";  
  const savedLesson = JSON.parse(localStorage.getItem("vergi_last_lesson") || "null");  
  
  document.getElementById("apiKeyInput").value = key;  
  document.getElementById("modelSelect").value = model;  
  document.getElementById("lawContext").value = law;  
  
  if (savedLesson) {  
    if (savedLesson.topic) {  
      currentTopic = savedLesson.topic;  
      document.getElementById("topicInput").value = savedLesson.topic;  
    }  
    if (savedLesson.title) document.getElementById("lessonTitle").textContent = savedLesson.title;  
    if (savedLesson.summary) document.getElementById("lessonBody").textContent = savedLesson.summary;  
    if (savedLesson.question && Array.isArray(savedLesson.options)) {  
      document.getElementById("questionText").textContent = savedLesson.question;  
      currentQuiz = {  
        topic: savedLesson.topic || currentTopic,  
        fromErrorBookId: null,  
        question: savedLesson.question,  
        options: savedLesson.options,  
        correctIndex: savedLesson.correctIndex,  
        explanation: savedLesson.explanation  
      };  
    }  
  }  
  
  updateNetworkStatus();  
  updateBadges(key);  
  renderOptions();  
  renderErrorBook();  
  renderTopicPerformance();  
}  
  
function updateNetworkStatus() {  
  const isOnline = navigator.onLine;  
  const badge = document.getElementById("networkBadge");  
  const dot = document.getElementById("networkDot");  
  const text = document.getElementById("networkText");  
  if (!badge || !dot || !text) return;  
  
  if (isOnline) {  
    badge.className = "text-[11px] px-2 py-1 rounded-full border flex items-center gap-1.5 bg-emerald-950/60 text-emerald-300 border-emerald-700/60";  
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
  if (key && key.trim().length > 10) {  
    badge.textContent = "Canlı Gemini API Aktif";  
    badge.className = "text-[11px] text-emerald-400 truncate";  
  } else {  
    badge.textContent = "Demo Modu (Ayarlardan API Anahtarı Ekleyin)";  
    badge.className = "text-[11px] text-amber-400 truncate";  
  }  
  document.getElementById("scoreBadge").textContent = `Doğru: ${stats.correct} / ${stats.total}`;  
}  
  
function switchTab(tab) {  
  ALL_TABS.forEach((t) => {  
    document.getElementById("tab-" + t).classList.toggle("hidden", t !== tab);  
    const nav = document.getElementById("nav-" + t);  
    nav.className = t === tab  
      ? "flex flex-col items-center text-[11px] font-bold text-slate-900"  
      : "flex flex-col items-center text-[11px] font-medium text-slate-400";  
  });  
}  
  
function saveSettings() {  
  const key = document.getElementById("apiKeyInput").value.trim();  
  const model = document.getElementById("modelSelect").value;  
  localStorage.setItem("gemini_key", key);  
  localStorage.setItem("gemini_model", model);  
  updateBadges(key);  
  alert("Ayarlar kaydedildi.");  
}  
  
function saveLawContext() {  
  localStorage.setItem("vergi_law", document.getElementById("lawContext").value);  
  alert("Mevzuat metni kaydedildi.");  
}  
  
function renderOptions() {  
  const list = document.getElementById("optionsList");  
  const retryTag = document.getElementById("retryTag");  
  list.innerHTML = "";  
  selectedOption = null;  
  retryTag.classList.toggle("hidden", !currentQuiz.fromErrorBookId);  
  
  currentQuiz.options.forEach((opt, idx) => {  
    const btn = document.createElement("button");  
    btn.className = "w-full text-left p-3 rounded-xl border border-slate-200 text-sm bg-slate-50 active:bg-slate-100";  
    btn.textContent = `${["A", "B", "C", "D"][idx]}) ${opt}`;  
    btn.onclick = () => {  
      selectedOption = idx;  
      Array.from(list.children).forEach((c, i) => {  
        c.className = i === idx  
          ? "w-full text-left p-3 rounded-xl border-2 border-indigo-600 text-sm bg-indigo-50 font-medium"  
          : "w-full text-left p-3 rounded-xl border border-slate-200 text-sm bg-slate-50";  
      });  
    };  
    list.appendChild(btn);  
  });  
}  
  
function recordTopicResult(topicName, isCorrect) {  
  const cleanTopic = (topicName || DEFAULT_TOPIC).trim();  
  if (!topicStats[cleanTopic]) {  
    topicStats[cleanTopic] = { correct: 0, wrong: 0 };  
  }  
  if (isCorrect) {  
    topicStats[cleanTopic].correct += 1;  
  } else {  
    topicStats[cleanTopic].wrong += 1;  
  }  
  localStorage.setItem("vergi_topic_stats", JSON.stringify(topicStats));  
  renderTopicPerformance();  
}  
  
function resetTopicStats() {  
  if (!Object.keys(topicStats).length) return;  
  if (!confirm("Konu performans özetini sıfırlamak istiyor musunuz?")) return;  
  topicStats = {};  
  localStorage.setItem("vergi_topic_stats", JSON.stringify(topicStats));  
  renderTopicPerformance();  
}  
  
function renderTopicPerformance() {  
  const container = document.getElementById("topicPerformanceList");  
  if (!container) return;  
  
  const entries = Object.entries(topicStats);  
  if (!entries.length) {  
    container.innerHTML = `<p class="text-xs text-slate-500">Henüz soru çözülmedi. Soru çözdükçe konu bazlı doğru/yanlış dağılımı burada görünecek.</p>`;  
    return;  
  }  
  
  container.innerHTML = "";  
  entries.forEach(([topic, counts]) => {  
    const correct = counts.correct || 0;  
    const wrong = counts.wrong || 0;  
    const total = correct + wrong;  
    const rate = total > 0 ? Math.round((correct / total) * 100) : 0;  
  
    const row = document.createElement("div");  
    row.className = "p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5";  
    row.innerHTML = `  
      <div class="flex items-start justify-between gap-2">  
        <span class="text-xs font-semibold text-slate-800 leading-snug">${topic}</span>  
        <span class="text-[11px] font-bold text-slate-700 shrink-0">%${rate}</span>  
      </div>  
      <div class="flex items-center justify-between text-[11px]">  
        <div class="flex items-center gap-3">  
          <span class="text-emerald-700 font-medium">Doğru: ${correct}</span>  
          <span class="text-rose-600 font-medium">Yanlış: ${wrong}</span>  
        </div>  
        <span class="text-slate-400">Toplam: ${total}</span>  
      </div>  
      <div class="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">  
        <div class="h-full bg-emerald-500" style="width: ${rate}%"></div>  
      </div>  
    `;  
    container.appendChild(row);  
  });  
}  
  
function checkAnswer() {  
  if (selectedOption === null) return alert("Lütfen bir şık seçin.");  
  const box = document.getElementById("explanationBox");  
  const status = document.getElementById("resultStatus");  
  const exp = document.getElementById("explanationText");  
  const isCorrect = selectedOption === currentQuiz.correctIndex;  
  const activeTopic = currentQuiz.topic || currentTopic;  
  
  box.classList.remove("hidden");  
  stats.total += 1;  
  recordTopicResult(activeTopic, isCorrect);  
  
  if (isCorrect) {  
    stats.correct += 1;  
    status.textContent = "✅ Doğru Cevap!";  
    status.className = "text-sm font-bold text-emerald-600";  
  
    if (currentQuiz.fromErrorBookId) {  
      removeErrorQuestion(currentQuiz.fromErrorBookId);  
      currentQuiz.fromErrorBookId = null;  
      document.getElementById("retryTag").classList.add("hidden");  
      exp.textContent = currentQuiz.explanation + " (Hata Defteri'ndeki bu soru doğru çözüldüğü için listeden çıkarıldı.)";  
    } else {  
      exp.textContent = currentQuiz.explanation;  
    }  
  } else {  
    status.textContent = `❌ Yanlış Cevap (Doğru Şık: ${["A", "B", "C", "D"][currentQuiz.correctIndex]})`;  
    status.className = "text-sm font-bold text-rose-600";  
    exp.textContent = currentQuiz.explanation;  
    saveToErrorBook({ ...currentQuiz, topic: activeTopic }, selectedOption);  
  }  
  
  localStorage.setItem("vergi_stats", JSON.stringify(stats));  
  updateBadges(localStorage.getItem("gemini_key"));  
}  
  
function saveToErrorBook(quizItem, chosenIdx) {  
  const existingIndex = errorBook.findIndex((item) => item.question === quizItem.question);  
  const entry = {  
    id: existingIndex >= 0 ? errorBook[existingIndex].id : Date.now(),  
    topic: quizItem.topic || currentTopic,  
    question: quizItem.question,  
    options: quizItem.options,  
    correctIndex: quizItem.correctIndex,  
    explanation: quizItem.explanation,  
    lastChosenIndex: chosenIdx,  
    attempts: existingIndex >= 0 ? (errorBook[existingIndex].attempts || 1) + 1 : 1,  
    updatedAt: new Date().toLocaleDateString("tr-TR")  
  };  
  
  if (existingIndex >= 0) {  
    errorBook[existingIndex] = entry;  
  } else {  
    errorBook.unshift(entry);  
  }  
  
  localStorage.setItem("vergi_error_book", JSON.stringify(errorBook));  
  renderErrorBook();  
}  
  
function retryErrorQuestion(id) {  
  const item = errorBook.find((q) => q.id === id);  
  if (!item) return;  
  
  currentQuiz = {  
    topic: item.topic || currentTopic,  
    fromErrorBookId: item.id,  
    question: item.question,  
    options: item.options,  
    correctIndex: item.correctIndex,  
    explanation: item.explanation  
  };  
  
  document.getElementById("questionText").textContent = item.question;  
  document.getElementById("explanationBox").classList.add("hidden");  
  renderOptions();  
  switchTab("soru");  
}  
  
function removeErrorQuestion(id) {  
  errorBook = errorBook.filter((q) => q.id !== id);  
  localStorage.setItem("vergi_error_book", JSON.stringify(errorBook));  
  renderErrorBook();  
}  
  
function clearErrorBook() {  
  if (!errorBook.length) return;  
  if (!confirm("Hata Defteri'ndeki tüm kayıtlı soruları silmek istiyor musunuz?")) return;  
  errorBook = [];  
  localStorage.setItem("vergi_error_book", JSON.stringify(errorBook));  
  renderErrorBook();  
}  
  
function renderErrorBook() {  
  const list = document.getElementById("errorList");  
  const countText = document.getElementById("errorCountText");  
  if (!list || !countText) return;  
  
  countText.textContent = `${errorBook.length} kayıtlı soru bulunuyor`;  
  list.innerHTML = "";  
  
  if (!errorBook.length) {  
    list.innerHTML = `  
      <div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 text-xs text-slate-500 text-center">  
        Henüz yanlış cevaplanmış bir soru yok. Yanlış yaptığınız sorular otomatik olarak buraya kaydedilir.  
      </div>`;  
    return;  
  }  
  
  errorBook.forEach((item) => {  
    const card = document.createElement("div");  
    card.className = "bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-2.5";  
    card.innerHTML = `  
      <div class="flex items-center justify-between text-[11px] text-slate-400 gap-2">  
        <span class="truncate">${item.topic || DEFAULT_TOPIC}</span>  
        <span class="shrink-0">Hata: ${item.attempts || 1} (${item.updatedAt || "-"})</span>  
      </div>  
      <p class="text-sm font-medium text-slate-800 leading-relaxed">${item.question}</p>  
      <p class="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">  
        <strong class="text-slate-800">Çözüm Notu:</strong> ${item.explanation}  
      </p>  
      <div class="flex gap-2 pt-1">  
        <button onclick="retryErrorQuestion(${item.id})" class="flex-1 bg-indigo-600 active:bg-indigo-700 text-white text-xs font-medium py-2 rounded-xl">  
          Tekrar Çöz  
        </button>  
        <button onclick="removeErrorQuestion(${item.id})" class="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-600 active:bg-slate-100">  
          Sil  
        </button>  
      </div>  
    `;  
    list.appendChild(card);  
  });  
}  
  
async function callGemini(prompt) {  
  const key = localStorage.getItem("gemini_key");  
  const model = localStorage.getItem("gemini_model") || "gemini-4-hydrogen";  
  const law = localStorage.getItem("vergi_law") || "";  
  const fullPrompt = law ? `ÖNCELİKLİ MEVZUAT KAYNAĞI:\n${law}\n\nGÖREV:\n${prompt}` : prompt;  
  
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {  
    method: "POST",  
    headers: { "Content-Type": "application/json" },  
    body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] })  
  });  
  const data = await res.json();  
  if (!res.ok) throw new Error(data.error?.message || "API hatası");  
  return data.candidates[0].content.parts[0].text;  
}  
  
async function generateDailyContent() {  
  if (!navigator.onLine) {  
    return alert("Şu an çevrimdışısınız. Kayıtlı konu, soru ve Hata Defteri'ni inceleyebilirsiniz.");  
  }  
  const key = localStorage.getItem("gemini_key");  
  const topic = document.getElementById("topicInput").value.trim() || DEFAULT_TOPIC;  
  if (!key) return alert("Canlı üretim için önce Ayarlar sekmesinden Gemini API anahtarınızı girin.");  
  
  const btn = document.getElementById("btnGenerate");  
  btn.textContent = "Üretiliyor...";  
  btn.disabled = true;  
  
  try {  
    const prompt = `Türk vergi mevzuatı uzmanı olarak "${topic}" konusunda sadece geçerli JSON döndür. Markdown kod bloğu kullanma. Format:  
{"title":"Başlık","summary":"Temel kural, istisna ve dayanak maddeyi içeren net özet","question":"Vaka veya mevzuat sorusu","options":["Şık 1","Şık 2","Şık 3","Şık 4"],"correctIndex":0,"explanation":"Mevzuat dayanaklı çözüm açıklaması"}`;  
    const raw = await callGemini(prompt);  
    const cleaned = raw.replace(/```json|```/g, "").trim();  
    const parsed = JSON.parse(cleaned);  
  
    currentTopic = topic;  
    document.getElementById("lessonTitle").textContent = parsed.title;  
    document.getElementById("lessonBody").textContent = parsed.summary;  
    document.getElementById("questionText").textContent = parsed.question;  
  
    currentQuiz = {  
      topic: currentTopic,  
      fromErrorBookId: null,  
      question: parsed.question,  
      options: parsed.options,  
      correctIndex: parsed.correctIndex,  
      explanation: parsed.explanation  
    };  
  
    localStorage.setItem("vergi_last_lesson", JSON.stringify({ ...parsed, topic: currentTopic }));  
    document.getElementById("explanationBox").classList.add("hidden");  
    renderOptions();  
    alert("Yeni konu ve soru hazırlandı! Soru sekmesinden çözebilirsiniz.");  
  } catch (e) {  
    alert("Hata: " + e.message);  
  } finally {  
    btn.textContent = "Günün Konusunu ve Sorusunu Üret";  
    btn.disabled = false;  
  }  
}  
  
async function askFreeQuestion() {  
  if (!navigator.onLine) {  
    return alert("Şu an çevrimdışısınız. İnternet bağlantısı geldiğinde tekrar deneyebilirsiniz.");  
  }  
  const key = localStorage.getItem("gemini_key");  
  const q = document.getElementById("freeQuestion").value.trim();  
  if (!q) return;  
  if (!key) return alert("Önce Ayarlar sekmesinden API anahtarınızı girin.");  
  
  const btn = document.getElementById("btnAsk");  
  const box = document.getElementById("chatAnswerBox");  
  btn.textContent = "Yanıtlanıyor...";  
  btn.disabled = true;  
  
  try {  
    const ans = await callGemini(`Türk vergi mevzuatına göre şu soruyu kanun/tebliğ dayanağı belirterek açık ve net yanıtla:\n${q}`);  
    box.textContent = ans;  
    box.classList.remove("hidden");  
  } catch (e) {  
    alert("Hata: " + e.message);  
  } finally {  
    btn.textContent = "Mevzuata Göre Yanıtla";  
    btn.disabled = false;  
  }  
}  
  
if ("serviceWorker" in navigator) {  
  window.addEventListener("load", () => {  
    navigator.serviceWorker.register("./sw.js").catch((err) => {  
      console.error("Service Worker kaydı başarısız:", err);  
    });  
  });  
}  
  
init();  
