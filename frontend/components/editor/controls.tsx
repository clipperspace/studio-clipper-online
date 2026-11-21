"use client";

// Komponen kecil yang dipakai bersama di panel editor.
import { useRef, useState } from "react";
import {
  type Aspect,
  type Crop,
  type FontId,
  type FontInfo,
  DEFAULT_CROP,
  MAX_ZOOM,
  SWATCHES,
  cropBox,
  fontFamily,
} from "@/lib/editor";

export function Segmented<T extends string | number>({
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
export function Section({
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

/** Slider dengan label & nilai. */
export function Slider({
  label,
  value,
  min,
  max,
  step,
  text,
  onChange,
  disabled = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  text: string;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
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
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <output>{text}</output>
    </label>
  );
}

/**
 * Pilihan font: setiap tombol ditulis dengan font-nya sendiri. Bisa menambah font sendiri (.ttf / .otf),
 * mis. font berbayar yang sudah kamu beli, dan menghapusnya lagi.
 */
export function FontPicker({
  fonts,
  value,
  onChange,
  label,
  onUpload,
  onDelete,
}: {
  fonts: FontInfo[];
  value: FontId;
  onChange: (v: FontId) => void;
  label: string;
  onUpload: (file: File) => Promise<void>;
  onDelete: (id: FontId) => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const current = fonts.find((f) => f.id === value);
  return (
    <div className="stack-6">
      <div className="ed-fonts" role="group" aria-label={label}>
        {fonts.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={value === f.id}
            title={f.user ? `${f.name} (font kamu)` : f.name}
            onClick={() => onChange(f.id)}
            style={{ fontFamily: fontFamily(f.id) }}
          >
            {f.name}
          </button>
        ))}
        <button
          type="button"
          className="ed-font-add"
          disabled={busy}
          onClick={() => input.current?.click()}
          title="Tambah font sendiri (.ttf / .otf)"
        >
          {busy ? "Mengunggah…" : "+ Font sendiri"}
        </button>
      </div>
      <input
        ref={input}
        type="file"
        accept=".ttf,.otf,font/ttf,font/otf"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          setErr("");
          try {
            await onUpload(file);
          } catch (x) {
            setErr((x as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
      {err && (
        <span role="alert" className="alert">
          {err}
        </span>
      )}
      {current?.user && (
        <div className="hint ed-name-hint">
          <span>Font kamu: {current.name}</span>
          <button
            type="button"
            className="ed-linkbtn"
            onClick={() => {
              if (confirm(`Hapus font "${current.name}" dari Studio Clipper?`)) void onDelete(current.id);
            }}
          >
            Hapus font
          </button>
        </div>
      )}
    </div>
  );
}

/** Pilihan warna: beberapa warna cepat + pemilih warna bebas. */
export function ColorPicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="ed-colors" role="group" aria-label={label}>
      {SWATCHES.map((c) => (
        <button
          key={c}
          type="button"
          aria-pressed={value.toUpperCase() === c}
          aria-label={c}
          title={c}
          style={{ background: c }}
          onClick={() => onChange(c)}
        />
      ))}
      <label className="ed-color-custom" title="Warna lain">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} aria-label={`${label}: warna lain`} />
        <span style={{ background: value }} />
      </label>
    </div>
  );
}

/** Posisi cepat 3×3 (atau 1×3 vertikal jika `cols` = 1). */
export function PositionGrid({
  x,
  y,
  xs,
  ys,
  onChange,
  label,
}: {
  x: number;
  y: number;
  xs: number[];
  ys: number[];
  onChange: (x: number, y: number) => void;
  label: string;
}) {
  const names = (v: number, list: number[], words: [string, string, string]) =>
    list.length === 1 ? "" : words[list.indexOf(v)];
  return (
    <div
      className="ed-posgrid"
      role="group"
      aria-label={label}
      style={{ gridTemplateColumns: `repeat(${xs.length}, 1fr)` }}
    >
      {ys.map((py) =>
        xs.map((px) => {
          const name = [names(py, ys, ["Atas", "Tengah", "Bawah"]), names(px, xs, ["kiri", "tengah", "kanan"])]
            .filter(Boolean)
            .join(" ");
          const on = Math.abs(x - px) < 0.01 && Math.abs(y - py) < 0.01;
          return (
            <button
              key={`${px}-${py}`}
              type="button"
              aria-pressed={on}
              aria-label={name}
              title={name}
              onClick={() => onChange(px, py)}
            >
              <span />
            </button>
          );
        }),
      )}
    </div>
  );
}

/** Pengaturan potong manual: zoom & posisi. Sama hasilnya dengan menyeret video di preview. */
export function CropControls({
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
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  return (
    <div className="ed-crop">
      <div className="ed-crop-head">
        <span className="lbl">✂️ Potong manual</span>
        <button type="button" className="ed-linkbtn" onClick={() => onChange(DEFAULT_CROP)} disabled={!changed}>
          Reset
        </button>
      </div>
      <Slider label="Zoom" value={crop.zoom} min={1} max={MAX_ZOOM} step={0.05} text={pct(crop.zoom)} onChange={(v) => onChange({ ...crop, zoom: v })} />
      <Slider label="Kiri ↔ kanan" value={crop.x} min={0} max={1} step={0.01} text={pct(crop.x)} onChange={(v) => onChange({ ...crop, x: v })} disabled={!canX} />
      <Slider label="Atas ↕ bawah" value={crop.y} min={0} max={1} step={0.01} text={pct(crop.y)} onChange={(v) => onChange({ ...crop, y: v })} disabled={!canY} />
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
