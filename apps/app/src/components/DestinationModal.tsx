"use client";

import { useEffect, useState } from "react";
import type { PartnerLinks } from "@/lib/partnerLinks";
import { trackEvent } from "@/lib/trackEvent";
import { ORIGIN_LABELS } from "@/lib/originLabels";
import type { OriginHub } from "@aritrips/data";

type DestinationDetail = {
  destinationId: string;
  destinationAirportCode: string;
  name: string;
  country: string;
  imageQuery: string;
  tripDays: number;
  adults: number;
  startDate: string;
  endDate: string;
  totalEstimatedCostUSD: number;
  costBreakdown: { flightUSD: number; hotelUSD: number; activitiesUSD: number };
  weather: { avgTempMinC: number; avgTempMaxC: number; rainfallLevel: "low" | "medium" | "high" } | null;
  signatureExperiences: string[];
  insiderNotes: string;
  // Resuelto server-side en /api/destination — ver apps/app/src/lib/partnerLinks.ts.
  links: PartnerLinks;
};

const CTA_LABELS = {
  flight: "✈ Flights",
  hotel: "🏨 Hotel",
  activity: "🎟 Activities",
  insurance: "🛡 Insurance",
  esim: "📶 eSIM",
} as const;

const RAINFALL_LABEL: Record<"low" | "medium" | "high", string> = {
  low: "Low rainfall",
  medium: "Some rainfall",
  high: "Rainy season",
};

const RAINFALL_ICON: Record<"low" | "medium" | "high", string> = {
  low: "☀️",
  medium: "⛅",
  high: "🌧️",
};

function formatDateRange(startDate: string, endDate: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  return `${start.toLocaleDateString("en-US", opts)} – ${end.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
}

export function DestinationModal({
  destinationId,
  originAirportCode,
  onClose,
}: {
  destinationId: string;
  originAirportCode: OriginHub;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<DestinationDetail | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(`/api/destination?id=${encodeURIComponent(destinationId)}&origin=${encodeURIComponent(originAirportCode)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setDetail)
      .catch(() => setFailed(true));
  }, [destinationId, originAirportCode]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const links = detail?.links ?? null;
  const originLabel = ORIGIN_LABELS[originAirportCode] ?? originAirportCode;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={detail ? `${detail.name}, ${detail.country}` : "Destination details"}
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto rounded-lg bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        {failed && (
          <div className="flex flex-col gap-3 p-6 text-center">
            <p className="text-sm text-muted">Couldn&apos;t load this destination right now.</p>
            <button
              type="button"
              onClick={onClose}
              className="self-center rounded-full border border-rule px-4 py-1.5 text-sm text-ink hover:border-accent hover:text-accent"
            >
              Close
            </button>
          </div>
        )}

        {!detail && !failed && <div className="flex h-64 items-center justify-center text-sm text-muted">Loading…</div>}

        {detail && (
          <>
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- viene de un proxy propio */}
              <img
                src={`/api/image-proxy?q=${encodeURIComponent(detail.imageQuery)}&fallback=${encodeURIComponent(detail.name)}`}
                alt={`${detail.name}, ${detail.country}`}
                className="h-48 w-full object-cover"
              />
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-surface text-ink shadow-sm hover:scale-105"
              >
                ✕
              </button>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-10">
                <p className="text-xs font-medium uppercase tracking-wide text-white/80">{detail.country}</p>
                <p className="text-lg font-semibold text-white">{detail.name}</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 p-5">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted">From</p>
                  <p className="text-2xl font-semibold text-accent">${detail.totalEstimatedCostUSD.toLocaleString()}</p>
                </div>
                <p className="text-xs text-muted">Estimated</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span>Flying from</span>
                <span className="rounded-full bg-highlight/10 px-2.5 py-1 font-medium text-highlight">{originLabel}</span>
                <span>· {formatDateRange(detail.startDate, detail.endDate)} · {detail.adults} travelers</span>
              </div>

              <div className="grid grid-cols-3 gap-2 rounded-md border border-rule bg-bg p-3 text-center text-xs">
                <div>
                  <p className="font-medium text-ink">${detail.costBreakdown.flightUSD.toLocaleString()}</p>
                  <p className="text-muted">Flights</p>
                </div>
                <div>
                  <p className="font-medium text-ink">${detail.costBreakdown.hotelUSD.toLocaleString()}</p>
                  <p className="text-muted">Hotel</p>
                </div>
                <div>
                  <p className="font-medium text-ink">${detail.costBreakdown.activitiesUSD.toLocaleString()}</p>
                  <p className="text-muted">Activities</p>
                </div>
              </div>

              {detail.weather && (
                <div className="flex items-center gap-2 rounded-md border border-rule bg-bg p-3 text-xs text-muted">
                  <span aria-hidden="true">{RAINFALL_ICON[detail.weather.rainfallLevel]}</span>
                  <span>
                    {detail.weather.avgTempMinC}°–{detail.weather.avgTempMaxC}°C · {RAINFALL_LABEL[detail.weather.rainfallLevel]}{" "}
                    around these dates
                  </span>
                </div>
              )}

              {detail.signatureExperiences.length > 0 && (
                <ul className="flex flex-col gap-1 text-sm text-ink">
                  {detail.signatureExperiences.map((exp, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="font-semibold text-highlight">+</span> {exp}
                    </li>
                  ))}
                </ul>
              )}

              {detail.insiderNotes && <p className="text-sm text-muted">{detail.insiderNotes}</p>}

              {links && (
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(links) as (keyof typeof links)[]).map((category) => (
                    <a
                      key={category}
                      href={links[category]}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      onClick={() =>
                        trackEvent({ name: "recommendation_clicked", destinationId: detail.destinationId, category })
                      }
                      className="rounded-full border border-rule px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-accent hover:text-accent"
                    >
                      {CTA_LABELS[category]}
                    </a>
                  ))}
                </div>
              )}

              <p className="text-xs text-muted">
                Some links on this page are affiliate links. We may earn a commission at no extra cost to you.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
