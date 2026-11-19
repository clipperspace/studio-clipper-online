# Studio Clipper: versi online (hibrida), misalnya untuk Railway.
#   - Website + analisa AI berjalan di server ini; setiap pengguna memakai API key Gemini miliknya.
#   - Server tidak mengunduh video YouTube, jadi FFmpeg tidak dipasang.
#   - Potong & unduh klip dilakukan di versi lokal (start.bat / Termux).

# 1) Bangun tampilan statis (Next.js export)
FROM node:22-slim AS web
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN STATIC_EXPORT=1 npx next build

# 2) Backend FastAPI yang melayani website + API di satu port
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOSTED_MODE=1
WORKDIR /app/backend
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app ./app
COPY --from=web /app/frontend/out ./web

RUN useradd --create-home app && chown -R app /app
USER app

# Railway mengisi $PORT otomatis.
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
