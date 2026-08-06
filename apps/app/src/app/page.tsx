import { SearchForm } from "@/components/SearchForm";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center gap-8 bg-bg px-6 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-sm uppercase tracking-wide text-muted">Sprint 2 — search form</p>
        <h1 className="max-w-lg text-3xl font-semibold text-ink">Where can you go with your budget?</h1>
        <p className="max-w-md text-muted">
          Tell us your budget and we&apos;ll do the rest.
        </p>
      </div>
      <SearchForm />
    </main>
  );
}
