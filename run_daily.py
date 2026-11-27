import json
import os
import time
from datetime import datetime
from pathlib import Path
import requests
from bs4 import BeautifulSoup
from google import genai
from google.genai import types

OUTPUT_DIR = Path("outputs")
OUTPUT_DIR.mkdir(exist_ok=True)
TEAM_MD = Path("team.md")

SOURCES = {
    "resmi_gazete": "https://www.resmigazete.gov.tr/",
    "mevzuat_gov": "https://www.mevzuat.gov.tr/",
    "gib": "https://www.gib.gov.tr/duyuru-arsivi/guncel",
    "turmob": "https://www.turmob.org.tr/sirkuler",
}
ALLOWED_SECTORS = ["İhracat", "İnşaat", "Üretim", "Hizmet", "E-Ticaret", "Genel"]
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
}


def run_scout() -> dict:
    today = datetime.now().strftime("%Y-%m-%d")
    results = []
    for name, url in SOURCES.items():
        print(f"[Tarayıcı] Kontrol ediliyor: {name}...", flush=True)
        try:
            resp = requests.get(url, headers=HEADERS, timeout=(5, 10))
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")
            links = []
            for a in soup.find_all("a", href=True):
                text = " ".join(a.get_text().split())
                href = a["href"]
                if len(text) > 15:
                    if href.startswith("/"):
                        href = url.rstrip("/") + href
                    links.append({"baslik": text[:180], "url": href})
            print(f"[Tarayıcı] {name} -> OK ({len(links[:25])} kayıt)", flush=True)
            results.append({"kaynak": name, "durum": "ok", "ham_veriler": links[:25]})
        except Exception as exc:
            err_name = type(exc).__name__
            print(f"[Tarayıcı] {name} -> ATLANDI ({err_name})", flush=True)
            results.append({"kaynak": name, "durum": f"erisim_hatasi:{err_name}", "ham_veriler": []})
    return {"tarih": today, "kaynaklar": results}


def get_available_models(client) -> list[str]:
    preferred = [os.environ.get("GEMINI_MODEL", "gemini-3.8-flash")]
    discovered = []
    try:
        for m in client.models.list():
            name = (m.name or "").replace("models/", "")
            actions = getattr(m, "supported_actions", None) or getattr(m, "supported_generation_methods", []) or []
            if "gemini" in name and "generateContent" in actions and "embedding" not in name:
                discovered.append(name)
    except Exception as exc:
        print(f"[API] Model listesi alınamadı: {exc}", flush=True)

    discovered.sort(key=lambda x: (0 if "flash" in x else 1, x))
    models = list(dict.fromkeys(preferred + discovered))
    print(f"[API] Aktif modeller: {models[:5]}", flush=True)
    return models[:5]


def call_gemini_json(system_prompt: str, payload: str, temp: float = 0.1) -> dict:
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    models = get_available_models(client)
    last_error = None

    for round_no in range(2):
        for model in models:
            try:
                print(f"[API] Deneniyor: {model}...", flush=True)
                resp = client.models.generate_content(
                    model=model,
                    contents=payload,
                    config=types.GenerateContentConfig(
                        system_instruction=system_prompt,
                        response_mime_type="application/json",
                        temperature=temp,
                    ),
                )
                print(f"[API] Başarılı: {model}", flush=True)
                return json.loads(resp.text)
            except Exception as exc:
                last_error = exc
                print(f"[API] {model} atlandı ({type(exc).__name__})", flush=True)
                continue
        if round_no == 0:
            print("[API] Modeller yoğun, 20 sn sonra tekrar deneniyor...", flush=True)
            time.sleep(20)

    raise last_error


def run_analyst(scout_data: dict, feedback: str = "") -> dict:
    print("[Analist] Bülten hazırlanıyor...", flush=True)
    sys_prompt = f"""
Sen YMM Mevzuat Analistisin. Tarayıcı ham verilerinden YALNIZCA vergi, KDV iadesi, tam tasdik, VUK, KVK, GVK, ÖTV, Damga/Harç ve SGK/teşvik konularını ayıkla.
KURALLAR:
1. Ham veride olmayan hiçbir kanun/tebliğ numarası, oran veya URL uydurma.
2. Taslakları durum="TASLAK" ve oncelik="IZLENECEK" olarak işaretle.
3. Her gelişmeye yalnızca şu havuzdan en fazla 2 sektör etiketi ver: {ALLOWED_SECTORS}.
4. İlgili gelişme yoksa "gelismeler": [] döndür.
Çıktı formatı:
{{
  "tarih": "YYYY-MM-DD",
  "gelismeler": [
    {{
      "id": "YYYY-MM-DD-01",
      "oncelik": "KRITIK | IZLENECEK | BILGI",
      "durum": "YURURLUKTE | TASLAK",
      "baslik": "...",
      "mevzuat_ref": "...",
      "yururluk_tarihi": "...",
      "sektorler": ["Genel"],
      "etkilenen_alan": "...",
      "ymm_aksiyonu": "...",
      "kaynak_url": "..."
    }}
  ]
}}
"""
    content = f"HAM VERİ:\n{json.dumps(scout_data, ensure_ascii=False)}"
    if feedback:
        content += f"\n\nDENETÇİ DÜZELTME NOTU:\n{feedback}"
    return call_gemini_json(sys_prompt, content, temp=0.1)


def run_checker(scout_data: dict, draft: dict) -> dict:
    print("[Denetçi] Çapraz kontrol yapılıyor...", flush=True)
    sys_prompt = """
Sen YMM Mevzuat Denetçisisin. Analist taslağını ham veriyle karşılaştır ve 1-5 arası puanla.
Ham veride olmayan link, oran veya madde uydurulduysa puan <= 3 ver.
Çıktı formatı: {"puan": 5, "duzeltme_notu": "Onaylandı veya düzeltilecek net nokta"}
"""
    payload = json.dumps({"ham_veri": scout_data, "analist_taslagi": draft}, ensure_ascii=False)
    res = call_gemini_json(sys_prompt, payload, temp=0.0)
    res["onay"] = res.get("puan", 0) >= 4
    print(f"[Denetçi] Puan: {res.get('puan')}/5 ({res.get('duzeltme_notu')})", flush=True)
    return res


def main():
    scout_data = run_scout()
    tarih = scout_data["tarih"]
    kaynak_durumu = {k["kaynak"]: k["durum"] for k in scout_data["kaynaklar"]}

    feedback = ""
    geri_gonderim = 0
    draft, check = {}, {"puan": 0, "onay": False, "duzeltme_notu": "Çalışmadı"}

    for _ in range(2):
        draft = run_analyst(scout_data, feedback=feedback)
        check = run_checker(scout_data, draft)
        if check["onay"]:
            break
        geri_gonderim += 1
        feedback = check.get("duzeltme_notu", "")

    final_json = {
        "tarih": tarih,
        "denetci_puani": check["puan"],
        "onay": check["onay"],
        "kaynak_durumu": kaynak_durumu,
        "gelismeler": draft.get("gelismeler", []),
    }

    text = json.dumps(final_json, ensure_ascii=False, indent=2)
    (OUTPUT_DIR / f"{tarih}.json").write_text(text, encoding="utf-8")
    (OUTPUT_DIR / "latest.json").write_text(text, encoding="utf-8")

    with TEAM_MD.open("a", encoding="utf-8") as f:
        f.write(f"\n- **{tarih}:** Puan {check['puan']}/5 | Tur: {geri_gonderim} | Kaynaklar: {kaynak_durumu}\n")

    print(f"[Lider] Tamamlandı: {tarih} | Puan: {check['puan']}/5 | Gelişme: {len(final_json['gelismeler'])}", flush=True)


if __name__ == "__main__":
    main()
