"""STUDIO CLIPPER ONLINE — API backend."""
from __future__ import annotations

import re
import shutil
import threading
import time
import zipfile
from typing import Literal

import yt_dlp
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from . import ai, config, jobs, youtube
from .ai import AIError
from .timeutil import fmt, to_seconds
from .youtube import YouTubeError

app = FastAPI(title="Studio Clipper Online API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

SAFE_ERRORS = (YouTubeError, AIError, ValueError)


# ------------------------------------------------------------------ models --

class AnalyzeRequest(BaseModel):
    url: str
    prompt: str = Field("", max_length=2000)
    count: int = Field(5, ge=config.MIN_CLIPS, le=config.MAX_CLIPS)
    mode: Literal["auto", "transcript", "video"] = "auto"
    # lite = Kilat (Flash-Lite), flash = Seimbang, deep = Mendalam
    model: Literal["lite", "flash", "deep"] = "lite"


class ClipItem(BaseModel):
    start: float | str
    end: float | str
    title: str = "clip"


class ClipRequest(BaseModel):
    url: str
    title: str = "video"
    clips: list[ClipItem] = Field(..., min_length=1, max_length=config.MAX_CLIPS)
    format: Literal["mp4", "mp3"] = "mp4"
    height: Literal[360, 480, 720, 1080] = 720
    # 16:9 = asli; 9:16 / 1:1 = video di tengah dengan latar blur
    aspect: Literal["16:9", "9:16", "1:1"] = "16:9"


class InfoRequest(BaseModel):
    url: str


# ----------------------------------------------------------------- helpers --

class TTLCache:
    """Cache kecil di memori dengan masa berlaku."""

    def __init__(self, minutes: int, max_items: int = 64):
        self.ttl, self.max, self.data = minutes * 60, max_items, {}
        self.lock = threading.Lock()

    def get(self, key):
        with self.lock:
            hit = self.data.get(key)
            if hit and time.time() - hit[0] < self.ttl:
                return hit[1]
            self.data.pop(key, None)
            return None

    def set(self, key, value):
        with self.lock:
            if len(self.data) >= self.max:
                self.data.pop(min(self.data, key=lambda k: self.data[k][0]))
            self.data[key] = (time.time(), value)


# url → info mentah yt-dlp; url → (meta, transkrip, sumber); kunci hasil → hasil analisa
info_cache = TTLCache(config.CACHE_MINUTES, max_items=8)
video_cache = TTLCache(config.CACHE_MINUTES, max_items=16)
result_cache = TTLCache(config.CACHE_MINUTES, max_items=64)


def get_info(url: str) -> dict:
    info = info_cache.get(url)
    if info is None:
        info = youtube.extract_info(url)
        info_cache.set(url, info)
    return info


def safe_name(text: str, limit: int = 60) -> str:
    text = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "", text or "")
    text = re.sub(r"\s+", " ", text).strip(" .")
    return (text[:limit].rstrip(" .")) or "clip"


# --------------------------------------------------------------- endpoints --

@app.get("/api/health")
def health():
    return {
        "ok": True,
        "gemini_configured": bool(config.GEMINI_API_KEY),
        "ffmpeg": shutil.which("ffmpeg") is not None,
        "yt_dlp": yt_dlp.version.__version__,
        "models": {"flash": config.GEMINI_MODEL_FAST, "lite": config.GEMINI_MODEL_LITE},
    }


@app.post("/api/info")
def video_info(req: InfoRequest):
    """Info ringkas video (judul, durasi, thumbnail, resolusi) untuk preview & timeline."""
    try:
        return youtube.summarize(get_info(youtube.validate_url(req.url)))
    except YouTubeError as e:
        raise HTTPException(400, str(e))


@app.post("/api/ai-analyze")
def ai_analyze(req: AnalyzeRequest):
    try:
        url = youtube.validate_url(req.url)
    except YouTubeError as e:
        raise HTTPException(400, str(e))
    if not config.GEMINI_API_KEY:
        raise HTTPException(400, "API key Gemini belum diatur. Isi GEMINI_API_KEY di backend/.env lalu restart backend.")

    result_key = (url, req.prompt.strip(), req.count, req.mode, req.model)

    def work(job: jobs.Job):
        cached_result = result_cache.get(result_key)
        if cached_result:
            job.result = cached_result
            return

        cached = video_cache.get(url)
        if cached:
            meta, transcript, source = cached
        else:
            job.stage, job.progress = "Membaca info video", 0.08
            info = get_info(url)
            meta = youtube.summarize(info)
            job.stage, job.progress = "Mengambil transkrip", 0.22
            transcript, source = youtube.get_transcript(info) or (None, None)
            video_cache.set(url, (meta, transcript, source))

        use_video = req.mode == "video" or (req.mode == "auto" and not transcript)
        if req.mode == "transcript" and not transcript:
            raise YouTubeError("Video ini tidak punya subtitle/auto-caption. Pilih mode 'Video' atau 'Otomatis'.")

        job.stage = "Gemini menonton video" if use_video else "Gemini membaca transkrip"
        job.progress = 0.4
        def on_status(msg: str):
            job.stage = msg

        out = ai.find_clips(meta, req.prompt, req.count, transcript, use_video, req.model, on_status)

        job.stage, job.progress = "Menyusun klip", 0.95
        if not out["clips"]:
            raise AIError("AI tidak menemukan klip yang cocok. Coba longgarkan prompt Anda.")
        job.result = {
            "video": meta,
            "summary": out["summary"],
            "clips": out["clips"],
            "source": "video (Gemini)" + (f" + {source}" if source else "") if use_video else source,
            "model": out["model"],
        }
        result_cache.set(result_key, job.result)

    job = jobs.submit("analyze", work, SAFE_ERRORS)
    return job.public()


@app.post("/api/clip")
def make_clip(req: ClipRequest):
    try:
        url = youtube.validate_url(req.url)
        ranges = []
        for c in req.clips:
            s, e = to_seconds(c.start), to_seconds(c.end)
            if e <= s:
                raise ValueError(f"Waktu selesai harus setelah waktu mulai ({c.title}).")
            if e - s > config.MAX_CLIP_SECONDS:
                raise ValueError(f"Durasi klip maksimal {config.MAX_CLIP_SECONDS // 60} menit.")
            ranges.append((s, e, c.title))
    except (YouTubeError, ValueError) as e:
        raise HTTPException(400, str(e))

    def work(job: jobs.Job):
        n = len(ranges)
        files = []
        for i, (s, e, title) in enumerate(ranges):
            job.stage = f"Memotong klip {i + 1} dari {n}"
            base = safe_name(f"{i + 1:02d} - {title} ({fmt(s).replace(':', '.')})", 80)

            reframe = req.format == "mp4" and req.aspect != "16:9"
            share = 0.6 if reframe else 1.0  # porsi progres untuk download vs. render format

            def on_progress(p, i=i):
                job.progress = (i + p * share) / n * 0.95

            f = youtube.download_clip(url, s, e, req.format, req.height, job.workdir, base, on_progress)
            if reframe:
                job.stage = f"Membuat format {req.aspect} (klip {i + 1} dari {n})"
                job.progress = (i + share) / n * 0.95
                f = youtube.reframe(f, req.aspect, req.height)
            files.append(f)
            job.progress = (i + 1) / n * 0.95

        if n == 1:
            job.file, job.filename = files[0], files[0].name
            return
        job.stage = "Membuat file ZIP"
        zip_path = job.workdir / f"{safe_name(req.title)} - clips.zip"
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_STORED) as zf:
            for f in files:
                zf.write(f, f.name)
        job.file, job.filename = zip_path, zip_path.name

    job = jobs.submit("clip", work, SAFE_ERRORS)
    return job.public()


@app.get("/api/job/{job_id}")
def job_status(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job tidak ditemukan atau sudah kedaluwarsa.")
    return job.public()


@app.get("/api/download/{job_id}")
def download(job_id: str):
    job = jobs.get(job_id)
    if not job or not job.file or not job.file.exists():
        raise HTTPException(404, "File tidak ditemukan atau sudah dihapus otomatis.")
    media = {".mp4": "video/mp4", ".mp3": "audio/mpeg", ".zip": "application/zip"}.get(
        job.file.suffix, "application/octet-stream"
    )
    return FileResponse(job.file, media_type=media, filename=job.filename)
