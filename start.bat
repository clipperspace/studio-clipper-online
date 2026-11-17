@echo off
setlocal
title Studio Clipper Online
cd /d "%~dp0"

rem ==========================================================================
rem  0. Cek program yang dibutuhkan
rem ==========================================================================
set "MISSING="
python -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>nul || (
  set "MISSING=1"
  echo [x] Python 3.10+ belum terpasang.
)
node --version >nul 2>nul || (
  set "MISSING=1"
  echo [x] Node.js belum terpasang.
)
ffmpeg -version >nul 2>nul || (
  set "MISSING=1"
  echo [x] FFmpeg belum terpasang.
)
if defined MISSING (
  echo.
  echo Pasang semuanya sekaligus dengan perintah ini di PowerShell / Command Prompt:
  echo.
  echo   winget install Python.Python.3.12 OpenJS.NodeJS.LTS Gyan.FFmpeg
  echo.
  echo Setelah selesai, TUTUP jendela ini lalu jalankan start.bat lagi.
  pause
  exit /b 1
)

rem ==========================================================================
rem  1. Persiapan (hanya saat pertama kali)
rem ==========================================================================
if not exist "backend\.venv\Scripts\python.exe" (
  echo [1/2] Menyiapkan backend Python. Pertama kali butuh 1-3 menit...
  python -m venv backend\.venv || goto :err
  backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt || goto :err
)

if not exist "frontend\node_modules" (
  echo [2/2] Memasang dependensi frontend. Pertama kali butuh 1-3 menit...
  call npm --prefix frontend install || goto :err
)

rem ==========================================================================
rem  2. API key Gemini
rem ==========================================================================
if not exist "backend\.env" copy "backend\.env.example" "backend\.env" >nul
findstr /r /c:"^GEMINI_API_KEY=..*" "backend\.env" >nul && goto :keydone

echo.
echo ----------------------------------------------------------------
echo  API key Gemini belum diisi (dibutuhkan untuk fitur AI).
echo  Buat gratis di: https://aistudio.google.com/apikey
echo ----------------------------------------------------------------
set "GKEY="
set /p "GKEY=Tempel API key lalu tekan Enter (kosongkan untuk lewati): "
if not defined GKEY (
  echo Dilewati. Fitur AI belum aktif; isi nanti di backend\.env
  goto :keydone
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p = (Resolve-Path 'backend\.env').Path; $k = $env:GKEY.Trim(); $out = Get-Content $p | ForEach-Object { if ($_ -match '^GEMINI_API_KEY=') { 'GEMINI_API_KEY=' + $k } else { $_ } }; [IO.File]::WriteAllLines($p, [string[]]$out)" || goto :err
set "GKEY="
echo API key disimpan di backend\.env
:keydone

rem ==========================================================================
rem  3. Jalankan
rem ==========================================================================
echo.
echo Memperbarui yt-dlp...
backend\.venv\Scripts\python.exe -m pip install -q -U yt-dlp

start "Studio Clipper - Backend" cmd /k backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
start "Studio Clipper - Frontend" cmd /k npm --prefix frontend run dev

echo Menunggu server siap...
timeout /t 6 /nobreak >nul
start "" http://localhost:3000
echo.
echo Studio Clipper berjalan di http://localhost:3000
echo Untuk berhenti, tutup jendela "Studio Clipper - Backend" dan "Studio Clipper - Frontend".
timeout /t 5 >nul
exit /b 0

:err
echo.
echo Terjadi kesalahan saat menyiapkan Studio Clipper. Lihat pesan di atas.
echo Panduan lengkap: docs\INSTALL.md
pause
exit /b 1
