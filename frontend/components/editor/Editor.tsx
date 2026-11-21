"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  type FontInfo,
  type WordColors,
  type Style,
  type Title,
  type Watermark,
  type WmColor,
  ASPECTS,
  BUILTIN_PRESETS,
  DEFAULT_CROP,
  HEIGHTS,
  LIMITS,
  PRESET_NAME_MAX,
  TITLE_LOOKS,
  TITLE_MAX_LINES,
  aspectRatio,
  deleteFont,
  drawTitle,
  fontFamily,
  loadBuiltins,
  loadFont,
  loadLastStyle,
  loadPresets,
  sameStyle,
  saveBuiltinNames,
  saveLastStyle,
  savePresets,
  lookMatches,
  titleWords,
  uploadFile,
  uploadFont,
} from "@/lib/editor";
import { Check, Download } from "../Icons";
import { ColorPicker, CropControls, FontPicker, PositionGrid, Section, Segmented, Slider, Switch } from "./controls";
import Preview, { type PreviewHandle, cropActive } from "./Preview";
import TrimBar from "./TrimBar";

// Fitur dari roadmap yang belum tersedia: ditampilkan supaya pengguna tahu apa yang akan datang.
const SOON = [
  ["💬", "Subtitle otomatis", "Font, ukuran, warna & highlight per kata"],
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

const WM_COLORS: { v: WmColor; label: string }[] = [
  { v: "white", label: "Putih" },
  { v: "black", label: "Hitam" },
  { v: "yellow", label: "Kuning" },
];

/** Lebar video hasil render (sama dengan out_size di backend). */
function outWidth(aspect: string, height: number) {
  const short = Math.floor(height / 2) * 2;
  const [n, d] = aspect.split(":").map(Number);
  const long = Math.floor((short * Math.max(n, d)) / Math.min(n, d) / 2) * 2;
  return n > d ? long : short;
}

const isDark = (hex: string) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) < 110;
};

/** Lebar acuan gambar teks pembuka untuk preview. */
const PREVIEW_W = 1080;

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
  const hook = (params.get("hook") || "").slice(0, 200);
  const validParams = isYouTubeUrl(url) && Number.isFinite(start) && Number.isFinite(end) && end - start >= 1;

  const [health, setHealth] = useState<Health | "down" | null>(null);
  const hosted = !!(health && health !== "down" && health.hosted);

  const [src, setSrc] = useState<EditorSource | null>(null);
  const [load, setLoad] = useState<Load>({ status: "loading", stage: "Memulai…", progress: 0 });
  const [trim, setTrim] = useState({ start, end });
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [playhead, setPlayhead] = useState(start);
  const previewRef = useRef<PreviewHandle>(null);
  const [style, setStyleState] = useState<Style>(BUILTIN_PRESETS[0].style);
  // Khusus klip ini (tidak ikut preset): posisi potong & isi teks pembuka (awalnya hook dari AI)
  const [crop, setCrop] = useState<Crop>(DEFAULT_CROP);
  const [titleText, setTitleText] = useState(hook);
  // Warna per kata (khusus klip ini) & kata yang sedang dipilih untuk diwarnai
  const [wordColors, setWordColors] = useState<WordColors>({});
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [fonts, setFonts] = useState<FontInfo[]>([]);
  // Naik setiap ada font selesai dimuat → teks pembuka digambar ulang dengan font yang benar
  const [fontsVersion, setFontsVersion] = useState(0);
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
  const setWm = (patch: Partial<Watermark>) =>
    setStyleState((s) => {
      const next = { ...s, watermark: { ...s.watermark, ...patch } };
      saveLastStyle(next);
      return next;
    });
  const setTitle = (patch: Partial<Omit<Title, "text">>) =>
    setStyleState((s) => {
      const next = { ...s, title: { ...s.title, ...patch } };
      saveLastStyle(next);
      return next;
    });

  const refreshFonts = useCallback(async () => {
    try {
      const list = await apiGet<FontInfo[]>("/api/editor/fonts");
      setFonts(list);
      // Font yang dipakai sudah tidak ada (mis. dihapus): kembali ke font bawaan
      const ids = new Set(list.map((f) => f.id));
      setStyleState((s) => {
        if (ids.has(s.title.font) && ids.has(s.watermark.font)) return s;
        const next = {
          ...s,
          title: ids.has(s.title.font) ? s.title : { ...s.title, font: "poppins-black" },
          watermark: ids.has(s.watermark.font) ? s.watermark : { ...s.watermark, font: "poppins" },
        };
        saveLastStyle(next);
        return next;
      });
      await Promise.all(list.map(loadFont));
      setFontsVersion((v) => v + 1);
    } catch {
      /* daftar font gagal dimuat: preview memakai font cadangan */
    }
  }, []);

  const onUploadFont = async (file: File) => {
    const f = await uploadFont(file);
    await refreshFonts();
    return f;
  };
  const onDeleteFont = async (id: string) => {
    await deleteFont(id);
    if (style.title.font === id) setTitle({ font: "poppins-black" });
    if (style.watermark.font === id) setWm({ font: "poppins" });
    await refreshFonts();
  };

  const prepare = useCallback(async () => {
    setLoad({ status: "loading", stage: "Memulai…", progress: 0 });
    setSrc(null);
    setPeaks(null);
    setRender({ status: "idle" });
    try {
      const job = await apiPost<Job<EditorSource>>("/api/editor/source", { url, start, end, height: 1080 });
      const done = await pollJob<EditorSource>(job.id, (j) =>
        setLoad({ status: "loading", stage: j.stage, progress: j.progress }),
      );
      const r = done.result!;
      setSrc(r);
      setTrim({ start: r.start, end: r.end });
      setPlayhead(r.start);
      apiGet<{ peaks: number[] }>(`/api/editor/source/${r.source_id}/peaks?n=300`)
        .then((d) => setPeaks(d.peaks))
        .catch(() => setPeaks([]));
    } catch (e) {
      setLoad({ status: "error", error: (e as Error).message });
    }
  }, [url, start, end]);

  useEffect(() => {
    if (!validParams || !health || health === "down" || health.hosted) return;
    void prepare();
    void refreshFonts();
  }, [validParams, health, prepare]);

  // Kualitas maksimal mengikuti sisi pendek video sumber
  const srcShort = src ? Math.min(src.width, src.height) : 1080;
  const effHeight = ([...HEIGHTS].reverse().find((h) => h <= Math.min(style.height, srcShort)) ?? 360) as Height;
  const srcRatio = src && src.width && src.height ? src.width / src.height : 16 / 9;
  const sameRatio = Math.abs(srcRatio - aspectRatio(style.aspect)) < 0.01;
  const cropping = !!src && cropActive(src, style);
  const clipLen = trim.end - trim.start;

  // Teks pembuka digambar jadi gambar (dipakai preview; saat render digambar ulang di resolusi video)
  const titleData: Title = useMemo(() => ({ ...style.title, text: titleText }), [style.title, titleText]);
  const words = useMemo(() => titleWords(titleText), [titleText]);
  const titleImg = useMemo(
    () =>
      titleData.on && titleData.text.trim() && fontsVersion >= 0 ? drawTitle(titleData, PREVIEW_W, wordColors) : null,
    [titleData, fontsVersion, wordColors],
  );

  /** Teks diubah: warna & pilihan kata yang indeksnya sudah tidak ada dibuang. */
  const changeTitleText = (v: string) => {
    setTitleText(v);
    const n = titleWords(v).length;
    setWordColors((c) => Object.fromEntries(Object.entries(c).filter(([k]) => Number(k) < n)));
    setPicked((p) => new Set([...p].filter((i) => i < n)));
  };
  const colorPicked = (color: string | null) =>
    setWordColors((c) => {
      const next = { ...c };
      for (const i of picked) {
        if (color) next[i] = color;
        else delete next[i];
      }
      return next;
    });
  const titlePreview = useMemo(
    () => (titleImg ? { src: titleImg.canvas.toDataURL("image/png"), width: titleImg.canvas.width / PREVIEW_W } : null),
    [titleImg],
  );
  const titleTooLong = !!titleImg?.tooLong;

  /** Batas klip baru: tetap di dalam potongan sumber, minimal 1 detik. */
  const changeTrim = (next: { start: number; end: number }, edge: "start" | "end") => {
    if (!src) return;
    const [a0, a1] = src.available;
    const r = (v: number) => Math.round(v * 1000) / 1000;
    let s = r(next.start);
    let e = r(next.end);
    if (edge === "start") s = Math.min(Math.max(a0, s), e - 1);
    else e = Math.max(Math.min(a1, e), s + 1);
    setTrim({ start: s, end: e });
    // Tampilkan frame di ujung yang digeser
    if (edge === "end") previewRef.current?.seek(e - 0.04);
  };

  const presets = [...builtins, ...userPresets];
  // Preset yang terakhir dipilih/disimpan diutamakan; jika gaya sudah diubah, tampil "Gaya kustom"
  const active =
    presets.find((p) => p.id === presetId && sameStyle(p.style, style)) ?? presets.find((p) => sameStyle(p.style, style));

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
    if (titleTooLong)
      return setRender({
        status: "error",
        error: `Teks pembuka maksimal ${TITLE_MAX_LINES} baris. Perkecil ukuran atau persingkat teksnya.`,
      });
    setRender({ status: "running", stage: "Memulai…", progress: 0 });
    try {
      // Teks pembuka digambar di resolusi video, lalu diunggah sebagai PNG
      let titleRecipe: Record<string, unknown> = { on: false };
      if (titleData.on && titleData.text.trim()) {
        const W = outWidth(style.aspect, effHeight);
        const img = drawTitle(titleData, W, wordColors);
        if (img) {
          setRender({ status: "running", stage: "Menyiapkan teks pembuka", progress: 0 });
          const blob = await new Promise<Blob | null>((r) => img.canvas.toBlob(r, "image/png"));
          if (!blob) throw new Error("Gagal menggambar teks pembuka.");
          const up = await uploadFile(blob, undefined, "title.png");
          titleRecipe = { on: true, image: up.id, ref_width: W, x: titleData.x, y: titleData.y, duration: titleData.duration };
        }
      }
      const job = await apiPost<Job>("/api/editor/render", {
        source_id: src.source_id,
        title: title || src.video.title,
        recipe: {
          v: 1,
          trim,
          aspect: style.aspect,
          background: style.background,
          height: effHeight,
          crop: cropping ? crop : DEFAULT_CROP,
          watermark: style.watermark,
          title: titleRecipe,
        },
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
            Belum ada klip yang dibuka. Pilih klip dari <a href="/studio/">Studio AI</a> atau{" "}
            <a href="/#clip">Timestamp</a>, lalu tekan <b>✏️ Edit</b>.
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
          {fmt(trim.start)} → {fmt(trim.end)} · {duration(clipLen)}
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
            <a href={editorLink({ url, start, end, title, hook }, true)} target="_blank" rel="noopener">
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

  const wm = style.watermark;
  const tt = style.title;

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
            <Preview
              ref={previewRef}
              src={src}
              trim={trim}
              style={style}
              crop={cropping ? crop : DEFAULT_CROP}
              titleImage={titlePreview}
              caption={title || src.video.title}
              onCrop={setCrop}
              onMoveText={(kind, x, y) => (kind === "wm" ? setWm({ x, y }) : setTitle({ x, y }))}
              onTime={setPlayhead}
            />

            <div className="ed-panel">
              {/* ------------------------------------------------ preset */}
              <Section title="Preset" desc="Simpan gaya edit favorit (format, watermark, gaya teks) untuk klip lain.">
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

              {/* ------------------------------------------------ format */}
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
                {cropping && <CropControls srcRatio={srcRatio} aspect={style.aspect} crop={crop} onChange={setCrop} />}
                <span className="lbl">Kualitas</span>
                <Segmented<Height>
                  label="Kualitas"
                  value={effHeight}
                  onChange={(v) => setStyle({ height: v })}
                  options={HEIGHTS.map((h) => ({ v: h, label: `${h}p`, disabled: h > srcShort }))}
                />
              </Section>

              {/* ------------------------------------------------ batas klip */}
              <Section
                title="Batas klip"
                desc="Seret ujung kuning, atau geser per 0,1 detik / per frame. Klik timeline untuk melihat bagian itu."
              >
                <TrimBar
                  available={src.available}
                  trim={trim}
                  peaks={peaks}
                  playhead={playhead}
                  onChange={changeTrim}
                  onSeek={(v) => previewRef.current?.seek(v)}
                />
              </Section>

              {/* ------------------------------------------------ teks pembuka */}
              <Section
                title="Teks pembuka"
                desc={`Tampil ${tt.duration} detik pertama. Nanti tampil di atas video hook jika hook dipakai.`}
                on={tt.on}
                onToggle={(v) => setTitle({ on: v })}
              >
                <label htmlFor="ed-title-text" className="lbl">
                  Teks
                </label>
                <textarea
                  id="ed-title-text"
                  className="f-textarea ed-title-input"
                  rows={3}
                  maxLength={200}
                  value={titleText}
                  placeholder="Mis. Rahasia yang jarang dibahas orang"
                  onChange={(e) => changeTitleText(e.target.value)}
                />
                <div className="hint ed-name-hint">
                  {titleTooLong ? (
                    <span role="alert" className="alert">
                      Terlalu panjang: {titleImg?.lines.length} baris (maks. {TITLE_MAX_LINES}). Perkecil ukuran atau
                      persingkat.
                    </span>
                  ) : (
                    <span>{titleImg?.lines.length ?? 0} baris · dibungkus otomatis sesuai lebar video</span>
                  )}
                </div>

                {words.length > 0 && (
                  <>
                    <div className="ed-subhead">
                      <span className="lbl">Warna per kata</span>
                      {picked.size > 0 ? (
                        <button type="button" className="ed-linkbtn" onClick={() => setPicked(new Set())}>
                          Batal pilih
                        </button>
                      ) : (
                        Object.keys(wordColors).length > 0 && (
                          <button type="button" className="ed-linkbtn" onClick={() => setWordColors({})}>
                            Hapus semua warna
                          </button>
                        )
                      )}
                    </div>
                    <div className="ed-words" role="group" aria-label="Pilih kata untuk diwarnai">
                      {words.map((wd) => (
                        <button
                          key={wd.i}
                          type="button"
                          aria-pressed={picked.has(wd.i)}
                          style={{
                            color: wordColors[wd.i] || undefined,
                            // Kata berwarna gelap diberi latar terang supaya tetap terbaca
                            background: wordColors[wd.i] && isDark(wordColors[wd.i]) ? "rgba(255,255,255,0.85)" : undefined,
                          }}
                          className={wordColors[wd.i] ? "has-color" : ""}
                          onClick={() =>
                            setPicked((p) => {
                              const n = new Set(p);
                              if (n.has(wd.i)) n.delete(wd.i);
                              else n.add(wd.i);
                              return n;
                            })
                          }
                        >
                          {wd.w}
                        </button>
                      ))}
                    </div>
                    {picked.size > 0 ? (
                      <div className="ed-crop">
                        <span className="lbl">Warna untuk {picked.size} kata terpilih</span>
                        <ColorPicker
                          label="Warna kata terpilih"
                          value={wordColors[[...picked][0]] || tt.textColor}
                          onChange={(v) => colorPicked(v)}
                        />
                        <button type="button" className="ed-linkbtn" onClick={() => colorPicked(null)}>
                          Kembalikan ke warna teks
                        </button>
                      </div>
                    ) : (
                      <div className="hint">Ketuk satu atau beberapa kata, lalu pilih warnanya.</div>
                    )}
                  </>
                )}

                <span className="lbl">Gaya cepat</span>
                <div className="ed-tstyles" role="group" aria-label="Gaya cepat teks pembuka">
                  {TITLE_LOOKS.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      aria-pressed={lookMatches(tt, l.look)}
                      onClick={() => setTitle(l.look)}
                    >
                      <span
                        className="ed-look"
                        style={{
                          fontFamily: fontFamily(tt.font),
                          color: l.look.textColor,
                          background: l.look.box ? l.look.boxColor : "transparent",
                          opacity: 1,
                          borderRadius: `${tt.radius * 0.6}em`,
                          WebkitTextStroke: l.look.outline ? `${l.look.outline * 2}em ${l.look.outlineColor}` : undefined,
                          paintOrder: "stroke fill",
                          textShadow: l.look.shadow ? "0.07em 0.07em 0 rgba(0,0,0,0.75)" : undefined,
                        }}
                      >
                        Aa
                      </span>
                      <small>{l.name}</small>
                    </button>
                  ))}
                </div>

                <span className="lbl">Font</span>
                <FontPicker
                  fonts={fonts}
                  label="Font teks pembuka"
                  value={tt.font}
                  onChange={(v) => setTitle({ font: v })}
                  onUpload={async (f) => {
                    const font = await onUploadFont(f);
                    setTitle({ font: font.id });
                  }}
                  onDelete={onDeleteFont}
                />

                <span className="lbl">Warna teks</span>
                <ColorPicker label="Warna teks" value={tt.textColor} onChange={(v) => setTitle({ textColor: v })} />

                <div className="ed-subhead">
                  <span className="lbl">Kotak</span>
                  <Switch on={tt.box} onChange={(v) => setTitle({ box: v })} label="Kotak di belakang teks" />
                </div>
                {tt.box && (
                  <>
                    <Segmented<"block" | "line">
                      label="Bentuk kotak"
                      value={tt.boxMode}
                      onChange={(v) => setTitle({ boxMode: v })}
                      options={[
                        { v: "block", label: "Satu blok" },
                        { v: "line", label: "Per baris" },
                      ]}
                    />
                    <ColorPicker label="Warna kotak" value={tt.boxColor} onChange={(v) => setTitle({ boxColor: v })} />
                    <Slider
                      label="Transparansi"
                      value={tt.boxOpacity}
                      min={0.1}
                      max={1}
                      step={0.05}
                      text={`${Math.round(tt.boxOpacity * 100)}%`}
                      onChange={(v) => setTitle({ boxOpacity: v })}
                    />
                    <Slider
                      label="Rounded"
                      value={tt.radius}
                      min={0}
                      max={1}
                      step={0.05}
                      text={tt.radius === 0 ? "Siku" : tt.radius === 1 ? "Kapsul" : `${Math.round(tt.radius * 100)}%`}
                      onChange={(v) => setTitle({ radius: v })}
                    />
                  </>
                )}

                <div className="ed-subhead">
                  <span className="lbl">Garis tepi huruf</span>
                  <Switch
                    on={tt.outline > 0}
                    onChange={(v) => setTitle({ outline: v ? 0.08 : 0 })}
                    label="Garis tepi huruf"
                  />
                </div>
                {tt.outline > 0 && (
                  <>
                    <ColorPicker
                      label="Warna garis tepi"
                      value={tt.outlineColor}
                      onChange={(v) => setTitle({ outlineColor: v })}
                    />
                    <Slider
                      label="Tebal"
                      value={tt.outline}
                      min={0.01}
                      max={LIMITS.outline[1]}
                      step={0.01}
                      text={`${Math.round(tt.outline * 100)}%`}
                      onChange={(v) => setTitle({ outline: v })}
                    />
                  </>
                )}
                <div className="ed-subhead">
                  <span className="lbl">Bayangan</span>
                  <Switch on={tt.shadow} onChange={(v) => setTitle({ shadow: v })} label="Bayangan teks" />
                </div>

                <span className="lbl">Spasi</span>
                <Slider
                  label="Jarak baris"
                  value={tt.lineHeight}
                  min={LIMITS.lineHeight[0]}
                  max={LIMITS.lineHeight[1]}
                  step={0.05}
                  text={`${tt.lineHeight.toFixed(2)}×`}
                  onChange={(v) => setTitle({ lineHeight: v })}
                />
                <Slider
                  label="Jarak huruf"
                  value={tt.letterSpacing}
                  min={LIMITS.letterSpacing[0]}
                  max={LIMITS.letterSpacing[1]}
                  step={0.01}
                  text={`${Math.round(tt.letterSpacing * 100)}`}
                  onChange={(v) => setTitle({ letterSpacing: v })}
                />

                <Slider
                  label="Ukuran"
                  value={tt.size}
                  min={0.03}
                  max={0.16}
                  step={0.005}
                  text={`${Math.round(tt.size * 1000) / 10}%`}
                  onChange={(v) => setTitle({ size: v })}
                />
                <Slider
                  label="Durasi"
                  value={tt.duration}
                  min={1}
                  max={10}
                  step={0.5}
                  text={`${tt.duration} dtk`}
                  onChange={(v) => setTitle({ duration: v })}
                />
                {tt.duration > clipLen && (
                  <div className="hint">Klip hanya {duration(clipLen)}, jadi teks tampil sepanjang klip.</div>
                )}

                <span className="lbl">Posisi</span>
                <PositionGrid
                  label="Posisi teks pembuka"
                  x={tt.x}
                  y={tt.y}
                  xs={[0.5]}
                  ys={[0.18, 0.5, 0.82]}
                  onChange={(x, y) => setTitle({ x, y })}
                />
                <div className="hint">Atau seret teks langsung di preview.</div>
              </Section>

              {/* ------------------------------------------------ watermark */}
              <Section
                title="Watermark"
                desc="Nama akunmu di atas video, ikut tersimpan di preset."
                on={wm.on}
                onToggle={(v) => setWm({ on: v })}
              >
                <label htmlFor="ed-wm-text" className="lbl">
                  Nama akun
                </label>
                <input
                  id="ed-wm-text"
                  className="f-input"
                  maxLength={60}
                  value={wm.text}
                  placeholder="@namaakun"
                  onChange={(e) => setWm({ text: e.target.value })}
                />
                {!wm.text.trim() && <div className="hint">Isi nama akun supaya watermark tampil.</div>}

                <span className="lbl">Font</span>
                <FontPicker
                  fonts={fonts}
                  label="Font watermark"
                  value={wm.font}
                  onChange={(v) => setWm({ font: v })}
                  onUpload={async (f) => {
                    const font = await onUploadFont(f);
                    setWm({ font: font.id });
                  }}
                  onDelete={onDeleteFont}
                />

                <span className="lbl">Warna</span>
                <Segmented<WmColor>
                  label="Warna watermark"
                  value={wm.color}
                  onChange={(v) => setWm({ color: v })}
                  options={WM_COLORS}
                />
                <Slider
                  label="Ukuran"
                  value={wm.size}
                  min={0.015}
                  max={0.12}
                  step={0.0025}
                  text={`${Math.round(wm.size * 1000) / 10}%`}
                  onChange={(v) => setWm({ size: v })}
                />
                <Slider
                  label="Transparansi"
                  value={wm.opacity}
                  min={0.05}
                  max={1}
                  step={0.05}
                  text={`${Math.round(wm.opacity * 100)}%`}
                  onChange={(v) => setWm({ opacity: v })}
                />

                <span className="lbl">Posisi</span>
                <PositionGrid
                  label="Posisi watermark"
                  x={wm.x}
                  y={wm.y}
                  xs={[0.05, 0.5, 0.95]}
                  ys={[0.04, 0.5, 0.96]}
                  onChange={(x, y) => setWm({ x, y })}
                />
                <div className="hint">Atau seret watermark langsung di preview.</div>
              </Section>

              {/* ------------------------------------------------ segera hadir */}
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
                    <Check size={16} /> Selesai: {render.filename}. <a href={render.href}>Unduh lagi</a>
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
