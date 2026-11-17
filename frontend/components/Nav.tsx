import Link from "next/link";
import { LogoMark } from "./Logo";

export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="Studio Clipper, ke beranda">
      <LogoMark size={24} />
      <span>Studio Clipper</span>
    </Link>
  );
}

export default function Nav({ studio = false }: { studio?: boolean }) {
  return (
    <header className="nav">
      <nav className="container nav-inner" aria-label="Navigasi utama">
        <Logo />
        <div className="nav-links">
          <Link href="/#cara-kerja" className="hide-sm">Cara Kerja</Link>
          <Link href="/#fitur" className="hide-sm">Fitur</Link>
          <Link href="/#format" className="hide-sm">Format</Link>
          {studio ? (
            <Link href="/#clip" className="btn btn-yellow">Clip Manual</Link>
          ) : (
            <a href="#clip" className="btn btn-yellow">Mulai Clip</a>
          )}
        </div>
      </nav>
    </header>
  );
}
