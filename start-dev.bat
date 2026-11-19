@echo off
rem Mode pengembangan (untuk developer): backend di port 8000 + Next.js dev server di port 3000
rem dengan hot reload. Butuh Node.js. Pengguna biasa cukup memakai start.bat.
setlocal
cd /d "%~dp0"

node --version >nul 2>nul || (
  echo [x] Node.js belum terpasang. Pasang dengan: winget install OpenJS.NodeJS.LTS
  pause
  exit /b 1
)
if not exist "backend\.venv\Scripts\python.exe" (
  echo [x] Jalankan start.bat sekali dulu untuk menyiapkan backend.
  pause
  exit /b 1
)
if not exist "frontend\node_modules" (
  echo Memasang dependensi frontend. Pertama kali butuh 1-3 menit...
  call npm --prefix frontend install || exit /b 1
)

start "Studio Clipper - Backend (dev)" cmd /k backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload --reload-dir backend\app
start "Studio Clipper - Frontend (dev)" cmd /k npm --prefix frontend run dev
timeout /t 8 /nobreak >nul
start "" http://localhost:3000
