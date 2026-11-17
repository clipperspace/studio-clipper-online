"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { type Clip, duration, fmt, parseTime } from "@/lib/api";
import { Check, Download, Play } from "../Icons";

type Props = {
  clip: Clip;
  index: number;
  videoId: string;
  videoDuration: number;
  selected: boolean;
  busy: boolean;
  onToggle: () => void;
  onChange: (start: number, end: number) => void;
  onDownload: () => void;
};

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [done, setDone] = useState(false);
  if (!text) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1400);
    } catch {
      /* clipboard ditolak browser */
    }
  };
  return (
    <div className="copy-block">
      <small>{label}</small>
      <p>{text}</p>
      <button type="button" className="copy-btn" onClick={copy}>
        {done ? "Tersalin" : "Salin"}
      </button>
    </div>
  );
}

function TimeInput({ value, onCommit, label }: { value: number; onCommit: (v: number) => boolean; label: string }) {
  const [text, setText] = useState(fmt(value));
  const [bad, setBad] = useState(false);
  useEffect(() => setText(fmt(value)), [value]);

  const commit = () => {
    const v = parseTime(text);
    if (v === null || !onCommit(v)) {
      setBad(true);
      return;
    }
    setBad(false);
  };

  return (
    <input
      aria-label={label}
      className={bad ? "bad" : ""}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        setBad(false);
      }}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
    />
  );
}

export default function ClipCard({
  clip,
  index,
  videoId,
  videoDuration,
  selected,
  busy,
  onToggle,
  onChange,
  onDownload,
}: Props) {
  const [playing, setPlaying] = useState(false);
  const embed = `https://www.youtube-nocookie.com/embed/${videoId}?start=${Math.floor(clip.start)}&end=${Math.ceil(
    clip.end,
  )}&autoplay=1&rel=0&modestbranding=1`;

  return (
    <motion.article
      className={`clip ${selected ? "selected" : ""}`}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: index * 0.07, ease: [0.16, 1, 0.3, 1] }}
      layout="position"
    >
      <div className="clip-media">
        {playing ? (
          <iframe
            key={`${clip.start}-${clip.end}`}
            src={embed}
            title={clip.title}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button type="button" className="clip-play" onClick={() => setPlaying(true)} aria-label={`Putar preview ${clip.title}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`} alt="" loading="lazy" />
            <span className="play">
              <Play />
            </span>
          </button>
        )}
        {!playing && (
          <>
            <div className="clip-badges">
              <span className="badge">#{clip.rank}</span>
              <span className="badge score">🔥 {clip.viral_score}</span>
            </div>
            <span className="badge clip-time-badge">
              {fmt(clip.start)} · {duration(clip.end - clip.start)}
            </span>
          </>
        )}
      </div>

      <div className="clip-body">
        <div className="clip-title">
          <div>
            {clip.category && <div className="cat">{clip.category}</div>}
            <h4>{clip.title}</h4>
          </div>
          <button
            type="button"
            role="checkbox"
            aria-checked={selected}
            aria-label="Pilih klip ini"
            className="check"
            onClick={onToggle}
          >
            {selected && <Check />}
          </button>
        </div>

        <div className="time-edit">
          <TimeInput
            label="Waktu mulai"
            value={clip.start}
            onCommit={(v) => {
              if (v < 0 || v >= clip.end - 1) return false;
              onChange(v, clip.end);
              setPlaying(false);
              return true;
            }}
          />
          <span>→</span>
          <TimeInput
            label="Waktu selesai"
            value={clip.end}
            onCommit={(v) => {
              if (v <= clip.start + 1 || (videoDuration > 0 && v > videoDuration)) return false;
              onChange(clip.start, v);
              setPlaying(false);
              return true;
            }}
          />
          <span>{duration(clip.end - clip.start)}</span>
        </div>

        <p className="reason">
          <strong>Kenapa bisa viral: </strong>
          {clip.reason}
        </p>

        <CopyBlock label="Hook" text={clip.hook} />
        <CopyBlock label="Headline" text={clip.headline} />

        <div className="clip-foot">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onDownload} disabled={busy}>
            <Download size={15} /> Unduh klip ini
          </button>
        </div>
      </div>
    </motion.article>
  );
}
