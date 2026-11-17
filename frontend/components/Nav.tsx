"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Scissors } from "./Icons";

export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="Studio Clipper Online — beranda">
      <span className="logo-mark">
        <Scissors size={15} />
      </span>
      <span>
        Studio Clipper <small>Online</small>
      </span>
    </Link>
  );
}

export default function Nav({ studio = false }: { studio?: boolean }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`nav ${scrolled ? "scrolled" : ""}`}>
      <div className="container nav-inner">
        <Logo />
        <nav className="nav-links">
          {!studio && (
            <>
              <a href="#cara-kerja" className="hide-sm">Cara Kerja</a>
              <a href="#fitur" className="hide-sm">Fitur</a>
              <a href="#faq" className="hide-sm">FAQ</a>
            </>
          )}
          {studio ? (
            <Link href="/" className="btn btn-ghost btn-sm">Beranda</Link>
          ) : (
            <Link href="/studio" className="btn btn-primary btn-sm">Buka Studio</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
