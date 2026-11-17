"""Konfigurasi aplikasi, dibaca dari backend/.env."""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
# "auto" = pilih otomatis versi Flash/Pro terbaru yang tersedia untuk API key.
# Jika nama yang diisi tidak tersedia, backend juga jatuh ke pilihan otomatis.
GEMINI_MODEL_FAST = os.getenv("GEMINI_MODEL_FAST", "auto").strip()  # keluarga Flash
GEMINI_MODEL_LITE = os.getenv("GEMINI_MODEL_LITE", "auto").strip()  # keluarga Flash-Lite

# Mode Seimbang / Mendalam: jika Flash belum menjawab dalam N detik, Flash-Lite dijalankan paralel.
HEDGE_FLASH_SECONDS = float(os.getenv("HEDGE_FLASH_SECONDS", "20"))
HEDGE_DEEP_SECONDS = float(os.getenv("HEDGE_DEEP_SECONDS", "45"))

# Cache info video, transkrip & hasil analisa (menit)
CACHE_MINUTES = int(os.getenv("CACHE_MINUTES", "30"))

# Batas waktu satu permintaan ke Gemini (detik)
GEMINI_TIMEOUT_SECONDS = int(os.getenv("GEMINI_TIMEOUT_SECONDS", "120"))

# Tampilan website versi statis (hasil `npm run build:static`). Jika folder ini ada, backend ikut
# melayani website di "/", sehingga cukup satu server tanpa Node.js (dipakai di HP lewat Termux).
WEB_DIR = Path(os.getenv("WEB_DIR", str(BASE_DIR / "web")))

DOWNLOAD_DIR = BASE_DIR / "downloads"
DOWNLOAD_DIR.mkdir(exist_ok=True)

FILE_TTL_MINUTES = int(os.getenv("FILE_TTL_MINUTES", "60"))
MAX_CLIP_SECONDS = int(os.getenv("MAX_CLIP_SECONDS", "1800"))
MAX_CONCURRENT_JOBS = int(os.getenv("MAX_CONCURRENT_JOBS", "2"))

MIN_CLIPS = 5
MAX_CLIPS = 10

ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
    if o.strip()
]
