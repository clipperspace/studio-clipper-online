# 🗺️ Roadmap: Studio Clipper → Editor Clipper

Tujuan: mengubah Studio Clipper dari "cari & unduh klip" menjadi editor clipper.

**Alur lama:** pilih klip → unduh
**Alur baru:** pilih klip → **Editor** (atur opsi + preview) → **Render** → unduh

Semua pengaturan disimpan sebagai satu **resep edit** (JSON), lalu backend lokal merender resep
itu dengan FFmpeg dalam satu proses. Setiap fitur punya tombol on/off dan defaultnya mati.

Keterangan: ✅ selesai · 🚧 sedang dikerjakan · ⬜ belum

---

## Fase 0: Fondasi Editor ✅

- ✅ Halaman **Editor** (`/editor`) dari tombol ✏️ Edit di hasil AI & daftar Timestamp:
  preview langsung di kiri, pengaturan di kanan
- ✅ Potongan sumber diunduh sekali (±15 detik di kiri-kanan klip), bisa dirender berkali-kali
- ✅ **Upload file dari device** (backend `/api/editor/upload`; dipakai mulai Fase 3)
- ✅ Mesin render baru `backend/app/editor.py`: resep edit → satu perintah FFmpeg
- ✅ Simpan & pakai ulang **preset** gaya edit (tersimpan di browser). Nama preset bisa diatur sendiri
  dan diubah kapan saja, termasuk preset bawaan
- ✅ Saklar on/off untuk setiap fitur (komponen `Switch` / `Section`)

## Fase 1: Fitur cepat, dampak besar 🚧

- ✅ **Rasio ekspor**: 9:16, 1:1, 4:5, 16:9 (ikut dikerjakan di Fase 0)
- ✅ **Latar**: blur, hitam, atau potong (ikut dikerjakan di Fase 0)
- ✅ **Potong manual**: seret video di preview, atau atur zoom (100–400%) & posisi kiri-kanan/atas-bawah
- ⬜ **Batas klip presisi**: geser per 0,1 detik / per frame, handle seret di timeline,
  gelombang suara supaya tidak memotong kalimat
- ⬜ **Watermark nama akun**: teks manual, posisi (9 titik + seret bebas), opacity, font
- ⬜ **Teks overlay 5 detik awal**: isi manual, beberapa style siap pakai, posisi bisa diseret

## Fase 2: Subtitle otomatis ⬜

- ⬜ Sumber teks: auto-caption YouTube (waktu per kata), cadangan transkripsi audio dengan Gemini
- ⬜ Pilihan font (10–15 Google Fonts gratis), ukuran, warna, outline, posisi
- ⬜ Gaya: kalimat biasa / per kata / highlight kata yang diucapkan (karaoke)
- ⬜ Teks subtitle bisa diedit sebelum render

## Fase 3: Struktur video & audio ⬜

- ⬜ **Slot video hook 5 detik** (upload sendiri, otomatis disesuaikan durasi & rasio)
- ⬜ **Transisi hook → isi + sound effect** (flash + whoosh, zoom blur, glitch, swipe, fade)
- ⬜ **Video akhir** (on/off, durasi bisa diatur)
- ⬜ **Musik dari device**: pilih bagian lagu, volume, fade in/out, opsional mengecil saat ada suara bicara

## Fase 4: Auto-follow wajah ⬜

- ⬜ Deteksi wajah (MediaPipe), "kamera" bergerak halus mengikuti pembicara saat crop 9:16
- Catatan: tidak bisa aktif bersamaan dengan latar blur (auto-follow selalu crop penuh)

## Fase 5: Efek video ⬜

- ⬜ **Pendulum**, **Sparkle**, **Minimal shake**, dengan kecepatan & intensitas yang bisa diatur
- Efek dan sound effect dibuat sendiri / bebas royalti (CC0), bukan aset aplikasi lain

## Fase 6: Penyempurnaan ⬜

- ⬜ Terapkan satu resep edit ke semua klip hasil AI sekaligus
- ⬜ Antrean render & estimasi waktu
- ⬜ Uji di Android/Termux (fitur berat seperti auto-follow kemungkinan hanya untuk PC)

---

## 📌 Keputusan

1. Daftar fitur sudah lengkap. Nomor yang melompat (5 dan 9) hanya salah urut, tidak ada fitur yang terlewat.
2. Teks overlay 5 detik awal tampil **di atas video hook**. Jika video hook tidak dipakai, teks tampil
   di 5 detik pertama video isi.

## ⚠️ Catatan

- Render dengan banyak efek bisa 1–3 menit per klip 60 detik di PC biasa.
