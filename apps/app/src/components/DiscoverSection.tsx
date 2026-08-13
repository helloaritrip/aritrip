"use client";

import { useEffect, useState } from "react";
import { ShareButton } from "@aritrips/ui";
import { ORIGIN_HUBS, type DiscoverSlot, type OriginHub } from "@aritrips/data";
import { ORIGIN_LABELS } from "@/lib/originLabels";
import { DestinationModal } from "./DestinationModal";

type DiscoverPick = {
  slot: DiscoverSlot;
  destinationId: string;
  name: string;
  country: string;
  estimatedFromUSD: number;
  imageQuery: string;
  imageUrl?: string | null;
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
  const [openDestinationId, setOpenDestinationId] = useState<string | null>(null);

  useEffect(() => {
    // Mismo ?origin=XXX que ya lee SearchForm (viene de los links "Find
    // your trip" de las páginas /p/best-trips-from-{city}) — sin esto,
    // "Trip ideas" ignoraba por completo de qué página venías y siempre
    // usaba geo-detección, aunque el formulario de arriba ya mostrara la
    // ciudad correcta (bug real reportado por el usuario, 2026-08-10:
    // entrar desde best-trips-from-new-york dejaba el formulario en New
    // York pero las 3 ideas seguían siendo desde el origen geo-detectado).
    const params = new URLSearchParams(window.location.search);
    const originParam = params.get("origin");
    const url =
      originParam && (ORIGIN_HUBS as readonly string[]).includes(originParam)
        ? `/api/discover?origin=${encodeURIComponent(originParam)}`
        : "/api/discover";
    fetch(url)
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
    <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-4">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-ink">Trip ideas from {ORIGIN_LABELS[data.originAirportCode]}</h2>
        <p className="text-sm text-muted">
          {data.detectionSource === "override"
            ? "Matching the city you started from."
            : data.detectionSource === "geo"
              ? "Based on where you're connecting from."
              : "Showing ideas from a default origin — search above to personalize."}
        </p>
      </div>

      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
        {ordered.map((pick) => (
          <DiscoverCard
            key={pick.slot}
            pick={pick}
            emphasized={pick.slot === "recommended"}
            onOpen={() => setOpenDestinationId(pick.destinationId)}
          />
        ))}
      </div>

      {openDestinationId && (
        <DestinationModal
          destinationId={openDestinationId}
          originAirportCode={data.originAirportCode}
          onClose={() => setOpenDestinationId(null)}
        />
      )}
    </section>
  );
}

function DiscoverCard({
  pick,
  emphasized,
  onOpen,
}: {
  pick: DiscoverPick;
  emphasized: boolean;
  onOpen: () => void;
}) {
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  return (
    // No es un <button> a propósito: adentro ya hay un <button> real
    // (ShareButton) — anidar botones es HTML inválido y rompe el click.
    // role="button" + onKeyDown le da el mismo comportamiento accesible.
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="flex cursor-pointer flex-col overflow-hidden rounded-lg border border-rule bg-surface text-left transition-shadow hover:shadow-md"
    >
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element -- viene de un proxy propio */}
        <img
          src={pick.imageUrl || `/api/image-proxy?q=${encodeURIComponent(pick.imageQuery)}&fallback=${encodeURIComponent(pick.name)}`}
          alt={`${pick.name}, ${pick.country}`}
          className="h-40 w-full object-cover"
          loading="lazy"
        />
        {/* "Our pick" es el único slot en nuestro azul de marca — el resto
            se queda en el naranja de siempre (a pedido del usuario,
            2026-08-14: la tarjeta ya no debe distinguirse por el borde, solo
            la etiqueta). */}
        <span
          className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold ${
            emphasized ? "bg-accent text-accent-ink" : "bg-highlight text-highlight-ink"
          }`}
        >
          {SLOT_LABEL[pick.slot]}
        </span>
        <div className="absolute right-3 top-3">
          <ShareButton title={`${pick.name}, ${pick.country}`} url={shareUrl} />
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-2 pt-8">
          <p className="text-xs font-medium uppercase tracking-wide text-white/80">{pick.country}</p>
          <p className="font-semibold text-white">{pick.name}</p>
        </div>
      </div>
      <div className="flex flex-col gap-1 p-4">
        <p className="text-sm text-muted">From ${pick.estimatedFromUSD.toLocaleString()}</p>
        {/* Esta tarjeta no tenía ningún disclaimer — "From $1,541" solo
            se lee como precio concreto, exactamente el riesgo de confianza
            que marcó el head de producto (2026-08-10). */}
        <p className="text-xs text-muted">Estimate — confirm at booking</p>
      </div>
    </div>
  );
}
