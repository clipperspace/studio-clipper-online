"use client";

import { AnimatePresence, motion } from "motion/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  type AnalyzeResult,
  type Clip,
  type Health,
  type Job,
  INSTALL_GUIDE,
  type VideoMeta,
  apiGet,
  apiPost,
  duration,
  editorLink,
  fmt,
  getUserKey,
  isYouTubeUrl,
  localStudioLink,
  pollJob,
  readImport,
  setUserKey,
  triggerDownload,
} from "@/lib/api";
import { Check, Download, Sparkle } from "../Icons";
import ClipCard from "./ClipCard";

const EASE = [0.16, 1, 0.3, 1] as const;

const PRESETS = [
  {
    label: "😂 Momen lucu",
    text: "Cari momen paling lucu dan bikin ngakak, durasi 30–60 detik.",
  },
  {
    label: "💡 Insight bisnis",
    text: "Cari insight bisnis dan finansial yang tajam dan bisa langsung dipraktikkan, durasi 45–90 detik.",
  },
  {
    label: "🔥 Kontroversial",
    text: "Cari pernyataan kontroversial atau opini panas yang memancing debat di kolom komentar.",
  },
  {
    label: "🥹 Haru & inspiratif",
    text: "Cari cerita perjuangan hidup yang emosional dan inspiratif.",
  },
  {
    label: "📱 Cocok TikTok",
    text: "Cari klip dengan hook kuat di 3 detik pertama, cocok untuk TikTok, maksimal 60 detik.",
  },
];

const STAGES = ["Membaca info video", "Mengambil transkrip", "Gemini menganalisa", "Menyusun klip"];
const HEIGHTS = [360, 480, 720, 1080] as const;
type Height = (typeof HEIGHTS)[number];
type Mode = "auto" | "transcript" | "video";

type DlState = {
  key: string;
  status: "running" | "done" | "error";
  progress: number;
  stage: string;
  error?: string;
  href?: string;
  filename?: string | null;
};

function stageIndex(stage: string): number {
  if (stage.startsWith("Gemini")) return 2;
  const i = STAGES.indexOf(stage);
  if (stage === "Selesai") return 4;
  return i < 0 ? 0 : i;
}

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T;
  options: { v: T; label: string; disabled?: boolean }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="segmented" role="group">
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

/** Kolom API key Gemini milik pengguna (versi online). Key hanya disimpan di browser ini. */
function KeyPanel({ saved, onSave }: { saved: string; onSave: (k: string) => void }) {
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(!saved);
  useEffect(() => setEditing(!saved), [saved]);

  if (!editing) {
    return (
      <div className="banner key-banner">
        <span>🔑 API key Gemini tersimpan di browser ini (…{saved.slice(-4)}).</span>
        <span className="key-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
            Ganti
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onSave("")}>
            Hapus
          </button>
        </span>
      </div>
    );
  }
  return (
    <form
      className="banner key-banner key-form"
      onSubmit={(e) => {
        e.preventDefault();
        const k = text.trim();
        if (k) {
          onSave(k);
          setText("");
        }
      }}
    >
      <div>
        <strong>🔑 Masukkan API key Gemini milikmu</strong>
        <p>
          Gratis, buat di{" "}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
            aistudio.google.com/apikey
          </a>
          . Key hanya disimpan di browser ini dan diteruskan ke Gemini setiap kali analisa, tidak disimpan di server.
        </p>
      </div>
      <div className="key-row">
        <input
          className="input"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="AIza…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="API key Gemini"
        />
        <button className="btn btn-accent" type="submit" disabled={!text.trim()}>
          Simpan
        </button>
        {saved && (
          <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
            Batal
          </button>
        )}
      </div>
    </form>
  );
}

export default function Studio() {
  const params = useSearchParams();
  const [health, setHealth] = useState<Health | "down" | null>(null);

  const [url, setUrl] = useState(params.get("url") || "");
  const [prompt, setPrompt] = useState(params.get("prompt") || "");
  const [count, setCount] = useState(() => Math.min(10, Math.max(5, Number(params.get("count")) || 5)));
  const [mode, setMode] = useState<Mode>("auto");
  const [model, setModel] = useState<"lite" | "flash" | "deep">(() => {
    const s = params.get("speed");
    return s === "flash" || s === "deep" ? s : "lite";
  });

  const [analyzing, setAnalyzing] = useState(false);
  const [stage, setStage] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const [format, setFormat] = useState<"mp4" | "mp3">("mp4");
  const [aspect, setAspect] = useState<"9:16" | "1:1" | "16:9">("9:16");
  const [height, setHeight] = useState<Height>(1080);
  const [dl, setDl] = useState<DlState | null>(null);

  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!analyzing) return;
    const t0 = Date.now();
    setElapsed(0);
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, [analyzing]);

  const resultsRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [userKey, setUserKeyState] = useState("");
  const saveKey = (k: string) => {
    setUserKey(k);
    setUserKeyState(k);
    setError("");
  };
  const hosted = !!(health && health !== "down" && health.hosted);

  useEffect(() => {
    setUserKeyState(getUserKey());
    apiGet<Health>("/api/health")
      .then(setHealth)
      .catch(() => setHealth("down"));
    return () => abortRef.current?.abort();
  }, []);

  // Hasil analisa dari versi online (#import=…): tampilkan langsung tanpa analisa ulang,
  // lalu lengkapi durasi & resolusi dari backend lokal.
  useEffect(() => {
    const load = () => {
      const data = readImport(window.location.hash);
      if (!data) return;
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      abortRef.current?.abort();
      setAnalyzing(false);
      setError("");
      setDl(null);
      const video: VideoMeta = {
        ...data.video,
        duration: 0,
        thumbnail: data.video.id ? `https://i.ytimg.com/vi/${data.video.id}/hqdefault.jpg` : null,
        chapters: [],
        heights: [],
        language: null,
      };
      setUrl(data.video.url);
      setResult({
        video,
        summary: data.summary,
        clips: data.clips,
        source: "versi online",
        model: data.model,
      });
      setClips(data.clips);
      setSelected(new Set(data.selected));
      apiPost<VideoMeta>("/api/info", { url: data.video.url })
        .then((meta) => {
          setResult((r) => (r ? { ...r, video: { ...r.video, ...meta } } : r));
          const top = Math.max(0, ...meta.heights);
          if (top) setHeight(([...HEIGHTS].reverse().find((h) => h <= top) ?? 360) as Height);
        })
        .catch(() => {
          /* info tambahan saja; klip tetap bisa diunduh */
        });
    };
    load();
    // Studio lokal yang sudah terbuka di tab yang sama: hanya bagian "#" yang berubah.
    window.addEventListener("hashchange", load);
    return () => window.removeEventListener("hashchange", load);
  }, []);

  // Sinkronkan slider jumlah klip dengan angka di prompt, mis. "cari 7 klip lucu".
  const onPrompt = (text: string) => {
    setPrompt(text);
    const m = text.match(/(\d{1,2})\s*(klip|clip|video|potongan|momen|bagian)/i);
    if (m) setCount(Math.min(10, Math.max(5, Number(m[1]))));
  };

  const maxHeight = useMemo(() => {
    const hs = result?.video.heights;
    return hs && hs.length ? Math.max(...hs) : 1080;
  }, [result]);

  const analyze = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError("");
    if (!isYouTubeUrl(url)) {
      setError("Tempel link video YouTube yang valid.");
      return;
    }
    if (hosted && !getUserKey()) {
      setError("Masukkan API key Gemini milikmu dulu (kolom di atas).");
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setAnalyzing(true);
    setResult(null);
    setClips([]);
    setSelected(new Set());
    setDl(null);
    setStage(STAGES[0]);
    setProgress(0.03);

    try {
      const job = await apiPost<Job<AnalyzeResult>>("/api/ai-analyze", {
        url,
        prompt,
        count,
        mode: hosted ? "video" : mode,
        model,
      });
      const done = await pollJob<AnalyzeResult>(
        job.id,
        (j) => {
          setStage(j.stage);
          setProgress(j.progress);
        },
        ctrl.signal,
      );
      const r = done.result!;
      setResult(r);
      setClips(r.clips);
      setSelected(new Set(r.clips.map((c) => c.rank)));
      const top = Math.max(0, ...r.video.heights);
      if (top) setHeight(([...HEIGHTS].reverse().find((h) => h <= top) ?? 360) as Height);
      setTimeout(
        () =>
          resultsRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          }),
        150,
      );
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError((err as Error).message);
    } finally {
      setAnalyzing(false);
    }
  };

  // Dari jendela Studio di landing page (?auto=1): langsung analisa sekali, lalu buang "auto" dari URL
  // supaya refresh halaman tidak memicu analisa ulang.
  // Dijadwalkan lewat setTimeout + dibatalkan saat cleanup: aman di React StrictMode (effect jalan 2x)
  // dan tidak ikut terbatalkan oleh cleanup effect lain.
  useEffect(() => {
    if (params.get("auto") !== "1" || !isYouTubeUrl(url)) return;
    const t = setTimeout(() => {
      const q = new URLSearchParams(window.location.search);
      q.delete("auto");
      window.history.replaceState(null, "", `${window.location.pathname}?${q.toString()}`);
      void analyze();
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateClip = (rank: number, start: number, end: number) =>
    setClips((cs) => cs.map((c) => (c.rank === rank ? { ...c, start, end } : c)));

  const toggle = (rank: number) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(rank)) n.delete(rank);
      else n.add(rank);
      return n;
    });

  const download = async (list: Clip[], key: string) => {
    if (!result || list.length === 0) return;
    setDl({ key, status: "running", progress: 0, stage: "Memulai…" });
    try {
      const job = await apiPost<Job>("/api/clip", {
        url: result.video.url,
        title: result.video.title,
        clips: list.map((c) => ({
          start: c.start,
          end: c.end,
          title: c.title,
        })),
        format,
        height,
        aspect: format === "mp4" ? aspect : "16:9",
      });
      const done = await pollJob(job.id, (j) => setDl((d) => (d ? { ...d, progress: j.progress, stage: j.stage } : d)));
      setDl({
        key,
        status: "done",
        progress: 1,
        stage: "Selesai",
        href: done.download_url!,
        filename: done.filename,
      });
      triggerDownload(done.download_url!);
    } catch (err) {
      setDl({
        key,
        status: "error",
        progress: 0,
        stage: "",
        error: (err as Error).message,
      });
    }
  };

  const selectedClips = clips.filter((c) => selected.has(c.rank));

  // Versi online: tautan ke Studio lokal yang membawa hasil analisa (semua klip, centang ikut).
  const localLink = (only?: Clip) =>
    result
      ? localStudioLink({
          video: {
            id: result.video.id,
            url: result.video.url,
            title: result.video.title,
            channel: result.video.channel,
          },
          summary: result.summary,
          model: result.model,
          clips,
          selected: only ? [only.rank] : [...selected],
        })
      : "#";
  const totalSec = selectedClips.reduce((a, c) => a + (c.end - c.start), 0);
  const busy = dl?.status === "running";
  const sIdx = stageIndex(stage);

  return (
    <main className="studio">
      <div className="container">
        <motion.div
          className="studio-head"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
        >
          <span className="eyebrow">
            <Sparkle size={14} /> Studio
          </span>
          <h1 className="display">
            Apa yang ingin kamu <span className="yellow">klip</span> hari ini?
          </h1>
          <p>Tempel link, tulis prompt, biarkan AI mencari momen terbaiknya.</p>
        </motion.div>

        {health === "down" && (
          <div className="banner err">
            ⚠️ Backend belum berjalan. Jalankan <code>start-backend.bat</code> lalu muat ulang halaman ini.
          </div>
        )}
        {hosted && (
          <div className="banner info">
            🌐 Ini <strong>versi online</strong>: cari klip viral langsung di sini. Untuk mengunduh klip, pakai Studio
            Clipper di perangkatmu sendiri (PC / HP Android).{" "}
            <a href={INSTALL_GUIDE} target="_blank" rel="noopener noreferrer">
              Cara pasang →
            </a>
          </div>
        )}
        {hosted && <KeyPanel saved={userKey} onSave={saveKey} />}
        {health && health !== "down" && !health.hosted && !health.gemini_configured && (
          <div className="banner">
            🔑 API key Gemini belum diatur. Buka <code>backend/.env</code>, isi <code>GEMINI_API_KEY=</code>, lalu
            restart backend. Dapatkan key gratis di aistudio.google.com/apikey
          </div>
        )}

        <motion.form
          className="panel"
          onSubmit={analyze}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.1, ease: EASE }}
        >
          <div className="field">
            <label htmlFor="url">Link video YouTube</label>
            <input
              id="url"
              className="input"
              type="url"
              inputMode="url"
              placeholder="https://www.youtube.com/watch?v=…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={analyzing}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="prompt">
              Klip seperti apa yang kamu cari? <span>Opsional</span>
            </label>
            <textarea
              id="prompt"
              className="textarea"
              placeholder="Contoh: Cari 7 momen paling lucu dan kontroversial tentang bisnis, durasi 30–60 detik, cocok untuk TikTok."
              value={prompt}
              maxLength={2000}
              onChange={(e) => onPrompt(e.target.value)}
              disabled={analyzing}
            />
            <div className="chips">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="chip"
                  onClick={() => onPrompt(p.text)}
                  disabled={analyzing}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="row-2">
            <div className="field">
              <div className="field-label">
                Jumlah klip <span>5–10</span>
              </div>
              <div className="range-wrap">
                <input
                  type="range"
                  min={5}
                  max={10}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  disabled={analyzing}
                  aria-label="Jumlah klip"
                />
                <output>{count}</output>
              </div>
            </div>
            <div className="field">
              <div className="field-label">Kecepatan AI</div>
              <Segmented
                value={model}
                onChange={setModel}
                disabled={analyzing}
                options={[
                  { v: "lite", label: "⚡ Kilat" },
                  { v: "flash", label: "✨ Seimbang" },
                  { v: "deep", label: "🧠 Mendalam" },
                ]}
              />
              <div className="hint">
                {model === "lite" && "Flash-Lite · ±5–15 detik. Cocok untuk sebagian besar video."}
                {model === "flash" && "Flash · analisa lebih tajam. Jika lambat, otomatis dibantu Flash-Lite."}
                {model === "deep" && "Flash + berpikir mendalam · paling teliti, paling lama."}
              </div>
            </div>
          </div>

          {!hosted && (
            <div className="field">
              <div className="field-label">Sumber analisa</div>
              <Segmented
                value={mode}
                onChange={setMode}
                disabled={analyzing}
                options={[
                  { v: "auto", label: "Otomatis" },
                  { v: "transcript", label: "Transkrip" },
                  { v: "video", label: "Tonton video" },
                ]}
              />
              <div className="hint">
                {mode === "auto" && "Pakai transkrip jika ada (cepat & hemat), jika tidak AI menonton videonya."}
                {mode === "transcript" && "Paling cepat dan hemat kuota. Butuh subtitle atau auto-caption."}
                {mode === "video" &&
                  "AI melihat & mendengar video. Lebih akurat untuk momen visual, tapi lebih lambat. Hanya video publik."}
              </div>
            </div>
          )}

          <div className="panel-actions">
            <button className="btn btn-accent" type="submit" disabled={analyzing || health === "down"}>
              <Sparkle /> {analyzing ? "Menganalisa…" : "Analisa dengan AI"}
            </button>
          </div>
        </motion.form>

        <AnimatePresence>
          {error && (
            <motion.div
              className="error-msg"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              role="alert"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {analyzing && (
            <motion.div
              key="loading"
              className="loading"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5, ease: EASE }}
              aria-live="polite"
            >
              <div className="stages">
                {STAGES.map((s, i) => (
                  <div key={s} className={`stage ${i < sIdx ? "done" : i === sIdx ? "active" : ""}`}>
                    <span className="stage-dot">{i < sIdx && <Check size={11} />}</span>
                    {i === 2 && i === sIdx ? stage : s}
                  </div>
                ))}
                <div className="progress">
                  <div style={{ transform: `scaleX(${Math.max(0.03, progress)})` }} />
                </div>
                <div className="hint">
                  {elapsed} detik berlalu
                  {elapsed > 60 && " · Video panjang atau server Gemini yang sibuk bisa butuh beberapa menit."}
                </div>
              </div>
              <div className="skeletons">
                {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                  <div key={i} className="skeleton" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {result && !analyzing && (
          <div className="results" ref={resultsRef} style={{ scrollMarginTop: 80 }}>
            <motion.div
              className="video-head"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE }}
            >
              {result.video.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={result.video.thumbnail} alt="" />
              )}
              <div>
                <h2>{result.video.title}</h2>
                <div className="meta-row">
                  <span>{result.video.channel}</span>
                  {result.video.duration > 0 && <span>⏱ {fmt(result.video.duration)}</span>}
                  <span>📄 {result.source}</span>
                  <span>🤖 {result.model}</span>
                </div>
                {result.summary && <p className="summary">{result.summary}</p>}
              </div>
            </motion.div>

            <div className="results-bar">
              <h3>{clips.length} klip berpotensi viral</h3>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  setSelected(selected.size === clips.length ? new Set() : new Set(clips.map((c) => c.rank)))
                }
              >
                {selected.size === clips.length ? "Batalkan semua" : "Pilih semua"}
              </button>
            </div>

            <div className="clips">
              {clips.map((c, i) => (
                <ClipCard
                  key={c.rank}
                  clip={c}
                  index={i}
                  videoId={result.video.id}
                  videoDuration={result.video.duration}
                  selected={selected.has(c.rank)}
                  busy={busy}
                  onToggle={() => toggle(c.rank)}
                  onChange={(s, e) => updateClip(c.rank, s, e)}
                  onDownload={() => download([c], `clip-${c.rank}`)}
                  downloadHref={hosted ? localLink(c) : undefined}
                  editHref={editorLink(
                    { url: result.video.url, start: c.start, end: c.end, title: c.title, hook: c.hook || c.headline },
                    hosted,
                  )}
                />
              ))}
            </div>

            <p className="legal">
              Gunakan hanya untuk konten milik Anda atau yang diizinkan pemiliknya. Hook & headline dari AI adalah
              saran. Periksa kembali sebelum memposting.
            </p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {result && !analyzing && (
          <motion.div
            className="dlbar"
            initial={{ opacity: 0, y: 40, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 40, x: "-50%" }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <div className="dlbar-count">
              {selected.size} klip dipilih
              <span>{selected.size ? `Total ${duration(totalSec)}` : "Centang klip untuk diunduh"}</span>
            </div>
            {hosted ? (
              <>
                <div className="dlbar-spacer" />
                <a className="btn btn-ghost btn-sm" href={INSTALL_GUIDE} target="_blank" rel="noopener noreferrer">
                  Belum pasang?
                </a>
                <a
                  className={`btn btn-accent ${selected.size === 0 ? "is-disabled" : ""}`}
                  href={localLink()}
                  target="_blank"
                  rel="noopener"
                  aria-disabled={selected.size === 0}
                  onClick={(e) => {
                    if (selected.size === 0) e.preventDefault();
                  }}
                >
                  <Download /> Unduh di Studio lokal
                </a>
                <div className="dlbar-progress">
                  Jalankan Studio Clipper di perangkatmu dulu (<code>start.bat</code> atau <code>studio-clipper</code>),
                  lalu klik tombol ini. Hasil analisa ikut terbawa, tanpa analisa ulang.
                </div>
              </>
            ) : (
              <>
                <Segmented
                  value={format}
                  onChange={setFormat}
                  disabled={busy}
                  options={[
                    { v: "mp4", label: "MP4" },
                    { v: "mp3", label: "MP3" },
                  ]}
                />
                {format === "mp4" && (
                  <Segmented
                    value={aspect}
                    onChange={setAspect}
                    disabled={busy}
                    options={[
                      { v: "9:16", label: "9:16" },
                      { v: "1:1", label: "1:1" },
                      { v: "16:9", label: "16:9" },
                    ]}
                  />
                )}
                {format === "mp4" && (
                  <Segmented
                    value={height}
                    onChange={setHeight}
                    disabled={busy}
                    options={HEIGHTS.map((h) => ({
                      v: h,
                      label: `${h}p`,
                      disabled: h > maxHeight,
                    }))}
                  />
                )}
                <div className="dlbar-spacer" />
                <button
                  type="button"
                  className="btn btn-accent"
                  disabled={busy || selected.size === 0}
                  onClick={() => download(selectedClips, "selected")}
                >
                  <Download />
                  {busy && dl?.key === "selected"
                    ? `${Math.round((dl?.progress ?? 0) * 100)}%`
                    : selected.size > 1
                      ? `Unduh ${selected.size} klip (ZIP)`
                      : "Unduh"}
                </button>
                {dl && (
                  <div className="dlbar-progress" aria-live="polite">
                    {dl.status === "running" && (
                      <>
                        {dl.stage} · {Math.round(dl.progress * 100)}%
                        <div className="progress">
                          <div
                            style={{
                              transform: `scaleX(${Math.max(0.03, dl.progress)})`,
                            }}
                          />
                        </div>
                      </>
                    )}
                    {dl.status === "done" && (
                      <>
                        ✅ Selesai: {dl.filename}.{" "}
                        <a href={dl.href} style={{ color: "var(--accent)", fontWeight: 600 }}>
                          Unduh lagi
                        </a>
                      </>
                    )}
                    {dl.status === "error" && <span style={{ color: "var(--accent)" }}>⚠️ {dl.error}</span>}
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
