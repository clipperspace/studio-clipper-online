// Editor klip: tipe resep edit, preset gaya, dan unggah file.
// Bentuk Recipe harus sama dengan backend/app/editor.py (class Recipe).
import type { VideoMeta } from "./api";

export const ASPECTS = ["9:16", "1:1", "4:5", "16:9"] as const;
export type Aspect = (typeof ASPECTS)[number];
/** blur = video utuh + latar blur · black = video utuh + latar hitam · fill = crop memenuhi layar */
export type Background = "blur" | "black" | "fill";
export const HEIGHTS = [360, 480, 720, 1080] as const;
export type Height = (typeof HEIGHTS)[number];

export type Recipe = {
  v: 1;
  /** Detik dari awal video YouTube. */
  trim: { start: number; end: number };
  aspect: Aspect;
  background: Background;
  height: Height;
};

/** Bagian resep yang berupa "gaya" (tanpa batas klip): disimpan sebagai preset. */
export type Style = Omit<Recipe, "v" | "trim">;

export const DEFAULT_STYLE: Style = { aspect: "9:16", background: "blur", height: 1080 };

export type EditorSource = {
  source_id: string;
  video: VideoMeta;
  /** Detik video YouTube pada awal file sumber. */
  offset: number;
  /** Rentang (detik video YouTube) yang tersedia di file sumber. */
  available: [number, number];
  start: number;
  end: number;
  width: number;
  height: number;
  has_audio: boolean;
  video_url: string;
};

export type Upload = {
  id: string;
  name: string;
  kind: "video" | "audio";
  duration: number;
  width: number;
  height: number;
  has_audio: boolean;
  size: number;
  url: string;
};

export function aspectRatio(a: Aspect): number {
  const [w, h] = a.split(":").map(Number);
  return w / h;
}

// ------------------------------------------------------------------ preset --
// Disimpan di browser ini saja (localStorage).

export type Preset = { id: string; name: string; style: Style; builtin?: boolean };

export const BUILTIN_PRESETS: Preset[] = [
  { id: "b-tiktok", name: "TikTok / Reels / Shorts", builtin: true, style: DEFAULT_STYLE },
  { id: "b-feed", name: "Feed Instagram (4:5)", builtin: true, style: { aspect: "4:5", background: "fill", height: 1080 } },
  { id: "b-yt", name: "YouTube (16:9)", builtin: true, style: { aspect: "16:9", background: "blur", height: 1080 } },
];

const PRESET_KEY = "sc_edit_presets";
const LAST_KEY = "sc_edit_last";

/** Lengkapi & bersihkan gaya dari penyimpanan (bisa berasal dari versi lama). */
export function cleanStyle(raw: unknown): Style {
  const s = (raw && typeof raw === "object" ? raw : {}) as Partial<Style>;
  return {
    aspect: ASPECTS.includes(s.aspect as Aspect) ? (s.aspect as Aspect) : DEFAULT_STYLE.aspect,
    background: ["blur", "black", "fill"].includes(s.background as string)
      ? (s.background as Background)
      : DEFAULT_STYLE.background,
    height: HEIGHTS.includes(s.height as Height) ? (s.height as Height) : DEFAULT_STYLE.height,
  };
}

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* penyimpanan diblokir browser */
  }
}

export function loadPresets(): Preset[] {
  const list = read<Preset[]>(PRESET_KEY, []);
  return Array.isArray(list)
    ? list
        .filter((p) => p && typeof p.id === "string" && typeof p.name === "string")
        .map((p) => ({ id: p.id, name: p.name.slice(0, 40), style: cleanStyle(p.style) }))
    : [];
}

export function savePresets(list: Preset[]) {
  write(
    PRESET_KEY,
    list.filter((p) => !p.builtin).slice(0, 30),
  );
}

export const loadLastStyle = (): Style => cleanStyle(read(LAST_KEY, DEFAULT_STYLE));
export const saveLastStyle = (s: Style) => write(LAST_KEY, s);

export const sameStyle = (a: Style, b: Style) =>
  a.aspect === b.aspect && a.background === b.background && a.height === b.height;

// ------------------------------------------------------------------ upload --

/** Unggah file ke Studio lokal (isi file dikirim langsung sebagai body). */
export function uploadFile(file: File, onProgress?: (p: number) => void): Promise<Upload> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/editor/upload?name=${encodeURIComponent(file.name)}`);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      let data: { detail?: unknown } & Partial<Upload> = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* bukan JSON */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as Upload);
      else reject(new Error(typeof data.detail === "string" ? data.detail : `Unggah gagal (${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error("Unggah gagal. Pastikan Studio Clipper masih berjalan."));
    xhr.send(file);
  });
}
