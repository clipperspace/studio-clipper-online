"use client";

// Pratinjau "seperti sudah diunggah": tombol & keterangan yang biasanya menutupi video di aplikasi
// video pendek. Ikon digambar sendiri (bukan logo/aset resmi) dan TIDAK ikut dirender.

export type Platform = "none" | "tiktok" | "reels";

const I = {
  heart: (
    <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.1 4.3 2.4h2c.7-1.3 2.2-2.4 4.3-2.4 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z" />
  ),
  chat: <path d="M12 3C6.5 3 2 6.9 2 11.6c0 2.6 1.4 4.9 3.6 6.5L5 21.5l4-2.1c.9.2 1.9.3 3 .3 5.5 0 10-3.9 10-8.6S17.5 3 12 3z" />,
  bookmark: <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z" />,
  share: <path d="M14 4l8 7.5-8 7.5v-4.6c-5.3 0-8.8 1.6-11.5 5.1 1-5.3 4.2-10.1 11.5-11.1V4z" />,
  plane: <path d="M22 3L2 10.5l7 2.8L19 6l-8.4 8.6V21l3.7-4.6 4.8 3.6L22 3z" />,
  camera: (
    <path d="M9 4h6l1.5 2H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.5L9 4zm3 4.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z" />
  ),
  dots: <path d="M5 10.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm7 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm7 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z" />,
  note: <path d="M9 18.5a3 3 0 1 1-2-2.8V5l12-2v12.5a3 3 0 1 1-2-2.8V7.2L9 8.6v9.9z" />,
  search: <path d="M10.5 3a7.5 7.5 0 0 1 6 12l4.3 4.3-1.4 1.4-4.3-4.3A7.5 7.5 0 1 1 10.5 3zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z" />,
};

const Icon = ({ d }: { d: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" aria-hidden>
    {d}
  </svg>
);

function Action({ icon, label }: { icon: React.ReactNode; label?: string }) {
  return (
    <div className="pf-action">
      <Icon d={icon} />
      {label && <span>{label}</span>}
    </div>
  );
}

export default function PlatformOverlay({
  platform,
  account,
  caption,
  unit,
}: {
  platform: Platform;
  account: string;
  caption: string;
  /** Satuan ukuran (CSS) = 1% lebar layar HP 9:16 di dalam preview. */
  unit: string;
}) {
  if (platform === "none") return null;
  const name = (account.trim() || "@akunmu").replace(/^@?/, "@");
  const short = name.slice(1);
  return (
    <div className={`pf pf-${platform}`} style={{ ["--u" as string]: unit }} aria-hidden>
      <div className="pf-shade-top" />
      <div className="pf-shade" />
      {platform === "tiktok" ? (
        <>
          <div className="pf-top">
            <span className="pf-live">LIVE</span>
            <span className="pf-tab">Mengikuti</span>
            <span className="pf-tab is-on">Untuk Anda</span>
            <Icon d={I.search} />
          </div>
          <div className="pf-side">
            <div className="pf-avatar">
              <b>+</b>
            </div>
            <Action icon={I.heart} label="12,3 rb" />
            <Action icon={I.chat} label="248" />
            <Action icon={I.bookmark} label="1.024" />
            <Action icon={I.share} label="512" />
            <div className="pf-disc" />
          </div>
          <div className="pf-bottom">
            <b>{name}</b>
            <p>{caption || "Keterangan videomu di sini"} #fyp #viral</p>
            <span className="pf-music">
              <Icon d={I.note} /> suara asli - {short}
            </span>
          </div>
        </>
      ) : (
        <>
          <div className="pf-top pf-top-reels">
            <b>Reels</b>
            <Icon d={I.camera} />
          </div>
          <div className="pf-side">
            <Action icon={I.heart} label="12,3 rb" />
            <Action icon={I.chat} label="248" />
            <Action icon={I.plane} label="512" />
            <Action icon={I.dots} />
            <div className="pf-audio" />
          </div>
          <div className="pf-bottom">
            <div className="pf-user">
              <span className="pf-avatar-sm" />
              <b>{short}</b>
              <span className="pf-follow">Ikuti</span>
            </div>
            <p>{caption || "Keterangan videomu di sini"}</p>
            <span className="pf-music">
              <Icon d={I.note} /> {short} · Audio asli
            </span>
          </div>
        </>
      )}
    </div>
  );
}
