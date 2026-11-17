import { LogoMark, Logo3D } from "../Logo";

const Check = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#FFCC00" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

const stroke = { fill: "none", stroke: "#471396", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function Hero() {
  return (
    <section id="top" className="hero">
      <div className="container">
        <div className="hero-copy sc-fade">
          <span className="hero-brand">Studio Clipper</span>
          <h1 className="display">
            Potong. Klip. <span className="yellow">Viral.</span>
          </h1>
          <p className="hero-sub">
            Tempel link YouTube, biarkan AI menemukan momen viral atau tentukan timestamp sendiri, lalu dapatkan klip
            siap upload untuk TikTok, Reels, dan Shorts.
          </p>
          <div className="hero-ctas">
            <a href="#clip" className="btn btn-yellow btn-pill btn-lg">
              Mulai Clip
            </a>
            <a href="#cara-kerja" className="link-more">
              Lihat cara kerja ›
            </a>
          </div>
        </div>
        <Logo3D />
      </div>
    </section>
  );
}

const STEPS = [
  {
    n: "01",
    t: "Tempel link",
    d: "Salin link video YouTube (podcast, livestream, atau apa saja), lalu tempel di Studio Clipper.",
    icon: (
      <svg viewBox="0 0 24 24" width="28" height="28" {...stroke} aria-hidden>
        <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
        <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
      </svg>
    ),
  },
  {
    n: "02",
    t: "AI atau timestamp",
    d: "Biarkan Gemini AI mencari 5–10 momen viral lengkap dengan hook & headline, atau isi waktu mulai dan selesai sendiri.",
    icon: (
      <svg viewBox="0 0 24 24" width="28" height="28" {...stroke} aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
  {
    n: "03",
    t: "Download & upload",
    d: "Pilih format 9:16, 1:1, atau 16:9 (360p–1080p) atau MP3. Klip langsung siap untuk TikTok, Reels, dan Shorts.",
    icon: (
      <svg viewBox="0 0 24 24" width="28" height="28" {...stroke} aria-hidden>
        <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
      </svg>
    ),
  },
];

export function Steps() {
  return (
    <section id="cara-kerja" className="light section">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Cara kerja</span>
          <h2 className="display">Tiga langkah. Itu saja.</h2>
        </div>
        <div className="steps">
          {STEPS.map((s) => (
            <div key={s.n} className="step sc-lift">
              <span className="step-num">{s.n}</span>
              {s.icon}
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const SAVED = [
  { t: "Momen lucu", r: "00:42 → 01:15", f: "9:16", bg: "#471396", a: "#FFFFFF", b: "#FFCC00", hot: true },
  { t: "Punchline", r: "05:12 → 06:01", f: "1:1", bg: "#B13BFF", a: "#090040", b: "#FFCC00" },
  { t: "Insight utama", r: "11:20 → 12:05", f: "16:9", bg: "#FFCC00", a: "#090040", b: "#471396" },
];

export function Features() {
  return (
    <section id="fitur" className="split">
      <div className="container split-inner">
        <div className="split-copy">
          <span className="eyebrow">Fitur</span>
          <h2 className="display">
            Presisi sampai <span className="yellow">detik.</span>
          </h2>
          <p>
            Biarkan AI menemukan momen terbaik, atau potong pakai timestamp. Tidak perlu tebak-tebakan geser timeline.
            Cocok buat clipper yang kerja cepat.
          </p>
          <ul className="checks">
            <li>
              <Check />
              AI Viral Finder: skor viral, hook & headline
            </li>
            <li>
              <Check />
              Banyak klip dari satu link
            </li>
            <li>
              <Check />
              Format 9:16, 1:1, dan 16:9
            </li>
            <li>
              <Check />
              Preview sebelum download
            </li>
          </ul>
        </div>
        <div className="split-art">
          <div className="sc-float">
            <div className="tilt-card">
              {SAVED.map((s) => (
                <div key={s.t} className="saved">
                  <div className="thumb" style={{ background: s.bg }}>
                    <LogoMark size={24} top={s.a} bottom={s.b} stroke={false} />
                  </div>
                  <div className="meta">
                    <b>{s.t}</b>
                    <span>{s.r}</span>
                  </div>
                  <span className={`pill ${s.hot ? "pill-yellow" : "pill-dim"}`}>{s.f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Formats() {
  const tag = <span className="pill pill-yellow" style={{ fontSize: 13, padding: "6px 10px" }}>Klip kamu di sini</span>;
  return (
    <section id="format" className="light section" style={{ paddingBottom: 140 }}>
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Format</span>
          <h2 className="display">Satu klip. Semua platform.</h2>
        </div>
        <div className="formats">
          <div className="fmt-item">
            <div className="mock mock-square sc-lift">
              <LogoMark size={60} stroke={false} />
              {tag}
            </div>
            <div className="fmt-caption">
              <b>1:1</b>
              <span>Feed Instagram</span>
            </div>
          </div>
          <div className="fmt-item">
            <div className="mock mock-phone sc-lift">
              <LogoMark size={69} stroke={false} />
              {tag}
            </div>
            <div className="fmt-caption">
              <b>9:16</b>
              <span>TikTok · Reels · Shorts</span>
            </div>
          </div>
          <div className="fmt-item">
            <div className="mock mock-wide sc-lift">
              <LogoMark size={56} stroke={false} />
              {tag}
            </div>
            <div className="fmt-caption">
              <b>16:9</b>
              <span>YouTube</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Cta() {
  return (
    <section className="cta">
      <div className="container cta-inner">
        <div className="sc-float">
          <LogoMark size={118} top="#FFFFFF" bottom="#FFCC00" />
        </div>
        <h2 className="display">Mulai clip sekarang.</h2>
        <p>Satu link YouTube, banyak klip siap upload.</p>
        <a href="#clip" className="btn btn-yellow btn-pill btn-lg">
          Tempel link YouTube
        </a>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <span>
          <LogoMark size={17} stroke={false} />© {new Date().getFullYear()} Studio Clipper
        </span>
        <p>
          Gunakan hanya untuk konten milik sendiri atau yang diizinkan pemiliknya. Tidak berafiliasi dengan YouTube atau
          Google.
        </p>
      </div>
    </footer>
  );
}
