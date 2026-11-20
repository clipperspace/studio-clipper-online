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
  type EditorSource,
  type Height,
  type Preset,
  type Style,
  ASPECTS,
  BUILTIN_PRESETS,
  HEIGHTS,
  aspectRatio,
  loadLastStyle,
  loadPresets,
  sameStyle,
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
  { v: "fill", label: "Penuh", hint: "Video diperbesar memenuhi layar; sisi kiri-kanan terpotong." },
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

function Preview({
  src,
  trim,
  style,
}: {
  src: EditorSource;
  trim: { start: number; end: number };
  style: Style;
}) {
  const fg = useRef<HTMLVideoElement>(null);
  const bg = useRef<HTMLVideoElement>(null);
  const [t, setT] = useState(trim.start);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);

  const ratio = aspectRatio(style.aspect);
  const srcRatio = src.width && src.height ? src.width / src.height : 16 / 9;
  const sameRatio = Math.abs(srcRatio - ratio) < 0.01;
  const blurBg = !sameRatio && style.background === "blur";
  const fit = !sameRatio && style.background === "fill" ? "cover" : "contain";

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
          className="ed-stage"
          style={{ aspectRatio: `${ratio}`, width: `min(100%, calc(var(--stage-h) * ${ratio}))` }}
          onClick={toggle}
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
            style={{ objectFit: fit }}
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
      <p className="hint ed-note">Preview dari browser. Hasil render bisa sedikit berbeda, terutama tingkat blur.</p>
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
  const [userPresets, setUserPresets] = useState<Preset[]>([]);
  const [naming, setNaming] = useState<string | null>(null);
  const [render, setRender] = useState<Render>({ status: "idle" });

  useEffect(() => {
    setStyleState(loadLastStyle());
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

  const presets = [...BUILTIN_PRESETS, ...userPresets];
  const active = presets.find((p) => sameStyle(p.style, style));

  const savePreset = () => {
    const name = (naming || "").trim().slice(0, 40);
    if (!name) return;
    const list = [...userPresets.filter((p) => p.name !== name), { id: `u-${Date.now()}`, name, style }];
    setUserPresets(list);
    savePresets(list);
    setNaming(null);
  };

  const deletePreset = (id: string) => {
    const list = userPresets.filter((p) => p.id !== id);
    setUserPresets(list);
    savePresets(list);
  };

  const doRender = async () => {
    if (!src) return;
    setRender({ status: "running", stage: "Memulai…", progress: 0 });
    try {
      const job = await apiPost<Job>("/api/editor/render", {
        source_id: src.source_id,
        title: title || src.video.title,
        recipe: { v: 1, trim, ...style, height: effHeight },
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
            <Preview src={src} trim={trim} style={style} />

            <div className="ed-panel">
              <Section title="Preset" desc="Simpan gaya edit favorit untuk dipakai di klip lain.">
                <div className="ed-preset-row">
                  <select
                    className="ed-select"
                    aria-label="Pilih preset"
                    value={active?.id ?? "custom"}
                    onChange={(e) => {
                      const p = presets.find((x) => x.id === e.target.value);
                      if (p) setStyle(p.style);
                    }}
                  >
                    {!active && <option value="custom">Gaya kustom</option>}
                    {BUILTIN_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
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
                  {active && !active.builtin ? (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => deletePreset(active.id)}>
                      Hapus
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setNaming(naming === null ? "" : null)}
                      disabled={!!active}
                      title={active ? "Ubah pengaturan dulu untuk membuat preset baru" : undefined}
                    >
                      Simpan
                    </button>
                  )}
                </div>
                {naming !== null && !active && (
                  <form
                    className="ed-preset-row"
                    onSubmit={(e) => {
                      e.preventDefault();
                      savePreset();
                    }}
                  >
                    <input
                      className="f-input"
                      autoFocus
                      maxLength={40}
                      placeholder="Nama preset, mis. Podcast 9:16"
                      value={naming}
                      onChange={(e) => setNaming(e.target.value)}
                      aria-label="Nama preset"
                    />
                    <button type="submit" className="btn btn-accent btn-sm" disabled={!naming.trim()}>
                      Simpan
                    </button>
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
                    ? "Rasio sama dengan video asli, jadi latar tidak dipakai."
                    : BACKGROUNDS.find((b) => b.v === style.background)?.hint}
                </div>
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
