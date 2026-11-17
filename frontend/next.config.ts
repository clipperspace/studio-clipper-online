import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

// STATIC_EXPORT=1 → build menjadi situs statis (folder out/), dilayani langsung oleh backend FastAPI.
// Dipakai untuk instalasi di HP Android (Termux), yang tidak perlu menjalankan Next.js/Node.js.
const STATIC = process.env.STATIC_EXPORT === "1";

// Mode development: semua request /api/* diteruskan ke backend FastAPI.
const API_URL = process.env.API_URL || "http://127.0.0.1:8000";

// Alamat IP PC ini di jaringan lokal (Wi-Fi/LAN), supaya website bisa dibuka dari HP
// lewat http://<ip-pc>:3000 saat mode development. Dihitung otomatis karena IP dari router bisa berubah.
const lanIPs = Object.values(networkInterfaces())
  .flat()
  .filter((a) => a && a.family === "IPv4" && !a.internal)
  .map((a) => a!.address);

const nextConfig: NextConfig = {
  poweredByHeader: false,
  ...(STATIC
    ? {
        output: "export",
        trailingSlash: true, // /studio → studio/index.html
        images: { unoptimized: true },
      }
    : {
        allowedDevOrigins: lanIPs,
        images: { remotePatterns: [{ protocol: "https", hostname: "i.ytimg.com" }] },
        async rewrites() {
          return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
        },
      }),
};

export default nextConfig;
