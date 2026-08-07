"use client";

import { ShareButton } from "@aritrips/ui";
import { buildPartnerLinks } from "@/lib/partnerLinks";
import { trackEvent } from "@/lib/trackEvent";
import { ORIGIN_LABELS } from "@/lib/originLabels";
import type { OriginHub } from "@aritrips/data";

export type RecommendationResult = {
  destinationId: string;
  destinationAirportCode: string;
  name: string;
  country: string;
  totalEstimatedCostUSD: number;
  costBreakdown: { flightUSD: number; hotelUSD: number; activitiesUSD: number };
  finalScore: number;
  reasons: string[];
  rank: number;
  imageQuery: string;
  weather: { avgTempMinC: number; avgTempMaxC: number; rainfallLevel: "low" | "medium" | "high" } | null;
};

export type TripContext = {
  originAirportCode: string;
  startDate: string;
  endDate: string;
  adults: number;
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
  const startLabel = start.toLocaleDateString("en-US", opts);
  const endLabel = end.toLocaleDateString("en-US", { ...opts, year: "numeric" });
  return `${startLabel} – ${endLabel}`;
}

export function ResultCard({ result, tripContext }: { result: RecommendationResult; tripContext: TripContext }) {
  const links = buildPartnerLinks({
    originAirportCode: tripContext.originAirportCode,
    destinationAirportCode: result.destinationAirportCode,
    destinationName: result.name,
    startDate: tripContext.startDate,
    endDate: tripContext.endDate,
    adults: tripContext.adults,
  });
  const originLabel = ORIGIN_LABELS[tripContext.originAirportCode as OriginHub] ?? tripContext.originAirportCode;
  const [topReason, ...otherReasons] = result.reasons;
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-rule bg-surface">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element -- viene de un proxy propio, no de next/image remote patterns */}
        <img
          src={`/api/image-proxy?q=${encodeURIComponent(result.imageQuery)}&fallback=${encodeURIComponent(result.name)}`}
          alt={`${result.name}, ${result.country}`}
          className="h-48 w-full object-cover"
          loading="lazy"
        />
        <span className="absolute left-3 top-3 rounded-full bg-highlight px-3 py-1 text-xs font-semibold text-highlight-ink">
          Flight + Hotel
        </span>
        <div className="absolute right-3 top-3">
          <ShareButton title={`${result.name}, ${result.country}`} text={topReason} url={shareUrl} />
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-10">
          <p className="text-xs font-medium uppercase tracking-wide text-white/80">{result.country}</p>
          <p className="text-lg font-semibold text-white">{result.name}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">From</p>
            <p className="text-2xl font-semibold text-accent">${result.totalEstimatedCostUSD.toLocaleString()}</p>
          </div>
          <p className="text-xs text-muted">Estimated · #{result.rank} match</p>
        </div>

        {topReason && (
          <p className="flex items-start gap-1.5 text-sm text-ink">
            <span className="font-semibold text-highlight">+</span> {topReason}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>Flying from</span>
          <span className="rounded-full bg-highlight/10 px-2.5 py-1 font-medium text-highlight">{originLabel}</span>
          <span>· {formatDateRange(tripContext.startDate, tripContext.endDate)}</span>
        </div>

        {otherReasons.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm text-muted">
            {otherReasons.map((reason, i) => (
              <li key={i}>• {reason}</li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-3 gap-2 rounded-md border border-rule bg-bg p-3 text-center text-xs">
          <div>
            <p className="font-medium text-ink">${result.costBreakdown.flightUSD.toLocaleString()}</p>
            <p className="text-muted">Flights</p>
          </div>
          <div>
            <p className="font-medium text-ink">${result.costBreakdown.hotelUSD.toLocaleString()}</p>
            <p className="text-muted">Hotel</p>
          </div>
          <div>
            <p className="font-medium text-ink">${result.costBreakdown.activitiesUSD.toLocaleString()}</p>
            <p className="text-muted">Activities</p>
          </div>
        </div>

        {result.weather && (
          <div className="flex items-center gap-2 rounded-md border border-rule bg-bg p-3 text-xs text-muted">
            <span aria-hidden="true">{RAINFALL_ICON[result.weather.rainfallLevel]}</span>
            <span>
              {result.weather.avgTempMinC}°–{result.weather.avgTempMaxC}°C · {RAINFALL_LABEL[result.weather.rainfallLevel]} for
              your dates
            </span>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {(Object.keys(links) as (keyof typeof links)[]).map((category) => (
            <a
              key={category}
              href={links[category]}
              target="_blank"
              rel="noopener noreferrer sponsored"
              onClick={() => trackEvent({ name: "recommendation_clicked", destinationId: result.destinationId, category })}
              className="rounded-full border border-rule px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-accent hover:text-accent"
            >
              {CTA_LABELS[category]}
            </a>
          ))}
        </div>

        <p className="text-xs text-muted">
          Some links on this page are affiliate links. We may earn a commission at no extra cost to you.
        </p>
      </div>
    </div>
  );
}
