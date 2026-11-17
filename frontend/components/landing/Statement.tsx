"use client";

import { motion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useRef } from "react";

const TEXT =
  "Podcast tiga jam menyimpan puluhan momen emas. Kami membantu Anda menemukannya, tanpa harus menonton ulang satu detik pun.";

function Word({ children, progress, range }: { children: string; progress: MotionValue<number>; range: [number, number] }) {
  const opacity = useTransform(progress, range, [0.16, 1]);
  return <motion.span style={{ opacity }}>{children}</motion.span>;
}

/** Teks besar yang menyala kata demi kata saat di-scroll (gaya halaman produk Apple). */
export default function Statement() {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.45"] });
  const words = TEXT.split(" ");

  return (
    <section className="statement">
      <div className="container">
        <p ref={ref}>
          {words.map((w, i) => [
            <Word key={i} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]}>
              {w}
            </Word>,
            " ",
          ])}
        </p>
      </div>
    </section>
  );
}
