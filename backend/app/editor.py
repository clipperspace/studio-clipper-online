"""Editor klip: resep edit (JSON) → satu perintah FFmpeg.

Alur:
1. Sumber: potongan video YouTube [mulai − PAD, selesai + PAD] diunduh sekali, dipakai untuk preview
   di browser dan render berulang. Jeda (PAD) memberi ruang untuk menggeser batas klip.
2. Upload: file milik pengguna (video hook, video akhir, musik) disimpan di folder uploads/.
3. Render: resep edit dirender jadi MP4 dalam satu proses FFmpeg.

Setiap fitur editor (subtitle, teks, watermark, musik, efek, …) nantinya menambah "lapisan" di
`build_graph()`, jadi mesin render tidak perlu ditulis ulang per fitur.
"""
from __future__ import annotations

import json
import re
import subprocess
import uuid
from pathlib import Path
from typing import Callable, Literal

from pydantic import BaseModel, Field, model_validator

from . import config

PAD_SECONDS = 15  # jeda sebelum & sesudah klip pada file sumber
UPLOAD_DIR = config.DOWNLOAD_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

VIDEO_EXT = {".mp4", ".mov", ".m4v", ".webm", ".mkv"}
AUDIO_EXT = {".mp3", ".m4a", ".aac", ".wav", ".ogg", ".opus", ".flac"}


class EditorError(Exception):
    """Kesalahan yang aman ditampilkan ke pengguna."""


# ------------------------------------------------------------------ resep --

Aspect = Literal["9:16", "1:1", "4:5", "16:9"]
# blur = video utuh + latar blur, black = video utuh + latar hitam, fill = crop memenuhi layar
Background = Literal["blur", "black", "fill"]


class Trim(BaseModel):
    """Batas klip dalam detik, dihitung dari awal video YouTube (bukan dari awal file sumber)."""

    start: float = Field(..., ge=0)
    end: float = Field(..., gt=0)

    @model_validator(mode="after")
    def _order(self):
        if self.end - self.start < 1:
            raise ValueError("Durasi klip minimal 1 detik.")
        if self.end - self.start > config.MAX_CLIP_SECONDS:
            raise ValueError(f"Durasi klip maksimal {config.MAX_CLIP_SECONDS // 60} menit.")
        return self


class Recipe(BaseModel):
    """Resep edit. Versi dinaikkan jika bentuknya berubah tidak kompatibel."""

    v: Literal[1] = 1
    trim: Trim
    aspect: Aspect = "9:16"
    background: Background = "blur"
    height: Literal[360, 480, 720, 1080] = 1080


def out_size(aspect: str, height: int) -> tuple[int, int]:
    """Ukuran video hasil. `height` = sisi pendek (1080 → 1080×1920 untuk 9:16, 1920×1080 untuk 16:9)."""
    short = int(height) // 2 * 2
    num, den = (int(x) for x in aspect.split(":"))
    long_ = (short * max(num, den) // min(num, den)) // 2 * 2
    return (short, long_) if num < den else (long_, short) if num > den else (short, short)


# --------------------------------------------------------------- ffprobe --

def probe(path: Path) -> dict:
    """Info dasar file media: durasi, ada video/audio, ukuran gambar."""
    cmd = [
        "ffprobe", "-v", "error", "-show_entries",
        "format=duration:stream=codec_type,width,height", "-of", "json", str(path),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if proc.returncode != 0:
        raise EditorError("File tidak bisa dibaca. Pastikan formatnya video atau audio yang umum.")
    data = json.loads(proc.stdout or "{}")
    streams = data.get("streams") or []
    video = next((s for s in streams if s.get("codec_type") == "video" and s.get("width")), None)
    return {
        "duration": float((data.get("format") or {}).get("duration") or 0),
        "has_video": video is not None,
        "has_audio": any(s.get("codec_type") == "audio" for s in streams),
        "width": int(video["width"]) if video else 0,
        "height": int(video["height"]) if video else 0,
    }


# ---------------------------------------------------------------- upload --

def new_upload(filename: str) -> tuple[str, Path]:
    ext = Path(filename or "").suffix.lower()
    if ext not in VIDEO_EXT | AUDIO_EXT:
        raise EditorError("Format file tidak didukung. Pakai MP4/MOV/WEBM untuk video atau MP3/M4A/WAV untuk audio.")
    uid = uuid.uuid4().hex[:12]
    return uid, UPLOAD_DIR / f"{uid}{ext}"


def find_upload(uid: str) -> Path | None:
    if not re.fullmatch(r"[0-9a-f]{12}", uid or ""):
        return None
    return next(UPLOAD_DIR.glob(f"{uid}.*"), None)


# ------------------------------------------------------------ render graph --

class Graph:
    """Penyusun filter_complex FFmpeg. Setiap lapisan memakai label keluaran lapisan sebelumnya."""

    def __init__(self):
        self.parts: list[str] = []
        self.n = 0

    def label(self, prefix: str = "x") -> str:
        self.n += 1
        return f"{prefix}{self.n}"

    def add(self, inputs: list[str], filt: str, outs: int = 1, prefix: str = "x") -> list[str]:
        labels = [self.label(prefix) for _ in range(outs)]
        self.parts.append("".join(f"[{i}]" for i in inputs) + filt + "".join(f"[{o}]" for o in labels))
        return labels

    def script(self) -> str:
        return ";".join(self.parts)


def frame_video(g: Graph, src: str, src_w: int, src_h: int, w: int, h: int, background: str) -> str:
    """Lapisan dasar: menyesuaikan video ke rasio tujuan (latar blur / hitam / crop penuh)."""
    same_ratio = src_w and src_h and abs(src_w / src_h - w / h) < 0.01
    if same_ratio:
        return g.add([src], f"scale={w}:{h}:flags=lanczos,setsar=1")[0]
    if background == "fill":
        return g.add([src], f"scale={w}:{h}:force_original_aspect_ratio=increase:flags=lanczos,crop={w}:{h},setsar=1")[0]
    fit = f"scale={w}:{h}:force_original_aspect_ratio=decrease:flags=lanczos,setsar=1"
    if background == "black":
        return g.add([src], f"{fit},pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:color=black")[0]
    # Latar blur: kecilkan dulu baru blur, lalu besarkan → jauh lebih ringan daripada blur di resolusi penuh
    a, b = g.add([src], "split=2", outs=2)
    bw, bh = max(2, (w // 8) // 2 * 2), max(2, (h // 8) // 2 * 2)
    bg = g.add(
        [a],
        f"scale={bw}:{bh}:force_original_aspect_ratio=increase,crop={bw}:{bh},boxblur=6:2,"
        f"scale={w}:{h},setsar=1,eq=brightness=-0.08",
    )[0]
    fg = g.add([b], fit)[0]
    return g.add([bg, fg], "overlay=(W-w)/2:(H-h)/2")[0]


def build_graph(recipe: Recipe, src_info: dict) -> tuple[str, str, str | None]:
    """Return (filter_complex, label_video, label_audio | None)."""
    g = Graph()
    w, h = out_size(recipe.aspect, recipe.height)
    v = frame_video(g, "0:v", src_info["width"], src_info["height"], w, h, recipe.background)
    # Lapisan fitur berikutnya (subtitle, teks, watermark, efek, …) ditambahkan di sini.
    v = g.add([v], "format=yuv420p")[0]
    a = None
    if src_info["has_audio"]:
        a = g.add(["0:a"], "aresample=48000")[0]
    return g.script(), v, a


# ---------------------------------------------------------------- render --

def render(
    source: Path,
    source_offset: float,
    recipe: Recipe,
    out: Path,
    on_progress: Callable[[float], None] | None = None,
) -> Path:
    """Render resep edit menjadi MP4. `source_offset` = detik video YouTube pada awal file sumber."""
    info = probe(source)
    if not info["has_video"]:
        raise EditorError("File sumber tidak berisi video.")
    start = recipe.trim.start - source_offset
    dur = recipe.trim.end - recipe.trim.start
    if start < -0.05 or start + dur > info["duration"] + 0.5:
        raise EditorError(
            "Batas klip di luar rentang yang sudah disiapkan. Buka ulang editor untuk klip ini."
        )
    start = max(0.0, start)

    graph, v, a = build_graph(recipe, info)
    cmd = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-nostats", "-progress", "pipe:1",
        "-ss", f"{start:.3f}", "-t", f"{dur:.3f}", "-i", str(source),
        "-filter_complex", graph, "-map", f"[{v}]",
    ]
    if a:
        cmd += ["-map", f"[{a}]", "-c:a", "aac", "-b:a", "192k"]
    cmd += [
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-r", "30",
        "-movflags", "+faststart", str(out),
    ]

    proc = subprocess.Popen(
        cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace"
    )
    assert proc.stdout is not None
    for line in proc.stdout:
        if on_progress and line.startswith("out_time_us="):
            try:
                on_progress(min(0.99, int(line.split("=", 1)[1]) / 1e6 / dur))
            except ValueError:
                pass
    err = proc.stderr.read() if proc.stderr else ""
    if proc.wait() != 0 or not out.exists():
        raise EditorError(f"Render gagal: {err.strip()[-300:]}")
    return out
