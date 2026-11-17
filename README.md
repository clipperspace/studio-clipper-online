# 🎬 Studio Clipper Online

AI clip finder untuk video YouTube. Tempel link, tulis prompt, lalu **Gemini AI** akan menemukan
5–10 potongan yang paling berpotensi viral, lengkap dengan **alasan, hook, dan headline**.
Unduh sebagai **MP4 (360p–1080p)** atau **MP3**.

## Alur kerja

Di jendela Studio pada landing page ada dua tab:

**✨ Cari dengan AI**
1. Tempel link video YouTube (misalnya podcast)
2. Tulis prompt: klip seperti apa yang dicari, jumlah (5–10), dan durasinya
3. Klik **Analisa dengan AI**. Gemini membaca transkrip atau menonton video
4. Tampil 5–10 kartu klip: skor viral, alasan, hook, headline, dan preview
5. Ubah waktu jika perlu, centang klip, pilih format, lalu **Unduh**

**✂️ Timestamp (manual)**
1. Tempel link, lalu isi waktu **Mulai** & **Selesai**, dan klik **Tambah klip** (bisa banyak)
2. Pilih format, lalu **Potong**

**Format:** 9:16 (TikTok/Reels/Shorts) · 1:1 (feed Instagram) · 16:9 (YouTube) · MP3.
Untuk 9:16 dan 1:1, video utuh ditaruh di tengah dengan latar belakang blur. Resolusi 360p–1080p.

## Kebutuhan

- Python 3.10+
- Node.js 20+
- FFmpeg (harus ada di PATH)
- API key Gemini (gratis): https://aistudio.google.com/apikey

## Menjalankan

### 1. Isi API key (sekali saja)
Buka `backend/.env` lalu isi:
```
GEMINI_API_KEY=key_anda_di_sini
```
> Jangan pernah membagikan file `.env`, karena isinya rahasia.

### 2. Jalankan
Klik dua kali **`start.bat`**. Skrip ini akan:
- menyiapkan backend & frontend (hanya saat pertama kali),
- memperbarui yt-dlp (penting, karena YouTube sering berubah),
- membuka dua jendela server dan browser di http://localhost:3000.

Untuk menghentikan, tutup kedua jendela "Studio Clipper".

### Manual
```bash
# Backend (port 8000)
backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --port 8000

# Frontend (port 3000)
npm --prefix frontend run dev
```

## Membuka dari HP

1. Pastikan HP dan PC terhubung ke **Wi-Fi yang sama**, dan Studio Clipper sudah berjalan di PC.
2. Di jendela "Studio Clipper - Frontend", cari baris `Network: http://192.168.x.x:3000`.
3. Buka alamat itu di browser HP. Hasil unduhan tersimpan di folder Download HP.

Catatan:
- Alamat IP bisa berubah saat router memberi IP baru. Lihat lagi baris `Network:` jika tidak bisa dibuka.
- Jika HP tidak bisa membuka halaman, izinkan **Node.js** di Windows Firewall untuk jaringan tersebut.
- Backend (port 8000) sengaja hanya bisa diakses dari PC sendiri; HP mengaksesnya lewat frontend.

## Struktur

```
backend/                 FastAPI + yt-dlp + Gemini
  app/main.py            Endpoint API
  app/ai.py              Prompt sistem, skema JSON, dan validasi klip dari Gemini
  app/youtube.py         Metadata, transkrip, dan potong klip (yt-dlp + FFmpeg)
  app/jobs.py            Antrean job & auto-hapus file (default 60 menit)
  .env                   Konfigurasi & API key (rahasia)
frontend/                Next.js 16 + Motion
  app/page.tsx           Landing page
  app/studio/page.tsx    Halaman Studio (alat utama)
  components/            Komponen landing & studio
  app/globals.css        Design system (light/dark otomatis)
```

## API

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/health` | Status backend, FFmpeg, dan API key |
| POST | `/api/info` | `{url}` → judul, durasi, thumbnail, resolusi (untuk preview & timeline) |
| POST | `/api/ai-analyze` | `{url, prompt, count, mode, model}` → job analisa AI |
| POST | `/api/clip` | `{url, title, clips[], format, height, aspect}` → job potong klip (`aspect`: 16:9 / 9:16 / 1:1) |
| GET | `/api/job/{id}` | Status & progres job |
| GET | `/api/download/{id}` | Unduh hasil (file tunggal atau ZIP) |

**Mode analisa**
- `auto`: pakai transkrip jika ada, jika tidak Gemini menonton video
- `transcript`: hanya transkrip (paling cepat & hemat kuota)
- `video`: Gemini menonton video langsung (hanya video publik)

## Catatan

- **Kecepatan AI** (pilihan di Studio):
  - ⚡ **Kilat** (default): Gemini Flash-Lite, ±5–15 detik
  - ✨ **Seimbang**: Gemini Flash; jika belum menjawab dalam 20 detik, Flash-Lite dijalankan paralel
  - 🧠 **Mendalam**: Flash dengan thinking tinggi; dibantu Flash-Lite setelah 45 detik
- **Model dipilih otomatis** (`auto`): backend mengukur kecepatan tiap model dan mencoba yang tercepat lebih
  dulu. Model yang sibuk (error 503) otomatis dilewati.
- **Cache 30 menit:** analisa ulang dengan prompt yang sama tampil instan, dan prompt baru untuk video yang
  sama melewati tahap baca info & transkrip.
- Jika muncul error verifikasi bot dari YouTube, tunggu beberapa saat. Error ini lebih jarang terjadi di koneksi rumah dibanding server/VPS.
- **Legal:** gunakan hanya untuk konten milik sendiri atau yang diizinkan pemiliknya. Mengunduh dari YouTube
  dapat melanggar Ketentuan Layanan YouTube dan hak cipta kreator.
