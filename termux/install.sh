#!/data/data/com.termux/files/usr/bin/bash
# =============================================================================
#  Studio Clipper: instalasi otomatis di HP Android (Termux)
#
#  Jalankan di Termux:
#    curl -fsSL https://raw.githubusercontent.com/clipperspace/studio-clipper-online/main/termux/install.sh | bash
#
#  Aman dijalankan ulang: langkah yang sudah selesai akan dilewati / diperbarui.
# =============================================================================
set -euo pipefail

REPO_URL="https://github.com/clipperspace/studio-clipper-online.git"
WEB_URL="https://github.com/clipperspace/studio-clipper-online/releases/download/web-latest/web.zip"
APP_DIR="$HOME/studio-clipper-online"

c_step=$'\033[1;35m'; c_ok=$'\033[1;32m'; c_warn=$'\033[1;33m'; c_off=$'\033[0m'
step() { printf '\n%s==> %s%s\n' "$c_step" "$1" "$c_off"; }
ok()   { printf '%s✓ %s%s\n' "$c_ok" "$1" "$c_off"; }
warn() { printf '%s! %s%s\n' "$c_warn" "$1" "$c_off"; }

if [ -z "${PREFIX:-}" ] || [ ! -d "/data/data/com.termux" ]; then
  echo "Skrip ini khusus untuk aplikasi Termux di Android." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
# Python Termux adalah Python milik pengguna; izinkan pip memasang paket ke sana.
export PIP_BREAK_SYSTEM_PACKAGES=1
APT_OPTS=(-y -o Dpkg::Options::=--force-confnew)

# -----------------------------------------------------------------------------
step "1/7 Memperbarui Termux"
pkg update "${APT_OPTS[@]}"
pkg upgrade "${APT_OPTS[@]}"
ok "Termux terbaru"

# -----------------------------------------------------------------------------
step "2/7 Memasang Python, FFmpeg, Git, dan alat compile"
# python-cryptography : versi siap pakai, supaya tidak perlu di-compile
# rust + clang        : hanya untuk meng-compile pydantic-core (FastAPI & Gemini SDK);
#                       dihapus lagi di langkah 4 supaya hemat ±500 MB
BUILD_PKGS=(rust clang)
pkg install "${APT_OPTS[@]}" \
  python python-pip python-cryptography ffmpeg git curl unzip \
  binutils libffi openssl termux-tools "${BUILD_PKGS[@]}"
ok "Python $(python -c 'import platform; print(platform.python_version())'), $(ffmpeg -version | head -n1 | cut -d' ' -f1-3)"

# -----------------------------------------------------------------------------
step "3/7 Mengunduh kode Studio Clipper"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull --ff-only
  ok "Kode diperbarui"
else
  git clone --depth 1 "$REPO_URL" "$APP_DIR"
  ok "Kode diunduh ke $APP_DIR"
fi

# -----------------------------------------------------------------------------
step "4/7 Memasang library Python"
warn "Langkah ini meng-compile pydantic-core dan bisa memakan 10–30 menit."
warn "Biarkan layar menyala dan Termux tetap terbuka."
termux-wake-lock 2>/dev/null || true
export ANDROID_API_LEVEL="$(getprop ro.build.version.sdk)"
export CARGO_BUILD_TARGET="$(rustc -vV | sed -n 's/^host: //p')"
pip install --no-cache-dir -r "$APP_DIR/backend/requirements-termux.txt"
termux-wake-unlock 2>/dev/null || true
ok "Library Python terpasang"

# Alat compile tidak dibutuhkan lagi setelah library terpasang.
# (studio-clipper update memasangnya sementara hanya jika ada library yang perlu di-compile ulang.)
apt-get remove "${APT_OPTS[@]}" "${BUILD_PKGS[@]}" >/dev/null 2>&1 || true
apt-get autoremove "${APT_OPTS[@]}" >/dev/null 2>&1 || true
apt-get clean >/dev/null 2>&1 || true
ok "Alat compile dihapus (hemat ±500 MB)"

# -----------------------------------------------------------------------------
step "5/7 Mengunduh tampilan website"
tmp_zip="$PREFIX/tmp/studio-clipper-web.zip"
curl -fL --retry 3 -o "$tmp_zip" "$WEB_URL"
rm -rf "$APP_DIR/backend/web"
unzip -q -o "$tmp_zip" -d "$APP_DIR/backend/web"
rm -f "$tmp_zip"
ok "Tampilan website siap"

# -----------------------------------------------------------------------------
# Bersihkan API key yang ditempel: buang spasi, tanda kutip, karakter tersembunyi, atau sisa kode
# tempel terminal (ESC[200~). Key lama berbentuk "AIza" + 35 karakter; key baru bisa berisi titik.
clean_key() {
  local k
  k="$(printf '%s' "$1" | grep -oE 'AIza[0-9A-Za-z_-]{35}' | head -n 1)"
  [ -n "$k" ] || k="$(printf '%s' "$1" | sed 's/\x1b\[[0-9;]*~\{0,1\}//g' | tr -cd 'A-Za-z0-9._-')"
  printf '%s' "$k"
}

step "6/7 API key Gemini"
ENV_FILE="$APP_DIR/backend/.env"
[ -f "$ENV_FILE" ] || cp "$APP_DIR/backend/.env.example" "$ENV_FILE"
if grep -Eq '^GEMINI_API_KEY=.+' "$ENV_FILE"; then
  ok "API key sudah terpasang sebelumnya"
else
  echo "Buat API key gratis di: https://aistudio.google.com/apikey"
  echo "Tempel API key di bawah lalu tekan Enter (kosongkan untuk melewati; fitur AI tidak aktif)."
  key=""
  # stdin skrip ini berasal dari curl, jadi baca langsung dari layar Termux.
  if [ -r /dev/tty ]; then
    read -r -s -p "API key: " key </dev/tty || true
    echo
  fi
  key="$(clean_key "$key")"
  if [ -n "$key" ]; then
    [ "${#key}" -ge 20 ] || warn "API key terlalu pendek, mungkin belum lengkap. Tetap disimpan."
    tmp_env="$(mktemp)"
    grep -v '^GEMINI_API_KEY=' "$ENV_FILE" > "$tmp_env" || true
    printf 'GEMINI_API_KEY=%s\n' "$key" >> "$tmp_env"
    mv "$tmp_env" "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    ok "API key disimpan"
  else
    warn "Dilewati. Isi nanti di $ENV_FILE"
  fi
fi

# -----------------------------------------------------------------------------
step "7/7 Membuat perintah 'studio-clipper'"
install -m 755 "$APP_DIR/termux/studio-clipper.sh" "$PREFIX/bin/studio-clipper"
ok "Perintah siap"

printf '\n%s=============================================%s\n' "$c_ok" "$c_off"
printf '%s  Instalasi selesai!%s\n\n' "$c_ok" "$c_off"
echo "  Jalankan         : studio-clipper"
echo "  Lalu buka di HP  : http://localhost:3000"
echo "  Perbarui         : studio-clipper update"
echo "  Bantuan          : studio-clipper help"
printf '%s=============================================%s\n' "$c_ok" "$c_off"
