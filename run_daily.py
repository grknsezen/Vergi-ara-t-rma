import json
import os
import re
import time
from datetime import datetime
from pathlib import Path
import requests
from bs4 import BeautifulSoup
from google import genai
from google.genai import types

OUTPUT_DIR = Path("outputs")
DATA_DIR = Path("data")
OUTPUT_DIR.mkdir(exist_ok=True)
DATA_DIR.mkdir(exist_ok=True)

TEAM_MD = Path("team.md")
GIB_ARCHIVE_PATH = DATA_DIR / "gib_mevzuat.json"

SOURCES = {
    "resmi_gazete": "https://www.resmigazete.gov.tr/",
    "mevzuat_gov": "https://www.mevzuat.gov.tr/",
    "gib": "https://www.gib.gov.tr/duyuru-arsivi/guncel",
    "turmob": "https://www.turmob.org.tr/sirkuler",
}
ALLOWED_SECTORS = ["İhracat", "İnşaat", "Üretim", "Hizmet", "E-Ticaret", "Genel"]
TAX_KEYWORDS = [
    "vergi", "kdv", "kvk", "gvk", "vuk", "ötv", "harç", "damga",
    "tebliğ", "sirküler", "özelge", "iade", "tevkifat", "yeniden değerleme",
    "amortisman", "e-defter", "e-fatura", "sgk", "muhtasar", "matrah", "ceza"
]
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
}


def fetch_page_links(name: str, url: str) -> tuple[str, list[dict]]:
    try:
        resp = requests.get(url, headers=HEADERS, timeout=(5, 10))
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        links = []
        for a in soup.find_all("a", href=True):
            text = " ".join(a.get_text().split())
            href = a["href"].strip()
            if len(text) > 15:
                if href.startswith("/"):
                    href = url.rstrip("/") + href
                links.append({"baslik": text[:200], "url": href})
        if links:
            return "ok", links[:30]
    except Exception:
        pass

    # JS ile yüklenen sayfalarda (özellikle GİB) metin okuyucu fallback
    try:
        reader_url = f"https://r.jina.ai/http://{url.replace('https://', '').replace('http://', '')}"
        resp = requests.get(reader_url, headers=HEADERS, timeout=(6, 15))
        resp.raise_for_status()
        lines = [line.strip() for line in resp.text.splitlines() if len(line.strip()) > 20]
        parsed = []
        for line in lines[:40]:
            clean = re.sub(r"[#*_`]+", "", line).strip()
            if len(clean) > 20:
                parsed.append({"baslik": clean[:200], "url": url})
        if parsed:
            return "ok:reader", parsed[:25]
    except Exception as exc:
        return f"erisim_hatasi:{type(exc).__name__}", []

    return "bos_icerik", []


def load_gib_archive() -> list[dict]:
    if not GIB_ARCHIVE_PATH.exists():
        return []
    try:
        data = json.loads(GIB_ARCHIVE_PATH.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except Exception:
        return []


def update_gib_archive(today: str, gib_items: list[dict]) -> list[dict]:
    archive = load_gib_archive()
    seen = {(item.get("baslik", "").lower(), item.get("url", "")) for item in archive}
    added = 0

    for item in gib_items:
        key = (item.get("baslik", "").lower(), item.get("url", ""))
        if key not in seen and item.get("baslik"):
            seen.add(key)
            archive.insert(0, {
                "id": f"gib-{today}-{len(archive)+1}",
                "eklenme_tarihi": today,
                "kaynak": "gib.gov.tr",
                "baslik": item["baslik"],
                "url": item.get("url", "https://www.gib.gov.tr/"),
            })
            added += 1

    # Arşivi makul boyutta tut (son 400 kayıt)
    archive = archive[:400]
    GIB_ARCHIVE_PATH.write_text(json.dumps(archive, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[GİB Arşiv] +{added} yeni kayıt eklendi (Toplam: {len(archive)})", flush=True)
    return archive


def run_scout() -> dict:
    today = datetime.now().strftime("%Y-%m-%d")
    results = []
    for name, url in SOURCES.items():
        print(f"[Tarayıcı] Kontrol ediliyor: {name}...", flush=True)
        status, links = fetch_page_links(name, url)
        print(f"[Tarayıcı] {name} -> {status} ({len(links)} kayıt)", flush=True)
        results.append({"kaynak": name, "durum": status, "ham_veriler": links})

    gib_raw = next((r["ham_veriler"] for r in results if r["kaynak"] == "gib"), [])
    archive = update_gib_archive(today, gib_raw)

    return {
        "tarih": today,
        "kaynaklar": results,
        "gib_arsiv_ozeti": archive[:25],
    }


def get_available_models(client) -> list[str]:
    preferred = [os.environ.get("GEMINI_MODEL", "gemini-3.8-flash")]
    discovered = []
    try:
        for m in client.models.list():
            name = (m.name or "").replace("models/", "")
            actions = getattr(m, "supported_actions", None) or getattr(m, "supported_generation_methods", []) or []
            if "gemini" in name and "generateContent" in actions and "embedding" not in name and "image" not in name:
                if not name.startswith("gemini-2.5"):
                    discovered.append(name)
    except Exception as exc:
        print(f"[API] Model listesi alınamadı: {exc}", flush=True)

    discovered.sort(key=lambda x: (0 if "flash" in x else 1, x))
    models = list(dict.fromkeys(preferred + discovered))
    print(f"[API] Aktif modeller: {models[:4]}", flush=True)
    return models[:4]


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
            print("[API] Modeller yoğun, 15 sn sonra tekrar deneniyor...", flush=True)
            time.sleep(15)

    raise last_error


def build_keyword_fallback_bulletin(scout_data: dict) -> list[dict]:
    items = []
    idx = 1
    for src in scout_data.get("kaynaklar", []):
        kaynak = src.get("kaynak", "")
        for row in src.get("ham_veriler", []):
            title = row.get("baslik", "")
            low = title.lower()
            if any(k in low for k in TAX_KEYWORDS):
                items.append({
                    "id": f"{scout_data['tarih']}-{idx:02d}",
                    "oncelik": "IZLENECEK",
                    "durum": "YURURLUKTE",
                    "baslik": title,
                    "mevzuat_ref": f"Kaynak: {kaynak}",
                    "yururluk_tarihi": scout_data["tarih"],
                    "sektorler": ["Genel"],
                    "etkilenen_alan": "Vergi / Mevzuat Tarama",
                    "ymm_aksiyonu": "İlgili başlığın tam metnini resmi kaynaktan inceleyip mükellef etkisini değerlendir.",
                    "kaynak_url": row.get("url", "https://www.resmigazete.gov.tr/"),
                })
                idx += 1
                if len(items) >= 10:
                    return items
    return items


def run_analyst(scout_data: dict, feedback: str = "") -> dict:
    print("[Analist] Bülten hazırlanıyor...", flush=True)
    sys_prompt = f"""
Sen YMM Mevzuat Analistisin. Tarayıcı ham verilerinden ve GİB arşivinden YALNIZCA vergi, KDV iadesi, tam tasdik, VUK, KVK, GVK, ÖTV, Damga/Harç ve SGK/teşvik konularını ayıkla.
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
    draft = {"gelismeler": []}
    check = {"puan": 3, "onay": False, "duzeltme_notu": "Anahtar kelime filtresiyle üretildi"}
    ai_used = False

    try:
        for _ in range(2):
            draft = run_analyst(scout_data, feedback=feedback)
            check = run_checker(scout_data, draft)
            ai_used = True
            if check["onay"]:
                break
            geri_gonderim += 1
            feedback = check.get("duzeltme_notu", "")
    except Exception as exc:
        print(f"[Lider] LLM yanıt vermedi ({type(exc).__name__}), anahtar kelime bülteni devrede.", flush=True)
        draft = {"gelismeler": build_keyword_fallback_bulletin(scout_data)}
        check = {"puan": 4, "onay": True, "duzeltme_notu": "Ham kaynak anahtar kelime filtresi"}

    final_json = {
        "tarih": tarih,
        "denetci_puani": check["puan"],
        "onay": check["onay"],
        "ai_destekli": ai_used,
        "kaynak_durumu": kaynak_durumu,
        "gelismeler": draft.get("gelismeler", []),
    }

    text = json.dumps(final_json, ensure_ascii=False, indent=2)
    (OUTPUT_DIR / f"{tarih}.json").write_text(text, encoding="utf-8")
    (OUTPUT_DIR / "latest.json").write_text(text, encoding="utf-8")

    with TEAM_MD.open("a", encoding="utf-8") as f:
        f.write(f"\n- **{tarih}:** Puan {check['puan']}/5 | AI: {ai_used} | Kaynaklar: {kaynak_durumu}\n")

    print(f"[Lider] Tamamlandı: {tarih} | Gelişme: {len(final_json['gelismeler'])}", flush=True)


if __name__ == "__main__":
    main()
