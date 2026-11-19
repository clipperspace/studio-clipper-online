# 🌐 Versi online (hibrida) di Railway

Versi online membuat Studio Clipper bisa dibuka siapa saja dari browser, **tanpa install**, untuk
**mencari klip viral dengan AI**. Untuk mengunduh klip, pengguna memakai versi lokal di perangkatnya
sendiri.

| Fitur | Versi online | Versi lokal (PC / HP) |
|---|---|---|
| Cari klip viral (skor, alasan, hook, headline) | ✅ | ✅ |
| Preview klip | ✅ | ✅ |
| Potong & unduh (MP4, MP3, 9:16, 1:1) | ❌ (tombol **Unduh di Studio lokal**) | ✅ |
| API key Gemini | Milik **masing-masing pengguna** | Milik pemilik perangkat |

## Cara kerjanya

- **Server tidak mengunduh video YouTube.** Judul dan thumbnail diambil lewat oEmbed resmi YouTube.
  Analisa dilakukan Gemini dengan "menonton" link YouTube dari server Google. Risiko blokir IP dari
  YouTube jadi kecil.
- **API key pengguna** disimpan di browser pengguna (localStorage) dan dikirim per permintaan lewat
  header `X-Gemini-Key`. Server meneruskannya ke Gemini **tanpa menyimpan atau mencatatnya**. Key milik
  server (`GEMINI_API_KEY`) sengaja diabaikan di mode ini supaya kuota Anda tidak dipakai orang lain.
- **Tombol "Unduh di Studio lokal"** membuka `http://localhost:3000/studio` di perangkat pengguna dan
  membawa hasil analisa di bagian `#` alamat, sehingga tidak perlu analisa ulang. Bagian `#` tidak
  dikirim ke server mana pun. Studio lokal lalu memotong dan mengunduh klip memakai IP pengguna sendiri.
  Windows (`start.bat`) dan Android (`studio-clipper`) sama-sama memakai port 3000.
- Karena tidak ada transkrip di versi online, analisa selalu memakai mode **Tonton video**. Mode ini
  hanya untuk video publik, dan video yang sangat panjang bisa melebihi batas token Gemini.

## Deploy ke Railway

1. Buat akun di [railway.com](https://railway.com) dan hubungkan dengan GitHub.
2. Klik **New Project → Deploy from GitHub repo**, lalu pilih `studio-clipper-online`.
   Railway otomatis memakai `Dockerfile` dan `railway.json` di repo ini.
3. **Tidak perlu mengisi variabel apa pun.** `HOSTED_MODE=1` sudah diatur di Dockerfile.
   **Jangan** isi `GEMINI_API_KEY` di Railway.
4. Setelah build selesai, buka **Settings → Networking → Generate Domain**. Website online tersedia di
   alamat seperti `https://studio-clipper-xxxx.up.railway.app`.
5. Cek `https://<domain-anda>/api/health`. Hasilnya harus berisi `"hosted": true`.

Setiap push ke branch `main` otomatis memicu deploy ulang.

### Variabel opsional

| Variabel | Default | Fungsi |
|---|---|---|
| `MAX_CONCURRENT_JOBS` | `2` | Jumlah analisa yang berjalan bersamaan; sisanya antre |
| `CACHE_MINUTES` | `30` | Lama hasil analisa disimpan di memori (per API key) |
| `GEMINI_TIMEOUT_SECONDS` | `120` | Batas waktu satu permintaan ke Gemini |

### Biaya

Paket Hobby Railway mulai sekitar **$5/bulan**. Versi online ringan karena tidak memproses video
(tanpa FFmpeg, tanpa unduhan), jadi pemakaian CPU dan bandwidth kecil. Biaya AI ditanggung kuota Gemini
masing-masing pengguna.

## Mencoba mode online di komputer sendiri

```powershell
docker build -t studio-clipper .
docker run --rm -p 8080:8000 studio-clipper
```

Buka http://localhost:8080. Jangan pakai port 3000, karena port itu milik Studio lokal yang menjadi
tujuan tombol unduh.

Tanpa Docker:

```powershell
npm --prefix frontend run build:static
Copy-Item -Recurse frontend\out backend\web
$env:HOSTED_MODE = "1"; backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --port 8080
```

## Catatan

- Versi online adalah layanan publik. Sebutkan di halaman Anda bahwa pengguna hanya boleh memakai
  konten milik sendiri atau yang diizinkan pemiliknya.
- Tidak ada pembatasan jumlah permintaan per pengguna. Jika website ramai, pertimbangkan menambah
  pembatasan (rate limit) atau menaikkan `MAX_CONCURRENT_JOBS`.
