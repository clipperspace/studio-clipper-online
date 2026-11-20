# 🎬 Studio Clipper

**Potong. Klip. Viral.** Ubah video YouTube panjang (podcast, wawancara, livestream) menjadi klip
pendek siap upload untuk TikTok, Reels, dan Shorts.

- ✨ **AI Viral Finder**: tulis prompt, lalu **Gemini AI** menemukan 5–10 momen paling berpotensi
  viral, lengkap dengan **skor, alasan, hook, dan headline**
- ✂️ **Potong pakai timestamp**: isi waktu mulai & selesai, bisa banyak klip sekaligus
- 📐 **Format 9:16, 1:1, 16:9**, atau **MP3**, dengan kualitas 360p–1080p
- ✏️ **Editor klip**: preview langsung, rasio 9:16 / 1:1 / 4:5 / 16:9, latar blur / hitam / penuh,
  dan preset gaya edit (fitur lain menyusul, lihat [roadmap](docs/ROADMAP.md))
- ⬇️ **Unduh video full**: video YouTube utuh (MP4 360p–1080p) atau audionya saja (MP3)
- 🎵 **Unduh video TikTok tanpa watermark** (MP4 kualitas asli) atau suaranya (MP3)
- 🔒 **Berjalan di perangkat sendiri** (PC atau HP Android), tanpa akun, tanpa server pihak ketiga

---

## 🚀 Instalasi

> 📖 **[Baca tutorial instalasi lengkap (langkah demi langkah) →](docs/INSTALL.md)**

**💻 Windows** (disarankan)
1. Pasang program pendukung (sekali saja), lalu tutup jendela Terminal:
   ```powershell
   winget install Python.Python.3.12 Gyan.FFmpeg
   ```
2. Klik **Code → Download ZIP** di halaman ini, lalu ekstrak.
3. Klik dua kali **`start.bat`**, lalu tempel [API key Gemini](https://aistudio.google.com/apikey)
   saat diminta. Browser terbuka di http://localhost:3000

**📱 Android tanpa PC** (Termux dari [F-Droid](https://f-droid.org/packages/com.termux/))
```bash
curl -fsSL https://raw.githubusercontent.com/clipperspace/studio-clipper-online/main/termux/install.sh | bash
```
Setelah selesai, jalankan `studio-clipper`. Lihat [panduan Android](docs/INSTALL.md#b-hp-android-tanpa-pc-termux).

**🍎 macOS / 🐧 Linux**: lihat [instalasi manual](docs/INSTALL.md#c-macos--linux-manual).

**📱 iPhone / HP lain**: buka lewat PC di Wi-Fi yang sama
([caranya](docs/INSTALL.md#membuka-dari-hp-lewat-pc-wi-fi-yang-sama)).

Ada kendala? Lihat [Mengatasi masalah](docs/INSTALL.md#mengatasi-masalah).

**🌐 Versi online (tanpa install)**: siapa pun bisa mencari klip viral dari browser dengan API key
Gemini miliknya sendiri, lalu mengunduh lewat versi lokal. Lihat
[panduan deploy ke Railway](docs/DEPLOY-ONLINE.md).

---

## 🎯 Cara memakai

Jendela Studio di halaman utama punya dua grup: **✂️ Buat klip** (Cari dengan AI, Timestamp) dan
**⬇️ Unduh video** (YouTube, TikTok). Menempel link TikTok di mana pun langsung membuka tab TikTok.

**✂️ Buat klip → ✨ Cari dengan AI**
1. Tempel link video YouTube
2. Tulis prompt: klip seperti apa yang dicari, jumlah (5–10), dan durasinya
3. Klik **Analisa dengan AI**. Gemini membaca transkrip atau menonton video
4. Muncul 5–10 kartu klip: skor viral, alasan, hook, headline, dan preview
5. Ubah waktu jika perlu, centang klip, pilih format, lalu **Unduh**

**✂️ Buat klip → ⏱️ Timestamp**
1. Tempel link, isi waktu **Mulai** & **Selesai**, lalu klik **Tambah klip** (bisa banyak)
2. Pilih format, lalu **Potong**

**⬇️ Unduh video → ▶️ YouTube**
1. Tempel link, pilih **Video MP4** (360p–1080p, rasio asli) atau **Audio MP3**
2. Klik **Unduh video full**. Video maksimal 4 jam (ubah lewat `MAX_FULL_MINUTES` di `backend/.env`)

**⬇️ Unduh video → 🎵 TikTok**
1. Tempel link TikTok (`tiktok.com/@akun/video/…`, `vm.tiktok.com/…`, atau `vt.tiktok.com/…`)
2. Pilih **Video MP4** (tanpa watermark, kualitas asli) atau **Audio MP3**, lalu **Unduh dari TikTok**

Untuk 9:16 dan 1:1, video utuh ditaruh di tengah dengan latar belakang blur.

**✏️ Editor klip**
1. Di kartu hasil AI atau daftar Timestamp, tekan **✏️ Edit**
2. Potongan video diunduh sekali, lalu muncul preview
3. Pilih rasio, latar (blur / hitam / penuh), dan kualitas. Simpan sebagai **preset** jika sering dipakai
4. Klik **Render & unduh**. Bisa dirender berkali-kali tanpa unduh ulang

---

## 🛠 Untuk developer

**Kebutuhan:** Python 3.10+, Node.js 20+, FFmpeg di PATH, API key Gemini.

`start.bat` untuk pengguna biasa tidak butuh Node.js: tampilan siap pakai (`web.zip`) dilayani backend
Python di port 3000. Untuk mengubah tampilan, pakai **`start-dev.bat`** (backend port 8000 + Next.js dev
server port 3000 dengan hot reload), atau jalankan manual:

```bash
# Backend (port 8000)
backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --port 8000

# Frontend (port 3000), meneruskan /api/* ke backend
npm --prefix frontend run dev

# Build tampilan statis (dipakai instalasi Android; dilayani backend dari backend/web/)
npm --prefix frontend run build:static
```

GitHub Actions membangun tampilan statis menjadi `web.zip` di rilis
[`web-latest`](https://github.com/clipperspace/studio-clipper-online/releases/tag/web-latest)
setiap ada perubahan di folder `frontend/`. `start.bat` (Windows), Termux (Android), dan versi online
mengunduh file ini, lalu backend Python melayani tampilan dan API sekaligus di satu port, sehingga
pengguna tidak perlu Node.js.

## Struktur

```
backend/                 FastAPI + yt-dlp + Gemini
  app/main.py            Endpoint API
  app/ai.py              Prompt sistem, skema JSON, dan validasi klip dari Gemini
  app/youtube.py         Metadata, transkrip, dan potong klip (yt-dlp + FFmpeg)
  app/editor.py          Editor: resep edit, unggah file, dan render (FFmpeg)
  app/jobs.py            Antrean job & auto-hapus file (default 60 menit)
  .env                   Konfigurasi & API key (rahasia)
frontend/                Next.js 16 + Motion
  app/page.tsx           Landing page
  app/studio/page.tsx    Halaman Studio (alat utama)
  app/editor/page.tsx    Halaman Editor klip
  components/            Komponen landing & studio
  app/globals.css        Design system (warna brand, font Sora + Inter)
termux/                  Skrip instalasi & perintah studio-clipper untuk Android
docs/INSTALL.md          Tutorial instalasi lengkap
docs/ROADMAP.md          Rencana fitur editor
.github/workflows/       Build tampilan statis (web.zip) otomatis
start.bat                Penyiapan & peluncur satu klik untuk Windows (tanpa Node.js)
start-dev.bat            Mode pengembangan (Next.js dev server + backend)
Dockerfile, railway.json Versi online (hibrida) untuk Railway, lihat docs/DEPLOY-ONLINE.md
```

## API

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/health` | Status backend, FFmpeg, dan API key |
| POST | `/api/info` | `{url}` → judul, durasi, thumbnail, resolusi (untuk preview & timeline) |
| POST | `/api/ai-analyze` | `{url, prompt, count, mode, model}` → job analisa AI |
| POST | `/api/clip` | `{url, title, clips[], format, height, aspect}` → job potong klip (`aspect`: 16:9 / 9:16 / 1:1) |
| POST | `/api/full` | `{url, format, height}` → job unduh video YouTube / TikTok utuh (`format`: mp4 / mp3) |
| POST | `/api/editor/source` | `{url, start, end, height}` → job siapkan potongan video untuk editor (±15 detik di kiri-kanan) |
| GET | `/api/editor/source/{id}/video` | Video sumber untuk preview |
| POST | `/api/editor/upload?name=` | Isi file sebagai body → unggah video/audio milik pengguna (maks. `MAX_UPLOAD_MB`) |
| GET | `/api/editor/upload/{id}` | File unggahan |
| POST | `/api/editor/render` | `{source_id, title, recipe}` → job render resep edit menjadi MP4 |
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
- **TikTok** butuh library `curl_cffi` (dipasang & diperbarui otomatis oleh `start.bat`). Post foto/slideshow,
  video private, dan analisa AI untuk TikTok belum didukung. Di Android (Termux) TikTok belum tentu berjalan.
- **Legal:** gunakan hanya untuk konten milik sendiri atau yang diizinkan pemiliknya. Mengunduh dari YouTube
  dapat melanggar Ketentuan Layanan YouTube dan hak cipta kreator.

## Lisensi

Kode di repository ini dirilis dengan [lisensi MIT](LICENSE): bebas dipakai, diubah, dan dibagikan,
termasuk untuk keperluan komersial, selama menyertakan pemberitahuan hak cipta dan lisensinya.
Lisensi ini hanya berlaku untuk kode Studio Clipper, bukan untuk video yang diunduh dengannya.
