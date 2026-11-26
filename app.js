if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

const STORAGE_KEYS = {
  apiKey: "exam_app_gemini_api_key",
  model: "exam_app_gemini_model",
  ymmPool: "exam_app_ymm_pool_text",
  generalPool: "exam_app_general_pool_text"
};

const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
const YMM_SLICE_LIMIT = 85000;
let currentMcqList = [];

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
  } catch (e) {
    alert("Tarayıcı depolama alanı doldu. Havuz metnini biraz kısaltarak tekrar deneyin.");
  }
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

async function callGemini(promptText, expectJson = true, systemInstructionText = "", onRetryStatus = null) {
  const apiKey = safeGetStorage(STORAGE_KEYS.apiKey, "").trim();
  if (!apiKey) {
    throw new Error("Lütfen önce sağ üstteki 'API & Havuz Ayarları' bölümünden Gemini API anahtarınızı girin.");
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
      maxOutputTokens: 16384
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

  const maxRetries = 4;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
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
      const waitMs = (attempt + 1) * 3500;
      if (typeof onRetryStatus === "function") {
        onRetryStatus(`Sunucu yoğun (${res.status}), ${Math.round(waitMs / 1000)} sn sonra tekrar deneniyor (${attempt + 1}/${maxRetries})...`);
      }
      await sleep(waitMs);
      continue;
    }

    throw new Error(`Gemini API Hatası (${res.status}): ${errBody.slice(0, 260)}`);
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

function updatePoolStatusUI() {
  const ymmText = safeGetStorage(STORAGE_KEYS.ymmPool, "");
  const genText = safeGetStorage(STORAGE_KEYS.generalPool, "");

  const ymmArea = document.getElementById("ymmPoolTextarea");
  const genArea = document.getElementById("generalPoolTextarea");
  if (ymmArea) ymmArea.value = ymmText;
  if (genArea) genArea.value = genText;

  const badge = document.getElementById("ymmPoolBadge");
  if (badge) {
    badge.textContent = ymmText.trim()
      ? `YMM Örnek Havuzu Aktif (${ymmText.length.toLocaleString("tr-TR")} karakter yüklü)`
      : "Henüz YMM örnek sınav PDF'i yüklenmedi (Sekme 3'ten yükleyebilirsiniz).";
  }
}

async function generateMcqBatch(topic, difficulty, count, generalSlice) {
  const sys = `Sen Türkiye vergi mevzuatı, muhasebe standartları ve mali hukuk alanında uzman bir sınav hazırlama komisyonu üyesisin.
Aşağıdaki çalışma havuzundan ve güncel Türk mevzuatından yararlanarak özgün, çeldiricileri güçlü çoktan seçmeli sorular üret.
Uydurma kanun maddesi veya oranı kullanma.

ÇALIŞMA HAVUZU:
${generalSlice || "Genel Türk Vergi ve Muhasebe Mevzuatı"}`;

  const prompt = `Konu: "${topic}" | Zorluk: "${difficulty}".
Tam olarak ${count} adet 5 şıklı (A, B, C, D, E) çoktan seçmeli soru üret.
JSON alanlarının içindeki metinlerde çift tırnak (") yerine tek tırnak (') kullan.
Sadece şu JSON şemasını döndür:
{
  "questions": [
    {
      "question": "Soru metni...",
      "options": {
        "A": "...",
        "B": "...",
        "C": "...",
        "D": "...",
        "E": "..."
      },
      "answer": "A",
      "explanation": "Doğru cevabın kanuni dayanağı ve kısa açıklaması..."
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
    div.dataset.index = idx;

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
    expDiv.innerHTML = `<strong>${isCorrect ? "Doğru!" : `Yanlış (Sizin seçiminiz: ${selected || "Boş"})`} — Doğru Cevap: ${q.answer}</strong><br>${q.explanation || ""}`;
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
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(toPdfSafeTurkish(`Zorluk: ${difficulty} | Soru Sayisi: ${questions.length}`), margin, y);
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
  doc.text(toPdfSafeTurkish("CEVAP ANAHTARI VE ACIKLAMALAR"), margin, y);
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

function buildYmmSystemPrompt(subject, formatType, ymmSlice) {
  const isVergiTeknigi = /vergi tekni/i.test(String(subject || ""));
  const domainDetail = isVergiTeknigi
    ? `213 sayılı VUK, 193 sayılı GVK, 5520 sayılı KVK, 3065 sayılı KDV Kanunu, 6183 sayılı AATUHK ve 2577 sayılı İYUK hükümlerini bir arada işleten karma vaka kurgusu kur.
Alt bentlerde (a, b, c, d, e) şu tarz konu kombinasyonlarını dengeli dağıt:
- Ortaklık/mükellefiyet türüne göre (örneğin paylı komandit şirket veya çok ortaklı sermaye şirketi) ticari/mali kar paylaşımı, fon/istisna (ör. VUK 325/A girişim sermayesi fonu, KVK 5/1-a), değerleme (VUK 279) ve vergi hatası/düzeltme (VUK 116-126, 112/4);
- İnceleme/tarhiyat/dava/istinaf/temyiz süreci, VUK 379 Kanun Yolundan Vazgeçme, gecikme faizi ve iade/mahsup (6183 m.23);
- Yoklama ve tespit tutanakları, VUK 353 özel usulsüzlük cezaları (düzenleyen ve belge almayan muhatap yönüyle), uzlaşma (VUK Ek m.1-12) ve cezada indirim (VUK 376) süre/oran/ödeme koşulları;
- İlk tesis ve taazzuv giderleri / peştemallık (VUK 282, 326), amortisman usulü (normal / azalan bakiyeler), VUK mükerrer m.298(Ç) yeniden değerleme ve matrah/vergi zıyaı cezası hesabı;
- Gayrimaddi hakların devri/yenileme fonu (VUK 328), yurt dışı ödemelerde ÇVÖA tevkifatı (KVK 30), sorumlu sıfatıyla KDV (KDV m.9 - 2 No.lu KDV) ve kredi faizi/masrafı maliyete intikali (VUK 262).`
    : `İlgili YMM sınav dersinin temel kanun ve tebliğlerini (VUK, GVK, KVK, KDV, 6183, İYUK, TTK, TMS/TFRS, SPK veya denetim/meslek hukuku) bir arada işleten somut olay, mali tablo/veri ve hesaplama odaklı vaka kurgusu kur.`;

  const isCatiFormat = /2026\/2/i.test(String(formatType || ""));

  const structureRules = isCatiFormat
    ? `YAPI VE FORMAT ZORUNLULUĞU (TÜRMOB 2026/2. DÖNEM VERGİ TEKNİĞİ TARZI):
1. "question" alanı tek bir bütünleşik YMM sınav kağıdı formatında olmalıdır:
   - BAŞLIK VE UYARI NOTU (Sınav süresi, puanlama notu).
   - SORU 1 — ÇATI ÖRNEK METNİ: Gerçek/tüzel kişi mükellef (unvanı, faaliyet konusu, defter/e-belge durumu, ortaklık yapısı ve pay oranları/tutarları) ayrıntılı ve somut olarak tanımlansın.
   - VERİLER BÖLÜMÜ (a, b, c, d, e, f, g, h...):
     * Özet Gelir Tablosu veya Bilanço kalemleri (rakamları tutarlı),
     * Ortakların veya ilgili tarafların önceki/cari dönem beyan özetleri,
     * Sınavda esas alınacak kanuni oranlar, vergi dilimleri, özel usulsüzlük/uzlaşma hadleri, gecikme faizi/tecil faizi oranları ve döviz kurları açıkça verilsin.
   - İSTENENLER BÖLÜMÜ (a, b, c, d, e alt bentleri — her birinin sonunda parantez içinde puanı yazılı olsun ve toplam 100 puan etsin; örn: (25 puan), (15 puan), (20 puan), (20 puan), (20 puan)):
     * Her bent çatı mükellef üzerinden münferit bir vergisel/hukuki olayı anlatsın ve hem hukuki değerlendirme hem de vergi/matrah/ceza/faiz/iade hesaplaması istesin.
2. "solution" alanı (SINAV KOMİSYONU CEVAPLARI):
   - Her bir alt bent (a, b, c, d, e) için önce ilgili Kanun ve Tebliğ maddelerini (madde numarası ve hükmün özüyle) açıklasın,
   - Ardından sorudaki sayıları kullanarak adım adım matematiksel hesaplamaları (parantez içi ara işlemlerle) yapsın,
   - Mevzuatta doktrin/idare yorum farkı bulunabilecek noktalarda "Veya" başlığı altında alternatif çözümü de göstersin,
   - Alt maddeler halinde puan dağılımını (örn. (4 puan), (5 puan)...) belirtsin.`
    : `YAPI VE FORMAT:
- "question" alanında 3 veya 4 adet kapsamlı somut olay (Soru 1, Soru 2, Soru 3...) ve puanları (toplam 100 puan) yer alsın.
- "solution" alanında her soru için kanun/tebliğ dayanakları ve adım adım hesaplamalı komisyon cevabı yer alsın.`;

  return `Sen TÜRMOB Yeminli Mali Müşavirlik (YMM) Sınav Komisyonu üyesi ve kıdemli vergi hukukçususun.
${domainDetail}

${structureRules}

KRİTİK KURALLAR:
- Tüm rakamlar, oranlar, tarihler ve matematiksel işlemler kendi içinde %100 tutarlı olmalıdır.
- Uydurma kanun maddesi veya oranı yazma; sorunun "Veriler" kısmında verdiğin parametrelerle çözümdeki hesaplamalar birebir örtüşsün.

${ymmSlice ? `REFERANS YMM SINAV HAVUZU (ÜSLUP VE DERİNLİK ÖRNEĞİ):\n${ymmSlice}` : ""}`;
}

async function generateYmmWrittenBatch(subject, focus, formatType, ymmSlice, startIndex, count, onRetryStatus = null) {
  const sysPrompt = buildYmmSystemPrompt(subject, formatType, ymmSlice);

  const prompt = `Ders: "${subject}" | Özel Odak: "${focus || "Genel YMM Yazılı Kapsamı"}" | Format: "${formatType}".
Tam olarak ${count} adet özgün ve eksiksiz YMM yazılı sınavı üret (Sınav No: ${startIndex}).
ÖNEMLİ: JSON string değerlerinin içinde kesinlikle çift tırnak (") kullanma; metin içi alıntılarda tek tırnak (') kullan ve satır sonlarını \\n ile kodla.
Yalnızca şu JSON nesnesini döndür:
{
  "questions": [
    {
      "no": ${startIndex},
      "question": "Soru 1 - [Çatı Örnek + Veriler + İstenenler a, b, c, d, e bentleri ve puanları]...",
      "solution": "Cevap 1 - [a, b, c, d, e bentlerinin kanuni dayanakları, adım adım hesaplamaları ve puan dağılımı]...",
      "keyPoints": ["Ana konu 1", "Ana konu 2", "Ana konu 3"]
    }
  ]
}`;

  const raw = await callGemini(prompt, true, sysPrompt, onRetryStatus);
  const parsed = parseJsonLoose(raw);
  const arr = Array.isArray(parsed.questions) ? parsed.questions : Array.isArray(parsed) ? parsed : [];

  return arr
    .map((item, idx) => ({
      no: Number(item.no) || startIndex + idx,
      question: String(item.question || "").trim(),
      solution: String(item.solution || "").trim(),
      keyPoints: Array.isArray(item.keyPoints)
        ? item.keyPoints.map((k) => String(k || "").trim()).filter(Boolean)
        : []
    }))
    .filter((q) => q.question.length > 0);
}

function renderYmmWrittenExamToPdf(examList, meta) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const maxWidth = pageWidth - margin * 2;
  let y = 18;

  const addHeaderFooter = () => {
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(
        toPdfSafeTurkish(`YMM Yazili Sinav Calisma Seti - ${meta.subject} (${meta.dateStr})`),
        margin,
        pageHeight - 8
      );
      doc.text(`Sayfa ${i} / ${totalPages}`, pageWidth - margin - 20, pageHeight - 8);
      doc.setTextColor(0);
    }
  };

  const writeParagraphs = (rawText, fontSize = 9.5, isBold = false) => {
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    const paragraphs = String(rawText || "").split(/\r?\n/);

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

  examList.forEach((exam, idx) => {
    if (idx > 0) {
      doc.addPage();
      y = 18;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(
      toPdfSafeTurkish(`TURMOB YMM YAZILI SINAV CALISMASI - ${meta.subject.toUpperCase()}`),
      margin,
      y
    );
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(
      toPdfSafeTurkish(`Tarih: ${meta.dateStr} | Sinav No: ${exam.no} | Odak: ${meta.focus || "Genel"}`),
      margin,
      y
    );
    y += 5;
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    writeParagraphs(exam.question, 9.5, false);

    doc.addPage();
    y = 18;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(
      toPdfSafeTurkish(`SINAV KOMISYONU CEVAPLARI (SINAV NO: ${exam.no})`),
      margin,
      y
    );
    y += 5;
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    writeParagraphs(exam.solution, 9.2, false);
  });

  addHeaderFooter();
  const safeSubj = toPdfSafeTurkish(meta.subject).replace(/\s+/g, "_");
  doc.save(`YMM_${safeSubj}_${meta.dateStr.replace(/\./g, "-")}.pdf`);
}

function setYmmPdfProgress(msg, isError = false) {
  const el = document.getElementById("ymmPdfStatus");
  if (!el) return;
  el.textContent = msg;
  el.className = isError ? "status-text error" : "status-text";
}

async function generateYmmSingleOnScreen() {
  const subject = document.getElementById("ymmSubjectSelect")?.value || "Vergi Tekniği";
  const focus = (document.getElementById("ymmFocusInput")?.value || "").trim();
  const formatType =
    document.getElementById("ymmFormatSelect")?.value ||
    "2026/2 TÜRMOB Tarzı Çatı Vaka (Tek Çatı Mükellef + Veriler + a-e Bentleri, 100 Puan)";
  const ymmPool = safeGetStorage(STORAGE_KEYS.ymmPool, "").trim();
  const ymmSlice = ymmPool.length > YMM_SLICE_LIMIT ? ymmPool.slice(0, YMM_SLICE_LIMIT) : ymmPool;

  const btn = document.getElementById("generateYmmSingleBtn");
  const prevText = btn ? btn.textContent : "";
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Çatı Sınav Hazırlanıyor...";
  }

  try {
    setYmmPdfProgress("2026/2 TÜRMOB tarzında çatı vaka ve komisyon cevabı üretiliyor (30-60 sn sürebilir)...");
    const batch = await generateYmmWrittenBatch(subject, focus, formatType, ymmSlice, 1, 1, (retryMsg) =>
      setYmmPdfProgress(retryMsg)
    );
    if (!batch.length) {
      throw new Error("Sınav üretilemedi, lütfen tekrar deneyin.");
    }

    const exam = batch[0];
    document.getElementById("ymmPreviewTitle").textContent = `${subject} — Örnek Çatı Sınav`;
    document.getElementById("ymmQuestionContent").textContent = exam.question;
    document.getElementById("ymmSolutionContent").textContent = exam.solution;
    document.getElementById("ymmSolutionWrapper").classList.add("hidden");
    document.getElementById("ymmPreviewArea").classList.remove("hidden");

    setYmmPdfProgress("Çatı sınav başarıyla üretildi. Komisyon cevabını görmek için sağ üstteki butona tıklayabilirsiniz.");
  } catch (err) {
    setYmmPdfProgress("Hata: " + err.message, true);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = prevText;
    }
  }
}

async function generateYmmPdfTestSet() {
  const subject = document.getElementById("ymmSubjectSelect")?.value || "Vergi Tekniği";
  const focus = (document.getElementById("ymmFocusInput")?.value || "").trim();
  const formatType =
    document.getElementById("ymmFormatSelect")?.value ||
    "2026/2 TÜRMOB Tarzı Çatı Vaka (Tek Çatı Mükellef + Veriler + a-e Bentleri, 100 Puan)";
  const requestedCount = Math.min(
    Math.max(parseInt(document.getElementById("ymmPdfCountInput")?.value || "1", 10) || 1, 1),
    5
  );
  const ymmPool = safeGetStorage(STORAGE_KEYS.ymmPool, "").trim();
  const ymmSlice = ymmPool.length > YMM_SLICE_LIMIT ? ymmPool.slice(0, YMM_SLICE_LIMIT) : ymmPool;

  const btn = document.getElementById("generateYmmPdfBtn");
  const prevText = btn ? btn.textContent : "";
  if (btn) {
    btn.disabled = true;
    btn.textContent = "YMM PDF Hazırlanıyor...";
  }

  try {
    const collected = [];
    for (let i = 1; i <= requestedCount; i++) {
      setYmmPdfProgress(`YMM çatı sınavı üretiliyor (${i} / ${requestedCount})... Lütfen bekleyin.`);
      const batch = await generateYmmWrittenBatch(subject, focus, formatType, ymmSlice, i, 1, (retryMsg) =>
        setYmmPdfProgress(retryMsg)
      );
      if (!batch.length) {
        throw new Error(`${i}. sınav üretilemedi; lütfen tekrar deneyin.`);
      }
      collected.push(batch[0]);
    }

    setYmmPdfProgress("PDF dosyası derleniyor...");
    renderYmmWrittenExamToPdf(collected, {
      subject,
      focus,
      formatType,
      dateStr: new Date().toLocaleDateString("tr-TR")
    });

    setYmmPdfProgress(`Tamamlandı! ${collected.length} adet YMM yazılı sınavı ve komisyon cevabı PDF olarak indirildi.`);
  } catch (err) {
    setYmmPdfProgress("Hata: " + err.message, true);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = prevText;
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  const currentStoredModel = safeGetStorage(STORAGE_KEYS.model, DEFAULT_GEMINI_MODEL);
  const normalizedStoredModel = normalizeModelName(currentStoredModel);
  if (currentStoredModel !== normalizedStoredModel) {
    safeSetStorage(STORAGE_KEYS.model, normalizedStoredModel);
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
    const modelSelect = document.getElementById("modelSelect");
    const activeModel = normalizeModelName(safeGetStorage(STORAGE_KEYS.model, DEFAULT_GEMINI_MODEL));
    if (modelSelect) {
      if (!Array.from(modelSelect.options).some((opt) => opt.value === activeModel)) {
        const customOpt = document.createElement("option");
        customOpt.value = activeModel;
        customOpt.textContent = activeModel;
        modelSelect.appendChild(customOpt);
      }
      modelSelect.value = activeModel;
    }
    modal.classList.remove("hidden");
  });
  document.getElementById("closeSettingsBtn")?.addEventListener("click", () => modal.classList.add("hidden"));
  document.getElementById("saveSettingsBtn")?.addEventListener("click", () => {
    safeSetStorage(STORAGE_KEYS.apiKey, document.getElementById("apiKeyInput").value.trim());
    safeSetStorage(
      STORAGE_KEYS.model,
      normalizeModelName(document.getElementById("modelSelect").value)
    );
    modal.classList.add("hidden");
  });

  document.getElementById("generateMcqBtn")?.addEventListener("click", async () => {
    const topic = (document.getElementById("mcqTopicInput")?.value || "").trim() || "Genel Vergi Mevzuatı";
    const difficulty = document.getElementById("mcqDifficultySelect")?.value || "Orta";
    const count = Math.min(Math.max(parseInt(document.getElementById("mcqCountInput")?.value || "5", 10) || 5, 1), 25);
    const generalSlice = safeGetStorage(STORAGE_KEYS.generalPool, "").slice(0, 60000);
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
    const count = Math.min(Math.max(parseInt(document.getElementById("mcqCountInput")?.value || "5", 10) || 5, 1), 25);
    const generalSlice = safeGetStorage(STORAGE_KEYS.generalPool, "").slice(0, 60000);
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

  document.getElementById("generateYmmSingleBtn")?.addEventListener("click", generateYmmSingleOnScreen);
  document.getElementById("generateYmmPdfBtn")?.addEventListener("click", generateYmmPdfTestSet);
  document.getElementById("toggleYmmSolutionBtn")?.addEventListener("click", () => {
    document.getElementById("ymmSolutionWrapper")?.classList.toggle("hidden");
  });

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
    document.getElementById("uploadStatusText").textContent = "Havuz metinleri kaydedildi.";
  });

  document.getElementById("clearYmmPoolBtn")?.addEventListener("click", () => {
    safeSetStorage(STORAGE_KEYS.ymmPool, "");
    updatePoolStatusUI();
  });

  document.getElementById("clearGeneralPoolBtn")?.addEventListener("click", () => {
    safeSetStorage(STORAGE_KEYS.generalPool, "");
    updatePoolStatusUI();
  });

  updatePoolStatusUI();
});
