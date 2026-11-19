# 📦 Tutorial Instalasi Studio Clipper

Panduan lengkap dari nol sampai Studio Clipper berjalan, untuk pemula.

**Daftar isi**
- [Pilih cara instalasi](#pilih-cara-instalasi)
- [Langkah 0: Buat API key Gemini (gratis)](#langkah-0-buat-api-key-gemini-gratis)
- [A. Windows (PC / laptop)](#a-windows-pc--laptop)
- [B. HP Android tanpa PC (Termux)](#b-hp-android-tanpa-pc-termux)
- [C. macOS / Linux (manual)](#c-macos--linux-manual)
- [Membuka dari HP lewat PC (Wi-Fi yang sama)](#membuka-dari-hp-lewat-pc-wi-fi-yang-sama)
- [Memperbarui Studio Clipper](#memperbarui-studio-clipper)
- [Mengatasi masalah](#mengatasi-masalah)
- [Menghapus Studio Clipper](#menghapus-studio-clipper)

---

## Pilih cara instalasi

| Perangkat | Cara | Tingkat kesulitan | Waktu instalasi |
|---|---|---|---|
| 💻 **Windows** (disarankan) | [Klik `start.bat`](#a-windows-pc--laptop) | ⭐ Mudah | ±10 menit |
| 📱 **Android** tanpa PC | [Satu perintah di Termux](#b-hp-android-tanpa-pc-termux) | ⭐⭐ Sedang | ±15–40 menit |
| 🍎 **macOS / 🐧 Linux** | [Perintah manual](#c-macos--linux-manual) | ⭐⭐⭐ Teknis | ±10 menit |
| 📱 **iPhone** | Belum bisa berjalan sendiri. Pakai lewat PC di Wi-Fi yang sama ([caranya](#membuka-dari-hp-lewat-pc-wi-fi-yang-sama)) | | |

> Studio Clipper berjalan **di perangkat Anda sendiri**. Tidak ada server pusat, tidak perlu daftar akun.

---

## Langkah 0: Buat API key Gemini (gratis)

API key dibutuhkan untuk fitur **✨ Cari dengan AI**. Fitur **✂️ Timestamp** (potong manual) tetap
bisa dipakai tanpa API key.

1. Buka **https://aistudio.google.com/apikey**
2. Login dengan akun Google.
3. Klik **Create API key** (atau **Buat kunci API**).
4. **Salin** kunci yang muncul. Bentuknya seperti `AIzaSy...` (±39 karakter).
5. Simpan sementara di tempat aman. Kunci ini akan ditempel saat instalasi.

> ⚠️ **API key itu rahasia**, seperti password. Jangan dibagikan, jangan diunggah ke GitHub,
> dan jangan dikirim di chat. Kuota gratisnya cukup untuk pemakaian pribadi.

---

## A. Windows (PC / laptop)

### A1. Pasang program pendukung

Studio Clipper butuh **Python** dan **FFmpeg**. Node.js **tidak** diperlukan.

1. Klik kanan tombol **Start** → pilih **Terminal** (atau **Windows PowerShell**).
2. Tempel perintah ini lalu tekan **Enter**:
   ```powershell
   winget install Python.Python.3.12 Gyan.FFmpeg
   ```
3. Jika ditanya persetujuan, ketik `Y` lalu Enter. Jika muncul jendela izin administrator, klik **Yes**.
4. **Tutup jendela Terminal** setelah selesai. Program baru hanya terbaca di jendela baru.

<details>
<summary>Alternatif: pasang manual tanpa winget</summary>

- **Python**: unduh dari https://www.python.org/downloads/. Saat instalasi,
  **centang "Add python.exe to PATH"**.
- **FFmpeg**: cara termudah tetap lewat winget: `winget install Gyan.FFmpeg`.
</details>

**Cek hasilnya** (opsional). Buka Terminal baru, lalu jalankan satu per satu:
```powershell
python --version
ffmpeg -version
```
Keduanya harus menampilkan nomor versi, bukan pesan error.

### A2. Unduh Studio Clipper

**Cara 1: Download ZIP (paling mudah)**
1. Buka https://github.com/clipperspace/studio-clipper-online
2. Klik tombol hijau **Code** → **Download ZIP**.
3. Klik kanan file ZIP → **Extract All…** → pilih lokasi, misalnya `Documents\Studio Clipper`.

> ❗ Jangan menjalankan dari dalam file ZIP. Ekstrak dulu.

**Cara 2: Git (untuk yang sudah terbiasa)**
```powershell
git clone https://github.com/clipperspace/studio-clipper-online.git
```

### A3. Jalankan pertama kali

1. Buka folder hasil ekstrak, lalu **klik dua kali `start.bat`**.
2. Jika muncul **"Windows protected your PC"**, klik **More info** → **Run anyway**.
   Ini normal untuk file `.bat` yang diunduh dari internet.
3. Tunggu proses persiapan (**±1–3 menit**, hanya saat pertama kali). `start.bat` memasang library
   Python dan mengunduh tampilan website (±0,5 MB) dari GitHub.
4. Saat diminta, **tempel API key Gemini** (klik kanan di jendela hitam untuk menempel), lalu tekan Enter.
   Kosongkan lalu Enter jika ingin melewati (fitur AI belum aktif).
5. Jika muncul jendela **Windows Firewall** untuk **Python**, klik **Allow** / **Izinkan**
   (dibutuhkan jika ingin membuka dari HP).
6. Browser terbuka otomatis di **http://localhost:3000** 🎉

`start.bat` berjalan di **satu jendela** bernama **Studio Clipper**, yang juga menampilkan alamat untuk
dibuka dari HP. Biarkan jendela itu tetap terbuka selama memakai Studio Clipper.

### A4. Pemakaian sehari-hari

- **Menyalakan**: klik dua kali `start.bat`. Setelah instalasi pertama, prosesnya hanya ±10 detik.
- **Mematikan**: tutup jendela **Studio Clipper**.
- **Mengganti API key**: buka `backend\.env` dengan Notepad, ubah baris `GEMINI_API_KEY=...`, simpan,
  lalu jalankan ulang `start.bat`.

---

## B. HP Android tanpa PC (Termux)

Studio Clipper bisa berjalan **sepenuhnya di HP Android**, tanpa PC.

> Butuh Android 7 ke atas, RAM 3 GB, dan ruang kosong ±1,5 GB saat instalasi. Setelah selesai, alat
> compile dihapus otomatis sehingga Studio Clipper hanya memakai ±400–600 MB. Memotong video membuat HP hangat dan baterai
> lebih cepat berkurang. Kualitas 720p lebih ringan daripada 1080p.

### B1. Pasang Termux

Unduh **Termux** dari **F-Droid**: https://f-droid.org/packages/com.termux/
(atau dari https://github.com/termux/termux-app/releases).

> ❗ **Jangan pakai Termux dari Play Store.** Versinya sudah usang dan instalasi akan gagal.

### B2. Jalankan perintah instalasi

Buka Termux, tempel perintah ini (tekan lama layar → **Paste**), lalu tekan Enter:
```bash
curl -fsSL https://raw.githubusercontent.com/clipperspace/studio-clipper-online/main/termux/install.sh | bash
```

Skrip akan otomatis:
1. Memperbarui Termux
2. Memasang Python, FFmpeg, dan Git
3. Mengunduh Studio Clipper
4. Memasang library Python. **Langkah paling lama (10–30 menit)**, karena satu library harus
   di-compile di HP. Biarkan layar menyala dan Termux tetap terbuka.
5. Mengunduh tampilan website
6. Meminta **API key Gemini**. Tempel lalu Enter. Teksnya memang tidak terlihat saat ditempel,
   itu normal.
7. Membuat perintah `studio-clipper`

Jika ditanya pertanyaan `[Y/n]` di tengah proses, tekan Enter.

### B3. Menjalankan

```bash
studio-clipper
```
Browser terbuka otomatis di **http://localhost:3000**. Biarkan Termux tetap berjalan di latar belakang.
Untuk berhenti, kembali ke Termux lalu tekan **Ctrl + C** (tombol CTRL ada di baris tombol tambahan Termux).

### B4. Perintah lain

| Perintah | Fungsi |
|---|---|
| `studio-clipper` | Menyalakan Studio Clipper |
| `studio-clipper update` | Memperbarui kode, tampilan, dan yt-dlp |
| `studio-clipper key` | Mengganti API key Gemini |
| `studio-clipper help` | Bantuan |

### B5. Tips agar lancar

- **Matikan optimasi baterai untuk Termux**: Pengaturan → Aplikasi → Termux → Baterai →
  **Tidak dibatasi**. Ini mencegah Android menghentikan Termux saat layar mati.
- Untuk akses cepat, buka `http://localhost:3000` di Chrome → menu ⋮ → **Tambahkan ke layar utama**.

---

## C. macOS / Linux (manual)

> Cara ini belum diuji secara resmi di setiap sistem. Silakan laporkan di
> [Issues](https://github.com/clipperspace/studio-clipper-online/issues) jika ada kendala.

**1. Pasang Python 3.10+, FFmpeg, Git, dan unzip**
```bash
# macOS (Homebrew)
brew install python ffmpeg git

# Ubuntu / Debian
sudo apt install python3 python3-venv ffmpeg git curl unzip
```

**2. Unduh & siapkan**
```bash
git clone https://github.com/clipperspace/studio-clipper-online.git
cd studio-clipper-online
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
curl -fL -o /tmp/studio-clipper-web.zip \
  https://github.com/clipperspace/studio-clipper-online/releases/download/web-latest/web.zip
unzip -q -o /tmp/studio-clipper-web.zip -d backend/web
cp backend/.env.example backend/.env
```
Buka `backend/.env` lalu isi `GEMINI_API_KEY=` dengan API key Anda.

**3. Jalankan**
```bash
backend/.venv/bin/python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 3000
```
Buka **http://localhost:3000**. Untuk memperbarui tampilan, ulangi perintah `curl` dan `unzip` di atas.

---

## Membuka dari HP lewat PC (Wi-Fi yang sama)

Cocok untuk iPhone, atau jika tidak ingin memasang apa pun di HP.

1. Jalankan Studio Clipper di PC (`start.bat`).
2. Sambungkan HP ke **Wi-Fi yang sama** dengan PC.
3. Di jendela **Studio Clipper**, cari baris:
   ```
   Dari HP di Wi-Fi yang sama: http://192.168.x.x:3000
   ```
4. Ketik alamat itu di browser HP.

Hasil unduhan tersimpan di folder **Download** HP. Di iPhone, buka aplikasi **File** → **Unduhan**,
lalu ketuk video → Bagikan → **Simpan Video** agar masuk ke Foto.

> Alamat IP bisa berubah jika router memberi IP baru. Lihat lagi baris di jendela **Studio Clipper**
> jika tidak bisa dibuka.

---

## Memperbarui Studio Clipper

YouTube sering berubah, jadi sesekali perbarui Studio Clipper (terutama jika unduhan mulai gagal).

| Instalasi | Cara memperbarui |
|---|---|
| Windows (Git) | Di folder Studio Clipper: `git pull`, lalu jalankan `start.bat` |
| Windows (ZIP) | Unduh ZIP terbaru dan ekstrak ke folder baru, **salin file `backend\.env`** dari folder lama ke folder baru, lalu jalankan `start.bat` |
| Android | `studio-clipper update` |

> `start.bat` selalu memperbarui **yt-dlp** dan **tampilan website** otomatis setiap kali dijalankan.

---

## Mengatasi masalah

| Masalah | Solusi |
|---|---|
| `start.bat` menampilkan **"[x] Python/FFmpeg belum terpasang"** | Jalankan perintah `winget install ...` yang ditampilkan, **tutup jendela**, lalu jalankan `start.bat` lagi. |
| Perintah `winget` tidak dikenali | Perbarui **App Installer** dari Microsoft Store, atau pasang program secara manual (lihat [A1](#a1-pasang-program-pendukung)). |
| `python` membuka Microsoft Store | Python belum terpasang. Pasang lewat winget atau python.org (centang **Add to PATH**). |
| Halaman menampilkan **"Backend belum berjalan"** atau tidak terbuka | Jendela **Studio Clipper** tertutup atau error. Tutup semua jendela Studio Clipper, lalu jalankan `start.bat` lagi. |
| **"Gagal mengunduh tampilan website"** | `start.bat` pertama kali butuh internet untuk mengunduh tampilan (±0,5 MB). Periksa koneksi lalu jalankan lagi. |
| Muncul **"API key Gemini belum diatur"** | Isi `GEMINI_API_KEY=` di `backend\.env` (Android: `studio-clipper key`), lalu jalankan ulang. |
| **"API key Gemini tidak valid"** | Salin ulang kunci dari aistudio.google.com/apikey. Pastikan tidak ada spasi tambahan. |
| Analisa AI lama / **"server sibuk"** | Server Gemini sedang padat. Pilih kecepatan **⚡ Kilat**, atau coba lagi 1–2 menit kemudian. |
| **"Kuota Gemini habis"** | Kuota gratis harian habis. Tunggu sampai besok, atau pakai fitur **✂️ Timestamp** (tanpa AI). |
| **"YouTube meminta verifikasi bot"** | Tunggu beberapa saat lalu coba lagi. Perbarui yt-dlp (lihat [Memperbarui](#memperbarui-studio-clipper)). |
| **"Video ini private / dibatasi usia"** | Video tersebut tidak bisa diakses tanpa login dan tidak didukung. |
| **"address already in use"** / port **3000** sudah dipakai | Studio Clipper sudah berjalan di jendela lain. Tutup jendela itu, atau restart PC. |
| HP tidak bisa membuka `192.168.x.x:3000` | Pastikan Wi-Fi sama dan izinkan **Python** di Windows Firewall (Windows Security → Firewall → *Allow an app*). |
| **Android:** instalasi gagal di langkah "library Python" | Pastikan Termux dari F-Droid, lalu jalankan ulang perintah instalasi. Jika tetap gagal, buat [Issue](https://github.com/clipperspace/studio-clipper-online/issues) dan sertakan pesan error terakhir. |
| **Android:** Studio Clipper berhenti saat layar mati | Matikan optimasi baterai untuk Termux (lihat [B5](#b5-tips-agar-lancar)). |

Masih bermasalah? Buat laporan di
[Issues](https://github.com/clipperspace/studio-clipper-online/issues) dan sertakan pesan error
(jangan sertakan API key Anda).

---

## Menghapus Studio Clipper

- **Windows**: hapus folder Studio Clipper. Python dan FFmpeg bisa dihapus lewat
  **Settings → Apps** jika tidak dipakai program lain.
- **Android**: `rm -rf ~/studio-clipper-online $PREFIX/bin/studio-clipper`, atau hapus aplikasi Termux.

---

⚖️ Gunakan Studio Clipper hanya untuk konten milik sendiri atau yang diizinkan pemiliknya.
Mengunduh dari YouTube dapat melanggar Ketentuan Layanan YouTube dan hak cipta kreator.
