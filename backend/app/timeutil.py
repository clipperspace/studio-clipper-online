"""Helper konversi waktu."""
import re


def to_seconds(value) -> float:
    """Terima 75, "75", "01:15", "00:01:15", "1:02:03.5" → detik (float)."""
    if isinstance(value, (int, float)):
        return float(value)
    s = str(value).strip()
    if not s:
        raise ValueError("Waktu kosong")
    if re.fullmatch(r"\d+(\.\d+)?", s):
        return float(s)
    parts = s.split(":")
    if len(parts) > 3 or not all(re.fullmatch(r"\d+(\.\d+)?", p) for p in parts):
        raise ValueError(f"Format waktu tidak valid: {value}")
    total = 0.0
    for p in parts:
        total = total * 60 + float(p)
    return total


def fmt(seconds: float) -> str:
    seconds = max(0, int(round(seconds)))
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    return f"{h:02d}:{m:02d}:{s:02d}"
