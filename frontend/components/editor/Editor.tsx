"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type Health,
  type Job,
  INSTALL_GUIDE,
  apiGet,
  apiPost,
  duration,
  editorLink,
  fmt,
  isYouTubeUrl,
  pollJob,
  triggerDownload,
} from "@/lib/api";
import {
  type Aspect,
  type Background,
  type Crop,
  type EditorSource,
  type Height,
  type Preset,
  type Style,
  ASPECTS,
  BUILTIN_PRESETS,
  DEFAULT_CROP,
  HEIGHTS,
  MAX_ZOOM,
  PRESET_NAME_MAX,
  aspectRatio,
  cropBox,
  loadBuiltins,
  loadLastStyle,
  loadPresets,
  sameStyle,
  saveBuiltinNames,
  saveLastStyle,
  savePresets,
} from "@/lib/editor";
import { Check, Download, Play } from "../Icons";

// Fitur dari roadmap yang belum tersedia: ditampilkan supaya pengguna tahu apa yang akan datang.
const SOON = [
  ["💬", "Subtitle otomatis", "Font, ukuran, warna & highlight per kata"],
  ["🔤", "Teks pembuka 5 detik", "Teks manual dengan style & posisi bebas"],
  ["🏷️", "Watermark nama akun", "Posisi & transparansi bisa diatur"],
  ["🎬", "Video hook 5 detik", "Video sendiri + transisi ber-sound effect"],
  ["🔚", "Video akhir", "Durasi bisa diatur"],
  ["🎵", "Musik", "Lagu dari device, atur bagian & volume"],
  ["🙂", "Auto-follow wajah", "Kamera mengikuti pembicara"],
  ["✨", "Efek", "Pendulum, sparkle, minimal shake"],
] as const;

const BACKGROUNDS: { v: Background; label: string; hint: string }[] = [
  { v: "blur", label: "Blur", hint: "Video utuh di tengah, latar versi blur dari video yang sama." },
  { v: "black", label: "Hitam", hint: "Video utuh di tengah dengan latar hitam." },
  {
    v: "fill",
    label: "Potong",
    hint: "Video memenuhi layar. Geser video di preview atau atur zoom & posisi untuk memilih bagian yang tampil.",
  },
];

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  disabled,
  label,
}: {
  value: T;
  options: { v: T; label: string; disabled?: boolean }[];
  onChange: (v: T) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          aria-pressed={value === o.v}
          disabled={disabled || o.disabled}
          onClick={() => onChange(o.v)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Saklar on/off. Setiap fitur editor memakai ini supaya semuanya opsional. */
export function Switch({
  on,
  onChange,
  label,
  disabled,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className="ed-switch"
      disabled={disabled}
      onClick={() => onChange(!on)}
    >
      <span />
    </button>
  );
}

/** Satu bagian pengaturan. Dengan `onToggle`, bagian ini punya saklar on/off dan isinya hanya tampil saat on. */
function Section({
  title,
  desc,
  on = true,
  onToggle,
  children,
}: {
  title: string;
  desc?: string;
  on?: boolean;
  onToggle?: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <section className={`ed-section ${on ? "" : "off"}`}>
      <header>
        <div>
          <h3>{title}</h3>
          {desc && <p>{desc}</p>}
        </div>
        {onToggle && <Switch on={on} onChange={onToggle} label={title} />}
      </header>
      {on && children && <div className="ed-section-body">{children}</div>}
    </section>
  );
}

// ------------------------------------------------------------------ preview --

/** Pengaturan potong manual: zoom & posisi. Sama hasilnya dengan menyeret video di preview. */
function CropControls({
  srcRatio,
  aspect,
  crop,
  onChange,
}: {
  srcRatio: number;
  aspect: Aspect;
  crop: Crop;
  onChange: (c: Crop) => void;
}) {
  const box = cropBox(srcRatio, aspect, crop);
  const canX = box.w > 1.001;
  const canY = box.h > 1.001;
  const changed = crop.x !== DEFAULT_CROP.x || crop.y !== DEFAULT_CROP.y || crop.zoom !== DEFAULT_CROP.zoom;
  const row = (label: string, value: number, min: number, max: number, step: number, text: string, set: (v: number) => void, disabled = false) => (
    <label className={`ed-slider ${disabled ? "is-off" : ""}`}>
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label}
        aria-valuetext={text}
        onChange={(e) => set(Number(e.target.value))}
      />
      <output>{text}</output>
    </label>
  );
  return (
    <div className="ed-crop">
      <div className="ed-crop-head">
        <span className="lbl">✂️ Potong manual</span>
        <button type="button" className="ed-linkbtn" onClick={() => onChange(DEFAULT_CROP)} disabled={!changed}>
          Reset
        </button>
      </div>
      {row("Zoom", crop.zoom, 1, MAX_ZOOM, 0.05, `${Math.round(crop.zoom * 100)}%`, (v) => onChange({ ...crop, zoom: v }))}
      {row(
        "Kiri ↔ kanan",
        crop.x,
        0,
        1,
        0.01,
        `${Math.round(crop.x * 100)}%`,
        (v) => onChange({ ...crop, x: v }),
        !canX,
      )}
      {row(
        "Atas ↕ bawah",
        crop.y,
        0,
        1,
        0.01,
        `${Math.round(crop.y * 100)}%`,
        (v) => onChange({ ...crop, y: v }),
        !canY,
      )}
      <div className="ed-crop-quick" role="group" aria-label="Posisi cepat">
        {(
          [
            ["Kiri", 0],
            ["Tengah", 0.5],
            ["Kanan", 1],
          ] as const
        ).map(([l, x]) => (
          <button
            key={l}
            type="button"
            className="chip"
            disabled={!canX}
            aria-pressed={canX && Math.abs(crop.x - x) < 0.005}
            onClick={() => onChange({ ...crop, x })}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="hint">Atau seret video langsung di preview.</div>
    </div>
  );
}

/** Potong manual aktif: latar "Potong", atau rasio tujuan sama dengan video asli (tinggal zoom & geser). */
export function cropActive(src: EditorSource, style: Style) {
  const srcRatio = src.width && src.height ? src.width / src.height : 16 / 9;
  return style.background === "fill" || Math.abs(srcRatio - aspectRatio(style.aspect)) < 0.01;
}

function Preview({
  src,
  trim,
  style,
  crop,
  onCrop,
}: {
  src: EditorSource;
  trim: { start: number; end: number };
  style: Style;
  crop: Crop;
  onCrop: (c: Crop) => void;
}) {
  const fg = useRef<HTMLVideoElement>(null);
  const bg = useRef<HTMLVideoElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; crop: Crop; moved: boolean } | null>(null);
  const [t, setT] = useState(trim.start);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);

  const ratio = aspectRatio(style.aspect);
  const srcRatio = src.width && src.height ? src.width / src.height : 16 / 9;
  const sameRatio = Math.abs(srcRatio - ratio) < 0.01;
  const cropping = cropActive(src, style);
  const blurBg = !sameRatio && style.background === "blur";
  const box = cropBox(srcRatio, style.aspect, crop);
  const canMove = cropping && (box.w > 1.001 || box.h > 1.001);
  const fgStyle: React.CSSProperties = cropping
    ? {
        objectFit: "fill",
        width: `${box.w * 100}%`,
        height: `${box.h * 100}%`,
        left: `${box.left * 100}%`,
        top: `${box.top * 100}%`,
      }
    : { objectFit: "contain" };

  // Geser video di dalam layar untuk memilih bagian yang tampil (mouse & sentuh)
  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, crop, moved: false };
    if (canMove) e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const el = stage.current;
    if (!d || !el || !canMove) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    d.moved = true;
    const rect = el.getBoundingClientRect();
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    onCrop({
      ...d.crop,
      x: box.w > 1.001 ? clamp(d.crop.x - dx / rect.width / (box.w - 1)) : d.crop.x,
      y: box.h > 1.001 ? clamp(d.crop.y - dy / rect.height / (box.h - 1)) : d.crop.y,
    });
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) toggle();
  };

  const seek = useCallback(
    (abs: number) => {
      const v = fg.current;
      if (!v) return;
      const clamped = Math.min(trim.end, Math.max(trim.start, abs));
      v.currentTime = clamped - src.offset;
      if (bg.current) bg.current.currentTime = v.currentTime;
      setT(clamped);
    },
    [trim.start, trim.end, src.offset],
  );

  // Batas klip berubah → kembali ke awal klip
  useEffect(() => {
    if (ready) seek(trim.start);
  }, [ready, trim.start, seek]);

  // Selama diputar: perbarui posisi, berhenti di akhir klip, jaga latar blur tetap sinkron
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const v = fg.current;
      if (v) {
        const abs = src.offset + v.currentTime;
        if (abs >= trim.end - 0.02) {
          v.pause();
          seek(trim.start);
          return;
        }
        setT(abs);
        const b = bg.current;
        if (b && Math.abs(b.currentTime - v.currentTime) > 0.25) b.currentTime = v.currentTime;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, trim.start, trim.end, src.offset, seek]);

  const toggle = () => {
    const v = fg.current;
    if (!v || !ready) return;
    if (v.paused) {
      const abs = src.offset + v.currentTime;
      if (abs < trim.start || abs >= trim.end - 0.05) seek(trim.start);
      void v.play();
    } else v.pause();
  };

  const len = trim.end - trim.start;
  return (
    <div className="ed-preview">
      <div className="ed-stage-wrap">
        <div
          ref={stage}
          className={`ed-stage ${canMove ? "can-move" : ""}`}
          style={{ aspectRatio: `${ratio}`, width: `min(100%, calc(var(--stage-h) * ${ratio}))` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (drag.current = null)}
        >
          {blurBg && (
            <video
              ref={bg}
              className="ed-bg"
              src={src.video_url}
              muted
              playsInline
              preload="auto"
              aria-hidden
              tabIndex={-1}
            />
          )}
          <video
            ref={fg}
            className="ed-fg"
            style={fgStyle}
            src={src.video_url}
            playsInline
            preload="auto"
            onLoadedMetadata={() => setReady(true)}
            onPlay={() => {
              setPlaying(true);
              void bg.current?.play().catch(() => {});
            }}
            onPause={() => {
              setPlaying(false);
              bg.current?.pause();
            }}
            onSeeked={() => {
              if (bg.current && fg.current) bg.current.currentTime = fg.current.currentTime;
            }}
          />
          {!playing && ready && (
            <span className="ed-play" aria-hidden>
              <Play size={28} />
            </span>
          )}
          {!ready && <span className="spinner ed-spinner" aria-label="Memuat video" />}
        </div>
      </div>
      <div className="ed-controls">
        <button
          type="button"
          className="icon-btn ed-playbtn"
          onClick={toggle}
          disabled={!ready}
          aria-label={playing ? "Jeda" : "Putar"}
        >
          {playing ? (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
              <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
            </svg>
          ) : (
            <Play size={18} />
          )}
        </button>
        <input
          type="range"
          min={0}
          max={len}
          step={0.05}
          value={Math.min(len, Math.max(0, t - trim.start))}
          onChange={(e) => seek(trim.start + Number(e.target.value))}
          aria-label="Posisi preview"
          disabled={!ready}
        />
        <span className="ed-time">
          {fmt(t - trim.start)} / {fmt(len)}
        </span>
      </div>
      <p className="hint ed-note">
        {canMove
          ? "Seret video di dalam layar untuk memilih bagian yang tampil. Ketuk untuk putar/jeda."
          : "Preview dari browser. Hasil render bisa sedikit berbeda, terutama tingkat blur."}
      </p>
    </div>
  );
}

// ------------------------------------------------------------------ editor --

type Load = { status: "loading"; stage: string; progress: number } | { status: "error"; error: string };
type Render =
  | { status: "idle" }
  | { status: "running"; stage: string; progress: number }
  | { status: "done"; href: string; filename: string | null }
  | { status: "error"; error: string };

export default function Editor() {
  const params = useSearchParams();
  const url = params.get("url") || "";
  const start = Number(params.get("start"));
  const end = Number(params.get("end"));
  const title = (params.get("title") || "").slice(0, 120);
  const validParams = isYouTubeUrl(url) && Number.isFinite(start) && Number.isFinite(end) && end - start >= 1;

  const [health, setHealth] = useState<Health | "down" | null>(null);
  const hosted = !!(health && health !== "down" && health.hosted);

  const [src, setSrc] = useState<EditorSource | null>(null);
  const [load, setLoad] = useState<Load>({ status: "loading", stage: "Memulai…", progress: 0 });
  const [trim, setTrim] = useState({ start, end });
  const [style, setStyleState] = useState<Style>(BUILTIN_PRESETS[0].style);
  // Posisi potong khusus klip ini (tidak ikut preset, karena tergantung isi video)
  const [crop, setCrop] = useState<Crop>(DEFAULT_CROP);
  const [builtins, setBuiltins] = useState<Preset[]>(BUILTIN_PRESETS);
  const [userPresets, setUserPresets] = useState<Preset[]>([]);
  const [presetId, setPresetId] = useState<string | null>(null);
  const [naming, setNaming] = useState<{ mode: "new" | "rename"; text: string; error?: string } | null>(null);
  const [render, setRender] = useState<Render>({ status: "idle" });

  useEffect(() => {
    setStyleState(loadLastStyle());
    setBuiltins(loadBuiltins());
    setUserPresets(loadPresets());
    apiGet<Health>("/api/health")
      .then(setHealth)
      .catch(() => setHealth("down"));
  }, []);

  const setStyle = (patch: Partial<Style>) =>
    setStyleState((s) => {
      const next = { ...s, ...patch };
      saveLastStyle(next);
      return next;
    });

  const prepare = useCallback(async () => {
    setLoad({ status: "loading", stage: "Memulai…", progress: 0 });
    setSrc(null);
    setRender({ status: "idle" });
    try {
      const job = await apiPost<Job<EditorSource>>("/api/editor/source", { url, start, end, height: 1080 });
      const done = await pollJob<EditorSource>(job.id, (j) =>
        setLoad({ status: "loading", stage: j.stage, progress: j.progress }),
      );
      const r = done.result!;
      setSrc(r);
      setTrim({ start: r.start, end: r.end });
    } catch (e) {
      setLoad({ status: "error", error: (e as Error).message });
    }
  }, [url, start, end]);

  useEffect(() => {
    if (!validParams || !health || health === "down" || health.hosted) return;
    void prepare();
  }, [validParams, health, prepare]);

  // Kualitas maksimal mengikuti sisi pendek video sumber
  const srcShort = src ? Math.min(src.width, src.height) : 1080;
  const effHeight = ([...HEIGHTS].reverse().find((h) => h <= Math.min(style.height, srcShort)) ?? 360) as Height;
  const srcRatio = src && src.width && src.height ? src.width / src.height : 16 / 9;
  const sameRatio = Math.abs(srcRatio - aspectRatio(style.aspect)) < 0.01;

  const presets = [...builtins, ...userPresets];
  // Preset yang terakhir dipilih/disimpan diutamakan; jika gaya sudah diubah, tampil "Gaya kustom"
  const active =
    presets.find((p) => p.id === presetId && sameStyle(p.style, style)) ?? presets.find((p) => sameStyle(p.style, style));
  const cropping = !!src && cropActive(src, style);

  const applyPreset = (p: Preset) => {
    setPresetId(p.id);
    setStyle(p.style);
    setNaming(null);
  };

  /** Simpan preset baru dengan gaya sekarang, atau ubah nama preset yang sedang dipilih. */
  const submitName = () => {
    if (!naming) return;
    const name = naming.text.trim().replace(/\s+/g, " ").slice(0, PRESET_NAME_MAX);
    if (!name) return setNaming({ ...naming, error: "Nama preset belum diisi." });
    const renaming = naming.mode === "rename" ? active : undefined;
    if (presets.some((p) => p.id !== renaming?.id && p.name.toLowerCase() === name.toLowerCase()))
      return setNaming({ ...naming, error: "Nama ini sudah dipakai preset lain." });

    if (renaming?.builtin) {
      const list = builtins.map((p) => (p.id === renaming.id ? { ...p, name } : p));
      setBuiltins(list);
      saveBuiltinNames(list);
    } else if (renaming) {
      const list = userPresets.map((p) => (p.id === renaming.id ? { ...p, name } : p));
      setUserPresets(list);
      savePresets(list);
    } else {
      const p: Preset = { id: `u-${Date.now()}`, name, style };
      const list = [...userPresets, p];
      setUserPresets(list);
      savePresets(list);
      setPresetId(p.id);
    }
    setNaming(null);
  };

  const deletePreset = (id: string) => {
    const list = userPresets.filter((p) => p.id !== id);
    setUserPresets(list);
    savePresets(list);
    setNaming(null);
  };

  /** Kembalikan nama preset bawaan ke nama aslinya. */
  const resetBuiltinName = (id: string) => {
    const orig = BUILTIN_PRESETS.find((b) => b.id === id);
    if (!orig) return;
    const list = builtins.map((p) => (p.id === id ? { ...p, name: orig.name } : p));
    setBuiltins(list);
    saveBuiltinNames(list);
    setNaming(null);
  };

  const doRender = async () => {
    if (!src) return;
    setRender({ status: "running", stage: "Memulai…", progress: 0 });
    try {
      const job = await apiPost<Job>("/api/editor/render", {
        source_id: src.source_id,
        title: title || src.video.title,
        recipe: { v: 1, trim, ...style, height: effHeight, crop: cropping ? crop : DEFAULT_CROP },
      });
      const done = await pollJob(job.id, (j) => setRender({ status: "running", stage: j.stage, progress: j.progress }));
      setRender({ status: "done", href: done.download_url!, filename: done.filename });
      triggerDownload(done.download_url!);
    } catch (e) {
      setRender({ status: "error", error: (e as Error).message });
    }
  };

  // ----------------------------------------------------------- tampilan awal --
  if (!validParams) {
    return (
      <main className="studio editor">
        <div className="container">
          <div className="banner">
            Belum ada klip yang dibuka. Pilih klip dari{" "}
            <a href="/studio/">Studio AI</a> atau <a href="/#clip">Timestamp</a>, lalu tekan <b>✏️ Edit</b>.
          </div>
        </div>
      </main>
    );
  }

  const head = (
    <div className="ed-head">
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => history.back()}>
        ← Kembali
      </button>
      <div>
        <span className="eyebrow">✏️ Editor klip</span>
        <h1>{title || src?.video.title || "Klip"}</h1>
        <p>
          {src?.video.title && title ? `${src.video.title} · ` : ""}
          {fmt(trim.start)} → {fmt(trim.end)} · {duration(trim.end - trim.start)}
        </p>
      </div>
    </div>
  );

  if (health === "down") {
    return (
      <main className="studio editor">
        <div className="container">
          {head}
          <div className="banner err">⚠️ Backend belum berjalan. Jalankan start.bat lalu muat ulang halaman ini.</div>
        </div>
      </main>
    );
  }

  if (hosted) {
    return (
      <main className="studio editor">
        <div className="container">
          {head}
          <div className="banner info">
            🌐 Editor memotong dan merender video, jadi hanya tersedia di Studio Clipper yang berjalan di perangkatmu.{" "}
            <a href={editorLink({ url, start, end, title }, true)} target="_blank" rel="noopener">
              Buka di Studio lokal →
            </a>{" "}
            ·{" "}
            <a href={INSTALL_GUIDE} target="_blank" rel="noopener noreferrer">
              Cara pasang
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="studio editor">
      <div className="container">
        {head}

        {!src ? (
          <div className="ed-loading" aria-live="polite">
            {load.status === "loading" ? (
              <>
                <span className="spinner" aria-hidden />
                <b>Menyiapkan klip untuk diedit</b>
                <span>
                  {load.stage} · {Math.round(load.progress * 100)}%
                </span>
                <div className="progress">
                  <div style={{ transform: `scaleX(${Math.max(0.03, load.progress)})` }} />
                </div>
                <small className="hint">Video diunduh sekali, lalu bisa dirender berkali-kali tanpa unduh ulang.</small>
              </>
            ) : (
              <>
                <b>Klip gagal disiapkan</b>
                <p role="alert" className="alert">
                  {load.error}
                </p>
                <button type="button" className="btn btn-accent" onClick={() => void prepare()}>
                  Coba lagi
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="ed-grid">
            <Preview src={src} trim={trim} style={style} crop={cropping ? crop : DEFAULT_CROP} onCrop={setCrop} />

            <div className="ed-panel">
              <Section title="Preset" desc="Simpan gaya edit favorit untuk dipakai di klip lain.">
                <div className="ed-preset-row">
                  <select
                    className="ed-select"
                    aria-label="Pilih preset"
                    value={active?.id ?? "custom"}
                    onChange={(e) => {
                      const p = presets.find((x) => x.id === e.target.value);
                      if (p) applyPreset(p);
                    }}
                  >
                    {!active && <option value="custom">Gaya kustom</option>}
                    <optgroup label="Bawaan">
                      {builtins.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </optgroup>
                    {userPresets.length > 0 && (
                      <optgroup label="Preset kamu">
                        {userPresets.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
                <div className="ed-preset-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    aria-pressed={naming?.mode === "new"}
                    onClick={() => setNaming(naming?.mode === "new" ? null : { mode: "new", text: "" })}
                  >
                    + Simpan baru
                  </button>
                  {active && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      aria-pressed={naming?.mode === "rename"}
                      onClick={() =>
                        setNaming(naming?.mode === "rename" ? null : { mode: "rename", text: active.name })
                      }
                    >
                      ✎ Ubah nama
                    </button>
                  )}
                  {active && !active.builtin && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => deletePreset(active.id)}>
                      Hapus
                    </button>
                  )}
                </div>
                {naming && (
                  <form
                    className="ed-name-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      submitName();
                    }}
                  >
                    <label htmlFor="ed-preset-name" className="lbl">
                      {naming.mode === "new" ? "Nama preset baru" : `Ubah nama "${active?.name ?? ""}"`}
                    </label>
                    <div className="ed-preset-row">
                      <input
                        id="ed-preset-name"
                        className="f-input"
                        autoFocus
                        maxLength={PRESET_NAME_MAX}
                        placeholder="Mis. Podcast 9:16 crop"
                        value={naming.text}
                        onChange={(e) => setNaming({ ...naming, text: e.target.value, error: undefined })}
                        onKeyDown={(e) => e.key === "Escape" && setNaming(null)}
                      />
                      <button type="submit" className="btn btn-accent btn-sm" disabled={!naming.text.trim()}>
                        Simpan
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNaming(null)}>
                        Batal
                      </button>
                    </div>
                    <div className="hint ed-name-hint">
                      {naming.error ? (
                        <span role="alert" className="alert">
                          {naming.error}
                        </span>
                      ) : (
                        <span>
                          {naming.text.trim().length}/{PRESET_NAME_MAX} karakter
                        </span>
                      )}
                      {naming.mode === "rename" &&
                        active?.builtin &&
                        active.name !== BUILTIN_PRESETS.find((b) => b.id === active.id)?.name && (
                          <button type="button" className="ed-linkbtn" onClick={() => resetBuiltinName(active.id)}>
                            Kembalikan nama asli
                          </button>
                        )}
                    </div>
                  </form>
                )}
              </Section>

              <Section title="Format & ukuran">
                <span className="lbl">Rasio aspek</span>
                <Segmented<Aspect>
                  label="Rasio aspek"
                  value={style.aspect}
                  onChange={(v) => setStyle({ aspect: v })}
                  options={ASPECTS.map((a) => ({ v: a, label: a }))}
                />
                <span className="lbl">Latar</span>
                <Segmented<Background>
                  label="Latar"
                  value={style.background}
                  onChange={(v) => setStyle({ background: v })}
                  disabled={sameRatio}
                  options={BACKGROUNDS.map((b) => ({ v: b.v, label: b.label }))}
                />
                <div className="hint">
                  {sameRatio
                    ? "Rasio sama dengan video asli, jadi latar tidak dipakai. Kamu tetap bisa zoom & geser di bawah."
                    : BACKGROUNDS.find((b) => b.v === style.background)?.hint}
                </div>
                {cropping && (
                  <CropControls srcRatio={srcRatio} aspect={style.aspect} crop={crop} onChange={setCrop} />
                )}
                <span className="lbl">Kualitas</span>
                <Segmented<Height>
                  label="Kualitas"
                  value={effHeight}
                  onChange={(v) => setStyle({ height: v })}
                  options={HEIGHTS.map((h) => ({ v: h, label: `${h}p`, disabled: h > srcShort }))}
                />
              </Section>

              <Section title="Batas klip" desc="Penggeser presisi per 0,1 detik hadir di update berikutnya.">
                <div className="ed-trim">
                  <span>
                    Mulai <b>{fmt(trim.start)}</b>
                  </span>
                  <span>
                    Selesai <b>{fmt(trim.end)}</b>
                  </span>
                  <span>
                    Durasi <b>{duration(trim.end - trim.start)}</b>
                  </span>
                </div>
              </Section>

              <Section title="Segera hadir" desc="Semua fitur ini opsional dan bisa dinyalakan atau dimatikan.">
                <ul className="ed-soon">
                  {SOON.map(([icon, name, desc]) => (
                    <li key={name}>
                      <span aria-hidden>{icon}</span>
                      <div>
                        <b>{name}</b>
                        <small>{desc}</small>
                      </div>
                      <Switch on={false} onChange={() => {}} label={name} disabled />
                    </li>
                  ))}
                </ul>
              </Section>

              <div className="ed-render">
                {render.status === "running" ? (
                  <div className="proc" aria-live="polite">
                    <span>
                      {render.stage} · {Math.round(render.progress * 100)}%
                    </span>
                    <div className="bar">
                      <div style={{ width: `${Math.max(3, render.progress * 100)}%` }} />
                    </div>
                  </div>
                ) : (
                  <button type="button" className="btn btn-yellow ed-render-btn" onClick={doRender}>
                    <Download /> Render & unduh · {style.aspect} · {effHeight}p
                  </button>
                )}
                {render.status === "done" && (
                  <p className="ed-done" aria-live="polite">
                    <Check size={16} /> Selesai: {render.filename}.{" "}
                    <a href={render.href}>Unduh lagi</a>
                  </p>
                )}
                {render.status === "error" && (
                  <div className="stack-6">
                    <p role="alert" className="alert">
                      {render.error}
                    </p>
                    {/kedaluwarsa/i.test(render.error) && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => void prepare()}>
                        Siapkan ulang klip
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
