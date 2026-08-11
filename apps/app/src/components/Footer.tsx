import Link from "next/link";

// Mismo set de links que el footer de aritrips.com (apps/www/src/components/Footer.astro)
// — antes tenían distinto contenido y "Home" acá mandaba a "/" (la propia
// herramienta de búsqueda) en vez del sitio de marca (2026-08-11).
const MARKETING_URL = "https://aritrips.com";

export function Footer() {
  return (
    <footer className="bg-[#004bc4] text-white">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-6 py-14 text-center">
        <p className="text-lg font-semibold">AriTrips</p>
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
          <a href={MARKETING_URL} className="hover:text-highlight">
            Home
          </a>
          <a href={`${MARKETING_URL}/blog`} className="hover:text-highlight">
            Blog
          </a>
          <a href={`${MARKETING_URL}/p/about`} className="hover:text-highlight">
            About
          </a>
          <Link href="/privacy" className="hover:text-highlight">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-highlight">
            Terms
          </Link>
        </nav>
        <p className="max-w-md text-xs text-white/70">
          Some links on this site are affiliate links. We may earn a commission at no extra cost to
          you.
        </p>
      </div>
    </footer>
  );
}
