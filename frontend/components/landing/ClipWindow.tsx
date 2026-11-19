"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  type Health,
  type Job,
  type VideoMeta,
  INSTALL_GUIDE,
  apiGet,
  apiPost,
  fmt,
  isYouTubeUrl,
  localStudioLink,
  parseTime,
  pollJob,
  triggerDownload,
} from "@/lib/api";
import { LogoMark } from "../Logo";

const DEMO_DURATION = 768; // 12:48, dipakai sebelum ada video
const BAR_COUNT = 64;
const HEIGHTS = [360, 480, 720, 1080] as const;
type Height = (typeof HEIGHTS)[number];
type Format = "9:16" | "1:1" | "16:9" | "mp3";
type Speed = "lite" | "flash" | "deep";

const PRESETS = [
  { label: "😂 Lucu", text: "Cari momen paling lucu, durasi 30–60 detik." },
  { label: "💡 Insight", text: "Cari insight paling tajam yang bisa langsung dipraktikkan, 45–90 detik." },
  { label: "🔥 Kontroversial", text: "Cari opini panas yang memancing debat di kolom komentar." },
  { label: "📱 TikTok", text: "Cari klip dengan hook kuat di 3 detik pertama, maksimal 60 detik." },
];

const Icon = {
  plus: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  ),
  scissors: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#FFCC00" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  ),
  spark: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
      <path d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9L12 2zm7 12l.95 2.55L22.5 17.5l-2.55.95L19 21l-.95-2.55L15.5 17.5l2.55-.95L19 14z" />
    </svg>
  ),
};

export default function ClipWindow() {
  const router = useRouter();

  const [tab, setTab] = useState<"ai" | "manual">("ai");
  const [url, setUrl] = useState("");
  const [info, setInfo] = useState<VideoMeta | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);

  const [prompt, setPrompt] = useState("");
  const [count, setCount] = useState(5);
  const [speed, setSpeed] = useState<Speed>("lite");

  const [start, setStart] = useState("01:20");
  const [end, setEnd] = useState("02:05");
  const [clips, setClips] = useState<{ s: number; e: number }[]>([]);
  const [format, setFormat] = useState<Format>("9:16");
  const [height, setHeight] = useState<Height>(1080);
  const [status, setStatus] = useState<"idle" | "proc" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const [href, setHref] = useState<string | null>(null);
  const [err, setErr] = useState("");
  // Versi online: potong & unduh dilakukan di Studio lokal milik pengguna.
  const [hosted, setHosted] = useState(false);
  useEffect(() => {
    apiGet<Health>("/api/health")
      .then((h) => setHosted(!!h.hosted))
      .catch(() => {});
  }, []);

  // Ambil info video (judul, durasi, thumbnail) begitu link valid ditempel.
  useEffect(() => {
    setInfo(null);
    if (!isYouTubeUrl(url)) return;
    let alive = true;
    const t = setTimeout(async () => {
      setInfoLoading(true);
      try {
        const meta = await apiPost<VideoMeta>("/api/info", { url });
        if (!alive) return;
        setInfo(meta);
        const top = Math.max(0, ...meta.heights);
        if (top) setHeight(([...HEIGHTS].reverse().find((h) => h <= top) ?? 360) as Height);
      } catch (e) {
        if (alive) setErr((e as Error).message);
      } finally {
        if (alive) setInfoLoading(false);
      }
    }, 500);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [url]);

  const duration = info?.duration || DEMO_DURATION;
  const cs = parseTime(start);
  const ce = parseTime(end);
  const curOk = tab === "manual" && cs !== null && ce !== null && ce > cs;

  const bars = Array.from({ length: BAR_COUNT }, (_, i) => {
    const t = ((i + 0.5) / BAR_COUNT) * duration;
    const inClip = tab === "manual" && clips.some((c) => t >= c.s && t <= c.e);
    const inCur = curOk && t >= cs! && t <= ce!;
    return {
      h: Math.round(10 + Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.37)) * 46 + (i % 5) * 2),
      c: inCur ? "#FFCC00" : inClip ? "#B13BFF" : "rgba(255,255,255,0.22)",
    };
  });
  const pct = (v: number) => Math.min(100, Math.max(0, (v / duration) * 100));
  const maxHeight = info && info.heights.length ? Math.max(...info.heights) : 1080;

  const onPrompt = (text: string) => {
    setPrompt(text);
    const m = text.match(/(\d{1,2})\s*(klip|clip|video|potongan|momen)/i);
    if (m) setCount(Math.min(10, Math.max(5, Number(m[1]))));
  };

  const runAI = () => {
    if (!isYouTubeUrl(url)) return setErr("Tempel link YouTube yang valid dulu.");
    const q = new URLSearchParams({ url: url.trim(), prompt, count: String(count), speed, auto: "1" });
    router.push(`/studio?${q.toString()}`);
  };

  const addClip = () => {
    if (!isYouTubeUrl(url)) return setErr("Tempel link YouTube yang valid dulu.");
    if (cs === null || ce === null) return setErr("Format waktu: mm:ss atau jj:mm:ss");
    if (ce <= cs) return setErr("Waktu selesai harus setelah waktu mulai.");
    if (info?.duration && ce > info.duration) return setErr(`Video hanya ${fmt(info.duration)}.`);
    setClips((c) => [...c, { s: cs, e: ce }]);
    setErr("");
    setStatus("idle");
  };

  const cut = async () => {
    if (!clips.length) return setErr("Tambah minimal satu klip dulu.");
    if (hosted) {
      const list = clips.map((c, i) => ({
        rank: i + 1,
        start: c.s,
        end: c.e,
        title: `Klip ${i + 1}`,
        category: "",
        viral_score: 0,
        reason: "",
        hook: "",
        headline: "",
      }));
      const link = localStudioLink({
        video: { id: info?.id || "", url: url.trim(), title: info?.title || "video", channel: info?.channel || "" },
        summary: "",
        model: "",
        clips: list,
        selected: list.map((c) => c.rank),
      });
      window.open(link, "_blank", "noopener");
      return;
    }
    setErr("");
    setStatus("proc");
    setProgress(0);
    setStage("Memulai…");
    try {
      const job = await apiPost<Job>("/api/clip", {
        url: url.trim(),
        title: info?.title || "video",
        clips: clips.map((c, i) => ({ start: c.s, end: c.e, title: `Klip ${i + 1}` })),
        format: format === "mp3" ? "mp3" : "mp4",
        height,
        aspect: format === "mp3" ? "16:9" : format,
      });
      const done = await pollJob(job.id, (j) => {
        setProgress(j.progress);
        setStage(j.stage);
      });
      setHref(done.download_url);
      setStatus("done");
      if (done.download_url) triggerDownload(done.download_url);
    } catch (e) {
      setStatus("idle");
      setErr((e as Error).message);
    }
  };

  const fmtLabel = format === "mp3" ? "MP3" : `${format} · ${height}p`;

  return (
    <section id="clip" className="clip-section">
      <div className="container">
        <div className="window">
          <div className="window-bar">
            <i />
            <i />
            <i />
            <span>Studio Clipper · Klip baru</span>
            <b />
          </div>

          <div className="window-body">
            {/* ------------------------------------------- kiri: preview & timeline */}
            <div className="window-left">
              <div className="preview">
                {info?.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="thumb" src={info.thumbnail} alt="" />
                ) : null}
                {infoLoading ? (
                  <span className="spinner" aria-label="Memuat info video" />
                ) : (
                  !info?.thumbnail && <LogoMark size={90} />
                )}
                <span className="tag tag-top">{info ? info.title : "Preview video"}</span>
                {tab === "manual" ? (
                  <>
                    <span className="tag tag-range">
                      {cs !== null ? fmt(cs) : "--:--"} – {ce !== null ? fmt(ce) : "--:--"}
                    </span>
                    <span className="tag tag-dur">{curOk ? `${Math.round(ce! - cs!)} detik` : "Cek timestamp"}</span>
                  </>
                ) : (
                  <span className="tag tag-range">AI memilih {count} klip</span>
                )}
              </div>

              <div className="timeline">
                <div className="timeline-head">
                  <b>Timeline</b>
                  <span>
                  {info
                    ? info.duration
                      ? `${info.channel} · ${fmt(info.duration)}`
                      : info.channel
                    : `Contoh video · ${fmt(DEMO_DURATION)}`}
                </span>
                </div>
                <div className="tl-bars" aria-hidden>
                  {bars.map((b, i) => (
                    <span key={i} style={{ height: b.h, background: b.c }} />
                  ))}
                </div>
                <div className="tl-track" aria-hidden>
                  {tab === "manual" &&
                    clips.map((c, i) => (
                      <span key={i} style={{ left: `${pct(c.s)}%`, width: `${Math.max(0.6, pct(c.e) - pct(c.s))}%` }} />
                    ))}
                  {curOk && <span className="cur" style={{ left: `${pct(cs!)}%`, width: `${Math.max(0.6, pct(ce!) - pct(cs!))}%` }} />}
                </div>
                <div className="tl-axis">
                  {[0, 1, 2, 3, 4].map((k) => (
                    <span key={k}>{fmt((duration * k) / 4)}</span>
                  ))}
                </div>
                <div className="legend">
                  <span>
                    <i style={{ background: "#FFCC00" }} />
                    Klip yang sedang diatur
                  </span>
                  <span>
                    <i style={{ background: "#B13BFF" }} />
                    Klip tersimpan
                  </span>
                </div>
              </div>
            </div>

            {/* ------------------------------------------- kanan: form */}
            <div className="window-right">
              <div className="tabs" role="tablist" aria-label="Cara membuat klip">
                <button type="button" role="tab" aria-selected={tab === "ai"} onClick={() => setTab("ai")}>
                  ✨ Cari dengan AI
                </button>
                <button type="button" role="tab" aria-selected={tab === "manual"} onClick={() => setTab("manual")}>
                  ✂️ Timestamp
                </button>
              </div>

              <label htmlFor="sc-url" className="lbl">
                Link YouTube
              </label>
              <input
                id="sc-url"
                className="f-input"
                type="url"
                inputMode="url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setErr("");
                }}
                placeholder="https://youtube.com/watch?v=..."
              />

              {tab === "ai" ? (
                <>
                  <label htmlFor="sc-prompt" className="lbl">
                    Klip seperti apa yang kamu cari?
                  </label>
                  <textarea
                    id="sc-prompt"
                    className="f-textarea"
                    value={prompt}
                    maxLength={2000}
                    onChange={(e) => onPrompt(e.target.value)}
                    placeholder="Contoh: cari 7 momen paling lucu soal bisnis, 30–60 detik"
                  />
                  <div className="chips">
                    {PRESETS.map((p) => (
                      <button key={p.label} type="button" className="chip" onClick={() => onPrompt(p.text)}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid-2">
                    <div className="stack-6">
                      <span className="lbl">Jumlah klip</span>
                      <div className="range-row">
                        <input
                          type="range"
                          min={5}
                          max={10}
                          value={count}
                          onChange={(e) => setCount(Number(e.target.value))}
                          aria-label="Jumlah klip"
                        />
                        <output>{count}</output>
                      </div>
                    </div>
                    <div className="stack-6">
                      <span className="lbl">Kecepatan AI</span>
                      <div className="tabs" role="group" aria-label="Kecepatan AI">
                        {(
                          [
                            ["lite", "⚡"],
                            ["flash", "✨"],
                            ["deep", "🧠"],
                          ] as const
                        ).map(([v, l]) => (
                          <button
                            key={v}
                            type="button"
                            aria-pressed={speed === v}
                            onClick={() => setSpeed(v)}
                            title={v === "lite" ? "Kilat" : v === "flash" ? "Seimbang" : "Mendalam"}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {err && (
                    <p role="alert" className="alert">
                      {err}
                    </p>
                  )}
                  <button type="button" className="btn btn-yellow" style={{ minHeight: 52, fontSize: 16 }} onClick={runAI}>
                    {Icon.spark} Analisa dengan AI
                  </button>
                </>
              ) : (
                <>
                  <div className="grid-2">
                    <div className="stack-6">
                      <label htmlFor="sc-start" className="lbl">
                        Mulai
                      </label>
                      <input
                        id="sc-start"
                        className="f-input time"
                        value={start}
                        onChange={(e) => {
                          setStart(e.target.value);
                          setErr("");
                        }}
                        placeholder="mm:ss"
                      />
                    </div>
                    <div className="stack-6">
                      <label htmlFor="sc-end" className="lbl">
                        Selesai
                      </label>
                      <input
                        id="sc-end"
                        className="f-input time"
                        value={end}
                        onChange={(e) => {
                          setEnd(e.target.value);
                          setErr("");
                        }}
                        placeholder="mm:ss"
                      />
                    </div>
                  </div>
                  {err && (
                    <p role="alert" className="alert">
                      {err}
                    </p>
                  )}
                  <button type="button" className="btn btn-violet" style={{ minHeight: 48 }} onClick={addClip}>
                    {Icon.plus} Tambah klip
                  </button>

                  <div className="divider" />
                  <span style={{ fontSize: 15, fontWeight: 600 }}>Klip kamu ({clips.length})</span>
                  <div className="clip-list">
                    {clips.map((c, i) => (
                      <div key={`${c.s}-${c.e}-${i}`} className="clip-row">
                        <span className="n">{i + 1}</span>
                        <span className="range">
                          {fmt(c.s)} → {fmt(c.e)}
                        </span>
                        <span className="dur">{Math.round(c.e - c.s)} dtk</span>
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Hapus klip ${i + 1}`}
                          onClick={() => {
                            setClips((cl) => cl.filter((_, j) => j !== i));
                            setStatus("idle");
                          }}
                        >
                          {Icon.x}
                        </button>
                      </div>
                    ))}
                    {clips.length === 0 && (
                      <span style={{ fontSize: 13, color: "rgba(255,255,255,.6)" }}>
                        Belum ada klip. Isi timestamp lalu tekan Tambah klip.
                      </span>
                    )}
                  </div>

                  <span className="lbl">Format</span>
                  <div className="tabs" role="group" aria-label="Format video">
                    {(["9:16", "1:1", "16:9", "mp3"] as const).map((f) => (
                      <button key={f} type="button" aria-pressed={format === f} onClick={() => setFormat(f)}>
                        {f === "mp3" ? "MP3" : f}
                      </button>
                    ))}
                  </div>
                  {format !== "mp3" && (
                    <div className="tabs" role="group" aria-label="Kualitas video">
                      {HEIGHTS.map((h) => (
                        <button
                          key={h}
                          type="button"
                          aria-pressed={height === h}
                          disabled={h > maxHeight}
                          onClick={() => setHeight(h)}
                        >
                          {h}p
                        </button>
                      ))}
                    </div>
                  )}

                  {status === "idle" && (
                    <>
                      <button type="button" className="btn btn-yellow" style={{ minHeight: 52, fontSize: 16 }} onClick={cut}>
                        {Icon.scissors} {hosted ? `Potong ${clips.length} klip di Studio lokal` : `Potong ${clips.length} klip`}
                      </button>
                      {hosted && (
                        <small className="local-note">
                          Versi online tidak mengunduh video. Jalankan Studio Clipper di perangkatmu dulu, lalu klik
                          tombol di atas.{" "}
                          <a href={INSTALL_GUIDE} target="_blank" rel="noopener noreferrer">
                            Cara pasang
                          </a>
                        </small>
                      )}
                    </>
                  )}
                  {status === "proc" && (
                    <div className="proc" aria-live="polite">
                      <span>
                        {stage} · {Math.round(progress * 100)}%
                      </span>
                      <div className="bar">
                        <div style={{ width: `${Math.max(3, progress * 100)}%` }} />
                      </div>
                    </div>
                  )}
                  {status === "done" && (
                    <div className="stack-6" style={{ gap: 10 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 600 }} aria-live="polite">
                        {Icon.check} {clips.length} klip siap · {fmtLabel}
                      </span>
                      <div className="done-row">
                        {href && (
                          <a className="btn btn-yellow" style={{ flex: 1 }} href={href}>
                            {clips.length > 1 ? "Download semua" : "Download"}
                          </a>
                        )}
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => {
                            setClips([]);
                            setStatus("idle");
                            setHref(null);
                          }}
                        >
                          Clip lagi
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
