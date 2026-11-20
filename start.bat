@echo off
setlocal
title Studio Clipper
cd /d "%~dp0"

rem ==========================================================================
rem  Studio Clipper versi ringan: cukup Python + FFmpeg, tanpa Node.js.
rem  Tampilan website siap pakai (web.zip) dilayani langsung oleh backend Python
rem  di satu port (3000). Untuk mengembangkan tampilan, pakai start-dev.bat.
rem ==========================================================================
set "WEB_URL=https://github.com/clipperspace/studio-clipper-online/releases/download/web-latest/web.zip"
set "PORT=3000"

rem --------------------------------------------------------------------------
rem  0. Cek program yang dibutuhkan
rem --------------------------------------------------------------------------
set "MISSING="
python -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>nul || (
  set "MISSING=1"
  echo [x] Python 3.10+ belum terpasang.
)
ffmpeg -version >nul 2>nul || (
  set "MISSING=1"
  echo [x] FFmpeg belum terpasang.
)
if defined MISSING (
  echo.
  echo Pasang semuanya sekaligus dengan perintah ini di PowerShell / Command Prompt:
  echo.
  echo   winget install Python.Python.3.12 Gyan.FFmpeg
  echo.
  echo Setelah selesai, TUTUP jendela ini lalu jalankan start.bat lagi.
  pause
  exit /b 1
)

rem --------------------------------------------------------------------------
rem  1. Library Python (hanya saat pertama kali)
rem --------------------------------------------------------------------------
if not exist "backend\.venv\Scripts\python.exe" (
  echo [1/3] Menyiapkan Studio Clipper. Pertama kali butuh 1-3 menit...
  python -m venv backend\.venv || goto :err
  backend\.venv\Scripts\python.exe -m pip install -q -r backend\requirements.txt || goto :err
)

rem --------------------------------------------------------------------------
rem  2. Tampilan website: selalu coba versi terbaru, pakai yang lama jika offline
rem --------------------------------------------------------------------------
echo [2/3] Memperbarui tampilan website...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'Stop'; $ProgressPreference = 'SilentlyContinue';" ^
  "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12;" ^
  "$zip = Join-Path $env:TEMP 'studio-clipper-web.zip'; $new = 'backend\web.new';" ^
  "Invoke-WebRequest -UseBasicParsing -Uri $env:WEB_URL -OutFile $zip;" ^
  "if (Test-Path $new) { Remove-Item -Recurse -Force $new };" ^
  "Expand-Archive -Path $zip -DestinationPath $new -Force;" ^
  "if (-not (Test-Path (Join-Path $new 'index.html'))) { throw 'web.zip tidak lengkap' };" ^
  "if (Test-Path 'backend\web') { Remove-Item -Recurse -Force 'backend\web' };" ^
  "Rename-Item $new 'web'; Remove-Item $zip -Force" >nul 2>nul
if errorlevel 1 (
  if exist "backend\web\index.html" (
    echo     Tidak bisa memperbarui, memakai tampilan yang sudah ada.
  ) else (
    echo [x] Gagal mengunduh tampilan website. Periksa koneksi internet lalu coba lagi.
    goto :err
  )
)

rem --------------------------------------------------------------------------
rem  3. API key Gemini
rem --------------------------------------------------------------------------
if not exist "backend\.env" copy "backend\.env.example" "backend\.env" >nul
findstr /r /c:"^GEMINI_API_KEY=..*" "backend\.env" >nul && goto :keydone

echo.
echo ----------------------------------------------------------------
echo  API key Gemini belum diisi. Dibutuhkan untuk fitur AI.
echo  Buat gratis di: https://aistudio.google.com/apikey
echo ----------------------------------------------------------------
set "GKEY="
set /p "GKEY=Tempel API key lalu tekan Enter, atau kosongkan untuk lewati: "
if not defined GKEY (
  echo Dilewati. Fitur AI belum aktif; isi nanti di backend\.env
  goto :keydone
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p = (Resolve-Path 'backend\.env').Path; $k = $env:GKEY.Trim(); $out = Get-Content $p | ForEach-Object { if ($_ -match '^GEMINI_API_KEY=') { 'GEMINI_API_KEY=' + $k } else { $_ } }; [IO.File]::WriteAllLines($p, [string[]]$out)" || goto :err
set "GKEY="
echo API key disimpan di backend\.env
:keydone

rem --------------------------------------------------------------------------
rem  4. Jalankan
rem --------------------------------------------------------------------------
echo [3/3] Memperbarui yt-dlp...
rem  curl_cffi dibutuhkan yt-dlp untuk TikTok
backend\.venv\Scripts\python.exe -m pip install -q -U yt-dlp curl_cffi

set "LAN="
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.PrefixOrigin -in 'Dhcp','Manual' -and $_.InterfaceAlias -notmatch 'vEthernet|VirtualBox|VMware|Loopback' } | Select-Object -First 1).IPAddress"`) do set "LAN=%%i"

cls
echo.
echo  ===============================================================
echo   Studio Clipper berjalan di  http://localhost:%PORT%
if defined LAN echo   Dari HP di Wi-Fi yang sama: http://%LAN%:%PORT%
echo.
echo   Biarkan jendela ini terbuka. Tutup jendela untuk berhenti.
echo  ===============================================================
echo.
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 4; Start-Process 'http://localhost:%PORT%'"
backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port %PORT%
echo.
echo Server berhenti. Jika muncul error "address already in use", Studio Clipper
echo mungkin sudah berjalan di jendela lain.
pause
exit /b 0

:err
echo.
echo Terjadi kesalahan saat menyiapkan Studio Clipper. Lihat pesan di atas.
echo Panduan lengkap: docs\INSTALL.md
pause
exit /b 1
