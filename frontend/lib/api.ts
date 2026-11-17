export type Clip = {
  rank: number;
  start: number;
  end: number;
  title: string;
  category: string;
  viral_score: number;
  reason: string;
  hook: string;
  headline: string;
};

export type VideoMeta = {
  id: string;
  url: string;
  title: string;
  channel: string;
  duration: number;
  thumbnail: string | null;
  chapters: { title: string; start: number; end: number }[];
  heights: number[];
  language: string | null;
};

export type AnalyzeResult = {
  video: VideoMeta;
  summary: string;
  clips: Clip[];
  source: string;
  model: string;
};

export type Job<T = unknown> = {
  id: string;
  kind: "analyze" | "clip";
  status: "queued" | "running" | "done" | "error";
  stage: string;
  progress: number;
  error: string | null;
  result: T | null;
  download_url: string | null;
  filename: string | null;
};

export type Health = {
  ok: boolean;
  gemini_configured: boolean;
  ffmpeg: boolean;
  yt_dlp: string;
  models: { flash: string; lite: string };
};

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.detail === "string") return data.detail;
    if (Array.isArray(data?.detail)) return data.detail.map((d: { msg: string }) => d.msg).join(", ");
  } catch {
    /* bukan JSON */
  }
  if (res.status >= 500) return "Backend tidak merespons. Pastikan backend sudah berjalan.";
  return `Permintaan gagal (${res.status}).`;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

/** Pantau job sampai selesai; panggil onUpdate di setiap perubahan. */
export async function pollJob<T>(
  id: string,
  onUpdate: (job: Job<T>) => void,
  signal?: AbortSignal,
): Promise<Job<T>> {
  for (;;) {
    if (signal?.aborted) throw new DOMException("Dibatalkan", "AbortError");
    const job = await apiGet<Job<T>>(`/api/job/${id}`);
    onUpdate(job);
    if (job.status === "done") return job;
    if (job.status === "error") throw new Error(job.error || "Proses gagal.");
    await new Promise((r) => setTimeout(r, 900));
  }
}

export function fmt(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(r)}` : `${pad(m)}:${pad(r)}`;
}

export function parseTime(v: string): number | null {
  const t = v.trim();
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  const parts = t.split(":");
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return null;
  return parts.reduce((acc, p) => acc * 60 + Number(p), 0);
}

export function duration(sec: number): string {
  const s = Math.round(sec);
  if (s < 60) return `${s} dtk`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m} mnt ${r} dtk` : `${m} mnt`;
}

const YT_RE = /^(https?:\/\/)?(www\.|m\.|music\.)?(youtube\.com|youtu\.be)\/.+/i;
export const isYouTubeUrl = (v: string) => YT_RE.test(v.trim());

export function triggerDownload(href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
