@echo off
title Studio Clipper Online
cd /d "%~dp0"

if not exist "backend\.venv\Scripts\python.exe" (
  echo [1/2] Menyiapkan backend Python...
  python -m venv backend\.venv || goto :err
  backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt || goto :err
)
if not exist "backend\.env" copy "backend\.env.example" "backend\.env" >nul

if not exist "frontend\node_modules" (
  echo [2/2] Memasang dependensi frontend...
  call npm --prefix frontend install || goto :err
)

echo Memperbarui yt-dlp...
backend\.venv\Scripts\python.exe -m pip install -q -U yt-dlp

start "Studio Clipper - Backend" cmd /k backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
start "Studio Clipper - Frontend" cmd /k npm --prefix frontend run dev

echo Menunggu server siap...
timeout /t 6 /nobreak >nul
start "" http://localhost:3000
exit /b 0

:err
echo.
echo Terjadi kesalahan. Pastikan Python 3.10+, Node.js 20+, dan FFmpeg sudah terpasang.
pause
exit /b 1
