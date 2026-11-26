if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

const STORAGE_KEYS = {
  apiKey: "exam_app_gemini_api_key",
  model: "exam_app_gemini_model",
  ymmPool: "exam_app_ymm_pool_text",
  generalPool: "exam_app_general_pool_text",
  lawsText: "exam_app_legislation_laws_text",
  communiquesText: "exam_app_legislation_communiques_text",
  resourceLinks: "exam_app_resource_links_json"
};

const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
const YMM_SLICE_LIMIT = 35000;
const LEG_SLICE_LIMIT = 20000;

let currentMcqList = [];
let currentYmmExam = {
  no: 1,
  subject: "Vergi Tekniği",
  focus: "",
  question: "",
  solution: ""
};

function normalizeModelName(modelName) {
  const clean = String(modelName || "").trim().replace(/^models\//i, "");
  if (!clean || /^gemini-2\.5-/i.test(clean)) {
    return DEFAULT_GEMINI_MODEL;
  }
  return clean;
}

function safeGetStorage(key, fallback = "") {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch (e) {
    return fallback;
  }
}

function safeSetStorage(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    alert("Tarayıcı depolama alanı doldu. Havuz metnini biraz kısaltarak tekrar deneyin.");
    return false;
  }
}

function getResourceLinks() {
  try {
    const raw = safeGetStorage(STORAGE_KEYS.resourceLinks, "[]");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function saveResourceLinks(links) {
  safeSetStorage(STORAGE_KEYS.resourceLinks, JSON.stringify(links));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toPdfSafeTurkish(text) {
  return String(text || "")
    .replace(/ğ/g, "g").replace(/Ğ/g, "G")
    .replace(/ü/g, "u").replace(/Ü/g, "U")
    .replace(/ş/g, "s").replace(/Ş/g, "S")
    .replace(/ı/g, "i").replace(/İ/g, "I")
    .replace(/ö/g, "o").replace(/Ö/g, "O")
    .replace(/ç/g, "c").replace(/Ç/g, "C")
    .replace(/₺/g, "TL")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/–|—/g, "-");
}

function parseJsonLoose(rawText) {
  let cleaned = String(rawText || "").trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch (_) {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    }
    throw new Error("Model yanıtı geçerli JSON biçiminde çözümlenemedi.");
  }
}

function buildLegislationContext() {
  const laws = safeGetStorage(STORAGE_KEYS.lawsText, "").trim().slice(0, LEG_SLICE_LIMIT);
  const communiques = safeGetStorage(STORAGE_KEYS.communiquesText, "").trim().slice(0, LEG_SLICE_LIMIT);
  const links = getResourceLinks();

  let parts = [];
  if (laws) {
    parts.push(`[KANUNLAR BÖLÜMÜ]\n${laws}`);
  }
  if (communiques) {
    parts.push(`[TEBLİĞLER BÖLÜMÜ]\n${communiques}`);
  }
  if (links.length) {
    parts.push(`[KAYNAK LİNKLERİ]\n${links.map((l) => `- ${l.title || "Kaynak"}: ${l.url}`).join("\n")}`);
  }
  return parts.join("\n\n");
}

async function callGemini(promptText, expectJson = true, systemInstructionText = "", onRetryStatus = null) {
  const apiKey = safeGetStorage(STORAGE_KEYS.apiKey, "").trim();
  if (!apiKey) {
    throw new Error("Lütfen önce sağ üstteki 'API & Ayarlar' bölümünden Gemini API anahtarınızı girin.");
  }

  const rawSavedModel = safeGetStorage(STORAGE_KEYS.model, DEFAULT_GEMINI_MODEL);
  const model = normalizeModelName(rawSavedModel);
  if (rawSavedModel !== model) {
    safeSetStorage(STORAGE_KEYS.model, model);
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: promptText }]
      }
    ],
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 8192
    }
  };

  if (systemInstructionText) {
    payload.systemInstruction = {
      parts: [{ text: systemInstructionText }]
    };
  }

  if (expectJson) {
    payload.generationConfig.responseMimeType = "application/json";
  }

  const maxRetries = 2;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("\n") || "";
        if (!text.trim()) {
          throw new Error("Gemini boş yanıt döndürdü.");
        }
        return text;
      }

      const errBody = await res.text();
      const isTransient = res.status === 429 || res.status === 500 || res.status === 503 || res.status === 504;
      if (isTransient && attempt < maxRetries) {
        const waitMs = (attempt + 1) * 2500;
        if (typeof onRetryStatus === "function") {
          onRetryStatus(`Sunucu yoğun (${res.status}), ${Math.round(waitMs / 1000)} sn sonra tekrar deneniyor...`);
        }
        await sleep(waitMs);
        continue;
      }

      throw new Error(`Gemini API Hatası (${res.status}): ${errBody.slice(0, 220)}`);
    } catch (networkErr) {
      if (attempt < maxRetries) {
        const waitMs = (attempt + 1) * 2000;
        if (typeof onRetryStatus === "function") {
          onRetryStatus(`Bağlantı tekrar deneniyor (${attempt + 1}/${maxRetries})...`);
        }
        await sleep(waitMs);
        continue;
      }
      throw new Error(networkErr?.message || "Bağlantı kurulamadı (Load failed).");
    }
  }
}

async function extractTextFromPdfFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = `\n--- DOSYA: ${file.name} ---\n`;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const strings = content.items.map((item) => item.str);
    fullText += `\n[Sayfa ${pageNum}]\n` + strings.join(" ");
  }
  return fullText;
}

function renderLinksUI() {
  const ul = document.getElementById("resourceLinkList");
  if (!ul) return;
  const links = getResourceLinks();
  ul.innerHTML = "";

  if (!links.length) {
    ul.innerHTML = `<li class="link-item">Henüz bağlantı eklenmedi.</li>`;
    return;
  }

  links.forEach((item, idx) => {
    const li = document.createElement("li");
    li.className = "link-item";
    li.innerHTML = `
      <div>
        <strong>${item.title || "Bağlantı"}</strong><br>
        <a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.url}</a>
      </div>
      <button type="button" class="btn btn-danger btn-sm" data-del-link="${idx}">Sil</button>
    `;
    ul.appendChild(li);
  });

  ul.querySelectorAll("[data-del-link]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = parseInt(btn.getAttribute("data-del-link"), 10);
      const updated = getResourceLinks().filter((_, idx) => idx !== i);
      saveResourceLinks(updated);
      renderLinksUI();
      updatePoolStatusUI();
    });
  });
}

function updatePoolStatusUI() {
  const ymmText = safeGetStorage(STORAGE_KEYS.ymmPool, "");
  const genText = safeGetStorage(STORAGE_KEYS.generalPool, "");
  const lawsText = safeGetStorage(STORAGE_KEYS.lawsText, "");
  const commText = safeGetStorage(STORAGE_KEYS.communiquesText, "");
  const links = getResourceLinks();

  const ymmArea = document.getElementById("ymmPoolTextarea");
  const genArea = document.getElementById("generalPoolTextarea");
  const lawsArea = document.getElementById("lawsTextarea");
  const commArea = document.getElementById("communiquesTextarea");

  if (ymmArea) ymmArea.value = ymmText;
  if (genArea) genArea.value = genText;
  if (lawsArea) lawsArea.value = lawsText;
  if (commArea) commArea.value = commText;

  const badge = document.getElementById("ymmPoolBadge");
  if (badge) {
    badge.textContent =
      `YMM Havuz: ${ymmText.length.toLocaleString("tr-TR")} kr | ` +
      `Link: ${links.length} | ` +
      `Kanun: ${lawsText.trim() ? "Var" : "Yok"} | ` +
      `Tebliğ: ${commText.trim() ? "Var" : "Yok"}`;
  }
}

// 1. ÇOKTAN SEÇMELİ TEST
async function generateMcqBatch(topic, difficulty, count, generalSlice) {
  const legContext = buildLegislationContext();
  const sys = `Sen Türkiye vergi mevzuatı ve muhasebe alanında uzman bir sınav komisyonu üyesisin.
Özgün, net ve kanuni dayanaklı çoktan seçmeli sorular üret.

ÇALIŞMA HAVUZU:
${generalSlice || "Genel Türk Vergi ve Muhasebe Mevzuatı"}

${legContext}`;

  const prompt = `Konu: "${topic}" | Zorluk: "${difficulty}".
Tam olarak ${count} adet 5 şıklı (A, B, C, D, E) çoktan seçmeli soru üret.
JSON alanlarının içindeki metinlerde çift tırnak (") yerine tek tırnak (') kullan.
Sadece şu JSON şemasını döndür:
{
  "questions": [
    {
      "question": "Soru metni...",
      "options": { "A": "...", "B": "...", "C": "...", "D": "...", "E": "..." },
      "answer": "A",
      "explanation": "Kanuni dayanak ve açıklama..."
    }
  ]
}`;

  const raw = await callGemini(prompt, true, sys, (msg) => {
    const el = document.getElementById("mcqStatusText");
    if (el) {
      el.className = "status-text";
      el.textContent = msg;
    }
  });
  const parsed = parseJsonLoose(raw);
  return Array.isArray(parsed.questions) ? parsed.questions : [];
}

function renderMcqToScreen(questions, topic) {
  const area = document.getElementById("mcqQuizArea");
  const container = document.getElementById("mcqQuestionsContainer");
  const title = document.getElementById("mcqQuizTitle");
  const badge = document.getElementById("mcqScoreBadge");

  title.textContent = `${topic} (${questions.length} Soru)`;
  badge.textContent = "Devam Ediyor";
  container.innerHTML = "";

  questions.forEach((q, idx) => {
    const div = document.createElement("div");
    div.className = "mcq-item";
    const optsHtml = ["A", "B", "C", "D", "E"]
      .map(
        (letter) => `
        <label class="mcq-option">
          <input type="radio" name="mcq_${idx}" value="${letter}" />
          <span><strong>${letter})</strong> ${q.options?.[letter] || ""}</span>
        </label>`
      )
      .join("");

    div.innerHTML = `
      <div class="mcq-question">${idx + 1}. ${q.question}</div>
      <div>${optsHtml}</div>
      <div class="mcq-explanation hidden" id="mcq_exp_${idx}"></div>
    `;
    container.appendChild(div);
  });

  area.classList.remove("hidden");
}

function gradeMcqQuiz() {
  let correctCount = 0;
  currentMcqList.forEach((q, idx) => {
    const selected = document.querySelector(`input[name="mcq_${idx}"]:checked`)?.value || "";
    const expDiv = document.getElementById(`mcq_exp_${idx}`);
    const isCorrect = selected === q.answer;
    if (isCorrect) correctCount++;

    expDiv.className = `mcq-explanation ${isCorrect ? "correct" : "wrong"}`;
    expDiv.innerHTML = `<strong>${isCorrect ? "Doğru!" : `Yanlış (Seçiminiz: ${selected || "Boş"})`} — Doğru Cevap: ${q.answer}</strong><br>${q.explanation || ""}`;
    expDiv.classList.remove("hidden");
  });

  const badge = document.getElementById("mcqScoreBadge");
  const score = Math.round((correctCount / Math.max(currentMcqList.length, 1)) * 100);
  badge.textContent = `Sonuç: ${correctCount}/${currentMcqList.length} (${score} Puan)`;
}

function exportMcqToPdf(questions, topic, difficulty) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const maxWidth = pageWidth - margin * 2;
  let y = 18;

  const ensureSpace = (needed = 10) => {
    if (y + needed > pageHeight - 15) {
      doc.addPage();
      y = 18;
    }
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(toPdfSafeTurkish(`CALISMA TESTI - ${topic}`), margin, y);
  y += 8;

  questions.forEach((q, idx) => {
    const qLines = doc.splitTextToSize(toPdfSafeTurkish(`${idx + 1}. ${q.question}`), maxWidth);
    ensureSpace(qLines.length * 5 + 26);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(qLines, margin, y);
    y += qLines.length * 4.8 + 2;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    ["A", "B", "C", "D", "E"].forEach((opt) => {
      const optLines = doc.splitTextToSize(toPdfSafeTurkish(`   ${opt}) ${q.options?.[opt] || ""}`), maxWidth);
      ensureSpace(optLines.length * 4.5 + 2);
      doc.text(optLines, margin, y);
      y += optLines.length * 4.4 + 1;
    });
    y += 4;
  });

  doc.addPage();
  y = 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(toPdfSafeTurkish("CEVAP ANAHTARI"), margin, y);
  y += 8;

  questions.forEach((q, idx) => {
    const expLines = doc.splitTextToSize(
      toPdfSafeTurkish(`${idx + 1}. Cevap: ${q.answer} - ${q.explanation || ""}`),
      maxWidth
    );
    ensureSpace(expLines.length * 4.5 + 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(expLines, margin, y);
    y += expLines.length * 4.5 + 3;
  });

  doc.save(`Test_${toPdfSafeTurkish(topic).replace(/\s+/g, "_")}.pdf`);
}

// 2. YMM İKİ AŞAMALI VAKA ÜRETİMİ
function setYmmStatus(msg, isError = false) {
  const el = document.getElementById("ymmPdfStatus");
  if (!el) return;
  el.textContent = msg;
  el.className = isError ? "status-text error" : "status-text";
}

async function generateYmmQuestionStep() {
  const subject = document.getElementById("ymmSubjectSelect")?.value || "Vergi Tekniği";
  const focus = (document.getElementById("ymmFocusInput")?.value || "").trim();
  const ymmPool = safeGetStorage(STORAGE_KEYS.ymmPool, "").trim();
  const ymmSlice = ymmPool.length > YMM_SLICE_LIMIT ? ymmPool.slice(0, YMM_SLICE_LIMIT) : ymmPool;
  const legContext = buildLegislationContext();

  const btn = document.getElementById("generateYmmSingleBtn");
  const solBtn = document.getElementById("generateYmmSolutionBtn");
  const prevText = btn ? btn.textContent : "";

  if (btn) {
    btn.disabled = true;
    btn.textContent = "Vaka Üretiliyor...";
  }
  if (solBtn) solBtn.disabled = true;

  try {
    setYmmStatus("1. Adım: Çatı vaka, veriler ve (a)-(e) bentleri hazırlanıyor...");

    const sysPrompt = `Sen TÜRMOB YMM yazılı sınav komisyonu üyesisin.
TÜRMOB 2026/2 Vergi Tekniği tarzında; tek bir ÇATI ÖRNEK mükellef, VERİLER (mali tablo/oran/parametreler) ve toplam 100 puanlık (a), (b), (c), (d), (e) alt bentlerinden oluşan bütüncül bir vaka sorusu üret.
Tutarlı sayılar ve kanun/tebliğ mantığı kullan. Cevap metnini henüz yazma; yalnızca soruyu üret.

${legContext}
${ymmSlice ? `\n[ÖRNEK YMM HAVUZU]\n${ymmSlice}` : ""}`;

    const prompt = `Ders: "${subject}" | Odak: "${focus || "Genel Kapsam"}".
JSON içinde çift tırnak (") yerine tek tırnak (') kullan ve satır sonlarını \\n ile yaz.
Sadece şu JSON formatında döndür:
{
  "question": "SORU 1 - ÇATI ÖRNEK...\\n\\nVERİLER...\\n\\nİSTENENLER (Toplam 100 Puan)..."
}`;

    const raw = await callGemini(prompt, true, sysPrompt, (msg) => setYmmStatus(msg));
    const parsed = parseJsonLoose(raw);
    const questionText = String(parsed.question || "").trim();
    if (!questionText) throw new Error("Soru metni boş geldi.");

    currentYmmExam = {
      no: 1,
      subject,
      focus,
      question: questionText,
      solution: ""
    };

    document.getElementById("ymmPreviewTitle").textContent = `${subject} — Çatı Vaka Sorusu`;
    document.getElementById("ymmQuestionContent").textContent = questionText;
    document.getElementById("ymmSolutionContent").textContent = "";
    document.getElementById("ymmSolutionWrapper").classList.add("hidden");
    document.getElementById("ymmPreviewArea").classList.remove("hidden");

    if (solBtn) solBtn.disabled = false;
    setYmmStatus("Soru hazır! Şimdi '2. Adım: Komisyon Cevabını Üret' butonuna basabilirsiniz.");
  } catch (err) {
    setYmmStatus("Hata: " + err.message, true);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = prevText;
    }
  }
}

async function generateYmmSolutionStep() {
  if (!currentYmmExam.question) {
    setYmmStatus("Önce 1. Adım ile bir çatı vaka sorusu üretin.", true);
    return;
  }

  const solBtn = document.getElementById("generateYmmSolutionBtn");
  const prevText = solBtn ? solBtn.textContent : "";
  if (solBtn) {
    solBtn.disabled = true;
    solBtn.textContent = "Cevap Hazırlanıyor...";
  }

  try {
    setYmmStatus("2. Adım: Kanuni dayanaklar ve adım adım hesaplamalı komisyon cevabı üretiliyor...");
    const legContext = buildLegislationContext();

    const sysPrompt = `Sen TÜRMOB YMM yazılı sınav komisyonu üyesisin.
Verilen vaka sorusundaki (a), (b), (c), (d), (e) bentlerinin her biri için; ilgili kanun ve tebliğ hükümlerini, sorudaki verilerle adım adım matematiksel hesaplamaları ve sonuçları açık ve düzenli şekilde yaz.

${legContext}`;

    const prompt = `Aşağıdaki YMM vaka sorusunun komisyon cevabını üret.
JSON içinde çift tırnak (") yerine tek tırnak (') kullan ve satır sonlarını \\n ile yaz.
Sadece şu JSON formatında döndür:
{
  "solution": "KOMİSYON CEVABI...\\n\\na) ...\\n\\nb) ..."
}

SORU METNİ:
${currentYmmExam.question.slice(0, 18000)}`;

    const raw = await callGemini(prompt, true, sysPrompt, (msg) => setYmmStatus(msg));
    const parsed = parseJsonLoose(raw);
    const solutionText = String(parsed.solution || "").trim();
    if (!solutionText) throw new Error("Komisyon cevabı boş geldi.");

    currentYmmExam.solution = solutionText;
    document.getElementById("ymmSolutionContent").textContent = solutionText;
    document.getElementById("ymmSolutionWrapper").classList.remove("hidden");
    setYmmStatus("Komisyon cevabı üretildi ve ekranda açıldı.");
  } catch (err) {
    setYmmStatus("Hata: " + err.message, true);
  } finally {
    if (solBtn) {
      solBtn.disabled = false;
      solBtn.textContent = prevText;
    }
  }
}

function exportCurrentYmmToPdf() {
  if (!currentYmmExam.question) {
    setYmmStatus("Önce ekranda bir vaka sorusu üretin.", true);
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const maxWidth = pageWidth - margin * 2;
  let y = 18;
  const dateStr = new Date().toLocaleDateString("tr-TR");

  const writeText = (raw, fontSize = 9.5) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    const paragraphs = String(raw || "").split(/\r?\n/);
    for (const para of paragraphs) {
      if (!para.trim()) {
        y += 3;
        continue;
      }
      const lines = doc.splitTextToSize(toPdfSafeTurkish(para), maxWidth);
      for (const line of lines) {
        if (y > pageHeight - 16) {
          doc.addPage();
          y = 18;
        }
        doc.text(line, margin, y);
        y += fontSize * 0.46;
      }
      y += 1.5;
    }
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(toPdfSafeTurkish(`YMM YAZILI VAKA - ${currentYmmExam.subject.toUpperCase()}`), margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(toPdfSafeTurkish(`Tarih: ${dateStr}`), margin, y);
  y += 7;

  writeText(currentYmmExam.question, 9.5);

  if (currentYmmExam.solution) {
    doc.addPage();
    y = 18;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(toPdfSafeTurkish("SINAV KOMISYONU CEVABI"), margin, y);
    y += 7;
    writeText(currentYmmExam.solution, 9.2);
  }

  doc.save(`YMM_Vaka_${dateStr.replace(/\./g, "-")}.pdf`);
  setYmmStatus("YMM vaka PDF dosyası indirildi.");
}

// 3. LİNK İÇERİĞİNİ HAVUZA ÇEKME
async function fetchLinksIntoPool() {
  const links = getResourceLinks();
  const status = document.getElementById("uploadStatusText");
  if (!links.length) {
    status.className = "status-text error";
    status.textContent = "Önce listeye en az bir bağlantı ekleyin.";
    return;
  }

  status.className = "status-text";
  status.textContent = "Bağlantı içerikleri çekiliyor...";

  let extractedAny = false;
  let poolAppend = "";

  for (const item of links) {
    try {
      const resp = await fetch(item.url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const html = await resp.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const text = (doc.body?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 15000);
      if (text) {
        poolAppend += `\n\n--- LİNK: ${item.title || item.url} (${item.url}) ---\n${text}`;
        extractedAny = true;
      }
    } catch (_) {
      poolAppend += `\n\n--- LİNK KAYDI: ${item.title || item.url} (${item.url}) ---`;
    }
  }

  const currentYmm = safeGetStorage(STORAGE_KEYS.ymmPool, "");
  safeSetStorage(STORAGE_KEYS.ymmPool, (currentYmm + poolAppend).trim());
  updatePoolStatusUI();

  status.className = "status-text";
  status.textContent = extractedAny
    ? "Erişilebilen bağlantı metinleri YMM havuzuna eklendi."
    : "Bağlantılar havuz notu olarak kaydedildi (hedef site doğrudan tarayıcı çekimine izin vermemiş olabilir).";
}

// 4. OLAY DİNLEYİCİLERİ
document.addEventListener("DOMContentLoaded", () => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  const savedModel = safeGetStorage(STORAGE_KEYS.model, DEFAULT_GEMINI_MODEL);
  const normModel = normalizeModelName(savedModel);
  if (savedModel !== normModel) {
    safeSetStorage(STORAGE_KEYS.model, normModel);
  }

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab)?.classList.add("active");
    });
  });

  const modal = document.getElementById("settingsModal");
  document.getElementById("openSettingsBtn")?.addEventListener("click", () => {
    document.getElementById("apiKeyInput").value = safeGetStorage(STORAGE_KEYS.apiKey, "");
    document.getElementById("modelSelect").value = normalizeModelName(
      safeGetStorage(STORAGE_KEYS.model, DEFAULT_GEMINI_MODEL)
    );
    modal.classList.remove("hidden");
  });
  document.getElementById("closeSettingsBtn")?.addEventListener("click", () => modal.classList.add("hidden"));
  document.getElementById("saveSettingsBtn")?.addEventListener("click", () => {
    safeSetStorage(STORAGE_KEYS.apiKey, document.getElementById("apiKeyInput").value.trim());
    safeSetStorage(STORAGE_KEYS.model, normalizeModelName(document.getElementById("modelSelect").value));
    modal.classList.add("hidden");
  });

  document.getElementById("generateMcqBtn")?.addEventListener("click", async () => {
    const topic = (document.getElementById("mcqTopicInput")?.value || "").trim() || "Genel Vergi Mevzuatı";
    const difficulty = document.getElementById("mcqDifficultySelect")?.value || "Orta";
    const count = Math.min(Math.max(parseInt(document.getElementById("mcqCountInput")?.value || "5", 10) || 5, 1), 20);
    const generalSlice = safeGetStorage(STORAGE_KEYS.generalPool, "").slice(0, 35000);
    const status = document.getElementById("mcqStatusText");

    try {
      status.className = "status-text";
      status.textContent = "Test soruları üretiliyor...";
      currentMcqList = await generateMcqBatch(topic, difficulty, count, generalSlice);
      renderMcqToScreen(currentMcqList, topic);
      status.textContent = `${currentMcqList.length} soru hazırlandı.`;
    } catch (err) {
      status.className = "status-text error";
      status.textContent = "Hata: " + err.message;
    }
  });

  document.getElementById("generateMcqPdfBtn")?.addEventListener("click", async () => {
    const topic = (document.getElementById("mcqTopicInput")?.value || "").trim() || "Genel Vergi Mevzuatı";
    const difficulty = document.getElementById("mcqDifficultySelect")?.value || "Orta";
    const count = Math.min(Math.max(parseInt(document.getElementById("mcqCountInput")?.value || "5", 10) || 5, 1), 20);
    const generalSlice = safeGetStorage(STORAGE_KEYS.generalPool, "").slice(0, 35000);
    const status = document.getElementById("mcqStatusText");

    try {
      status.className = "status-text";
      status.textContent = "Test PDF'i hazırlanıyor...";
      const list = await generateMcqBatch(topic, difficulty, count, generalSlice);
      exportMcqToPdf(list, topic, difficulty);
      status.textContent = "Test ve cevap anahtarı PDF olarak indirildi.";
    } catch (err) {
      status.className = "status-text error";
      status.textContent = "Hata: " + err.message;
    }
  });

  document.getElementById("gradeMcqBtn")?.addEventListener("click", gradeMcqQuiz);

  document.getElementById("generateYmmSingleBtn")?.addEventListener("click", generateYmmQuestionStep);
  document.getElementById("generateYmmSolutionBtn")?.addEventListener("click", generateYmmSolutionStep);
  document.getElementById("generateYmmPdfBtn")?.addEventListener("click", exportCurrentYmmToPdf);
  document.getElementById("toggleYmmSolutionBtn")?.addEventListener("click", () => {
    document.getElementById("ymmSolutionWrapper")?.classList.toggle("hidden");
  });

  document.getElementById("addLinkBtn")?.addEventListener("click", () => {
    const titleInput = document.getElementById("resourceLinkTitleInput");
    const urlInput = document.getElementById("resourceLinkInput");
    const url = (urlInput?.value || "").trim();
    const title = (titleInput?.value || "").trim();

    if (!url || !/^https?:\/\//i.test(url)) {
      const status = document.getElementById("uploadStatusText");
      status.className = "status-text error";
      status.textContent = "Lütfen http:// veya https:// ile başlayan geçerli bir bağlantı girin.";
      return;
    }

    const links = getResourceLinks();
    links.push({ title: title || "Kaynak Linki", url });
    saveResourceLinks(links);
    titleInput.value = "";
    urlInput.value = "";
    renderLinksUI();
    updatePoolStatusUI();
  });

  document.getElementById("fetchLinksToPoolBtn")?.addEventListener("click", fetchLinksIntoPool);

  document.getElementById("ymmPdfUpload")?.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const status = document.getElementById("uploadStatusText");
    status.className = "status-text";
    status.textContent = "YMM sınav PDF'leri okunuyor...";

    try {
      let combined = safeGetStorage(STORAGE_KEYS.ymmPool, "");
      for (const f of files) {
        const text = await extractTextFromPdfFile(f);
        combined += "\n" + text;
      }
      safeSetStorage(STORAGE_KEYS.ymmPool, combined.trim());
      updatePoolStatusUI();
      status.textContent = `${files.length} adet YMM sınav PDF'i havuza eklendi.`;
    } catch (err) {
      status.className = "status-text error";
      status.textContent = "PDF Okuma Hatası: " + err.message;
    }
  });

  document.getElementById("generalPdfUpload")?.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const status = document.getElementById("uploadStatusText");
    status.className = "status-text";
    status.textContent = "Genel ders PDF'leri okunuyor...";

    try {
      let combined = safeGetStorage(STORAGE_KEYS.generalPool, "");
      for (const f of files) {
        const text = await extractTextFromPdfFile(f);
        combined += "\n" + text;
      }
      safeSetStorage(STORAGE_KEYS.generalPool, combined.trim());
      updatePoolStatusUI();
      status.textContent = `${files.length} adet genel PDF havuza eklendi.`;
    } catch (err) {
      status.className = "status-text error";
      status.textContent = "PDF Okuma Hatası: " + err.message;
    }
  });

  document.getElementById("savePoolsBtn")?.addEventListener("click", () => {
    safeSetStorage(STORAGE_KEYS.ymmPool, document.getElementById("ymmPoolTextarea").value);
    safeSetStorage(STORAGE_KEYS.generalPool, document.getElementById("generalPoolTextarea").value);
    updatePoolStatusUI();
    const status = document.getElementById("uploadStatusText");
    status.className = "status-text";
    status.textContent = "Havuz metinleri kaydedildi.";
  });

  document.getElementById("clearYmmPoolBtn")?.addEventListener("click", () => {
    safeSetStorage(STORAGE_KEYS.ymmPool, "");
    updatePoolStatusUI();
  });

  document.getElementById("clearGeneralPoolBtn")?.addEventListener("click", () => {
    safeSetStorage(STORAGE_KEYS.generalPool, "");
    updatePoolStatusUI();
  });

  document.getElementById("saveLegislationBtn")?.addEventListener("click", () => {
    safeSetStorage(STORAGE_KEYS.lawsText, document.getElementById("lawsTextarea").value);
    safeSetStorage(STORAGE_KEYS.communiquesText, document.getElementById("communiquesTextarea").value);
    updatePoolStatusUI();
    const status = document.getElementById("legStatusText");
    status.className = "status-text";
    status.textContent = "Kanun ve tebliğ notları kaydedildi.";
  });

  document.getElementById("clearLegislationBtn")?.addEventListener("click", () => {
    safeSetStorage(STORAGE_KEYS.lawsText, "");
    safeSetStorage(STORAGE_KEYS.communiquesText, "");
    updatePoolStatusUI();
    const status = document.getElementById("legStatusText");
    status.className = "status-text";
    status.textContent = "Mevzuat alanları temizlendi.";
  });

  renderLinksUI();
  updatePoolStatusUI();
});
