/**
 * Corre los golden tests del Recommendation Engine Design (§6) contra el
 * catálogo real de destinations.ts + priceSnapshots generados. Implementa
 * la fórmula v0 tal como está documentada — cuando el motor real se
 * construya en Sprint 3 (Cloudflare Worker), esta lógica se traslada ahí;
 * este archivo queda como la forma más rápida de validar un cambio de
 * fórmula o de catálogo sin levantar infraestructura.
 *
 * Correr con: npm run verify --workspace=packages/data
 */
import { destinations } from "./destinations";
import { generateAllPriceSnapshots } from "./priceSnapshots";
import type { Destination, InterestTag, OriginHub, PriceSnapshot } from "./types";

const priceSnapshots = generateAllPriceSnapshots(destinations);

function budgetFit(ratio: number): number {
  if (ratio > 1.0) return 100 - (ratio - 1.0) * 400;
  if (ratio >= 0.95) return 100 - ((ratio - 0.95) / 0.05) * 10;
  return 100;
}

function seasonFit(rainfallLevel: "low" | "medium" | "high"): number {
  return { low: 100, medium: 85, high: 65 }[rainfallLevel];
}

function travelTime(durationMin: number, tripDays: number): number {
  let base: number;
  if (durationMin < 150) base = 100;
  else if (durationMin < 250) base = 90;
  else if (durationMin < 350) base = 75;
  else if (durationMin < 450) base = 55;
  else base = 35;
  if (tripDays <= 4 && durationMin > 240) base -= 20;
  return Math.max(0, base);
}

const VIBE_SCORE_BY_INTEREST: Record<InterestTag, keyof Destination | null> = {
  beach: "beachScore",
  adventure: "adventureScore",
  culture: null, // sin vibe score curado todavia (ver backlog)
  nightlife: "nightlifeScore",
  family: "familyScore",
  honeymoon: "coupleScore",
  foodie: "foodScore",
  nature: "natureScore",
};

function activitiesMatch(destination: Destination, interests: InterestTag[]): number {
  const values = interests.map((interest) => {
    const field = VIBE_SCORE_BY_INTEREST[interest];
    return field ? (destination[field] as number) : 50;
  });
  return values.reduce((a, b) => a + b, 0) / values.length;
}

interface Scenario {
  name: string;
  originAirportCode: OriginHub;
  budgetUSD: number;
  month: number;
  tripDays: number;
  adults: number;
  interests: InterestTag[];
}

function runScenario(scenario: Scenario) {
  const results: { destinationId: string; totalEstimatedCostUSD: number; finalScore: number }[] = [];

  for (const destination of destinations) {
    if (
      destination.idealTripLengthDays.min > scenario.tripDays ||
      destination.idealTripLengthDays.max < scenario.tripDays
    ) {
      continue;
    }

    const snapshot = priceSnapshots.find(
      (p: PriceSnapshot) =>
        p.destinationId === destination.id &&
        p.originAirportCode === scenario.originAirportCode &&
        p.month === scenario.month
    );
    if (!snapshot) continue;

    const rooms = Math.ceil(scenario.adults / 2);
    const totalEstimatedCostUSD =
      snapshot.avgFlightCostUSD * scenario.adults +
      snapshot.avgHotelCostPerNightUSD.mid * scenario.tripDays * rooms +
      snapshot.avgActivityCostPerDayUSD * scenario.adults * scenario.tripDays;

    const ratio = totalEstimatedCostUSD / scenario.budgetUSD;
    if (ratio > 1.05) continue;

    const season = destination.seasons.find((s) => s.months.includes(scenario.month));
    if (!season) continue;

    const finalScore =
      0.2 * budgetFit(ratio) +
      0.25 * activitiesMatch(destination, scenario.interests) +
      0.15 * seasonFit(season.rainfallLevel) +
      0.15 * travelTime(snapshot.avgFlightDurationMinutes, scenario.tripDays) +
      0.25 * destination.valueRating;

    results.push({ destinationId: destination.id, totalEstimatedCostUSD, finalScore: Math.round(finalScore * 10) / 10 });
  }

  results.sort((a, b) => b.finalScore - a.finalScore);
  console.log(`\n=== ${scenario.name} ===`);
  if (results.length === 0) {
    console.log("(sin resultados — ver Recommendation Engine Design §6 para saber si esto es esperado)");
  } else {
    console.table(results.slice(0, 5));
  }
  return results;
}

const scenarios: Scenario[] = [
  { name: "1. DFW $2700, 5d, 2 adultos, beach", originAirportCode: "DFW", budgetUSD: 2700, month: 2, tripDays: 5, adults: 2, interests: ["beach"] },
  { name: "2. JFK $5000, 7d, 2 adultos, honeymoon+foodie", originAirportCode: "JFK", budgetUSD: 5000, month: 2, tripDays: 7, adults: 2, interests: ["honeymoon", "foodie"] },
  { name: "3. YYZ $2200, 3d, 1 adulto, adventure", originAirportCode: "YYZ", budgetUSD: 2200, month: 2, tripDays: 3, adults: 1, interests: ["adventure"] },
  { name: "4. MEX $4500, 10d, 4 adultos, family", originAirportCode: "MEX", budgetUSD: 4500, month: 7, tripDays: 10, adults: 4, interests: ["family"] },
  { name: "5. LAX $1200, 6d, 2 adultos, beach", originAirportCode: "LAX", budgetUSD: 1200, month: 2, tripDays: 6, adults: 2, interests: ["beach"] },
];

for (const scenario of scenarios) runScenario(scenario);
