"use client";

import { MotionConfig } from "motion/react";

export default function Providers({ children }: { children: React.ReactNode }) {
  // reducedMotion="user" → animasi otomatis dimatikan jika pengguna memilih "kurangi gerakan" di OS.
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
