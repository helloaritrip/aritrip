/**
 * Corre los golden tests del Recommendation Engine Design (§6) contra el
 * catálogo real, usando el mismo motor (./recommend.ts) que expone la API
 * real — no una copia separada de la fórmula.
 *
 * Correr con: npm run verify --workspace=packages/data
 */
import { destinations } from "./destinations";
import { generateAllPriceSnapshots } from "./priceSnapshots";
import { getRecommendations, type RecommendationInput } from "./recommend";

const priceSnapshots = generateAllPriceSnapshots(destinations);

interface Scenario {
  name: string;
  input: RecommendationInput;
}

const scenarios: Scenario[] = [
  {
    name: "1. DFW $2700, 5d, 2 adultos, beach",
    input: { originAirportCode: "DFW", budgetUSD: 2700, startDate: "2026-02-10", endDate: "2026-02-15", adults: 2, children: 0, interests: ["beach"] },
  },
  {
    name: "2. JFK $5000, 7d, 2 adultos, honeymoon+foodie",
    input: { originAirportCode: "JFK", budgetUSD: 5000, startDate: "2026-02-10", endDate: "2026-02-17", adults: 2, children: 0, interests: ["honeymoon", "foodie"] },
  },
  {
    name: "3. YYZ $2200, 3d, 1 adulto, adventure",
    input: { originAirportCode: "YYZ", budgetUSD: 2200, startDate: "2026-02-10", endDate: "2026-02-13", adults: 1, children: 0, interests: ["adventure"] },
  },
  {
    name: "4. MEX $7500, 10d, 4 adultos, family (recalibrado — $4500 no era alcanzable ni con Aruba agregada)",
    input: { originAirportCode: "MEX", budgetUSD: 7500, startDate: "2026-07-10", endDate: "2026-07-20", adults: 4, children: 0, interests: ["family"] },
  },
  {
    name: "5. LAX $1200, 6d, 2 adultos, beach",
    input: { originAirportCode: "LAX", budgetUSD: 1200, startDate: "2026-02-10", endDate: "2026-02-16", adults: 2, children: 0, interests: ["beach"] },
  },
];

for (const scenario of scenarios) {
  const results = getRecommendations(scenario.input, destinations, priceSnapshots);
  console.log(`\n=== ${scenario.name} ===`);
  if (results.length === 0) {
    console.log("(sin resultados — ver Recommendation Engine Design §6 para saber si esto es esperado)");
  } else {
    console.table(
      results.map((r) => ({
        destinationId: r.destination.id,
        totalEstimatedCostUSD: Math.round(r.totalEstimatedCostUSD),
        finalScore: r.finalScore,
        topReason: r.reasons[0],
      }))
    );
  }
}
