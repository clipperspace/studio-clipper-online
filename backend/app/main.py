"""STUDIO CLIPPER ONLINE — API backend."""
from __future__ import annotations

import hashlib
import os
import re
import shutil
import threading
import time
import zipfile
from typing import Literal

import yt_dlp
from fastapi import FastAPI, Header, HTTPException, Query, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import ai, config, editor, jobs, youtube
from .ai import AIError
from .editor import EditorError
from .timeutil import fmt, to_seconds
from .youtube import YouTubeError

app = FastAPI(title="Studio Clipper Online API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

SAFE_ERRORS = (YouTubeError, AIError, EditorError, ValueError)


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


class FullRequest(BaseModel):
    url: str
    format: Literal["mp4", "mp3"] = "mp4"
    height: Literal[360, 480, 720, 1080] = 720


class InfoRequest(BaseModel):
    url: str


class SourceRequest(BaseModel):
    url: str
    start: float | str
    end: float | str
    height: Literal[360, 480, 720, 1080] = 1080


class RenderRequest(BaseModel):
    source_id: str
    title: str = Field("klip", max_length=200)
    recipe: editor.Recipe


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


LOCAL_ONLY = (
    "Potong & unduh klip hanya tersedia di versi lokal (PC / HP Android). "
    "Pakai tombol \"Unduh di Studio lokal\" atau lihat panduan instalasi."
)


def user_key(header_key: str | None) -> str:
    """API key untuk satu permintaan. Mode online: wajib dari pengguna. Mode lokal: key server,
    atau key dari browser jika server belum punya. Key tidak pernah disimpan atau dicatat."""
    key = config.clean_key(header_key or "") if header_key else ""
    if key and (len(key) > 200 or not re.fullmatch(r"[A-Za-z0-9_\-.]+", key)):
        raise HTTPException(400, "Format API key Gemini tidak valid.")
    if config.HOSTED:
        return key
    return config.GEMINI_API_KEY or key


def meta_for(url: str) -> dict:
    """Info ringkas video. Mode online lewat oEmbed (server tidak memanggil yt-dlp)."""
    if config.HOSTED:
        meta = info_cache.get(("oembed", url))
        if meta is None:
            meta = youtube.oembed_summary(url)
            info_cache.set(("oembed", url), meta)
        return meta
    return youtube.summarize(get_info(url))


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
        # hosted = versi online: API key dari pengguna, tanpa potong/unduh klip
        "hosted": config.HOSTED,
        "gemini_configured": bool(config.GEMINI_API_KEY),
        "gemini_key_ok": config.GEMINI_KEY_LOOKS_OK or not config.GEMINI_API_KEY,
        "ffmpeg": shutil.which("ffmpeg") is not None,
        "yt_dlp": yt_dlp.version.__version__,
        "models": {"flash": config.GEMINI_MODEL_FAST, "lite": config.GEMINI_MODEL_LITE},
    }


@app.post("/api/info")
def video_info(req: InfoRequest):
    """Info ringkas video (judul, durasi, thumbnail, resolusi) untuk preview & timeline."""
    try:
        # TikTok hanya di versi lokal (versi online tidak memanggil yt-dlp)
        return meta_for(youtube.validate_url(req.url, allow_tiktok=not config.HOSTED))
    except YouTubeError as e:
        raise HTTPException(400, str(e))


@app.post("/api/ai-analyze")
def ai_analyze(req: AnalyzeRequest, x_gemini_key: str | None = Header(None)):
    try:
        url = youtube.validate_url(req.url)
        if config.HOSTED:
            url = f"https://www.youtube.com/watch?v={youtube.video_id(url)}"
    except YouTubeError as e:
        raise HTTPException(400, str(e))
    api_key = user_key(x_gemini_key)
    if not api_key:
        raise HTTPException(
            400,
            "Masukkan API key Gemini Anda dulu (gratis di aistudio.google.com/apikey)."
            if config.HOSTED
            else "API key Gemini belum diatur. Isi GEMINI_API_KEY di backend/.env lalu restart backend.",
        )
    # Mode online: tidak ada transkrip (server tidak memakai yt-dlp), Gemini selalu menonton video.
    mode = "video" if config.HOSTED else req.mode

    # Hasil di-cache per API key (hash), supaya key yang tidak valid tidak ikut menikmati hasil orang lain.
    key_id = hashlib.sha256(api_key.encode()).hexdigest()[:16]
    result_key = (key_id, url, req.prompt.strip(), req.count, mode, req.model)

    def work(job: jobs.Job):
        cached_result = result_cache.get(result_key)
        if cached_result:
            job.result = cached_result
            return

        cached = video_cache.get(url)
        if cached:
            meta, transcript, source = cached
        elif config.HOSTED:
            job.stage, job.progress = "Membaca info video", 0.08
            meta, transcript, source = meta_for(url), None, None
            video_cache.set(url, (meta, transcript, source))
        else:
            job.stage, job.progress = "Membaca info video", 0.08
            info = get_info(url)
            meta = youtube.summarize(info)
            job.stage, job.progress = "Mengambil transkrip", 0.22
            transcript, source = youtube.get_transcript(info) or (None, None)
            video_cache.set(url, (meta, transcript, source))

        use_video = mode == "video" or (mode == "auto" and not transcript)
        if mode == "transcript" and not transcript:
            raise YouTubeError("Video ini tidak punya subtitle/auto-caption. Pilih mode 'Video' atau 'Otomatis'.")

        job.stage = "Gemini menonton video" if use_video else "Gemini membaca transkrip"
        job.progress = 0.4
        def on_status(msg: str):
            job.stage = msg

        out = ai.find_clips(meta, req.prompt, req.count, transcript, use_video, req.model, on_status, api_key)

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
    if config.HOSTED:
        raise HTTPException(403, LOCAL_ONLY)
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


@app.post("/api/full")
def download_full(req: FullRequest):
    """Unduh video YouTube / TikTok utuh (MP4 rasio asli) atau audionya saja (MP3), tanpa dipotong.
    TikTok selalu diambil versi tanpa watermark dengan kualitas asli."""
    if config.HOSTED:
        raise HTTPException(403, LOCAL_ONLY)
    try:
        url = youtube.validate_url(req.url, allow_tiktok=True)
    except YouTubeError as e:
        raise HTTPException(400, str(e))

    def work(job: jobs.Job):
        job.stage = "Membaca info video"
        meta = youtube.summarize(get_info(url))
        limit = config.MAX_FULL_MINUTES * 60
        if limit and meta["duration"] > limit:
            raise ValueError(
                f"Video terlalu panjang ({fmt(meta['duration'])}). Maksimal {fmt(limit)}; "
                "potong dulu lewat tab Timestamp."
            )
        tiktok = youtube.is_tiktok(url)
        if tiktok and req.format == "mp4" and not meta["heights"]:
            raise ValueError("Post foto/slideshow TikTok belum didukung. Pilih Audio MP3 untuk mengambil suaranya.")
        top = max(meta["heights"] or [req.height])
        height = min(req.height, top) if req.format == "mp4" else req.height
        if req.format == "mp3":
            job.stage = "Mengunduh audio"
        elif tiktok:
            job.stage = "Mengunduh video TikTok"
        else:
            job.stage = f"Mengunduh video {height}p"

        def on_progress(p):
            job.progress = p * 0.95

        def on_stage(text):
            job.stage = text

        base = safe_name(meta["title"], 80)
        f = youtube.download_clip(
            meta["url"] or url, None, None, req.format, height, job.workdir, base, on_progress, on_stage
        )
        job.file, job.filename = f, f.name

    job = jobs.submit("full", work, SAFE_ERRORS)
    return job.public()


# ------------------------------------------------------------------ editor --
# Sumber yang sudah disiapkan dipakai ulang: (url, mulai, selesai, tinggi) -> id job sumber
_sources: dict[tuple, str] = {}
_sources_lock = threading.Lock()


@app.post("/api/editor/source")
def editor_source(req: SourceRequest):
    """Siapkan potongan video untuk editor (preview + render). Diunduh sekali, dengan jeda di kiri-kanan
    klip supaya batasnya masih bisa digeser."""
    if config.HOSTED:
        raise HTTPException(403, LOCAL_ONLY)
    try:
        url = youtube.validate_url(req.url)
        s, e = to_seconds(req.start), to_seconds(req.end)
        if e - s < 1:
            raise ValueError("Waktu selesai harus setelah waktu mulai.")
        if e - s > config.MAX_CLIP_SECONDS:
            raise ValueError(f"Durasi klip maksimal {config.MAX_CLIP_SECONDS // 60} menit.")
    except (YouTubeError, ValueError) as err:
        raise HTTPException(400, str(err))

    key = (url, round(s, 2), round(e, 2), req.height)
    with _sources_lock:
        old = jobs.get(_sources.get(key, ""))
        if old and old.status in ("queued", "running"):
            return old.public()
        if old and old.status == "done" and old.file and old.file.exists():
            old.touch()
            return old.public()

    def work(job: jobs.Job):
        job.stage = "Membaca info video"
        meta = youtube.summarize(get_info(url))
        total = meta["duration"] or 0
        if total and s >= total:
            raise ValueError(f"Video hanya {fmt(total)}.")
        top = max(meta["heights"] or [req.height])
        h = min(req.height, top)
        a = max(0.0, s - editor.PAD_SECONDS)
        b = min(total, e + editor.PAD_SECONDS) if total else e + editor.PAD_SECONDS
        job.stage, job.progress = f"Mengunduh potongan {h}p", 0.05

        def on_progress(p):
            job.progress = 0.05 + p * 0.9

        f = youtube.download_clip(url, a, b, "mp4", h, job.workdir, "source", on_progress)
        info = editor.probe(f)
        job.file, job.filename = f, f.name
        job.result = {
            "source_id": job.id,
            "video": meta,
            # Detik video YouTube pada awal file sumber, dan rentang yang tersedia untuk digeser
            "offset": a,
            "available": [a, a + info["duration"]],
            "start": s,
            "end": min(e, a + info["duration"]),
            "width": info["width"],
            "height": info["height"],
            "has_audio": info["has_audio"],
            "video_url": f"/api/editor/source/{job.id}/video",
        }

    job = jobs.submit("source", work, SAFE_ERRORS)
    with _sources_lock:
        _sources[key] = job.id
    return job.public()


@app.get("/api/editor/source/{job_id}/video")
def editor_source_video(job_id: str):
    job = jobs.get(job_id)
    if not job or job.kind != "source" or not job.file or not job.file.exists():
        raise HTTPException(404, "Sumber klip sudah kedaluwarsa. Buka ulang editor.")
    job.touch()
    return FileResponse(job.file, media_type="video/mp4")


_peaks: dict[tuple[str, int], list[float]] = {}


@app.get("/api/editor/source/{job_id}/peaks")
def editor_source_peaks(job_id: str, n: int = Query(400, ge=50, le=2000)):
    """Gelombang suara file sumber untuk timeline batas klip."""
    job = jobs.get(job_id)
    if not job or job.kind != "source" or not job.file or not job.file.exists():
        raise HTTPException(404, "Sumber klip sudah kedaluwarsa. Buka ulang editor.")
    key = (job_id, n)
    if key not in _peaks:
        if len(_peaks) > 64:
            _peaks.clear()
        _peaks[key] = editor.peaks(job.file, n)
    return {"peaks": _peaks[key]}


@app.get("/api/editor/fonts")
def editor_fonts():
    """Daftar font untuk watermark, teks pembuka & subtitle: bawaan + yang diunggah pengguna."""
    return [{**f, "url": f"/api/editor/fonts/{f['id']}"} for f in editor.list_fonts()]


@app.get("/api/editor/fonts/{font_id}")
def editor_font_file(font_id: str):
    path = editor.font_path(font_id)
    if not path:
        raise HTTPException(404, "Font tidak ditemukan.")
    return FileResponse(
        path,
        media_type="font/otf" if path.suffix == ".otf" else "font/ttf",
        headers={"Cache-Control": "public, max-age=604800"},
    )


@app.post("/api/editor/fonts/upload")
async def editor_font_upload(
    request: Request,
    name: str = Query(..., max_length=255),
    label: str = Query("", max_length=60),
):
    """Unggah font sendiri (.ttf / .otf). Isi file dikirim langsung sebagai body permintaan."""
    if config.HOSTED:
        raise HTTPException(403, LOCAL_ONLY)
    limit = editor.MAX_FONT_MB * 1024 * 1024
    data = bytearray()
    async for chunk in request.stream():
        data += chunk
        if len(data) > limit:
            raise HTTPException(413, f"File font terlalu besar. Maksimal {editor.MAX_FONT_MB} MB.")
    try:
        font = await run_in_threadpool(editor.add_user_font, bytes(data), name, label)
    except EditorError as err:
        raise HTTPException(400, str(err))
    return {**font, "url": f"/api/editor/fonts/{font['id']}"}


@app.delete("/api/editor/fonts/{font_id}")
def editor_font_delete(font_id: str):
    if config.HOSTED:
        raise HTTPException(403, LOCAL_ONLY)
    if not editor.delete_user_font(font_id):
        raise HTTPException(404, "Font tidak ditemukan atau font bawaan (tidak bisa dihapus).")
    return {"ok": True}


@app.post("/api/editor/upload")
async def editor_upload(request: Request, name: str = Query(..., max_length=255)):
    """Unggah file milik pengguna (video hook, video akhir, musik). Isi file dikirim langsung sebagai
    body permintaan, jadi tidak butuh library tambahan untuk form multipart."""
    if config.HOSTED:
        raise HTTPException(403, LOCAL_ONLY)
    try:
        uid, path = editor.new_upload(name)
    except EditorError as err:
        raise HTTPException(400, str(err))
    limit = config.MAX_UPLOAD_MB * 1024 * 1024
    size = 0
    try:
        with open(path, "wb") as fh:
            async for chunk in request.stream():
                size += len(chunk)
                if size > limit:
                    raise HTTPException(413, f"File terlalu besar. Maksimal {config.MAX_UPLOAD_MB} MB.")
                fh.write(chunk)
        if size == 0:
            raise HTTPException(400, "File kosong.")
        info = await run_in_threadpool(editor.probe, path)
    except EditorError as err:
        path.unlink(missing_ok=True)
        raise HTTPException(400, str(err))
    except BaseException:
        path.unlink(missing_ok=True)
        raise
    is_image = path.suffix in editor.IMAGE_EXT and info["has_video"]
    is_video = info["has_video"] and path.suffix in editor.VIDEO_EXT
    if not is_image and not is_video and not info["has_audio"]:
        path.unlink(missing_ok=True)
        raise HTTPException(400, "File ini tidak berisi video maupun audio.")
    return {
        "id": uid,
        "name": name,
        "kind": "image" if is_image else "video" if is_video else "audio",
        "duration": info["duration"],
        "width": info["width"],
        "height": info["height"],
        "has_audio": info["has_audio"],
        "size": size,
        "url": f"/api/editor/upload/{uid}",
    }


@app.get("/api/editor/upload/{uid}")
def editor_upload_file(uid: str):
    path = editor.find_upload(uid)
    if not path:
        raise HTTPException(404, "File unggahan tidak ditemukan atau sudah dihapus otomatis.")
    os.utime(path)  # tandai masih dipakai supaya tidak ikut dihapus otomatis
    return FileResponse(path)


@app.post("/api/editor/render")
def editor_render(req: RenderRequest):
    """Render resep edit menjadi MP4."""
    if config.HOSTED:
        raise HTTPException(403, LOCAL_ONLY)
    src = jobs.get(req.source_id)
    if not src or src.kind != "source" or src.status != "done" or not src.file or not src.file.exists():
        raise HTTPException(404, "Sumber klip sudah kedaluwarsa. Buka ulang editor untuk klip ini.")
    src.touch()
    source, offset = src.file, float(src.result["offset"])
    recipe = req.recipe

    def work(job: jobs.Job):
        job.stage = f"Merender {recipe.aspect} · {recipe.height}p"
        job.workdir.mkdir(parents=True, exist_ok=True)
        base = safe_name(f"{req.title} ({fmt(recipe.trim.start).replace(':', '.')})", 80)
        out = job.workdir / f"{base} [{recipe.aspect.replace(':', 'x')}].mp4"

        def on_progress(p):
            job.progress = p
            src.touch()

        editor.render(source, offset, recipe, out, on_progress)
        job.file, job.filename = out, out.name

    job = jobs.submit("render", work, SAFE_ERRORS)
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


# Website statis (mode satu-server, mis. di HP lewat Termux). Dipasang paling akhir supaya
# rute /api/* di atas tetap diprioritaskan.
if (config.WEB_DIR / "index.html").exists():
    app.mount("/", StaticFiles(directory=config.WEB_DIR, html=True), name="web")
