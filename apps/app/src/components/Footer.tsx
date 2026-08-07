import Link from "next/link";
import { SkylineIllustration } from "@aritrips/ui";

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-brand-blue-mid text-white">
      <SkylineIllustration className="absolute inset-0 h-full w-full" />
      <div className="relative mx-auto flex max-w-5xl flex-col items-center gap-4 px-6 py-14 text-center">
        <p className="text-lg font-semibold">AriTrips</p>
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
          <Link href="/" className="hover:text-highlight">
            Home
          </Link>
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
