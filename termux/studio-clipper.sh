#!/data/data/com.termux/files/usr/bin/bash
# Perintah "studio-clipper" di Termux. Dipasang oleh termux/install.sh.
#   studio-clipper           → jalankan server & buka browser
#   studio-clipper update    → perbarui kode, tampilan web, dan yt-dlp
#   studio-clipper key       → ganti API key Gemini
#   studio-clipper help      → bantuan
set -euo pipefail

APP_DIR="$HOME/studio-clipper-online"
WEB_URL="https://github.com/clipperspace/studio-clipper-online/releases/download/web-latest/web.zip"
PORT="${PORT:-3000}"
export PIP_BREAK_SYSTEM_PACKAGES=1
URL="http://localhost:$PORT"

start() {
  cd "$APP_DIR/backend"
  # Cegah Android menghentikan Termux saat layar mati / pindah aplikasi.
  termux-wake-lock 2>/dev/null || true
  trap 'termux-wake-unlock 2>/dev/null || true' EXIT
  echo "Studio Clipper berjalan di $URL"
  echo "Biarkan Termux tetap terbuka. Tekan Ctrl+C untuk berhenti."
  ( sleep 4; termux-open-url "$URL" 2>/dev/null || true ) &
  python -m uvicorn app.main:app --host 127.0.0.1 --port "$PORT"
}

# Pasang library yang belum ada. Alat compile (rust + clang) hanya dipasang sementara jika
# ada library yang harus di-compile, lalu dihapus lagi supaya HP tetap lega.
install_requirements() {
  local req="$APP_DIR/backend/requirements-termux.txt"
  # Semua library sudah terpasang, atau versi barunya tersedia siap pakai → tidak perlu compile.
  if pip install --no-cache-dir --only-binary=:all: -r "$req" >/dev/null 2>&1; then
    return 0
  fi
  echo "==> Ada library yang perlu di-compile. Memasang alat compile sementara (bisa 10–30 menit)"
  pkg install -y rust clang
  export ANDROID_API_LEVEL="$(getprop ro.build.version.sdk)"
  export CARGO_BUILD_TARGET="$(rustc -vV | sed -n 's/^host: //p')"
  termux-wake-lock 2>/dev/null || true
  local rc=0
  pip install --no-cache-dir -r "$req" || rc=$?
  termux-wake-unlock 2>/dev/null || true
  apt-get remove -y rust clang >/dev/null 2>&1 || true
  apt-get autoremove -y >/dev/null 2>&1 || true
  apt-get clean >/dev/null 2>&1 || true
  return "$rc"
}

update() {
  echo "==> Memperbarui kode"
  git -C "$APP_DIR" pull --ff-only
  echo "==> Memperbarui yt-dlp"
  pip install --no-cache-dir -U yt-dlp
  echo "==> Memeriksa library Python"
  install_requirements
  echo "==> Memperbarui tampilan website"
  tmp_zip="$PREFIX/tmp/studio-clipper-web.zip"
  curl -fL --retry 3 -o "$tmp_zip" "$WEB_URL"
  rm -rf "$APP_DIR/backend/web"
  unzip -q -o "$tmp_zip" -d "$APP_DIR/backend/web"
  rm -f "$tmp_zip"
  install -m 755 "$APP_DIR/termux/studio-clipper.sh" "$PREFIX/bin/studio-clipper"
  echo "Selesai. Jalankan: studio-clipper"
}

# Bersihkan API key yang ditempel: buang spasi, tanda kutip, karakter tersembunyi, atau sisa kode
# tempel terminal (ESC[200~). Key lama berbentuk "AIza" + 35 karakter; key baru bisa berisi titik.
clean_key() {
  local k
  k="$(printf '%s' "$1" | grep -oE 'AIza[0-9A-Za-z_-]{35}' | head -n 1)"
  [ -n "$k" ] || k="$(printf '%s' "$1" | sed 's/\x1b\[[0-9;]*~\{0,1\}//g' | tr -cd 'A-Za-z0-9._-')"
  printf '%s' "$k"
}

set_key() {
  local env_file="$APP_DIR/backend/.env" key tmp_env
  [ -f "$env_file" ] || cp "$APP_DIR/backend/.env.example" "$env_file"
  echo "Buat API key gratis di: https://aistudio.google.com/apikey"
  read -r -s -p "Tempel API key Gemini: " key
  echo
  key="$(clean_key "$key")"
  [ -n "$key" ] || { echo "Dibatalkan."; exit 1; }
  [ "${#key}" -ge 20 ] || echo "Peringatan: API key terlalu pendek, mungkin belum lengkap."
  tmp_env="$(mktemp)"
  grep -v '^GEMINI_API_KEY=' "$env_file" > "$tmp_env" || true
  printf 'GEMINI_API_KEY=%s\n' "$key" >> "$tmp_env"
  mv "$tmp_env" "$env_file"
  chmod 600 "$env_file"
  echo "API key disimpan. Jalankan ulang: studio-clipper"
}

case "${1:-start}" in
  start) start ;;
  update) update ;;
  key) set_key ;;
  help | -h | --help)
    sed -n '2,6p' "$0" | sed 's/^# \{0,1\}//'
    ;;
  *)
    echo "Perintah tidak dikenal: $1 (lihat: studio-clipper help)" >&2
    exit 1
    ;;
esac
