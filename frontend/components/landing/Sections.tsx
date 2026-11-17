import Link from "next/link";
import Reveal from "../Reveal";
import { Arrow } from "../Icons";
import Statement from "./Statement";

const STATS = [
  { v: "5–10", l: "klip per analisa" },
  { v: "1080p", l: "resolusi maksimal" },
  { v: "MP3", l: "ekstrak audio" },
  { v: "±1 dtk", l: "presisi potongan" },
];

const STEPS = [
  { t: "Tempel link", d: "Salin link video YouTube, misalnya podcast 2 jam, lalu tempel di Studio." },
  { t: "Tulis prompt", d: "Ceritakan klip seperti apa yang Anda cari: tema, gaya, durasi, dan jumlahnya." },
  { t: "AI memilihkan", d: "Gemini menemukan 5–10 momen paling berpotensi viral, lengkap dengan alasannya." },
  { t: "Unduh", d: "Pilih klip favorit, atur resolusi 360p–1080p atau MP3, lalu unduh." },
];

const FAQ = [
  {
    q: "Apakah Studio Clipper gratis?",
    a: "Ya. Aplikasi ini berjalan di komputer Anda sendiri. Analisa AI memakai API key Gemini milik Anda, yang memiliki kuota gratis yang cukup untuk pemakaian pribadi.",
  },
  {
    q: "Bagaimana AI tahu momen mana yang berpotensi viral?",
    a: "Gemini membaca transkrip berstempel waktu (atau menonton videonya langsung) lalu menilai setiap momen berdasarkan kekuatan hook, puncak emosi, apakah bisa dipahami tanpa konteks, dan kecocokan dengan prompt Anda.",
  },
  {
    q: "Bagaimana jika video tidak punya subtitle?",
    a: "Mode Otomatis akan beralih ke analisa video langsung oleh Gemini, sehingga AI tetap bisa mendengar dan melihat isi video. Mode ini hanya berlaku untuk video publik.",
  },
  {
    q: "Bisakah saya mengubah waktu klip yang dipilih AI?",
    a: "Bisa. Setiap kartu klip punya kolom waktu mulai dan selesai yang bisa Anda ubah, serta preview yang langsung diputar dari detik tersebut.",
  },
  {
    q: "Apakah boleh mengunduh video siapa saja?",
    a: "Gunakan hanya untuk konten milik Anda sendiri atau konten yang pemiliknya mengizinkan. Mengunduh dari YouTube dapat melanggar Ketentuan Layanan YouTube dan hak cipta kreator.",
  },
];

export function Stats() {
  return (
    <div className="container">
      <Reveal className="stats">
        {STATS.map((s) => (
          <div key={s.l}>
            <b>{s.v}</b>
            <span>{s.l}</span>
          </div>
        ))}
      </Reveal>
    </div>
  );
}

export function Steps() {
  return (
    <section className="section" id="cara-kerja">
      <div className="container">
        <Reveal className="section-head">
          <span className="eyebrow">Cara kerja</span>
          <h2>Dari video 3 jam ke klip siap posting.</h2>
          <p>Empat langkah sederhana, tanpa timeline editor yang rumit.</p>
        </Reveal>
        <div className="steps">
          {STEPS.map((s, i) => (
            <Reveal key={s.t} delay={i * 0.08} className="step">
              <div className="step-num">{i + 1}</div>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Bento() {
  return (
    <section className="section bento-wrap" id="fitur">
      <div className="container">
        <Reveal className="section-head">
          <span className="eyebrow">Fitur</span>
          <h2>Editor klip yang berpikir seperti kreator.</h2>
          <p>Semua yang Anda butuhkan untuk mengubah video panjang menjadi konten pendek.</p>
        </Reveal>

        <div className="bento">
          <Reveal className="tile tile-dark span-4">
            <span className="tile-label">AI Viral Finder</span>
            <h3>Skor viral untuk setiap momen.</h3>
            <p>Gemini menilai hook, emosi, dan konteks setiap potongan, lalu mengurutkannya dari yang paling berpotensi meledak.</p>
            <div className="tile-art ai-row">
              <div className="score-ring">
                <div>
                  <div>
                    <b>92</b>
                    <br />
                    <span>skor viral</span>
                  </div>
                </div>
              </div>
              <div className="ai-tags">
                <span>Hook kuat</span>
                <span>Puncak emosi</span>
                <span>Standalone</span>
                <span>Kontroversial</span>
                <span>Durasi ideal</span>
              </div>
            </div>
          </Reveal>

          <Reveal className="tile span-2" delay={0.08}>
            <span className="tile-label">Prompt bebas</span>
            <h3>Anda yang menentukan aturannya.</h3>
            <p>“Cari 7 momen lucu soal bisnis, 30–60 detik.”</p>
          </Reveal>

          <Reveal className="tile span-3">
            <span className="tile-label">Copywriting otomatis</span>
            <h3>Hook & headline siap pakai.</h3>
            <div className="tile-art">
              <div className="quote-card">
                <small>Hook</small>“Saya rugi 2 miliar karena satu keputusan ini…”
              </div>
              <div className="quote-card">
                <small>Headline</small>Kesalahan Fatal Pebisnis Pemula yang Jarang Dibahas
              </div>
            </div>
          </Reveal>

          <Reveal className="tile span-3" delay={0.08}>
            <span className="tile-label">Kualitas</span>
            <h3>MP4 hingga 1080p, atau MP3 saja.</h3>
            <p>H.264 + AAC, langsung kompatibel dengan TikTok, Reels, Shorts, dan WhatsApp.</p>
            <div className="tile-art res-pills">
              <span>360p</span>
              <span>480p</span>
              <span>720p</span>
              <span className="on">1080p</span>
              <span>MP3</span>
            </div>
          </Reveal>

          <Reveal className="tile span-2">
            <span className="tile-label">Presisi</span>
            <div className="tile-art" style={{ marginTop: 0, paddingTop: 18 }}>
              <div className="big-num grad-text">±1 dtk</div>
            </div>
            <p style={{ marginTop: 14 }}>Potongan tepat di detik yang Anda pilih, tidak meleset ke keyframe.</p>
          </Reveal>

          <Reveal className="tile span-4" delay={0.08}>
            <span className="tile-label">Privat</span>
            <h3>Berjalan di komputer Anda sendiri.</h3>
            <p>Tanpa akun, tanpa upload ke server pihak ketiga. File hasil dihapus otomatis setelah satu jam.</p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export function Faq() {
  return (
    <section className="section" id="faq">
      <div className="container">
        <Reveal className="section-head">
          <span className="eyebrow">FAQ</span>
          <h2>Pertanyaan umum.</h2>
        </Reveal>
        <Reveal className="faq">
          {FAQ.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

export function Cta() {
  return (
    <section className="cta">
      <div className="container">
        <Reveal>
          <h2>
            Klip viral berikutnya
            <br />
            <span className="grad-text">ada di video Anda.</span>
          </h2>
          <p>Mulai dalam hitungan detik. Gratis.</p>
          <Link href="/studio" className="btn btn-accent" style={{ height: 52, padding: "0 30px", fontSize: 17 }}>
            Buka Studio <Arrow />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <p>
          © {new Date().getFullYear()} Studio Clipper Online. Gunakan hanya untuk konten milik Anda atau yang
          diizinkan pemiliknya. Tidak berafiliasi dengan YouTube atau Google.
        </p>
        <p>Dibuat dengan yt-dlp, FFmpeg & Gemini.</p>
      </div>
    </footer>
  );
}

export { Statement };
