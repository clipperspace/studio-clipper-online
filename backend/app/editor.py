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

import hashlib
import json
import os
import re
import subprocess
import uuid
from array import array
from pathlib import Path
from typing import Callable, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from . import config

PAD_SECONDS = 15  # jeda sebelum & sesudah klip pada file sumber
UPLOAD_DIR = config.DOWNLOAD_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Font bawaan untuk watermark, teks pembuka & subtitle (lisensi OFL, lihat backend/fonts/LICENSE-*).
# id → (nama tampilan, file). Frontend memuat file yang sama supaya preview sama dengan hasil render.
FONTS_DIR = config.BASE_DIR / "fonts"
FONTS: dict[str, tuple[str, str]] = {
    "poppins": ("Poppins Bold", "Poppins-Bold.ttf"),
    "poppins-black": ("Poppins Black", "Poppins-Black.ttf"),
    "inter-extrabold": ("Inter ExtraBold", "Inter-ExtraBold.ttf"),
    "inter-black": ("Inter Black", "Inter-Black.ttf"),
    "rubik-bold": ("Rubik Bold", "Rubik-Bold.ttf"),
    "montserrat-black": ("Montserrat Black", "Montserrat-Black.ttf"),
    "archivo": ("Archivo Black", "ArchivoBlack-Regular.ttf"),
}
# Font milik pengguna (diunggah sendiri, mis. font berbayar yang sudah dibeli). Tidak ikut dihapus otomatis.
USER_FONTS_DIR = FONTS_DIR / "user"
USER_FONTS_INDEX = USER_FONTS_DIR / "fonts.json"
MAX_FONT_MB = 15

VIDEO_EXT = {".mp4", ".mov", ".m4v", ".webm", ".mkv"}
AUDIO_EXT = {".mp3", ".m4a", ".aac", ".wav", ".ogg", ".opus", ".flac"}
# Gambar teks pembuka yang digambar browser (PNG transparan)
IMAGE_EXT = {".png"}


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


class Crop(BaseModel):
    """Potong manual untuk latar "fill": bagian video yang ditampilkan.
    x, y = posisi (0 = kiri/atas, 0.5 = tengah, 1 = kanan/bawah), zoom = perbesaran di atas ukuran pas layar."""

    x: float = Field(0.5, ge=0, le=1)
    y: float = Field(0.5, ge=0, le=1)
    zoom: float = Field(1.0, ge=1, le=4)


def _user_fonts() -> dict[str, dict]:
    try:
        data = json.loads(USER_FONTS_INDEX.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def list_fonts() -> list[dict]:
    builtin = [{"id": k, "name": name, "user": False} for k, (name, _) in FONTS.items()]
    user = [
        {"id": k, "name": v.get("name", k), "user": True}
        for k, v in _user_fonts().items()
        if (USER_FONTS_DIR / str(v.get("file", ""))).is_file()
    ]
    return builtin + user


def font_path(font_id: str) -> Path | None:
    if font_id in FONTS:
        return FONTS_DIR / FONTS[font_id][1]
    info = _user_fonts().get(font_id)
    if info:
        p = USER_FONTS_DIR / str(info.get("file", ""))
        if p.is_file() and p.parent == USER_FONTS_DIR:
            return p
    return None


def add_user_font(data: bytes, filename: str, name: str = "") -> dict:
    """Simpan font unggahan pengguna (.ttf / .otf). Font yang sama tidak disimpan dua kali."""
    ext = Path(filename or "").suffix.lower()
    if ext not in (".ttf", ".otf"):
        raise EditorError("Font harus berupa file .ttf atau .otf.")
    if len(data) > MAX_FONT_MB * 1024 * 1024:
        raise EditorError(f"File font terlalu besar. Maksimal {MAX_FONT_MB} MB.")
    if data[:4] not in (b"\x00\x01\x00\x00", b"OTTO", b"true"):
        raise EditorError("File ini bukan font TrueType / OpenType yang valid.")
    fid = "u-" + hashlib.sha1(data).hexdigest()[:10]
    USER_FONTS_DIR.mkdir(parents=True, exist_ok=True)
    path = USER_FONTS_DIR / f"{fid}{ext}"
    path.write_bytes(data)
    # Pastikan FFmpeg (FreeType) bisa memakai font ini
    test = subprocess.run(
        ["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "color=s=64x64", "-frames:v", "1",
         "-vf", f"drawtext=fontfile={path.name}:text=Aa", "-f", "null", "-"],
        cwd=USER_FONTS_DIR, capture_output=True,
    )
    if test.returncode != 0:
        path.unlink(missing_ok=True)
        raise EditorError("Font tidak bisa dipakai untuk render. Coba file font lain.")
    index = _user_fonts()
    label = " ".join((name or Path(filename).stem).replace("_", " ").replace("-", " ").split())[:40] or fid
    index[fid] = {"name": label, "file": path.name}
    USER_FONTS_INDEX.write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")
    return {"id": fid, "name": label, "user": True}


def delete_user_font(font_id: str) -> bool:
    index = _user_fonts()
    info = index.pop(font_id, None)
    if not info:
        return False
    (USER_FONTS_DIR / str(info.get("file", ""))).unlink(missing_ok=True)
    USER_FONTS_INDEX.write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")
    return True


def _font(v: str) -> str:
    if not font_path(v):
        raise ValueError("Font tidak ditemukan. Pilih font lain.")
    return v


class Watermark(BaseModel):
    """Nama akun di atas video. x, y = posisi (0 = kiri/atas, 1 = kanan/bawah); ukuran = pecahan lebar video."""

    on: bool = False
    text: str = Field("", max_length=60)
    font: str = "poppins"
    size: float = Field(0.035, ge=0.015, le=0.12)
    color: Literal["white", "black", "yellow"] = "white"
    opacity: float = Field(0.7, ge=0.05, le=1)
    x: float = Field(0.95, ge=0, le=1)
    y: float = Field(0.05, ge=0, le=1)

    @field_validator("font")
    @classmethod
    def _known_font(cls, v: str) -> str:
        return _font(v)

    @field_validator("text")
    @classmethod
    def _one_line(cls, v: str) -> str:
        return " ".join(v.split())


class Title(BaseModel):
    """Teks pembuka di detik-detik awal video (di atas video hook jika ada).

    Teksnya digambar browser menjadi PNG transparan (warna, kotak rounded, garis tepi, jarak baris &
    huruf), lalu diunggah. Jadi hasil render persis sama dengan preview, untuk font apa pun."""

    on: bool = False
    image: str = ""  # id unggahan PNG
    ref_width: int = Field(1080, ge=100, le=4000)  # lebar video saat PNG digambar
    x: float = Field(0.5, ge=0, le=1)
    y: float = Field(0.18, ge=0, le=1)
    duration: float = Field(5, ge=1, le=10)


class Recipe(BaseModel):
    """Resep edit. Versi dinaikkan jika bentuknya berubah tidak kompatibel."""

    v: Literal[1] = 1
    trim: Trim
    aspect: Aspect = "9:16"
    background: Background = "blur"
    height: Literal[360, 480, 720, 1080] = 1080
    crop: Crop = Field(default_factory=Crop)
    watermark: Watermark = Field(default_factory=Watermark)
    title: Title = Field(default_factory=Title)


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


def peaks(path: Path, n: int = 400) -> list[float]:
    """Gelombang suara ringkas: n nilai 0–1 (puncak per bagian) untuk timeline editor."""
    cmd = ["ffmpeg", "-v", "error", "-i", str(path), "-map", "0:a:0?", "-ac", "1", "-ar", "4000", "-f", "s16le", "-"]
    proc = subprocess.run(cmd, capture_output=True)
    samples = array("h")
    samples.frombytes(proc.stdout[: len(proc.stdout) // 2 * 2])
    if not samples:
        return [0.0] * n
    size = max(1, len(samples) // n)
    out = []
    for i in range(n):
        chunk = samples[i * size : (i + 1) * size]
        out.append(max((abs(x) for x in chunk), default=0))
    top = max(out) or 1
    return [round(v / top, 3) for v in out]


# ---------------------------------------------------------------- upload --

def new_upload(filename: str) -> tuple[str, Path]:
    ext = Path(filename or "").suffix.lower()
    if ext not in VIDEO_EXT | AUDIO_EXT | IMAGE_EXT:
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


def frame_video(
    g: Graph, src: str, src_w: int, src_h: int, w: int, h: int, background: str, crop: Crop | None = None
) -> str:
    """Lapisan dasar: menyesuaikan video ke rasio tujuan (latar blur / hitam / potong manual)."""
    crop = crop or Crop()
    same_ratio = bool(src_w and src_h and abs(src_w / src_h - w / h) < 0.01)
    if same_ratio and crop.zoom <= 1.001:
        return g.add([src], f"scale={w}:{h}:flags=lanczos,setsar=1")[0]
    if (background == "fill" or same_ratio) and src_w and src_h:
        # Potong manual: ambil bagian video seukuran layar tujuan (÷ zoom) di posisi x/y, lalu perbesar.
        # Potong dulu baru diperbesar → ringan walau zoom besar.
        s = max(w / src_w, h / src_h) * crop.zoom
        cw, ch = min(src_w, round(w / s / 2) * 2), min(src_h, round(h / s / 2) * 2)
        x, y = round((src_w - cw) * crop.x), round((src_h - ch) * crop.y)
        return g.add([src], f"crop={cw}:{ch}:{x}:{y},scale={w}:{h}:flags=lanczos,setsar=1")[0]
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


COLORS = {"white": "0xFFFFFF", "black": "0x111111", "yellow": "0xFFCC00"}


def _drawtext(workdir: Path, name: str, text: str, font: str, opts: dict[str, object], x: float, y: float, pad: int) -> str:
    """Filter drawtext. Teks ditulis ke file (tanpa perlu escape karakter khusus) dan font dirujuk
    dengan path relatif dari folder kerja (FFmpeg dijalankan di folder itu), supaya aman di Windows.
    Posisi: x, y = 0 → tepi kiri/atas, 1 → tepi kanan/bawah, 0.5 → tengah; tidak pernah keluar layar."""
    # Tulis sebagai bytes: write_text di Windows mengubah baris baru jadi CRLF (dibaca FFmpeg sebagai 2 baris)
    (workdir / name).write_bytes(text.encode("utf-8"))
    fontfile = Path(os.path.relpath(font_path(font) or FONTS_DIR / FONTS["poppins"][1], workdir)).as_posix()
    parts = {
        "textfile": name,
        "fontfile": fontfile,
        "expansion": "none",
        "x": f"'max({pad},min(w-text_w-{pad},w*{x:.4f}-text_w*{x:.4f}))'",
        "y": f"'max({pad},min(h-text_h-{pad},h*{y:.4f}-text_h*{y:.4f}))'",
        **opts,
    }
    return "drawtext=" + ":".join(f"{k}={v}" for k, v in parts.items())


def watermark_filter(wm: Watermark, w: int, workdir: Path) -> str | None:
    if not wm.on or not wm.text:
        return None
    px = max(10, round(wm.size * w))
    opts: dict[str, object] = {"fontsize": px, "fontcolor": f"{COLORS[wm.color]}@{wm.opacity:.2f}"}
    if wm.color != "black":
        sh = max(1, round(px * 0.06))
        opts |= {"shadowcolor": f"0x000000@{wm.opacity * 0.5:.2f}", "shadowx": sh, "shadowy": sh}
    return _drawtext(workdir, "watermark.txt", wm.text, wm.font, opts, wm.x, wm.y, 4)


def title_image(t: Title) -> Path | None:
    """File PNG teks pembuka, jika aktif."""
    if not t.on or not t.image:
        return None
    path = find_upload(t.image)
    if not path or path.suffix.lower() not in IMAGE_EXT:
        raise EditorError("Gambar teks pembuka tidak ditemukan. Ubah sedikit teksnya lalu render ulang.")
    return path


def title_overlay(g: Graph, v: str, t: Title, w: int, clip_len: float, label: str) -> str:
    """Tempel PNG teks pembuka (input `label`) dengan muncul/hilang halus di awal & akhir durasi.
    Posisi: x, y = 0 → menempel tepi kiri/atas, 1 → tepi kanan/bawah, 0.5 → tengah."""
    d = min(t.duration, clip_len)
    fade = min(0.3, d / 4)
    scale = w / t.ref_width
    img = g.add(
        [label],
        f"scale=round(iw*{scale:.5f}):-1:flags=lanczos,format=rgba,"
        f"fade=t=in:st=0:d={fade:.2f}:alpha=1,fade=t=out:st={d - fade:.2f}:d={fade:.2f}:alpha=1",
    )[0]
    return g.add(
        [v, img],
        f"overlay=x='max(0,min(W-w,W*{t.x:.4f}-w*{t.x:.4f}))':y='max(0,min(H-h,H*{t.y:.4f}-h*{t.y:.4f}))'"
        ":eof_action=pass:format=auto",
    )[0]


def build_graph(recipe: Recipe, src_info: dict, workdir: Path, title_input: str | None = None) -> tuple[str, str, str | None]:
    """Return (filter_complex, label_video, label_audio | None). `title_input` = label input PNG teks pembuka."""
    g = Graph()
    w, h = out_size(recipe.aspect, recipe.height)
    v = frame_video(g, "0:v", src_info["width"], src_info["height"], w, h, recipe.background, recipe.crop)
    clip_len = recipe.trim.end - recipe.trim.start
    wm = watermark_filter(recipe.watermark, w, workdir)
    if wm:
        v = g.add([v], wm)[0]
    if title_input:
        v = title_overlay(g, v, recipe.title, w, clip_len, title_input)
    # Lapisan fitur berikutnya (subtitle, musik, efek, …) ditambahkan di sini.
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

    workdir = out.parent
    workdir.mkdir(parents=True, exist_ok=True)
    title_png = title_image(recipe.title)
    graph, v, a = build_graph(recipe, info, workdir, "1:v" if title_png else None)
    extra: list[str] = []
    if title_png:
        # Gambar diam diulang sepanjang durasi teks (supaya efek muncul/hilang bisa berjalan)
        d = min(recipe.title.duration, dur)
        extra = ["-loop", "1", "-framerate", "30", "-t", f"{d:.3f}", "-i", str(title_png.resolve())]
    cmd = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-nostats", "-progress", "pipe:1",
        "-ss", f"{start:.3f}", "-t", f"{dur:.3f}", "-i", str(source.resolve()), *extra,
        "-filter_complex", graph, "-map", f"[{v}]",
    ]
    if a:
        cmd += ["-map", f"[{a}]", "-c:a", "aac", "-b:a", "192k"]
    cmd += [
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-r", "30",
        "-movflags", "+faststart", str(out.resolve()),
    ]

    # Dijalankan di folder kerja: file teks & font dirujuk dengan path relatif
    proc = subprocess.Popen(
        cmd, cwd=workdir, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace"
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
