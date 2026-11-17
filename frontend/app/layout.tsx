import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Providers from "./providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "Studio Clipper Online — Temukan Momen Viral dengan AI",
  description:
    "Tempel link YouTube, tulis prompt, dan biarkan Gemini AI menemukan 5–10 klip paling berpotensi viral lengkap dengan hook & headline. Unduh MP4 360p–1080p atau MP3.",
  openGraph: {
    title: "Studio Clipper Online",
    description: "AI clip finder untuk podcast & video panjang YouTube.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfd" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={inter.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
