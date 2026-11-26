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
  resourceLinks: "exam_app_resource_links_json",
  lawLinks: "exam_app_law_links_json",
  commLinks: "exam_app_comm_links_json",
  wizardHistory: "exam_app_wizard_history_json"
};

const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
const YMM_SLICE_LIMIT = 20000;
const GENERAL_SLICE_LIMIT = 15000;
const LEG_SLICE_LIMIT = 10000;
const FREE_TIER_BATCH_SIZE = 5;

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
    alert("Tarayıcı depolama alanı doldu. Eski metinlerden bir kısmını kısaltarak tekrar deneyin.");
    return false;
  }
}

function getJsonStorage(key, fallback = []) {
  try {
    const raw = safeGetStorage(key, JSON.stringify(fallback));
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (_) {
    return fallback;
  }
}

function saveJsonStorage(key, arr) {
  safeSetStorage(key, JSON.stringify(arr));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
  const lawLinks = getJsonStorage(STORAGE_KEYS.lawLinks, []);
  const commLinks = getJsonStorage(STORAGE_KEYS.commLinks, []);
  const genLinks = getJsonStorage(STORAGE_KEYS.resourceLinks, []);

  const parts = [];
  if (laws) parts.push(`[KANUNLAR BÖLÜMÜ]\n${laws}`);
  if (lawLinks.length) {
    parts.push(`[KANUN LİNKLERİ]\n${lawLinks.map((l) => `- ${l.title}: ${l.url}`).join("\n")}`);
  }
  if (communiques) parts.push(`[TEBLİĞLER BÖLÜMÜ]\n${communiques}`);
  if (commLinks.length) {
    parts.push(`[TEBLİĞ LİNKLERİ]\n${commLinks.map((l) => `- ${l.title}: ${l.url}`).join("\n")}`);
  }
  if (genLinks.length) {
    parts.push(`[GENEL KAYNAK LİNKLERİ]\n${genLinks.map((l) => `- ${l.title}: ${l.url}`).join("\n")}`);
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
      maxOutputTokens: 4096
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
        const waitMs = res.status === 429 ? (attempt + 1) * 5000 : (attempt + 1) * 2500;
        if (typeof onRetryStatus === "function") {
          onRetryStatus(`Kota/yoğunluk (${res.status}), ${Math.round(waitMs / 1000)} sn beklenip tekrar deneniyor...`);
        }
        await sleep(waitMs);
        continue;
      }

      if (res.status === 429) {
        throw new Error("Ücretsiz kota sınırına ulaşıldı (429). 1-2 dakika bekleyip tekrar deneyin.");
      }
      throw new Error(`Gemini API Hatası (${res.status}): ${errBody.slice(0, 220)}`);
    } catch (networkErr) {
      if (attempt < maxRetries && !String(networkErr?.message || "").includes("429")) {
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

// GENEL LİNK LİSTESİ RENDER & ÇEKİM YARDIMCILARI
function renderLinkList(ulId, storageKey) {
  const ul = document.getElementById(ulId);
  if (!ul) return;
  const links = getJsonStorage(storageKey, []);
  ul.innerHTML = "";

  if (!links.length) {
    ul.innerHTML = `<li class="link-item" style="color:#64748b;">Henüz bağlantı eklenmedi.</li>`;
    return;
  }

  links.forEach((item, idx) => {
    const li = document.createElement("li");
    li.className = "link-item";
    li.innerHTML = `
      <div>
        <strong>${escapeHtml(item.title || "Bağlantı")}</strong><br>
        <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.url)}</a>
      </div>
      <button type="button" class="btn btn-danger btn-sm" data-del-idx="${idx}">Sil</button>
    `;
    ul.appendChild(li);
  });

  ul.querySelectorAll("[data-del-idx]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = parseInt(btn.getAttribute("data-del-idx"), 10);
      const updated = getJsonStorage(storageKey, []).filter((_, idx) => idx !== i);
      saveJsonStorage(storageKey, updated);
      renderLinkList(ulId, storageKey);
      updatePoolStatusUI();
    });
  });
}

function addLinkToStorage(titleInputId, urlInputId, storageKey, ulId, statusElId) {
  const titleInput = document.getElementById(titleInputId);
  const urlInput = document.getElementById(urlInputId);
  const status = document.getElementById(statusElId);
  const url = (urlInput?.value || "").trim();
  const title = (titleInput?.value || "").trim();

  if (!url || !/^https?:\/\//i.test(url)) {
    if (status) {
      status.className = "status-text error";
      status.textContent = "Lütfen http:// veya https:// ile başlayan geçerli bir bağlantı girin.";
    }
    return;
  }

  const links = getJsonStorage(storageKey, []);
  links.push({ title: title || "Kaynak Linki", url });
  saveJsonStorage(storageKey, links);
  if (titleInput) titleInput.value = "";
  if (urlInput) urlInput.value = "";
  renderLinkList(ulId, storageKey);
  updatePoolStatusUI();
  if (status) {
    status.className = "status-text";
    status.textContent = "Bağlantı listeye eklendi.";
  }
}

async function fetchLinksIntoTextStorage(linkStorageKey, textStorageKey, statusElId, labelName) {
  const links = getJsonStorage(linkStorageKey, []);
  const status = document.getElementById(statusElId);

  if (!links.length) {
    if (status) {
      status.className = "status-text error";
      status.textContent = `Önce ${labelName} listesine en az bir bağlantı ekleyin.`;
    }
    return;
  }

  if (status) {
    status.className = "status-text";
    status.textContent = `${labelName} bağlantı içerikleri çekiliyor...`;
  }

  let extractedAny = false;
  let appendText = "";

  for (const item of links) {
    try {
      const resp = await fetch(item.url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const html = await resp.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const text = (doc.body?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 12000);
      if (text) {
        appendText += `\n\n--- LİNK (${labelName}): ${item.title || item.url} (${item.url}) ---\n${text}`;
        extractedAny = true;
      }
    } catch (_) {
      appendText += `\n\n--- LİNK KAYDI (${labelName}): ${item.title || item.url} (${item.url}) ---`;
    }
  }

  const current = safeGetStorage(textStorageKey, "");
  safeSetStorage(textStorageKey, (current + appendText).trim());
  updatePoolStatusUI();

  if (status) {
    status.className = "status-text";
    status.textContent = extractedAny
      ? `Erişilebilen bağlantı metinleri ${labelName} alanına aktarıldı.`
      : `Bağlantılar ${labelName} alanına referans olarak eklendi (hedef site doğrudan tarayıcı çekimine kapalı olabilir).`;
  }
}

async function handleMultiPdfUpload(files, textStorageKey, statusElId, labelName) {
  if (!files.length) return;
  const status = document.getElementById(statusElId);
  if (status) {
    status.className = "status-text";
    status.textContent = `${files.length} adet ${labelName} PDF'i okunuyor...`;
  }

  try {
    let combined = safeGetStorage(textStorageKey, "");
    for (const f of files) {
      const text = await extractTextFromPdfFile(f);
      combined += "\n" + text;
    }
    safeSetStorage(textStorageKey, combined.trim());
    updatePoolStatusUI();
    if (status) {
      status.className = "status-text";
      status.textContent = `${files.length} adet PDF başarıyla ${labelName} alanına eklendi.`;
    }
  } catch (err) {
    if (status) {
      status.className = "status-text error";
      status.textContent = "PDF Okuma Hatası: " + err.message;
    }
  }
}

function updatePoolStatusUI() {
  const ymmText = safeGetStorage(STORAGE_KEYS.ymmPool, "");
  const genText = safeGetStorage(STORAGE_KEYS.generalPool, "");
  const lawsText = safeGetStorage(STORAGE_KEYS.lawsText, "");
  const commText = safeGetStorage(STORAGE_KEYS.communiquesText, "");
  const totalLinks =
    getJsonStorage(STORAGE_KEYS.resourceLinks, []).length +
    getJsonStorage(STORAGE_KEYS.lawLinks, []).length +
    getJsonStorage(STORAGE_KEYS.commLinks, []).length;

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
      `SMMM Havuz: ${genText.length.toLocaleString("tr-TR")} kr | ` +
      `Kanunlar: ${lawsText.length.toLocaleString("tr-TR")} kr | ` +
      `Tebliğler: ${commText.length.toLocaleString("tr-TR")} kr | ` +
      `Toplam Link: ${totalLinks}`;
  }
}

// 1. SMMM TEST (5'ER SORULUK PAKETLEME)
async function generateMcqBatch(topic, difficulty, count, generalSlice, onStatus) {
  const legContext = buildLegislationContext();
  const sys = `Sen TÜRMOB SMMM Yeterlilik Sınavı 'Vergi Mevzuatı ve Uygulaması' komisyonu üyesisin.
GVK, KVK, KDV, VUK, 6183, MTV, ÖTV ve Emlak Vergisi kapsamından somut, hesaplamalı ve mevzuat odaklı sorular üret.
Sayısal sorularda tüm verileri ve oranları açıkça ver ve kendi içinde tutarlı hesapla.

SMMM / ÇALIŞMA HAVUZU:
${generalSlice || "TÜRMOB SMMM Vergi Mevzuatı ve Uygulaması Müfredatı"}

${legContext}`;

  const prompt = `Odak / Konu: "${topic}" | Düzey: "${difficulty}".
Tam olarak ${count} adet 5 şıklı (A, B, C, D, E) SMMM Yeterlilik Vergi Mevzuatı çoktan seçmeli soru üret.
JSON alanlarının içindeki metinlerde çift tırnak (") yerine tek tırnak (') kullan ve satır sonlarını \\n ile kodla.
Sadece şu JSON şemasını döndür:
{
  "questions": [
    {
      "question": "Somut olay ve veriler içeren soru metni...",
      "options": { "A": "...", "B": "...", "C": "...", "D": "...", "E": "..." },
      "answer": "A",
      "explanation": "İlgili kanun maddesi, adım adım hesaplama ve kısa açıklama..."
    }
  ]
}`;

  const raw = await callGemini(prompt, true, sys, onStatus);
  const parsed = parseJsonLoose(raw);
  return Array.isArray(parsed.questions) ? parsed.questions : [];
}

async function generateMcqInBatches(topic, difficulty, totalCount, generalSlice, onStatus) {
  const allQuestions = [];
  const totalBatches = Math.ceil(totalCount / FREE_TIER_BATCH_SIZE);

  for (let b = 0; b < totalBatches; b++) {
    const remaining = totalCount - allQuestions.length;
    const batchCount = Math.min(FREE_TIER_BATCH_SIZE, remaining);

    if (typeof onStatus === "function") {
      onStatus(`SMMM soruları üretiliyor: Paket ${b + 1}/${totalBatches} (${allQuestions.length}/${totalCount} soru)...`);
    }

    const batch = await generateMcqBatch(topic, difficulty, batchCount, generalSlice, onStatus);
    allQuestions.push(...batch.slice(0, batchCount));

    if (b < totalBatches - 1) {
      if (typeof onStatus === "function") {
        onStatus(`Kota koruması: Sonraki paket için 4 sn bekleniyor (${allQuestions.length}/${totalCount} soru hazır)...`);
      }
      await sleep(4000);
    }
  }

  return allQuestions;
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
          <span><strong>${letter})</strong> ${escapeHtml(q.options?.[letter] || "")}</span>
        </label>`
      )
      .join("");

    div.innerHTML = `
      <div class="mcq-question">${idx + 1}. ${escapeHtml(q.question)}</div>
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
    expDiv.innerHTML = `<strong>${isCorrect ? "Doğru!" : `Yanlış (Seçiminiz: ${selected || "Boş"})`} — Doğru Cevap: ${escapeHtml(q.answer)}</strong><br>${escapeHtml(q.explanation || "")}`;
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
  doc.text(toPdfSafeTurkish(`SMMM VERGI MEVZUATI TESTI - ${topic}`), margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(toPdfSafeTurkish(`Duzey: ${difficulty} | Soru Sayisi: ${questions.length}`), margin, y);
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

  doc.save(`SMMM_Vergi_Mevzuati_${toPdfSafeTurkish(topic).replace(/\s+/g, "_")}.pdf`);
}

// 2. YMM İKİ AŞAMALI VAKA
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

    currentYmmExam = { no: 1, subject, focus, question: questionText, solution: "" };

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
${currentYmmExam.question.slice(0, 12000)}`;

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
    doc.text(toPdfSafeTurkish("SINAV KOMISYONU CEVAPLARI"), margin, y);
    y += 7;
    writeText(currentYmmExam.solution, 9.2);
  }

  doc.save(`YMM_Vaka_${dateStr.replace(/\./g, "-")}.pdf`);
  setYmmStatus("YMM vaka PDF dosyası indirildi.");
}

// 3. VERGİ SİHİRBAZI (DANIŞMANLIK)
function renderWizardHistory() {
  const box = document.getElementById("wizardChatHistory");
  if (!box) return;
  const history = getJsonStorage(STORAGE_KEYS.wizardHistory, []);

  if (!history.length) {
    box.innerHTML = `<div class="chat-empty">Vergi Sihirbazı hazır. Aşağıya somut olayınızı veya mevzuat sorunuzu yazıp <strong>Danış ve Analiz Et</strong> butonuna basabilirsiniz.</div>`;
    return;
  }

  box.innerHTML = "";
  history.forEach((msg) => {
    const div = document.createElement("div");
    div.className = `chat-msg ${msg.role === "user" ? "user" : "assistant"}`;
    const roleLabel = msg.role === "user" ? "Soru / Olay" : "Vergi Sihirbazı Görüşü";
    div.innerHTML = `<div class="chat-role">${roleLabel}</div><div>${escapeHtml(msg.text)}</div>`;
    box.appendChild(div);
  });

  box.scrollTop = box.scrollHeight;
}

async function askTaxWizard() {
  const input = document.getElementById("wizardInput");
  const status = document.getElementById("wizardStatusText");
  const btn = document.getElementById("wizardSendBtn");
  const question = (input?.value || "").trim();

  if (!question) {
    status.className = "status-text error";
    status.textContent = "Lütfen danışmak istediğiniz konuyu veya olayı yazın.";
    return;
  }

  const category = document.getElementById("wizardCategorySelect")?.value || "Genel Vergi Danışmanlığı";
  const includeContext = document.getElementById("wizardContextToggle")?.checked ?? true;
  const history = getJsonStorage(STORAGE_KEYS.wizardHistory, []);

  history.push({ role: "user", text: question, ts: new Date().toLocaleTimeString("tr-TR") });
  saveJsonStorage(STORAGE_KEYS.wizardHistory, history);
  renderWizardHistory();
  if (input) input.value = "";

  if (btn) {
    btn.disabled = true;
    btn.textContent = "Analiz Ediliyor...";
  }
  status.className = "status-text";
  status.textContent = "Vergi Sihirbazı mevzuatı ve dayanakları inceliyor...";

  try {
    const legContext = includeContext ? buildLegislationContext() : "";
    const recentTurns = history
      .slice(-6, -1)
      .map((m) => `${m.role === "user" ? "DANIŞAN" : "VERGİ SİHİRBAZI"}: ${m.text}`)
      .join("\n\n");

    const sysPrompt = `Sen Türkiye vergi mevzuatı (VUK, GVK, KVK, KDV, 6183, İYUK, ÇVÖA, TTK, TMS/TFRS) alanında uzman, kıdemli bir YMM ve vergi danışmanısın ("Vergi Sihirbazı").
Uzmanlık Odak Alanı: ${category}.
Yanıtlarını her zaman profesyonel, net ve yapılandırılmış şekilde ver:
1. ÖZET GÖRÜŞ (Doğrudan sonuç)
2. İLGİLİ KANUN VE TEBLİĞ DAYANAKLARI (Madde numaralarıyla; uydurma madde veya oran yazma)
3. UYGULAMA / HESAPLAMA VE RİSK DEĞERLENDİRMESİ (Sayısal veri varsa adım adım hesapla)
4. ÖNERİLEN AKSİYON / MUHASEBE VEYA BEYAN NOTU

${legContext ? `KULLANICININ KAYITLI MEVZUAT NOTLARI:\n${legContext}` : ""}`;

    const fullPrompt = `${recentTurns ? `ÖNCEKİ GÖRÜŞME BAĞLAMI:\n${recentTurns}\n\n` : ""}YENİ DANIŞMANLIK SORUSU:\n${question}`;

    const answer = await callGemini(fullPrompt, false, sysPrompt, (msg) => {
      status.className = "status-text";
      status.textContent = msg;
    });

    history.push({ role: "assistant", text: answer.trim(), ts: new Date().toLocaleTimeString("tr-TR") });
    saveJsonStorage(STORAGE_KEYS.wizardHistory, history);
    renderWizardHistory();
    status.textContent = "Danışmanlık görüşü hazırlandı.";
  } catch (err) {
    status.className = "status-text error";
    status.textContent = "Hata: " + err.message;
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Danış ve Analiz Et";
    }
  }
}

function exportWizardToPdf() {
  const history = getJsonStorage(STORAGE_KEYS.wizardHistory, []);
  const status = document.getElementById("wizardStatusText");
  if (!history.length) {
    status.className = "status-text error";
    status.textContent = "PDF oluşturmak için önce en az bir danışmanlık görüşmesi yapın.";
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

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(toPdfSafeTurkish("VERGI SIHIRBAZI - DANISMANLIK RAPORU"), margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(toPdfSafeTurkish(`Tarih: ${dateStr}`), margin, y);
  y += 8;

  history.forEach((msg) => {
    const header = msg.role === "user" ? "SORU / SOMUT OLAY:" : "VERGI SIHIRBAZI GORUSU:";
    if (y > pageHeight - 20) {
      doc.addPage();
      y = 18;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(toPdfSafeTurkish(header), margin, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.3);
    const paragraphs = String(msg.text || "").split(/\r?\n/);
    for (const para of paragraphs) {
      if (!para.trim()) {
        y += 2.5;
        continue;
      }
      const lines = doc.splitTextToSize(toPdfSafeTurkish(para), maxWidth);
      for (const line of lines) {
        if (y > pageHeight - 15) {
          doc.addPage();
          y = 18;
        }
        doc.text(line, margin, y);
        y += 4.4;
      }
      y += 1.2;
    }
    y += 4;
  });

  doc.save(`Vergi_Sihirbazi_Gorusu_${dateStr.replace(/\./g, "-")}.pdf`);
  status.className = "status-text";
  status.textContent = "Danışmanlık görüşmesi PDF olarak indirildi.";
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

  // SMMM Test
  document.getElementById("generateMcqBtn")?.addEventListener("click", async () => {
    const topic =
      (document.getElementById("mcqTopicInput")?.value || "").trim() ||
      "Vergi Mevzuatı ve Uygulaması (SMMM Yeterlilik)";
    const difficulty =
      document.getElementById("mcqDifficultySelect")?.value ||
      "SMMM Yeterlilik (Standart Sınav Düzeyi)";
    const count = Math.min(Math.max(parseInt(document.getElementById("mcqCountInput")?.value || "5", 10) || 5, 1), 20);
    const generalSlice = safeGetStorage(STORAGE_KEYS.generalPool, "").slice(0, GENERAL_SLICE_LIMIT);
    const status = document.getElementById("mcqStatusText");
    const btn = document.getElementById("generateMcqBtn");

    if (btn) btn.disabled = true;
    try {
      status.className = "status-text";
      currentMcqList = await generateMcqInBatches(topic, difficulty, count, generalSlice, (msg) => {
        status.className = "status-text";
        status.textContent = msg;
      });
      renderMcqToScreen(currentMcqList, topic);
      status.textContent = `${currentMcqList.length} SMMM sorusu hazırlandı.`;
    } catch (err) {
      status.className = "status-text error";
      status.textContent = "Hata: " + err.message;
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  document.getElementById("generateMcqPdfBtn")?.addEventListener("click", async () => {
    const topic =
      (document.getElementById("mcqTopicInput")?.value || "").trim() ||
      "Vergi Mevzuatı ve Uygulaması (SMMM Yeterlilik)";
    const difficulty =
      document.getElementById("mcqDifficultySelect")?.value ||
      "SMMM Yeterlilik (Standart Sınav Düzeyi)";
    const count = Math.min(Math.max(parseInt(document.getElementById("mcqCountInput")?.value || "5", 10) || 5, 1), 20);
    const generalSlice = safeGetStorage(STORAGE_KEYS.generalPool, "").slice(0, GENERAL_SLICE_LIMIT);
    const status = document.getElementById("mcqStatusText");
    const btn = document.getElementById("generateMcqPdfBtn");

    if (btn) btn.disabled = true;
    try {
      status.className = "status-text";
      const list = await generateMcqInBatches(topic, difficulty, count, generalSlice, (msg) => {
        status.className = "status-text";
        status.textContent = msg;
      });
      exportMcqToPdf(list, topic, difficulty);
      status.textContent = "SMMM test ve cevap anahtarı PDF olarak indirildi.";
    } catch (err) {
      status.className = "status-text error";
      status.textContent = "Hata: " + err.message;
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  document.getElementById("gradeMcqBtn")?.addEventListener("click", gradeMcqQuiz);

  // YMM Vaka
  document.getElementById("generateYmmSingleBtn")?.addEventListener("click", generateYmmQuestionStep);
  document.getElementById("generateYmmSolutionBtn")?.addEventListener("click", generateYmmSolutionStep);
  document.getElementById("generateYmmPdfBtn")?.addEventListener("click", exportCurrentYmmToPdf);
  document.getElementById("toggleYmmSolutionBtn")?.addEventListener("click", () => {
    document.getElementById("ymmSolutionWrapper")?.classList.toggle("hidden");
  });

  // Vergi Sihirbazı
  document.querySelectorAll(".wizard-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const inp = document.getElementById("wizardInput");
      if (inp) {
        inp.value = chip.getAttribute("data-prompt") || "";
        inp.focus();
      }
    });
  });

  document.getElementById("wizardSendBtn")?.addEventListener("click", askTaxWizard);
  document.getElementById("wizardPdfBtn")?.addEventListener("click", exportWizardToPdf);
  document.getElementById("wizardClearBtn")?.addEventListener("click", () => {
    saveJsonStorage(STORAGE_KEYS.wizardHistory, []);
    renderWizardHistory();
    const status = document.getElementById("wizardStatusText");
    if (status) {
      status.className = "status-text";
      status.textContent = "Sohbet geçmişi temizlendi.";
    }
  });

  // Mevzuat — Kanunlar (Çoklu PDF + URL)
  document.getElementById("lawsPdfUpload")?.addEventListener("change", (e) => {
    handleMultiPdfUpload(Array.from(e.target.files || []), STORAGE_KEYS.lawsText, "legStatusText", "Kanun");
  });
  document.getElementById("addLawLinkBtn")?.addEventListener("click", () => {
    addLinkToStorage("lawLinkTitleInput", "lawLinkUrlInput", STORAGE_KEYS.lawLinks, "lawLinkList", "legStatusText");
  });
  document.getElementById("fetchLawLinksBtn")?.addEventListener("click", () => {
    fetchLinksIntoTextStorage(STORAGE_KEYS.lawLinks, STORAGE_KEYS.lawsText, "legStatusText", "Kanun");
  });

  // Mevzuat — Tebliğler (Çoklu PDF + URL)
  document.getElementById("commPdfUpload")?.addEventListener("change", (e) => {
    handleMultiPdfUpload(Array.from(e.target.files || []), STORAGE_KEYS.communiquesText, "legStatusText", "Tebliğ");
  });
  document.getElementById("addCommLinkBtn")?.addEventListener("click", () => {
    addLinkToStorage("commLinkTitleInput", "commLinkUrlInput", STORAGE_KEYS.commLinks, "commLinkList", "legStatusText");
  });
  document.getElementById("fetchCommLinksBtn")?.addEventListener("click", () => {
    fetchLinksIntoTextStorage(STORAGE_KEYS.commLinks, STORAGE_KEYS.communiquesText, "legStatusText", "Tebliğ");
  });

  document.getElementById("saveLegislationBtn")?.addEventListener("click", () => {
    safeSetStorage(STORAGE_KEYS.lawsText, document.getElementById("lawsTextarea").value);
    safeSetStorage(STORAGE_KEYS.communiquesText, document.getElementById("communiquesTextarea").value);
    updatePoolStatusUI();
    const status = document.getElementById("legStatusText");
    status.className = "status-text";
    status.textContent = "Kanun ve Tebliğ metinleri kaydedildi.";
  });

  document.getElementById("clearLegislationBtn")?.addEventListener("click", () => {
    safeSetStorage(STORAGE_KEYS.lawsText, "");
    safeSetStorage(STORAGE_KEYS.communiquesText, "");
    updatePoolStatusUI();
    const status = document.getElementById("legStatusText");
    status.className = "status-text";
    status.textContent = "Mevzuat metin alanları temizlendi.";
  });

  // Havuz — PDF & Linkler
  document.getElementById("ymmPdfUpload")?.addEventListener("change", (e) => {
    handleMultiPdfUpload(Array.from(e.target.files || []), STORAGE_KEYS.ymmPool, "uploadStatusText", "YMM Sınav");
  });
  document.getElementById("generalPdfUpload")?.addEventListener("change", (e) => {
    handleMultiPdfUpload(Array.from(e.target.files || []), STORAGE_KEYS.generalPool, "uploadStatusText", "SMMM/Genel");
  });
  document.getElementById("addLinkBtn")?.addEventListener("click", () => {
    addLinkToStorage("resourceLinkTitleInput", "resourceLinkInput", STORAGE_KEYS.resourceLinks, "resourceLinkList", "uploadStatusText");
  });
  document.getElementById("fetchLinksToPoolBtn")?.addEventListener("click", () => {
    fetchLinksIntoTextStorage(STORAGE_KEYS.resourceLinks, STORAGE_KEYS.generalPool, "uploadStatusText", "Genel Havuz");
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

  // İlk Yükleme
  renderLinkList("lawLinkList", STORAGE_KEYS.lawLinks);
  renderLinkList("commLinkList", STORAGE_KEYS.commLinks);
  renderLinkList("resourceLinkList", STORAGE_KEYS.resourceLinks);
  renderWizardHistory();
  updatePoolStatusUI();
});
