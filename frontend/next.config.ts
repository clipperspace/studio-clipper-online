import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

// Semua request /api/* diteruskan ke backend FastAPI.
const API_URL = process.env.API_URL || "http://127.0.0.1:8000";

// Alamat IP PC ini di jaringan lokal (Wi-Fi/LAN), supaya website bisa dibuka dari HP
// lewat http://<ip-pc>:3000 saat mode development. Dihitung otomatis karena IP dari router bisa berubah.
const lanIPs = Object.values(networkInterfaces())
  .flat()
  .filter((a) => a && a.family === "IPv4" && !a.internal)
  .map((a) => a!.address);

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: lanIPs,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "i.ytimg.com" }],
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
