<!DOCTYPE html>  
<html lang="tr">  
<head>  
  <meta charset="UTF-8" />  
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />  
  <meta name="apple-mobile-web-app-capable" content="yes" />  
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />  
  <meta name="apple-mobile-web-app-title" content="Vergi Asistanı" />  
  <meta name="theme-color" content="#0f172a" />  
  <link rel="manifest" href="./manifest.json" />  
  <title>Vergi Araştırma Asistanı</title>  
  <script src="https://cdn.tailwindcss.com"></script>  
  <style>  
    body { -webkit-tap-highlight-color: transparent; padding-bottom: 88px; }  
    .safe-top { padding-top: env(safe-area-inset-top, 12px); }  
    .safe-bottom { padding-bottom: env(safe-area-inset-bottom, 10px); }  
  </style>  
</head>  
<body class="bg-slate-50 text-slate-900 font-sans antialiased">  
  
  <header class="bg-slate-900 text-white px-3.5 py-3 sticky top-0 z-20 shadow safe-top flex items-center justify-between gap-2">  
    <div class="min-w-0">  
      <h1 class="text-sm sm:text-base font-bold tracking-tight truncate">Vergi Araştırma Asistanı</h1>  
      <p id="modeBadge" class="text-[11px] text-amber-400 truncate">Demo Modu Aktif</p>  
    </div>  
    <div class="flex items-center gap-1.5 shrink-0">  
      <span id="networkBadge" class="text-[11px] px-2 py-1 rounded-full border flex items-center gap-1.5 bg-emerald-950/60 text-emerald-300 border-emerald-700/60">  
        <span id="networkDot" class="w-2 h-2 rounded-full bg-emerald-400"></span>  
        <span id="networkText">Çevrimiçi</span>  
      </span>  
      <span id="scoreBadge" class="text-xs bg-slate-800 px-2.5 py-1 rounded-full border border-slate-700">  
        Doğru: 0 / 0  
      </span>  
    </div>  
  </header>  
  
  <main class="p-4 max-w-lg mx-auto space-y-4">  
  
    <section id="tab-konu" class="space-y-3">  
      <div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3">  
        <label class="block text-xs font-semibold text-slate-500 uppercase">Çalışılacak Vergi Konusu</label>  
        <input id="topicInput" type="text" value="Kurumlar Vergisi - İştirak Kazançları İstisnası (KVK m.5/1-a)"  
          class="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-slate-900" />  
        <button onclick="generateDailyContent()" id="btnGenerate"  
          class="w-full bg-slate-900 active:bg-slate-800 text-white font-medium py-3 rounded-xl text-sm shadow">  
          Günün Konusunu ve Sorusunu Üret  
        </button>  
      </div>  
  
      <div id="lessonCard" class="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-2">  
        <span class="inline-block text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">Günün Konu Özeti</span>  
        <h2 id="lessonTitle" class="text-base font-bold text-slate-900">İştirak Kazançları İstisnası (KVK m. 5/1-a)</h2>  
        <div id="lessonBody" class="text-sm text-slate-700 leading-relaxed whitespace-pre-line">  
          <p class="mb-2"><strong>Temel Kural:</strong> Tam mükellef kurumların, başka bir tam mükellef kuruma iştiraklerinden elde ettikleri kâr payları kurumlar vergisinden istisnadır.</p>  
          <p class="mb-2"><strong>Kritik Ayrım:</strong> Fon ve yatırım ortaklıklarının katılma payları/hisselerinden elde edilen kâr paylarında istisna şartları kanundaki özel hükümlere tabidir.</p>  
          <p class="text-xs text-slate-500 pt-2 border-t">Dayanak: 5520 sayılı KVK Madde 5/1-a</p>  
        </div>  
      </div>  
  
      <div id="topicPerformanceCard" class="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-2.5">  
        <div class="flex items-center justify-between">  
          <h3 class="text-xs font-bold text-slate-500 uppercase tracking-wide">Konu Performans Özeti</h3>  
          <button onclick="resetTopicStats()" class="text-[11px] text-slate-400 active:text-rose-600">  
            Sıfırla  
          </button>  
        </div>  
        <div id="topicPerformanceList" class="space-y-2"></div>  
      </div>  
    </section>  
  
    <section id="tab-soru" class="hidden space-y-3">  
      <div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3">  
        <div class="flex items-center justify-between gap-2">  
          <span class="inline-block text-[11px] font-semibold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md">Günün Vaka Sorusu</span>  
          <span id="retryTag" class="hidden text-[11px] font-semibold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-md">Hata Defterinden Tekrar</span>  
        </div>  
        <p id="questionText" class="text-sm font-medium text-slate-800 leading-relaxed">  
          Tam mükellef (A) A.Ş., %15 oranında iştirak ettiği tam mükellef (B) Ltd. Şti.’nden 2026 yılında 1.000.000 TL kâr payı elde etmiştir. (A) A.Ş. bu iştirak hisselerini 6 aydır aktifinde tutmaktadır. Kurumlar vergisi istisnası açısından doğru değerlendirme hangisidir?  
        </p>  
        <div id="optionsList" class="space-y-2"></div>  
        <button onclick="checkAnswer()" class="w-full bg-indigo-600 active:bg-indigo-700 text-white font-medium py-3 rounded-xl text-sm">  
          Cevabı Kontrol Et  
        </button>  
      </div>  
  
      <div id="explanationBox" class="hidden bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-2">  
        <div id="resultStatus" class="text-sm font-bold"></div>  
        <p id="explanationText" class="text-sm text-slate-700 leading-relaxed"></p>  
      </div>  
    </section>  
  
    <section id="tab-chat" class="hidden space-y-3">  
      <div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3">  
        <label class="block text-xs font-semibold text-slate-500 uppercase">Vergisel Soru Sor</label>  
        <textarea id="freeQuestion" rows="3" placeholder="Örn: Binek otomobil gider kısıtlamasında amortisman ve kira sınırları nasıl uygulanır?"  
          class="w-full border border-slate-300 rounded-xl p-3 text-sm focus:outline-none focus:border-slate-900"></textarea>  
        <button onclick="askFreeQuestion()" id="btnAsk"  
          class="w-full bg-slate-900 active:bg-slate-800 text-white font-medium py-3 rounded-xl text-sm">  
          Mevzuata Göre Yanıtla  
        </button>  
      </div>  
  
      <div id="chatAnswerBox" class="hidden bg-white p-4 rounded-2xl shadow-sm border border-slate-200 text-sm text-slate-800 leading-relaxed whitespace-pre-line"></div>  
    </section>  
  
    <section id="tab-hata" class="hidden space-y-3">  
      <div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">  
        <div>  
          <h2 class="text-sm font-bold text-slate-900">Hata Defteri</h2>  
          <p id="errorCountText" class="text-xs text-slate-500">0 kayıtlı soru bulunuyor</p>  
        </div>  
        <button onclick="clearErrorBook()" class="text-xs text-rose-600 font-medium px-2.5 py-1.5 rounded-lg border border-rose-200 active:bg-rose-50">  
          Temizle  
        </button>  
      </div>  
  
      <div id="errorList" class="space-y-3"></div>  
    </section>  
  
    <section id="tab-ayar" class="hidden space-y-3">  
      <div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3">  
        <h3 class="text-sm font-bold text-slate-900">API ve Model Ayarları</h3>  
        <div>  
          <label class="block text-xs text-slate-500 mb-1">Gemini API Anahtarı</label>  
          <input id="apiKeyInput" type="password" placeholder="AIza..."  
            class="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm" />  
        </div>  
        <div>  
          <label class="block text-xs text-slate-500 mb-1">Model Seçimi (Ücretsiz Katman Uyumlu)</label>  
          <select id="modelSelect" class="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white">  
            <option value="gemini-4-hydrogen">gemini-4-hydrogen (Yüksek Muhakeme)</option>  
            <option value="gemini-3.5-flash-lite">gemini-3.5-flash-lite (Geniş Günlük Kota)</option>  
            <option value="gemini-3.8-flash">gemini-3.8-flash (Dengeli Flash)</option>  
          </select>  
        </div>  
        <button onclick="saveSettings()" class="w-full bg-emerald-600 text-white font-medium py-2.5 rounded-xl text-sm">  
          Ayarları Telefona Kaydet  
        </button>  
      </div>  
  
      <div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-2">  
        <h3 class="text-sm font-bold text-slate-900">Mevzuat Havuzu (İsteğe Bağlı Kaynak)</h3>  
        <p class="text-xs text-slate-500">Yapıştırdığınız kanun/tebliğ metni soru ve konu üretiminde öncelikli kaynak alınır.</p>  
        <textarea id="lawContext" rows="5" placeholder="İlgili kanun maddesi veya tebliğ metnini buraya yapıştırın..."  
          class="w-full border border-slate-300 rounded-xl p-2.5 text-xs"></textarea>  
        <button onclick="saveLawContext()" class="w-full bg-slate-800 text-white font-medium py-2 rounded-xl text-xs">  
          Mevzuat Metnini Kaydet  
        </button>  
      </div>  
    </section>  
  
  </main>  
  
  <nav class="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 flex justify-around py-2 safe-bottom z-30">  
    <button onclick="switchTab('konu')" id="nav-konu" class="flex flex-col items-center text-[11px] font-bold text-slate-900">  
      <span>📖</span><span>Konu</span>  
    </button>  
    <button onclick="switchTab('soru')" id="nav-soru" class="flex flex-col items-center text-[11px] font-medium text-slate-400">  
      <span>✍️</span><span>Soru</span>  
    </button>  
    <button onclick="switchTab('chat')" id="nav-chat" class="flex flex-col items-center text-[11px] font-medium text-slate-400">  
      <span>💬</span><span>Soru-Cevap</span>  
    </button>  
    <button onclick="switchTab('hata')" id="nav-hata" class="flex flex-col items-center text-[11px] font-medium text-slate-400">  
      <span>📕</span><span>Hata Defteri</span>  
    </button>  
    <button onclick="switchTab('ayar')" id="nav-ayar" class="flex flex-col items-center text-[11px] font-medium text-slate-400">  
      <span>⚙️</span><span>Ayarlar</span>  
    </button>  
  </nav>  
  
  <script src="./app.js"></script>  
</body>  
</html>  
