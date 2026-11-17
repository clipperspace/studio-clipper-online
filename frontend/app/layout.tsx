import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import Providers from "./providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-inter", display: "swap" });
const sora = Sora({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-sora", display: "swap" });

export const metadata: Metadata = {
  title: "Studio Clipper: Potong. Klip. Viral.",
  description:
    "Tempel link YouTube, biarkan AI menemukan momen viral atau tentukan timestamp sendiri, lalu unduh klip 9:16, 1:1, atau 16:9 siap upload.",
  openGraph: {
    title: "Studio Clipper",
    description: "Potong video YouTube jadi klip viral untuk TikTok, Reels, dan Shorts.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#090040",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${inter.variable} ${sora.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
