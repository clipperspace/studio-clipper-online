"use client";

import { motion } from "motion/react";

const EASE = [0.16, 1, 0.3, 1] as const;

// Pola tinggi bar gelombang suara (statis, supaya render server & client identik).
const BARS = [
  0.4, 0.7, 0.5, 0.9, 0.6, 0.3, 0.8, 1, 0.7, 0.5, 0.4, 0.6, 0.9, 0.7, 0.5, 0.8, 0.6, 0.4, 0.7, 0.9, 1, 0.8, 0.6,
  0.5, 0.3, 0.6, 0.8, 0.7, 0.5, 0.4, 0.6, 0.9, 0.7, 0.4, 0.5, 0.8,
];
const HOT = new Set([6, 7, 8, 18, 19, 20, 21, 30, 31]);

const SEGMENTS = [
  { left: "14%", width: "11%" },
  { left: "47%", width: "14%" },
  { left: "78%", width: "9%" },
];

const CLIPS = [
  { score: 94, title: "“Saya bangkrut di usia 24…”", meta: "00:12:30 · 58 dtk · Haru" },
  { score: 88, title: "Debat panas soal AI & kerja", meta: "00:41:05 · 47 dtk · Kontroversial" },
  { score: 81, title: "Tips negosiasi gaji 3 kalimat", meta: "01:07:44 · 39 dtk · Insight" },
];

export default function HeroVisual() {
  return (
    <motion.div
      className="hv"
      initial={{ opacity: 0, y: 60, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 1.3, delay: 0.85, ease: EASE }}
      aria-hidden
    >
      <div className="hv-bar">
        <i />
        <i />
        <i />
        <span>studio-clipper.online/studio</span>
      </div>
      <div className="hv-body">
        <div>
          <div className="hv-player">
            <span className="hv-live">AI menganalisa</span>
            <div className="hv-wave">
              {BARS.map((h, i) => (
                <b
                  key={i}
                  className={HOT.has(i) ? "hot" : ""}
                  style={{ height: `${h * 100}%`, animationDelay: `${(i % 7) * 0.12}s` }}
                />
              ))}
            </div>
          </div>
          <div className="hv-timeline">
            {SEGMENTS.map((s, i) => (
              <motion.div
                key={i}
                className="hv-seg"
                style={{ left: s.left, width: s.width }}
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ duration: 0.8, delay: 1.6 + i * 0.25, ease: EASE }}
              />
            ))}
            <div className="hv-playhead" />
          </div>
        </div>
        <div className="hv-clips">
          {CLIPS.map((c, i) => (
            <motion.div
              key={c.title}
              className="hv-clip"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 1.7 + i * 0.18, ease: EASE }}
            >
              <div className="hv-score">{c.score}</div>
              <div>
                <strong>{c.title}</strong>
                <span>{c.meta}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
