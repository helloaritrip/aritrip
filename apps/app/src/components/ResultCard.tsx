"use client";

import { ShareButton } from "@aritrips/ui";
import type { PartnerLinks } from "@/lib/partnerLinks";
import { trackEvent } from "@/lib/trackEvent";
import { ORIGIN_LABELS } from "@/lib/originLabels";
import type { OriginHub } from "@aritrips/data";

export type SubScores = {
  budgetFit: number;
  activitiesMatch: number;
  seasonFit: number;
  weatherComfort: number;
  travelTime: number;
  valueRating: number;
  safety: number;
};

export type RecommendationResult = {
  destinationId: string;
  destinationAirportCode: string;
  name: string;
  country: string;
  totalEstimatedCostUSD: number;
  costBreakdown: { flightUSD: number; hotelUSD: number; activitiesUSD: number };
  finalScore: number;
  subScores: SubScores;
  reasons: string[];
  rank: number;
  imageQuery: string;
  weather: { avgTempMinC: number; avgTempMaxC: number; rainfallLevel: "low" | "medium" | "high" } | null;
  // Resueltos server-side en /api/recommendations (lee Firestore, con
  // fallback) — el componente ya no arma los links él mismo, ver
  // apps/app/src/lib/partnerLinks.ts.
  links: PartnerLinks;
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

// Mismo orden que buildReasons() en recommend.ts, para que el desglose
// "abra la caja" en el mismo orden en que ya se explican los reasons[]
// de texto — nada nuevo que aprender, solo más detalle de lo mismo.
const SUB_SCORE_ROWS: { key: keyof SubScores; label: string }[] = [
  { key: "budgetFit", label: "Budget fit" },
  { key: "activitiesMatch", label: "Matches your interests" },
  { key: "seasonFit", label: "Season fit" },
  { key: "travelTime", label: "Flight convenience" },
  { key: "valueRating", label: "Overall value" },
  { key: "weatherComfort", label: "Weather comfort" },
  { key: "safety", label: "Safety" },
];

function formatDateRange(startDate: string, endDate: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const startLabel = start.toLocaleDateString("en-US", opts);
  const endLabel = end.toLocaleDateString("en-US", { ...opts, year: "numeric" });
  return `${startLabel} – ${endLabel}`;
}

export function ResultCard({ result, tripContext }: { result: RecommendationResult; tripContext: TripContext }) {
  const links = result.links;
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

        <details className="group rounded-md border border-rule bg-bg text-xs">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-3 font-medium text-ink marker:content-none">
            <span>Why {result.finalScore}/100? See the full score breakdown</span>
            <span className="text-muted transition-transform group-open:rotate-45">+</span>
          </summary>
          <div className="flex flex-col gap-2 border-t border-rule p-3">
            {SUB_SCORE_ROWS.map(({ key, label }) => {
              const value = Math.round(result.subScores[key]);
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="w-36 shrink-0 text-muted">{label}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-rule">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${value}%` }} />
                  </div>
                  <span className="w-7 shrink-0 text-right font-medium text-ink">{value}</span>
                </div>
              );
            })}
          </div>
        </details>

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
