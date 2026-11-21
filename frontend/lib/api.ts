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
  kind: "analyze" | "clip" | "full" | "source" | "render";
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
  /** Versi online: API key dari pengguna, potong & unduh hanya di versi lokal. */
  hosted?: boolean;
  gemini_configured: boolean;
  ffmpeg: boolean;
  yt_dlp: string;
  models: { flash: string; lite: string };
};

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.detail === "string") return data.detail;
    if (Array.isArray(data?.detail))
      return data.detail.map((d: { msg: string }) => String(d.msg).replace(/^Value error, /, "")).join(", ");
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

// ------------------------------------------------------------ API key pengguna --
// Disimpan hanya di browser ini (localStorage) dan dikirim per permintaan lewat header.
const KEY_STORE = "sc_gemini_key";

export function getUserKey(): string {
  try {
    return localStorage.getItem(KEY_STORE) || "";
  } catch {
    return "";
  }
}

export function setUserKey(key: string) {
  try {
    if (key) localStorage.setItem(KEY_STORE, key);
    else localStorage.removeItem(KEY_STORE);
  } catch {
    /* penyimpanan diblokir browser */
  }
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const key = getUserKey();
  if (key) headers["X-Gemini-Key"] = key;
  const res = await fetch(path, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

/** Pantau job sampai selesai; panggil onUpdate di setiap perubahan. */
export async function pollJob<T>(id: string, onUpdate: (job: Job<T>) => void, signal?: AbortSignal): Promise<Job<T>> {
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
const TT_RE = /^(https?:\/\/)?(www\.|m\.|vm\.|vt\.)?tiktok\.com\/.+/i;
/** Link TikTok: hanya untuk tab "Video full" (unduh tanpa watermark). */
export const isTikTokUrl = (v: string) => TT_RE.test(v.trim());

export function triggerDownload(href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// ------------------------------------------------- kirim hasil ke Studio lokal --
// Versi online tidak bisa mengunduh. Hasil analisa dibawa ke Studio di perangkat pengguna lewat
// bagian "#" URL: tidak dikirim ke server mana pun, dan tidak perlu analisa ulang.

/** Alamat Studio lokal: Windows (start.bat) & Android (Termux) sama-sama di port 3000. */
export const LOCAL_STUDIO = "http://localhost:3000/studio";
/** Halaman utama Studio lokal, tab "Video full" langsung terbuka dengan link yang sama. */
export const localFullLink = (url: string) => `http://localhost:3000/?full=${encodeURIComponent(url.trim())}#clip`;
/** Editor klip: link YouTube + batas klip dibawa lewat query. Versi online membuka editor di Studio lokal. */
export function editorLink(
  p: { url: string; start: number; end: number; title?: string; hook?: string },
  local = false,
): string {
  const q = new URLSearchParams({
    url: p.url.trim(),
    start: String(Math.round(p.start * 100) / 100),
    end: String(Math.round(p.end * 100) / 100),
  });
  if (p.title) q.set("title", p.title.slice(0, 120));
  // Hook dari AI jadi isi awal teks pembuka
  if (p.hook) q.set("hook", p.hook.slice(0, 200));
  return `${local ? "http://localhost:3000" : ""}/editor/?${q.toString()}`;
}
export const INSTALL_GUIDE ="https://github.com/clipperspace/studio-clipper-online/blob/main/docs/INSTALL.md";

export type ImportPayload = {
  v: 1;
  video: Pick<VideoMeta, "id" | "url" | "title" | "channel">;
  summary: string;
  model: string;
  clips: Clip[];
  selected: number[];
};

function b64urlEncode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(data: string): string {
  const b64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function localStudioLink(p: Omit<ImportPayload, "v">): string {
  return `${LOCAL_STUDIO}#import=${b64urlEncode(JSON.stringify({ v: 1, ...p }))}`;
}

export function readImport(hash: string): ImportPayload | null {
  const m = hash.match(/import=([A-Za-z0-9_-]+)/);
  if (!m) return null;
  try {
    const data = JSON.parse(b64urlDecode(m[1]));
    if (data?.v !== 1 || !data.video?.url || !Array.isArray(data.clips)) return null;
    const clips: Clip[] = data.clips
      .slice(0, 10)
      .map((c: Partial<Clip>, i: number) => ({
        rank: Number(c.rank) || i + 1,
        start: Number(c.start) || 0,
        end: Number(c.end) || 0,
        title: String(c.title || `Klip ${i + 1}`),
        category: String(c.category || ""),
        viral_score: Number(c.viral_score) || 0,
        reason: String(c.reason || ""),
        hook: String(c.hook || ""),
        headline: String(c.headline || ""),
      }))
      .filter((c: Clip) => c.end > c.start);
    if (!clips.length || !isYouTubeUrl(String(data.video.url))) return null;
    return {
      v: 1,
      video: {
        id: String(data.video.id || ""),
        url: String(data.video.url),
        title: String(data.video.title || "Video"),
        channel: String(data.video.channel || ""),
      },
      summary: String(data.summary || ""),
      model: String(data.model || ""),
      clips,
      selected: Array.isArray(data.selected) ? data.selected.map(Number) : clips.map((c) => c.rank),
    };
  } catch {
    return null;
  }
}
