"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { fmt } from "@/lib/api";
import { type Crop, type EditorSource, type Style, aspectRatio, cropBox, fontFamily } from "@/lib/editor";
import { Play } from "../Icons";
import { Segmented } from "./controls";
import PlatformOverlay, { type Platform } from "./PlatformOverlay";

const PLATFORM_KEY = "sc_edit_platform";

export type PreviewHandle = {
  /** Pindah ke detik tertentu (detik video YouTube), dibatasi ke batas klip. */
  seek: (abs: number) => void;
};

/** Potong manual aktif: latar "Potong", atau rasio tujuan sama dengan video asli (tinggal zoom & geser). */
export function cropActive(src: EditorSource, style: Pick<Style, "aspect" | "background">) {
  const srcRatio = src.width && src.height ? src.width / src.height : 16 / 9;
  return style.background === "fill" || Math.abs(srcRatio - aspectRatio(style.aspect)) < 0.01;
}

const WM_COLORS = { white: "#ffffff", black: "#111111", yellow: "#ffcc00" } as const;

type Drag =
  | { kind: "crop"; x: number; y: number; crop: Crop; moved: boolean }
  | { kind: "wm" | "title"; x: number; y: number; ox: number; oy: number; ew: number; eh: number; moved: boolean };

export default function Preview({
  ref,
  src,
  trim,
  style,
  crop,
  titleImage,
  caption = "",
  onCrop,
  onMoveText,
  onTime,
}: {
  ref?: React.Ref<PreviewHandle>;
  src: EditorSource;
  trim: { start: number; end: number };
  style: Style;
  crop: Crop;
  /** Gambar teks pembuka (sama persis dengan yang dirender): data URL & lebarnya (pecahan lebar video). */
  titleImage: { src: string; width: number } | null;
  /** Keterangan contoh untuk pratinjau TikTok / Reels (judul klip). */
  caption?: string;
  onCrop: (c: Crop) => void;
  onMoveText: (kind: "wm" | "title", x: number, y: number) => void;
  /** Posisi pemutaran (detik video YouTube), dikirim maks. ±10× per detik. */
  onTime?: (abs: number) => void;
}) {
  const fg = useRef<HTMLVideoElement>(null);
  const bg = useRef<HTMLVideoElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const lastSent = useRef(0);
  const [t, setTState] = useState(trim.start);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  // Pratinjau tampilan aplikasi (hanya di preview, tidak ikut dirender); diingat di browser ini
  const [platform, setPlatformState] = useState<Platform>("none");
  useEffect(() => {
    try {
      const v = localStorage.getItem(PLATFORM_KEY);
      if (v === "tiktok" || v === "reels") setPlatformState(v);
    } catch {
      /* penyimpanan diblokir */
    }
  }, []);
  const setPlatform = (v: Platform) => {
    setPlatformState(v);
    try {
      localStorage.setItem(PLATFORM_KEY, v);
    } catch {
      /* penyimpanan diblokir */
    }
  };

  const setT = useCallback(
    (abs: number, force = false) => {
      setTState(abs);
      const now = performance.now();
      if (onTime && (force || now - lastSent.current > 100)) {
        lastSent.current = now;
        onTime(abs);
      }
    },
    [onTime],
  );

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

  const seek = useCallback(
    (abs: number) => {
      const v = fg.current;
      if (!v) return;
      // Boleh di luar batas klip (untuk melihat sebelum/sesudahnya saat mengatur batas), asal masih di file sumber
      const clamped = Math.min(src.available[1] - 0.04, Math.max(src.available[0], abs));
      v.currentTime = clamped - src.offset;
      if (bg.current) bg.current.currentTime = v.currentTime;
      setT(clamped, true);
    },
    [src.available, src.offset, setT],
  );

  useImperativeHandle(ref, () => ({ seek }), [seek]);

  // Awal klip berubah → kembali ke awal klip
  useEffect(() => {
    if (ready) seek(trim.start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, trim.start]);

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
  }, [playing, trim.start, trim.end, src.offset, seek, setT]);

  const toggle = () => {
    const v = fg.current;
    if (!v || !ready) return;
    if (v.paused) {
      const abs = src.offset + v.currentTime;
      if (abs < trim.start || abs >= trim.end - 0.05) seek(trim.start);
      void v.play();
    } else v.pause();
  };

  // ------------------------------------------------ seret: video & teks
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

  const onStageDown = (e: React.PointerEvent) => {
    drag.current = { kind: "crop", x: e.clientX, y: e.clientY, crop, moved: false };
    if (canMove) e.currentTarget.setPointerCapture(e.pointerId);
  };

  // Gerak & lepas dari teks diteruskan ke handler layar (bubbling), jadi cukup ditangani di sana
  const onTextDown = (kind: "wm" | "title", ox: number, oy: number) => (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    drag.current = { kind, x: e.clientX, y: e.clientY, ox, oy, ew: r.width, eh: r.height, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const el = stage.current;
    if (!d || !el) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    d.moved = true;
    const rect = el.getBoundingClientRect();
    if (d.kind === "crop") {
      if (!canMove) return;
      onCrop({
        ...d.crop,
        x: box.w > 1.001 ? clamp01(d.crop.x - dx / rect.width / (box.w - 1)) : d.crop.x,
        y: box.h > 1.001 ? clamp01(d.crop.y - dy / rect.height / (box.h - 1)) : d.crop.y,
      });
    } else {
      // Posisi relatif: 0 = menempel tepi kiri/atas, 1 = menempel tepi kanan/bawah
      const fx = rect.width - d.ew > 1 ? clamp01(d.ox + dx / (rect.width - d.ew)) : d.ox;
      const fy = rect.height - d.eh > 1 ? clamp01(d.oy + dy / (rect.height - d.eh)) : d.oy;
      onMoveText(d.kind, Math.round(fx * 1000) / 1000, Math.round(fy * 1000) / 1000);
    }
  };

  const onUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) {
      e.stopPropagation();
      toggle();
    }
  };

  // ------------------------------------------------ teks di atas video
  const wm = style.watermark;
  const showWm = wm.on && wm.text.trim();
  const title = style.title;
  const rel = t - trim.start;
  const showTitle = title.on && !!titleImage && (!playing || rel < title.duration);
  const place = (x: number, y: number): React.CSSProperties => ({
    left: `${x * 100}%`,
    top: `${y * 100}%`,
    transform: `translate(${-x * 100}%, ${-y * 100}%)`,
  });

  const len = trim.end - trim.start;
  return (
    <div className="ed-preview">
      <div className="ed-stage-wrap">
        <div
          ref={stage}
          className={`ed-stage ${canMove ? "can-move" : ""}`}
          style={{ aspectRatio: `${ratio}`, width: `min(100%, calc(var(--stage-h) * ${ratio}))` }}
          onPointerDown={onStageDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
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

          {showWm && (
            <div
              className="ed-ov ed-wm"
              style={{
                ...place(wm.x, wm.y),
                fontFamily: fontFamily(wm.font),
                fontSize: `${wm.size * 100}cqw`,
                color: WM_COLORS[wm.color],
                opacity: wm.opacity,
                textShadow: wm.color === "black" ? "none" : "0.06em 0.06em 0 rgba(0,0,0,0.5)",
              }}
              onPointerDown={onTextDown("wm", wm.x, wm.y)}
              title="Seret untuk memindahkan watermark"
            >
              {wm.text}
            </div>
          )}

          {showTitle && titleImage && (
            <div
              className="ed-ov ed-title-img"
              style={{ ...place(title.x, title.y), width: `${titleImage.width * 100}%` }}
              onPointerDown={onTextDown("title", title.x, title.y)}
              title="Seret untuk memindahkan teks pembuka"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={titleImage.src} alt="" draggable={false} />
            </div>
          )}

          <PlatformOverlay
            platform={platform}
            account={wm.text}
            caption={caption}
            // Layar HP selalu 9:16; untuk rasio lain ukurannya dihitung dari tinggi preview
            unit={ratio <= 9 / 16 + 0.001 ? "1cqw" : `calc(1cqw * ${(9 / 16 / ratio).toFixed(4)})`}
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
          step={0.01}
          value={Math.min(len, Math.max(0, rel))}
          onChange={(e) => seek(trim.start + Number(e.target.value))}
          aria-label="Posisi preview"
          disabled={!ready}
        />
        <span className="ed-time">
          {fmt(rel)} / {fmt(len)}
        </span>
      </div>
      <div className="ed-platform">
        <span>Pratinjau</span>
        <Segmented<Platform>
          label="Pratinjau tampilan aplikasi"
          value={platform}
          onChange={setPlatform}
          options={[
            { v: "none", label: "Biasa" },
            { v: "tiktok", label: "TikTok" },
            { v: "reels", label: "Instagram" },
          ]}
        />
      </div>
      {platform !== "none" && (
        <p className="hint ed-note">
          Tampilan perkiraan setelah diunggah, hanya untuk preview (tidak ikut dirender). Pastikan teks penting tidak
          tertutup tombol & keterangan.
          {Math.abs(ratio - 9 / 16) > 0.01 && " Di aplikasi, video selain 9:16 tampil dengan bagian kosong."}
        </p>
      )}
      <p className="hint ed-note">
        {showWm || title.on
          ? "Seret teks atau watermark untuk memindahkannya. Ketuk video untuk putar/jeda."
          : canMove
            ? "Seret video di dalam layar untuk memilih bagian yang tampil. Ketuk untuk putar/jeda."
            : "Preview dari browser. Hasil render bisa sedikit berbeda, terutama tingkat blur."}
      </p>
    </div>
  );
}
