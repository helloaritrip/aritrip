export type RecommendationResult = {
  destinationId: string;
  name: string;
  country: string;
  totalEstimatedCostUSD: number;
  costBreakdown: { flightUSD: number; hotelUSD: number; activitiesUSD: number };
  finalScore: number;
  reasons: string[];
  rank: number;
  imageQuery: string;
};

export function ResultCard({ result }: { result: RecommendationResult }) {
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

        <p className="text-xs text-muted">
          Some links on this page are affiliate links. We may earn a commission at no extra cost to you.
        </p>
      </div>
    </div>
  );
}
