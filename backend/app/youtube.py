"""Semua interaksi dengan YouTube lewat yt-dlp: metadata, transkrip, dan potong klip."""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path
from typing import Callable
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlparse
from urllib.request import Request, urlopen

import yt_dlp
from yt_dlp.utils import download_range_func

from .timeutil import fmt

ALLOWED_HOSTS = {
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtu.be",
}

BASE_OPTS = {
    "quiet": True,
    "no_warnings": True,
    "noplaylist": True,
    "noprogress": True,
}


class YouTubeError(Exception):
    """Error yang pesannya aman ditampilkan ke pengguna."""


def validate_url(url: str) -> str:
    url = (url or "").strip()
    if not url:
        raise YouTubeError("Link YouTube belum diisi.")
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    host = (urlparse(url).hostname or "").lower()
    if host not in ALLOWED_HOSTS:
        raise YouTubeError("Hanya link YouTube (youtube.com / youtu.be) yang didukung.")
    return url


def _friendly(err: Exception) -> YouTubeError:
    msg = str(err)
    low = msg.lower()
    if "sign in to confirm" in low or "not a bot" in low:
        return YouTubeError(
            "YouTube meminta verifikasi bot untuk koneksi ini. Coba lagi nanti atau gunakan koneksi lain."
        )
    if "private video" in low:
        return YouTubeError("Video ini private dan tidak bisa diakses.")
    if "age" in low and "restrict" in low:
        return YouTubeError("Video ini dibatasi usia dan tidak bisa diakses tanpa login.")
    if "video unavailable" in low or "is not available" in low:
        return YouTubeError("Video tidak tersedia (dihapus, diblokir di wilayah ini, atau link salah).")
    if "live event" in low or "is live" in low:
        return YouTubeError("Live stream yang sedang berlangsung belum didukung.")
    # Hapus kode warna ANSI dari pesan yt-dlp
    clean = re.sub(r"\x1b\[[0-9;]*m", "", msg).replace("ERROR: ", "")
    return YouTubeError(f"Gagal memproses video: {clean[:300]}")


def extract_info(url: str) -> dict:
    try:
        with yt_dlp.YoutubeDL({**BASE_OPTS, "skip_download": True}) as ydl:
            info = ydl.extract_info(url, download=False)
    except yt_dlp.utils.DownloadError as e:
        raise _friendly(e) from e
    if not info:
        raise YouTubeError("Tidak bisa membaca info video.")
    if info.get("_type") == "playlist":
        raise YouTubeError("Link playlist belum didukung. Gunakan link satu video.")
    if info.get("is_live"):
        raise YouTubeError("Live stream yang sedang berlangsung belum didukung.")
    return info


_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")


def video_id(url: str) -> str:
    """Ambil ID 11 karakter dari link youtube.com/watch, youtu.be, /shorts, /live, /embed."""
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    parts = [p for p in parsed.path.split("/") if p]
    vid = ""
    if host == "youtu.be" and parts:
        vid = parts[0]
    elif parts[:1] == ["watch"]:
        vid = (parse_qs(parsed.query).get("v") or [""])[0]
    elif len(parts) >= 2 and parts[0] in ("shorts", "live", "embed", "v"):
        vid = parts[1]
    if not _ID_RE.match(vid):
        raise YouTubeError("Link YouTube tidak dikenali. Gunakan link satu video (youtube.com/watch?v=… atau youtu.be/…).")
    return vid


def oembed_summary(url: str) -> dict:
    """Info ringkas lewat oEmbed resmi YouTube, tanpa yt-dlp (dipakai di mode online).
    oEmbed tidak memberi durasi & resolusi, jadi keduanya dikosongkan."""
    vid = video_id(url)
    watch = f"https://www.youtube.com/watch?v={vid}"
    req = Request(
        "https://www.youtube.com/oembed?" + urlencode({"url": watch, "format": "json"}),
        headers={"User-Agent": "StudioClipper/1.0"},
    )
    try:
        with urlopen(req, timeout=10) as res:
            data = json.loads(res.read().decode("utf-8"))
    except HTTPError as e:
        if e.code in (401, 403):
            raise YouTubeError("Video ini private atau tidak mengizinkan disematkan.") from e
        if e.code in (400, 404):
            raise YouTubeError("Video tidak tersedia (dihapus, private, atau link salah).") from e
        raise YouTubeError(f"YouTube tidak merespons ({e.code}). Coba lagi sebentar.") from e
    except (URLError, TimeoutError, ValueError) as e:
        raise YouTubeError("Tidak bisa menghubungi YouTube. Coba lagi sebentar.") from e
    return {
        "id": vid,
        "url": watch,
        "title": data.get("title") or "Tanpa judul",
        "channel": data.get("author_name") or "",
        "duration": 0,
        "thumbnail": f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg",
        "chapters": [],
        "heights": [],
        "language": None,
    }


def summarize(info: dict) -> dict:
    heights = sorted(
        {
            f["height"]
            for f in info.get("formats") or []
            if f.get("height") and f.get("vcodec") not in (None, "none")
        }
    )
    chapters = [
        {"title": c.get("title") or "", "start": c.get("start_time", 0), "end": c.get("end_time", 0)}
        for c in info.get("chapters") or []
    ]
    return {
        "id": info.get("id"),
        "url": info.get("webpage_url") or info.get("original_url"),
        "title": info.get("title") or "Tanpa judul",
        "channel": info.get("channel") or info.get("uploader") or "",
        "duration": info.get("duration") or 0,
        "thumbnail": info.get("thumbnail"),
        "chapters": chapters,
        "heights": heights,
        "language": info.get("language"),
    }


# ---------------------------------------------------------------- transkrip --

def _pick_track(info: dict) -> tuple[list, str, bool] | None:
    """Pilih subtitle terbaik. Return (daftar_format, kode_bahasa, is_auto)."""
    manual = info.get("subtitles") or {}
    auto = info.get("automatic_captions") or {}
    lang = (info.get("language") or "").split("-")[0]

    prefs = [l for l in (lang, "id", "en") if l]

    for code in prefs:
        for key, tracks in manual.items():
            if key == code or key.startswith(code + "-"):
                return tracks, key, False
    if manual:
        key = next((k for k in manual if k != "live_chat"), None)
        if key:
            return manual[key], key, False

    # Auto caption: "<lang>-orig" adalah bahasa asli video, selain itu hasil terjemahan.
    for key in [f"{lang}-orig" if lang else None, lang or None]:
        if key and key in auto:
            return auto[key], key, True
    orig = [k for k in auto if k.endswith("-orig")]
    if orig:
        return auto[orig[0]], orig[0], True
    for code in ("id", "en"):
        if code in auto:
            return auto[code], code, True
    return None


def _parse_json3(raw: str) -> list[tuple[float, str]]:
    data = json.loads(raw)
    out = []
    for ev in data.get("events") or []:
        segs = ev.get("segs")
        if not segs:
            continue
        text = "".join(s.get("utf8", "") for s in segs).replace("\n", " ").strip()
        if text:
            out.append((ev.get("tStartMs", 0) / 1000, text))
    return out


_VTT_TIME = re.compile(r"(\d+:)?(\d{2}):(\d{2})\.(\d{3})\s+-->")


def _parse_vtt(raw: str) -> list[tuple[float, str]]:
    out, cur_start, buf = [], None, []
    for line in raw.splitlines():
        m = _VTT_TIME.match(line)
        if m:
            if cur_start is not None and buf:
                out.append((cur_start, " ".join(buf)))
            h = int(m.group(1)[:-1]) if m.group(1) else 0
            cur_start = h * 3600 + int(m.group(2)) * 60 + int(m.group(3)) + int(m.group(4)) / 1000
            buf = []
        elif line.strip() and cur_start is not None and not line.startswith(("WEBVTT", "NOTE")):
            buf.append(re.sub(r"<[^>]+>", "", line).strip())
    if cur_start is not None and buf:
        out.append((cur_start, " ".join(buf)))
    return out


def _condense(lines: list[tuple[float, str]], block_seconds: float = 8.0) -> str:
    """Gabungkan potongan caption jadi blok ~8 detik dengan stempel waktu, buang duplikat."""
    blocks: list[str] = []
    block_start, words, last_text = None, [], ""
    for start, text in lines:
        if text == last_text:
            continue
        last_text = text
        if block_start is None:
            block_start = start
        if start - block_start >= block_seconds and words:
            blocks.append(f"[{fmt(block_start)}] {' '.join(words)}")
            block_start, words = start, []
        words.append(text)
    if words and block_start is not None:
        blocks.append(f"[{fmt(block_start)}] {' '.join(words)}")
    return "\n".join(blocks)


def get_transcript(info: dict) -> tuple[str, str] | None:
    """Return (transkrip_berstempel_waktu, keterangan_sumber) atau None jika tidak ada subtitle."""
    picked = _pick_track(info)
    if not picked:
        return None
    tracks, lang, is_auto = picked
    by_ext = {t.get("ext"): t for t in tracks}
    track = by_ext.get("json3") or by_ext.get("vtt")
    if not track or not track.get("url"):
        return None
    try:
        with yt_dlp.YoutubeDL(BASE_OPTS) as ydl:
            raw = ydl.urlopen(track["url"]).read().decode("utf-8", "replace")
    except Exception:
        return None
    lines = _parse_json3(raw) if track.get("ext") == "json3" else _parse_vtt(raw)
    if not lines:
        return None
    source = f"{'auto-caption' if is_auto else 'subtitle'} ({lang})"
    return _condense(lines), source


# ------------------------------------------------------------- potong klip --

def download_clip(
    url: str,
    start: float | None,
    end: float | None,
    kind: str,
    height: int,
    out_dir: Path,
    basename: str,
    on_progress: Callable[[float], None] | None = None,
    on_stage: Callable[[str], None] | None = None,
) -> Path:
    """Unduh satu potongan [start, end] sebagai MP4 (≤ height) atau MP3.
    Jika start/end None, video diunduh utuh (tanpa dipotong & tanpa encode ulang)."""
    out_dir.mkdir(parents=True, exist_ok=True)
    full = start is None or end is None

    # Video & audio diunduh terpisah lalu digabung; video ±90% dari total ukuran.
    parts = {"done": 0}
    weights = (1.0,) if kind == "mp3" else (0.9, 0.1)

    def hook(d):
        status = d.get("status")
        if status == "finished":
            parts["done"] += 1
            return
        if not on_progress or status != "downloading":
            return
        total = d.get("total_bytes") or d.get("total_bytes_estimate")
        if not total:
            return
        i = min(parts["done"], len(weights) - 1)
        base = sum(weights[:i])
        on_progress(min(0.95, base + weights[i] * d.get("downloaded_bytes", 0) / total))

    def pp_hook(d):
        if on_stage and d.get("status") == "started":
            name = d.get("postprocessor") or ""
            if name == "Merger":
                on_stage("Menggabungkan video & audio")
            elif name == "ExtractAudio":
                on_stage("Mengubah ke MP3")

    opts = {
        **BASE_OPTS,
        "outtmpl": str(out_dir / f"{basename}.%(ext)s"),
        "progress_hooks": [hook],
        "postprocessor_hooks": [pp_hook],
        "overwrites": True,
    }
    if not full:
        opts["download_ranges"] = download_range_func(None, [(start, end)])
        opts["force_keyframes_at_cuts"] = True
    if kind == "mp3":
        opts["format"] = "bestaudio/best"
        opts["postprocessors"] = [
            {"key": "FFmpegExtractAudio", "preferredcodec": "mp3", "preferredquality": "192"}
        ]
    else:
        h = int(height)
        # Utamakan H.264 + AAC agar langsung kompatibel dengan TikTok/IG/WA.
        opts["format"] = (
            f"bv*[height<={h}][vcodec^=avc1]+ba[ext=m4a]/"
            f"bv*[height<={h}]+ba/"
            f"b[height<={h}]/b"
        )
        opts["merge_output_format"] = "mp4"

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl.download([url])
    except yt_dlp.utils.DownloadError as e:
        raise _friendly(e) from e

    want = ".mp3" if kind == "mp3" else ".mp4"
    files = [
        p
        for p in out_dir.glob(f"{glob_escape(basename)}.*")
        if not p.name.endswith((".part", ".ytdl")) and ".temp" not in p.name
    ]
    if not files:
        raise YouTubeError("File hasil tidak ditemukan setelah proses download.")
    files.sort(key=lambda p: (p.suffix != want, -p.stat().st_mtime))
    return files[0]


ASPECTS = {"16:9", "9:16", "1:1"}


def reframe(src: Path, aspect: str, height: int) -> Path:
    """Ubah klip 16:9 menjadi 9:16 / 1:1: video utuh di tengah, latar belakang versi blur dari video yang sama."""
    if aspect not in ASPECTS or aspect == "16:9":
        return src
    w = int(height) // 2 * 2
    h = (w * 16 // 9) // 2 * 2 if aspect == "9:16" else w
    bw, bh = max(2, (w // 8) // 2 * 2), max(2, (h // 8) // 2 * 2)
    graph = (
        f"[0:v]split=2[a][b];"
        # Latar: kecilkan dulu baru blur, lalu besarkan → jauh lebih ringan daripada blur di resolusi penuh
        f"[a]scale={bw}:{bh}:force_original_aspect_ratio=increase,crop={bw}:{bh},boxblur=6:2,"
        f"scale={w}:{h},setsar=1,eq=brightness=-0.08[bg];"
        f"[b]scale={w}:-2:flags=lanczos,setsar=1[fg];"
        f"[bg][fg]overlay=(W-w)/2:(H-h)/2,format=yuv420p[v]"
    )
    tag = aspect.replace(":", "x")
    out = src.with_name(f"{src.stem} [{tag}].mp4")
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error", "-i", str(src),
        "-filter_complex", graph, "-map", "[v]", "-map", "0:a?",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
        "-c:a", "copy", "-movflags", "+faststart", str(out),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if proc.returncode != 0 or not out.exists():
        raise YouTubeError(f"Gagal membuat format {aspect}: {proc.stderr.strip()[-300:]}")
    src.unlink(missing_ok=True)
    return out


def glob_escape(name: str) -> str:
    return re.sub(r"([\[\]*?])", r"[\1]", name)
