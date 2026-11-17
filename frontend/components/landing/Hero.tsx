"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { isYouTubeUrl } from "@/lib/api";
import { Arrow, LinkIcon, Sparkle } from "../Icons";
import HeroVisual from "./HeroVisual";

const EASE = [0.16, 1, 0.3, 1] as const;
const LINE_1 = ["Temukan", "momen", "viral."];
const LINE_2 = ["Dalam", "hitungan", "detik."];

export default function Hero() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [err, setErr] = useState("");

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isYouTubeUrl(url)) {
      setErr("Tempel link video YouTube yang valid, misalnya https://youtu.be/…");
      return;
    }
    router.push(`/studio?url=${encodeURIComponent(url.trim())}`);
  };

  const word = (w: string, i: number) => [
    <motion.span
      key={w + i}
      className="word"
      initial={{ opacity: 0, y: 36, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 1, delay: 0.15 + i * 0.07, ease: EASE }}
    >
      {w}
    </motion.span>,
    " ",
  ];

  return (
    <section className="hero">
      <div className="hero-glow" />
      <div className="container">
        <motion.span
          className="eyebrow"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
        >
          <Sparkle size={14} /> Didukung Gemini AI
        </motion.span>

        <h1>
          <span className="line">{LINE_1.map((w, i) => word(w, i))}</span>
          <span className="line grad-text">{LINE_2.map((w, i) => word(w, i + LINE_1.length))}</span>
        </h1>

        <motion.p
          className="hero-sub"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.55, ease: EASE }}
        >
          Tempel link podcast atau video YouTube, ceritakan klip seperti apa yang Anda cari, dan AI akan
          memilihkan potongan terbaik lengkap dengan alasan, hook, dan headline.
        </motion.p>

        <motion.form
          onSubmit={go}
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, delay: 0.7, ease: EASE }}
        >
          <div className="paste-box">
            <LinkIcon />
            <input
              type="url"
              inputMode="url"
              placeholder="Tempel link YouTube di sini…"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setErr("");
              }}
              aria-label="Link video YouTube"
            />
            <button className="btn btn-accent" type="submit">
              Analisa <Arrow />
            </button>
          </div>
          <div className={`hero-hint ${err ? "err" : ""}`}>
            {err || "Gratis · Tanpa daftar · MP4 360p–1080p & MP3"}
          </div>
        </motion.form>

        <HeroVisual />
      </div>
    </section>
  );
}
