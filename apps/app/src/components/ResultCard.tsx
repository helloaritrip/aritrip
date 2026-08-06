"use client";

import { buildPartnerLinks } from "@/lib/partnerLinks";
import { trackEvent } from "@/lib/trackEvent";

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

export function ResultCard({ result, tripContext }: { result: RecommendationResult; tripContext: TripContext }) {
  const links = buildPartnerLinks({
    originAirportCode: tripContext.originAirportCode,
    destinationAirportCode: result.destinationAirportCode,
    destinationName: result.name,
    startDate: tripContext.startDate,
    endDate: tripContext.endDate,
    adults: tripContext.adults,
  });

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-rule bg-surface">
      {/* eslint-disable-next-line @next/next/no-img-element -- viene de un proxy propio, no de next/image remote patterns */}
      <img
        src={`/api/image-proxy?q=${encodeURIComponent(result.imageQuery)}`}
        alt={`${result.name}, ${result.country}`}
        className="h-48 w-full object-cover"
        loading="lazy"
      />

      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">#{result.rank}</p>
            <h3 className="text-lg font-semibold text-ink">
              {result.name}, {result.country}
            </h3>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-accent">${result.totalEstimatedCostUSD.toLocaleString()}</p>
            <p className="text-xs text-muted">total estimated</p>
          </div>
        </div>

        <ul className="flex flex-col gap-1 text-sm text-muted">
          {result.reasons.map((reason, i) => (
            <li key={i}>• {reason}</li>
          ))}
        </ul>

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

        <div className="flex items-center gap-2 rounded-md border border-dashed border-rule p-3 text-xs text-muted">
          <span>🌤️ Weather &amp; map — coming soon</span>
        </div>

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
