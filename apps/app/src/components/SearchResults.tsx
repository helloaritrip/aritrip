"use client";

import { destinations } from "@aritrips/data";
import { ResultCard } from "./ResultCard";
import { useSearch } from "./SearchContext";

// Vive fuera de la franja de foto del hero a propósito — ver SearchContext.tsx.
export function SearchResults() {
  const { status, results, tripContext, searchId } = useSearch();

  if (status !== "done") return null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-6 pb-4">
      {results.length === 0 && (
        <div className="rounded-lg border border-rule bg-surface p-5 text-sm text-muted">
          No destinations fit that budget for those dates yet — our catalog is still growing (
          {destinations.length} destinations so far). Try a higher budget or different dates.
        </div>
      )}

      {results.length > 0 &&
        tripContext &&
        results.map((r) => <ResultCard key={r.destinationId} result={r} tripContext={tripContext} searchId={searchId} />)}
    </div>
  );
}
