"use client";

import { useEffect, useRef, useState } from "react";
import { parseTime } from "@/lib/api";
import { FRAME, fmtPrecise } from "@/lib/editor";

type Trim = { start: number; end: number };

/** Kolom waktu presisi (mm:ss.ss) dengan tombol geser ±1 frame & ±0,1 detik. */
function TimeField({
  label,
  value,
  onCommit,
  onFromPlayhead,
}: {
  label: string;
  value: number;
  onCommit: (v: number) => void;
  onFromPlayhead: () => void;
}) {
  const [text, setText] = useState(fmtPrecise(value));
  const [bad, setBad] = useState(false);
  useEffect(() => {
    setText(fmtPrecise(value));
    setBad(false);
  }, [value]);

  const commit = () => {
    const v = parseTime(text);
    if (v === null) return setBad(true);
    onCommit(v);
  };
  const nudge = (d: number) => onCommit(Math.round((value + d) * 1000) / 1000);
  const id = `ed-time-${label.toLowerCase()}`;

  return (
    <div className="ed-timefield">
      <label htmlFor={id} className="lbl">
        {label}
      </label>
      <div className="ed-timefield-row">
        <button type="button" onClick={() => nudge(-0.1)} aria-label={`${label} mundur 0,1 detik`} title="−0,1 detik">
          −0,1
        </button>
        <button type="button" onClick={() => nudge(-FRAME)} aria-label={`${label} mundur 1 frame`} title="−1 frame">
          −1f
        </button>
        <input
          id={id}
          className={`f-input ed-timeinput ${bad ? "bad" : ""}`}
          value={text}
          inputMode="decimal"
          spellCheck={false}
          onChange={(e) => {
            setText(e.target.value);
            setBad(false);
          }}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
        />
        <button type="button" onClick={() => nudge(FRAME)} aria-label={`${label} maju 1 frame`} title="+1 frame">
          +1f
        </button>
        <button type="button" onClick={() => nudge(0.1)} aria-label={`${label} maju 0,1 detik`} title="+0,1 detik">
          +0,1
        </button>
      </div>
      <button type="button" className="ed-linkbtn" onClick={onFromPlayhead}>
        ⤓ Pakai posisi preview
      </button>
    </div>
  );
}

/**
 * Timeline batas klip: gelombang suara seluruh potongan sumber, area klip yang bisa digeser dari kedua
 * ujungnya, dan garis posisi preview. Klik di timeline untuk memindah preview.
 */
export default function TrimBar({
  available,
  trim,
  peaks,
  playhead,
  onChange,
  onSeek,
}: {
  available: [number, number];
  trim: Trim;
  peaks: number[] | null;
  playhead: number;
  /** `edge` = ujung yang digeser, supaya preview bisa menampilkan frame di ujung itu. */
  onChange: (next: Trim, edge: "start" | "end") => void;
  onSeek: (abs: number) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ edge: "start" | "end" | "seek" } | null>(null);
  const [a0, a1] = available;
  const span = Math.max(0.001, a1 - a0);
  const pct = (v: number) => `${((Math.min(a1, Math.max(a0, v)) - a0) / span) * 100}%`;

  const timeAt = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    return Math.round((a0 + f * span) * 100) / 100;
  };

  const apply = (edge: "start" | "end" | "seek", clientX: number) => {
    const v = timeAt(clientX);
    if (edge === "seek") onSeek(v);
    else if (edge === "start") onChange({ start: v, end: trim.end }, "start");
    else onChange({ start: trim.start, end: v }, "end");
  };

  const down = (edge: "start" | "end" | "seek") => (e: React.PointerEvent) => {
    e.stopPropagation();
    drag.current = { edge };
    track.current?.setPointerCapture(e.pointerId);
    apply(edge, e.clientX);
  };

  const bars = peaks ?? [];
  return (
    <div className="ed-trim">
      <div
        ref={track}
        className="ed-trimbar"
        onPointerDown={down("seek")}
        onPointerMove={(e) => drag.current && apply(drag.current.edge, e.clientX)}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        <div className="ed-wave" aria-hidden>
          {bars.length ? (
            bars.map((p, i) => <span key={i} style={{ height: `${Math.max(4, p * 100)}%` }} />)
          ) : (
            <em>Memuat gelombang suara…</em>
          )}
        </div>
        <div className="ed-trim-sel" style={{ left: pct(trim.start), width: `calc(${pct(trim.end)} - ${pct(trim.start)})` }} />
        <div className="ed-trim-dim" style={{ left: 0, width: pct(trim.start) }} />
        <div className="ed-trim-dim" style={{ left: pct(trim.end), right: 0 }} />
        <div className="ed-playhead" style={{ left: pct(playhead) }} />
        <button
          type="button"
          className="ed-handle start"
          style={{ left: pct(trim.start) }}
          onPointerDown={down("start")}
          aria-label="Geser awal klip"
        />
        <button
          type="button"
          className="ed-handle end"
          style={{ left: pct(trim.end) }}
          onPointerDown={down("end")}
          aria-label="Geser akhir klip"
        />
      </div>
      <div className="ed-trim-axis">
        <span>{fmtPrecise(a0)}</span>
        <span>Durasi {fmtPrecise(trim.end - trim.start)}</span>
        <span>{fmtPrecise(a1)}</span>
      </div>
      <div className="ed-timefields">
        <TimeField
          label="Mulai"
          value={trim.start}
          onCommit={(v) => onChange({ start: v, end: trim.end }, "start")}
          onFromPlayhead={() => onChange({ start: playhead, end: trim.end }, "start")}
        />
        <TimeField
          label="Selesai"
          value={trim.end}
          onCommit={(v) => onChange({ start: trim.start, end: v }, "end")}
          onFromPlayhead={() => onChange({ start: trim.start, end: playhead }, "end")}
        />
      </div>
    </div>
  );
}
