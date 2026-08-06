"use client";

import { useEffect, useState } from "react";
import type { DiscoverSlot, OriginHub } from "@travel-package-builder/data";
import { ORIGIN_LABELS } from "@/lib/originLabels";

type DiscoverPick = {
  slot: DiscoverSlot;
  destinationId: string;
  name: string;
  country: string;
  estimatedFromUSD: number;
  imageQuery: string;
};

type DiscoverResponse = {
  originAirportCode: OriginHub;
  detectionSource: "override" | "geo" | "default";
  picks: DiscoverPick[];
};

const SLOT_LABEL: Record<DiscoverSlot, string> = {
  popular: "Popular right now",
  recommended: "Our pick",
  dream: "Dream trip",
};

export function DiscoverSection() {
  const [data, setData] = useState<DiscoverResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/discover")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  if (failed) return null; // sección de descubrimiento, no crítica — si falla, no rompe la página
  if (!data || data.picks.length === 0) return null;

  // Reordena para que "recommended" quede al centro, sin importar el orden en que llegó del API.
  const order: DiscoverSlot[] = ["popular", "recommended", "dream"];
  const bySlot = new Map(data.picks.map((p) => [p.slot, p]));
  const ordered = order.map((slot) => bySlot.get(slot)).filter((p): p is DiscoverPick => Boolean(p));

  return (
    <section className="flex w-full max-w-5xl flex-col items-center gap-4">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-ink">Trip ideas from {ORIGIN_LABELS[data.originAirportCode]}</h2>
        <p className="text-sm text-muted">
          {data.detectionSource === "geo"
            ? "Based on where you're connecting from."
            : "Showing ideas from a default origin — search above to personalize."}
        </p>
      </div>

      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
        {ordered.map((pick) => (
          <DiscoverCard key={pick.slot} pick={pick} emphasized={pick.slot === "recommended"} />
        ))}
      </div>
    </section>
  );
}

function DiscoverCard({ pick, emphasized }: { pick: DiscoverPick; emphasized: boolean }) {
  return (
    <div
      className={`flex flex-col overflow-hidden rounded-lg border bg-surface ${
        emphasized ? "border-accent shadow-md sm:-translate-y-2" : "border-rule"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- viene de un proxy propio */}
      <img
        src={`/api/image-proxy?q=${encodeURIComponent(pick.imageQuery)}`}
        alt={`${pick.name}, ${pick.country}`}
        className="h-40 w-full object-cover"
        loading="lazy"
      />
      <div className="flex flex-col gap-1 p-4">
        <p
          className={`text-xs font-medium uppercase tracking-wide ${emphasized ? "text-accent" : "text-muted"}`}
        >
          {SLOT_LABEL[pick.slot]}
        </p>
        <h3 className="font-semibold text-ink">
          {pick.name}, {pick.country}
        </h3>
        <p className="text-sm text-muted">From ${pick.estimatedFromUSD.toLocaleString()}</p>
      </div>
    </div>
  );
}
