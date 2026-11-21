// Editor klip: tipe resep edit, preset gaya, font, dan unggah file.
// Bentuk Recipe harus sama dengan backend/app/editor.py (class Recipe).
import type { VideoMeta } from "./api";

export const ASPECTS = ["9:16", "1:1", "4:5", "16:9"] as const;
export type Aspect = (typeof ASPECTS)[number];
/** blur = video utuh + latar blur · black = video utuh + latar hitam · fill = potong memenuhi layar */
export type Background = "blur" | "black" | "fill";
export const HEIGHTS = [360, 480, 720, 1080] as const;
export type Height = (typeof HEIGHTS)[number];
/** Satu frame pada hasil render (30 fps). */
export const FRAME = 1 / 30;

/** Potong manual: posisi bagian yang ditampilkan (0 = kiri/atas, 1 = kanan/bawah) & perbesaran. */
export type Crop = { x: number; y: number; zoom: number };
export const DEFAULT_CROP: Crop = { x: 0.5, y: 0.5, zoom: 1 };
export const MAX_ZOOM = 4;

/** Id font: bawaan (mis. "poppins") atau unggahan pengguna ("u-…"). Daftarnya dari /api/editor/fonts. */
export type FontId = string;
export type FontInfo = { id: FontId; name: string; user: boolean; url: string };
const FONT_ID_RE = /^(u-[0-9a-f]{10}|[a-z0-9-]{2,30})$/;

export type WmColor = "white" | "black" | "yellow";
/** Nama akun di atas video. x, y = 0 → tepi kiri/atas, 1 → tepi kanan/bawah. size = pecahan lebar video. */
export type Watermark = {
  on: boolean;
  text: string;
  font: FontId;
  size: number;
  color: WmColor;
  opacity: number;
  x: number;
  y: number;
};
export const DEFAULT_WATERMARK: Watermark = {
  on: false,
  text: "",
  font: "poppins",
  size: 0.035,
  color: "white",
  opacity: 0.7,
  x: 0.95,
  y: 0.05,
};

/**
 * Teks pembuka di detik-detik awal video. Digambar di browser (canvas) jadi PNG transparan, lalu
 * ditempel saat render, jadi hasilnya persis sama dengan preview. Ukuran & jarak dalam em / pecahan.
 */
export type Title = {
  on: boolean;
  text: string;
  font: FontId;
  /** Ukuran huruf, pecahan lebar video. */
  size: number;
  x: number;
  y: number;
  duration: number;
  textColor: string;
  box: boolean;
  /** "block" = satu kotak untuk semua baris, "line" = kotak per baris (gaya TikTok). */
  boxMode: "block" | "line";
  boxColor: string;
  boxOpacity: number;
  /** Kelengkungan sudut kotak: 0 = siku, 1 = membulat penuh (kapsul). */
  radius: number;
  /** Tebal garis tepi huruf (em), 0 = tanpa garis tepi. */
  outline: number;
  outlineColor: string;
  shadow: boolean;
  /** Jarak antar-baris (kali ukuran huruf). */
  lineHeight: number;
  /** Jarak antar-huruf (em). */
  letterSpacing: number;
};
export const DEFAULT_TITLE: Title = {
  on: false,
  text: "",
  font: "poppins-black",
  size: 0.07,
  x: 0.5,
  y: 0.18,
  duration: 5,
  textColor: "#111111",
  box: true,
  boxMode: "block",
  boxColor: "#FFCC00",
  boxOpacity: 1,
  radius: 0.25,
  outline: 0,
  outlineColor: "#000000",
  shadow: false,
  lineHeight: 1.2,
  letterSpacing: 0,
};
export const TITLE_MAX_LINES = 4;
export const LIMITS = {
  lineHeight: [0.8, 2.2],
  letterSpacing: [-0.1, 0.5],
  outline: [0, 0.25],
} as const;

/** Gaya cepat: titik awal yang bisa diubah lagi (warna, kotak, garis tepi, bayangan). */
type Look = Pick<Title, "textColor" | "box" | "boxColor" | "boxOpacity" | "outline" | "outlineColor" | "shadow">;
export const TITLE_LOOKS: { id: string; name: string; look: Look }[] = [
  { id: "box-yellow", name: "Kotak kuning", look: { textColor: "#111111", box: true, boxColor: "#FFCC00", boxOpacity: 1, outline: 0, outlineColor: "#000000", shadow: false } },
  { id: "box-white", name: "Kotak putih", look: { textColor: "#111111", box: true, boxColor: "#FFFFFF", boxOpacity: 1, outline: 0, outlineColor: "#000000", shadow: false } },
  { id: "box-black", name: "Kotak gelap", look: { textColor: "#FFFFFF", box: true, boxColor: "#000000", boxOpacity: 0.72, outline: 0, outlineColor: "#000000", shadow: false } },
  { id: "outline", name: "Garis tepi", look: { textColor: "#FFFFFF", box: false, boxColor: "#000000", boxOpacity: 1, outline: 0.09, outlineColor: "#000000", shadow: false } },
  { id: "shadow", name: "Bayangan", look: { textColor: "#FFFFFF", box: false, boxColor: "#000000", boxOpacity: 1, outline: 0, outlineColor: "#000000", shadow: true } },
  { id: "neon", name: "Kuning tegas", look: { textColor: "#FFCC00", box: false, boxColor: "#000000", boxOpacity: 1, outline: 0.09, outlineColor: "#111111", shadow: false } },
];
export const lookMatches = (t: Look, l: Look) =>
  t.textColor.toUpperCase() === l.textColor.toUpperCase() &&
  t.box === l.box &&
  (!l.box || (t.boxColor.toUpperCase() === l.boxColor.toUpperCase() && Math.abs(t.boxOpacity - l.boxOpacity) < 0.01)) &&
  Math.abs(t.outline - l.outline) < 0.005 &&
  (l.outline === 0 || t.outlineColor.toUpperCase() === l.outlineColor.toUpperCase()) &&
  t.shadow === l.shadow;

/** Warna cepat untuk teks, kotak & garis tepi. */
export const SWATCHES = ["#FFFFFF", "#111111", "#FFCC00", "#FF3B30", "#FF2D95", "#B13BFF", "#0A84FF", "#30D158", "#FF9500"];

export type Recipe = {
  v: 1;
  /** Detik dari awal video YouTube. */
  trim: { start: number; end: number };
  aspect: Aspect;
  background: Background;
  height: Height;
  crop: Crop;
  watermark: Watermark;
  title: Title;
};

/**
 * Bagian resep yang berupa "gaya": disimpan sebagai preset. Tanpa batas klip, posisi potong, dan isi
 * teks pembuka (semuanya khusus untuk satu klip). Watermark ikut lengkap dengan nama akunnya.
 */
export type Style = {
  aspect: Aspect;
  background: Background;
  height: Height;
  watermark: Watermark;
  title: Omit<Title, "text">;
};

/**
 * Ukuran & posisi video di dalam layar saat dipotong manual, dalam pecahan lebar/tinggi layar.
 * Sama dengan hitungan backend (frame_video): video menutupi layar × zoom, lalu digeser ke posisi x/y.
 */
export function cropBox(srcRatio: number, aspect: Aspect, crop: Crop) {
  const r = srcRatio / aspectRatio(aspect);
  const w = (r >= 1 ? r : 1) * crop.zoom;
  const h = (r >= 1 ? 1 : 1 / r) * crop.zoom;
  return { w, h, left: -(w - 1) * crop.x, top: -(h - 1) * crop.y };
}

const { text: _ignored, ...TITLE_STYLE_DEFAULT } = DEFAULT_TITLE;
export const DEFAULT_STYLE: Style = {
  aspect: "9:16",
  background: "blur",
  height: 1080,
  watermark: DEFAULT_WATERMARK,
  title: TITLE_STYLE_DEFAULT,
};

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
  kind: "video" | "audio" | "image";
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

/** Waktu presisi: mm:ss.ss (atau jj:mm:ss.ss). */
export function fmtPrecise(sec: number): string {
  const s = Math.max(0, Math.round(sec * 100) / 100);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s - h * 3600 - m * 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const sec2 = r.toFixed(2).padStart(5, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${sec2}` : `${pad(m)}:${sec2}`;
}

// ------------------------------------------------------------------- font --

/** Nama keluarga CSS untuk font editor (dimuat dari backend supaya sama dengan hasil render). */
export const fontFamily = (id: FontId) => `"sc-${id}", sans-serif`;

/** Muat font dari backend ke browser (sekali per font). */
const loadedFonts = new Map<string, Promise<void>>();
export function loadFont(f: FontInfo): Promise<void> {
  let p = loadedFonts.get(f.id);
  if (!p) {
    p = (async () => {
      try {
        const face = new FontFace(`sc-${f.id}`, `url(${f.url})`);
        document.fonts.add(face);
        await face.load();
      } catch {
        /* font gagal dimuat: memakai font cadangan */
      }
    })();
    loadedFonts.set(f.id, p);
  }
  return p;
}

const rgba = (hex: string, a: number) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  const n = m ? parseInt(m[1], 16) : 0;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

export type TitleImage = { canvas: HTMLCanvasElement; lines: string[]; tooLong: boolean };

/**
 * Gambar teks pembuka untuk video selebar `W` px: teks dibungkus otomatis (maks. 90% lebar video),
 * kotak berlatar (sudut bisa membulat), garis tepi, bayangan, jarak baris & huruf. Hasilnya PNG
 * transparan seukuran kotak teks; dipakai untuk preview & render supaya keduanya sama persis.
 */
/** Warna khusus per kata: indeks kata (urut di seluruh teks) → warna. */
export type WordColors = Record<number, string>;

/** Kata-kata teks pembuka beserta indeksnya (dipakai untuk memilih kata yang diwarnai). */
export function titleWords(text: string): { w: string; i: number; para: number }[] {
  const out: { w: string; i: number; para: number }[] = [];
  text
    .replace(/\r/g, "")
    .split("\n")
    .forEach((para, p) => para.split(/\s+/).filter(Boolean).forEach((w) => out.push({ w, i: out.length, para: p })));
  return out;
}

export function drawTitle(t: Title, W: number, wordColors: WordColors = {}): TitleImage | null {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const px = Math.max(8, t.size * W);
  const font = `${px}px ${fontFamily(t.font)}`;
  const ls = t.letterSpacing * px;
  const setFont = (c: CanvasRenderingContext2D) => {
    c.font = font;
    if ("letterSpacing" in c) (c as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${ls}px`;
  };
  setFont(ctx);
  const nativeLs = "letterSpacing" in (ctx as object);
  // Lebar teks; jika browser belum mendukung letterSpacing, jaraknya ditambahkan manual per huruf
  const measure = (s: string) => ctx.measureText(s).width + (nativeLs ? 0 : ls * Math.max(0, [...s].length - 1));

  const pad = t.box ? px * 0.32 : 0;
  const edge = t.outline * px + (t.shadow ? px * 0.08 : 0) + 2;
  const max = W * 0.9 - 2 * (pad + edge);
  // Bungkus per kata; setiap baris menyimpan kata-katanya (untuk warna per kata)
  type Word = { w: string; i: number };
  const rows: Word[][] = [];
  const words = titleWords(t.text);
  let row: Word[] = [];
  let para = -1;
  for (const wd of words) {
    const joined = [...row, wd].map((x) => x.w).join(" ");
    if (row.length && (wd.para !== para || measure(joined) > max)) {
      rows.push(row);
      row = [];
    }
    row.push({ w: wd.w, i: wd.i });
    para = wd.para;
  }
  if (row.length) rows.push(row);
  if (!rows.length) return null;
  const lines = rows.map((r) => r.map((x) => x.w).join(" "));
  const tooLong = lines.length > TITLE_MAX_LINES;
  const shownRows = rows.slice(0, TITLE_MAX_LINES);
  const shown = lines.slice(0, TITLE_MAX_LINES);

  const m = ctx.measureText("Hg");
  const asc = m.fontBoundingBoxAscent || px * 0.9;
  const desc = m.fontBoundingBoxDescent || px * 0.25;
  const pitch = px * t.lineHeight;
  const widths = shown.map(measure);
  const blockW = Math.max(...widths);
  const blockH = (shown.length - 1) * pitch + asc + desc;
  const boxW = blockW + 2 * pad;
  const boxH = blockH + 2 * pad;
  // Lengkungan sudut maksimal setengah tinggi satu baris → 100% = ujung kapsul, teks tidak terpotong
  const lineBoxH = asc + desc + 2 * pad;
  const r = (h: number, w: number) => (t.radius * Math.min(h, w, lineBoxH)) / 2;
  canvas.width = Math.ceil(boxW + 2 * edge);
  canvas.height = Math.ceil(boxH + 2 * edge);
  setFont(ctx); // ukuran canvas berubah → pengaturan konteks ter-reset

  if (t.box) {
    ctx.fillStyle = rgba(t.boxColor, t.boxOpacity);
    ctx.beginPath();
    if (t.boxMode === "line") {
      // Kotak per baris, mengikuti lebar tiap baris (gaya teks TikTok)
      widths.forEach((lw, i) => {
        const w = lw + 2 * pad;
        ctx.roundRect(canvas.width / 2 - w / 2, edge + i * pitch, w, lineBoxH, r(lineBoxH, w));
      });
    } else ctx.roundRect(edge, edge, boxW, boxH, r(boxH, boxW));
    ctx.fill();
  }

  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  const cx = canvas.width / 2;
  ctx.textAlign = "left";
  /** Gambar satu baris kata demi kata (rata tengah), `paint` menerima warna kata itu. */
  const drawRow = (r: Word[], y: number, paint: (s: string, x: number, y: number, color: string) => void) => {
    const color = (i: number) => wordColors[i] || t.textColor;
    const line = r.map((x) => x.w).join(" ");
    if (nativeLs || !ls) {
      // letterSpacing juga menambah jarak setelah huruf terakhir; tidak dihitung supaya tetap di tengah
      let x = cx - (measure(line) - (nativeLs ? ls : 0)) / 2;
      r.forEach((wd, k) => {
        paint(wd.w, x, y, color(wd.i));
        x += measure(k < r.length - 1 ? `${wd.w} ` : wd.w);
      });
      return;
    }
    // Browser lama tanpa letterSpacing: huruf demi huruf
    let x = cx - measure(line) / 2;
    r.forEach((wd, k) => {
      for (const ch of k < r.length - 1 ? `${wd.w} ` : wd.w) {
        paint(ch, x, y, color(wd.i));
        x += ctx.measureText(ch).width + ls;
      }
    });
  };
  shownRows.forEach((r, i) => {
    const y = edge + pad + asc + i * pitch;
    if (t.outline > 0) {
      ctx.strokeStyle = t.outlineColor;
      ctx.lineWidth = t.outline * px * 2;
      drawRow(r, y, (c, x, yy) => ctx.strokeText(c, x, yy));
    }
    if (t.shadow) {
      ctx.shadowColor = "rgba(0,0,0,0.75)";
      ctx.shadowOffsetX = ctx.shadowOffsetY = px * 0.07;
    }
    drawRow(r, y, (c, x, yy, col) => {
      ctx.fillStyle = col;
      ctx.fillText(c, x, yy);
    });
    ctx.shadowColor = "transparent";
  });
  return { canvas, lines, tooLong };
}

// ------------------------------------------------------------------ preset --
// Disimpan di browser ini saja (localStorage).

export type Preset = { id: string; name: string; style: Style; builtin?: boolean };

export const BUILTIN_PRESETS: Preset[] = [
  { id: "b-tiktok", name: "TikTok / Reels / Shorts", builtin: true, style: DEFAULT_STYLE },
  {
    id: "b-feed",
    name: "Feed Instagram (4:5)",
    builtin: true,
    style: { ...DEFAULT_STYLE, aspect: "4:5", background: "fill" },
  },
  { id: "b-yt", name: "YouTube (16:9)", builtin: true, style: { ...DEFAULT_STYLE, aspect: "16:9" } },
];

const PRESET_KEY = "sc_edit_presets";
const LAST_KEY = "sc_edit_last";
/** Nama pengganti untuk preset bawaan yang diubah namanya oleh pengguna: id → nama. */
const NAMES_KEY = "sc_edit_preset_names";
export const PRESET_NAME_MAX = 40;

const num = (v: unknown, min: number, max: number, def: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
const pick = <T extends string>(v: unknown, list: readonly T[], def: T): T =>
  list.includes(v as T) ? (v as T) : def;
const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

const fontId = (v: unknown, def: FontId) => (typeof v === "string" && FONT_ID_RE.test(v) ? v : def);
const color = (v: unknown, def: string) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v.toUpperCase() : def);

export function cleanWatermark(raw: unknown): Watermark {
  const w = obj(raw);
  const d = DEFAULT_WATERMARK;
  return {
    on: w.on === true,
    text: typeof w.text === "string" ? w.text.replace(/\s+/g, " ").slice(0, 60) : d.text,
    font: fontId(w.font, d.font),
    size: num(w.size, 0.015, 0.12, d.size),
    color: pick(w.color, ["white", "black", "yellow"] as const, d.color),
    opacity: num(w.opacity, 0.05, 1, d.opacity),
    x: num(w.x, 0, 1, d.x),
    y: num(w.y, 0, 1, d.y),
  };
}

export function cleanTitleStyle(raw: unknown): Omit<Title, "text"> {
  const t = obj(raw);
  const d = DEFAULT_TITLE;
  return {
    on: t.on === true,
    font: fontId(t.font, d.font),
    size: num(t.size, 0.03, 0.16, d.size),
    x: num(t.x, 0, 1, d.x),
    y: num(t.y, 0, 1, d.y),
    duration: num(t.duration, 1, 10, d.duration),
    textColor: color(t.textColor, d.textColor),
    box: typeof t.box === "boolean" ? t.box : d.box,
    boxMode: t.boxMode === "line" ? "line" : "block",
    boxColor: color(t.boxColor, d.boxColor),
    boxOpacity: num(t.boxOpacity, 0.1, 1, d.boxOpacity),
    radius: num(t.radius, 0, 1, d.radius),
    outline: num(t.outline, LIMITS.outline[0], LIMITS.outline[1], d.outline),
    outlineColor: color(t.outlineColor, d.outlineColor),
    shadow: t.shadow === true,
    lineHeight: num(t.lineHeight, LIMITS.lineHeight[0], LIMITS.lineHeight[1], d.lineHeight),
    letterSpacing: num(t.letterSpacing, LIMITS.letterSpacing[0], LIMITS.letterSpacing[1], d.letterSpacing),
  };
}

/** Lengkapi & bersihkan gaya dari penyimpanan (bisa berasal dari versi lama). */
export function cleanStyle(raw: unknown): Style {
  const s = obj(raw);
  return {
    aspect: pick(s.aspect, ASPECTS, DEFAULT_STYLE.aspect),
    background: pick(s.background, ["blur", "black", "fill"] as const, DEFAULT_STYLE.background),
    height: HEIGHTS.includes(s.height as Height) ? (s.height as Height) : DEFAULT_STYLE.height,
    watermark: cleanWatermark(s.watermark),
    title: cleanTitleStyle(s.title),
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
        .map((p) => ({ id: p.id, name: p.name.slice(0, PRESET_NAME_MAX), style: cleanStyle(p.style) }))
    : [];
}

export function savePresets(list: Preset[]) {
  write(
    PRESET_KEY,
    list.filter((p) => !p.builtin).slice(0, 30),
  );
}

/** Preset bawaan dengan nama yang mungkin sudah diubah pengguna. */
export function loadBuiltins(): Preset[] {
  const names = read<Record<string, string>>(NAMES_KEY, {});
  return BUILTIN_PRESETS.map((p) => {
    const n = names && typeof names[p.id] === "string" ? names[p.id].trim().slice(0, PRESET_NAME_MAX) : "";
    return n ? { ...p, name: n } : p;
  });
}

export function saveBuiltinNames(list: Preset[]) {
  const names: Record<string, string> = {};
  for (const p of list) {
    const orig = BUILTIN_PRESETS.find((b) => b.id === p.id);
    if (orig && p.name !== orig.name) names[p.id] = p.name;
  }
  write(NAMES_KEY, names);
}

export const loadLastStyle = (): Style => cleanStyle(read(LAST_KEY, DEFAULT_STYLE));
export const saveLastStyle = (s: Style) => write(LAST_KEY, s);

export const sameStyle = (a: Style, b: Style) => JSON.stringify(cleanStyle(a)) === JSON.stringify(cleanStyle(b));

// ------------------------------------------------------------------ upload --

/** Unggah file ke Studio lokal (isi file dikirim langsung sebagai body). */
export function uploadFile(file: File | Blob, onProgress?: (p: number) => void, name?: string): Promise<Upload> {
  const fname = name ?? (file instanceof File ? file.name : "file.bin");
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/editor/upload?name=${encodeURIComponent(fname)}`);
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

/** Unggah font sendiri (.ttf / .otf). */
export async function uploadFont(file: File): Promise<FontInfo> {
  const res = await fetch(`/api/editor/fonts/upload?name=${encodeURIComponent(file.name)}`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: file,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : `Unggah font gagal (${res.status}).`);
  return data as FontInfo;
}

export async function deleteFont(id: FontId): Promise<void> {
  const res = await fetch(`/api/editor/fonts/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Font gagal dihapus.");
}
