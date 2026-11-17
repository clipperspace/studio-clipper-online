"""Antrean job sederhana di memori (cukup untuk pemakaian lokal/pribadi)."""
from __future__ import annotations

import shutil
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

from . import config


@dataclass
class Job:
    id: str
    kind: str
    status: str = "queued"  # queued | running | done | error
    stage: str = "Menunggu antrean"
    progress: float = 0.0
    error: str | None = None
    result: Any = None
    file: Path | None = None
    filename: str | None = None
    created: float = field(default_factory=time.time)

    def public(self) -> dict:
        return {
            "id": self.id,
            "kind": self.kind,
            "status": self.status,
            "stage": self.stage,
            "progress": round(self.progress, 3),
            "error": self.error,
            "result": self.result,
            "download_url": f"/api/download/{self.id}" if self.file else None,
            "filename": self.filename,
        }

    @property
    def workdir(self) -> Path:
        return config.DOWNLOAD_DIR / self.id


_jobs: dict[str, Job] = {}
_lock = threading.Lock()
_executor = ThreadPoolExecutor(max_workers=config.MAX_CONCURRENT_JOBS)


def submit(kind: str, work: Callable[[Job], None], safe_errors: tuple[type[Exception], ...]) -> Job:
    job = Job(id=uuid.uuid4().hex[:12], kind=kind)
    with _lock:
        _jobs[job.id] = job

    def run():
        job.status = "running"
        try:
            work(job)
            job.progress = 1.0
            job.status = "done"
            job.stage = "Selesai"
        except safe_errors as e:
            job.status, job.error = "error", str(e)
        except Exception as e:  # noqa: BLE001
            job.status, job.error = "error", f"Terjadi kesalahan tak terduga: {e}"

    _executor.submit(run)
    return job


def get(job_id: str) -> Job | None:
    with _lock:
        return _jobs.get(job_id)


def _cleanup_loop():
    while True:
        time.sleep(300)
        cutoff = time.time() - config.FILE_TTL_MINUTES * 60
        with _lock:
            old = [j for j in _jobs.values() if j.created < cutoff and j.status in ("done", "error")]
            for j in old:
                _jobs.pop(j.id, None)
        for j in old:
            shutil.rmtree(j.workdir, ignore_errors=True)
        # Sisa folder yatim (mis. setelah restart)
        for p in config.DOWNLOAD_DIR.iterdir():
            if p.is_dir() and p.stat().st_mtime < cutoff and p.name not in _jobs:
                shutil.rmtree(p, ignore_errors=True)


threading.Thread(target=_cleanup_loop, daemon=True).start()
