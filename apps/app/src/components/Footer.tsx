import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-rule px-6 py-6 text-xs text-muted">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 text-center sm:flex-row sm:justify-between sm:text-left">
        <p>
          Some links on this site are affiliate links. We may earn a commission at no extra cost to
          you.
        </p>
        <div className="flex gap-4">
          <Link href="/privacy" className="hover:text-ink">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-ink">
            Terms
          </Link>
        </div>
      </div>
    </footer>
  );
}
