/**
 * Genera una página "Best trips from {City}" por cada uno de los 24 hubs
 * de origen, usando los mismos picks reales que ya calcula la sección
 * Discover del producto (getDiscoverPicks) — no copy genérico repetido:
 * cada página se arma con los 3 destinos que de verdad rinden mejor desde
 * ESE hub (popular / mejor valor / más aspiracional), con su ficha curada
 * real (insiderNotes, valueRating) vía el bloque DestinationHighlight que
 * ya existe.
 *
 * Correr con: npx tsx scripts/generate-hub-pages.ts
 *
 * Sobrescribe los JSON en src/content/pages/best-trips-from-*.json. Si
 * alguna de estas páginas se edita a mano desde el editor de Puck más
 * adelante, no volver a correr este script sobre ella sin guardar esos
 * cambios manuales antes (no hay merge, pisa el archivo entero).
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
// Imports directos a cada archivo fuente, no vía el "export *" agregado de
// packages/data/src/index.ts: tsx corriendo standalone (no a través del
// bundler de Next.js/Astro) no resuelve bien esa reexportación en cadena.
import { ORIGIN_HUBS, type OriginHub } from "../../../packages/data/src/types";
import { ORIGIN_LABELS, ORIGIN_IMAGE_QUERY } from "../../../packages/data/src/originGeo";
import { destinations } from "../../../packages/data/src/destinations";
import { generateAllPriceSnapshots } from "../../../packages/data/src/priceSnapshots";
import { getDiscoverPicks } from "../../../packages/data/src/discover";
import { cityName, hubPageSlug } from "../src/lib/citySlug";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "../src/content/pages");
const APP_URL = "https://app.aritrips.com";

const priceSnapshots = generateAllPriceSnapshots(destinations);

let written = 0;

for (const hub of ORIGIN_HUBS as readonly OriginHub[]) {
  const label = ORIGIN_LABELS[hub];
  const city = cityName(label);
  const slug = hubPageSlug(label);

  const picks = getDiscoverPicks(hub, destinations, priceSnapshots);
  if (picks.length === 0) {
    console.warn(`skip ${hub}: no picks available (catálogo no cubre este hub para 5 noches / 2 adultos)`);
    continue;
  }

  const cheapest = [...picks].sort((a, b) => a.estimatedFromUSD - b.estimatedFromUSD)[0];

  // ?origin= preselecciona el hub en el Combobox del formulario real
  // (apps/app/src/components/SearchForm.tsx) — alguien que entra desde
  // "Best trips from Atlanta" no debería tener que volver a elegir
  // Atlanta a mano.
  const appUrlWithOrigin = `${APP_URL}/?origin=${hub}`;

  const intro =
    `Flying out of ${hub}, a trip to ${cheapest.name} can start around $${cheapest.estimatedFromUSD.toLocaleString()} ` +
    `for flight, hotel, and activities together — not just the flight. Here's what actually gives ${city} travelers ` +
    `the best value right now, pulled from our own cost data, not guesses.`;

  const data = {
    root: { props: { title: `Best Trips From ${city}` } },
    content: [
      {
        type: "Hero",
        props: {
          id: "hero-1",
          heading: `Best trips from ${city} on a budget`,
          subheading: `Real flight, hotel, and activity costs for the destinations that actually fit what you have to spend — flying out of ${hub}.`,
          ctaLabel: "Find your trip",
          ctaHref: appUrlWithOrigin,
          backgroundImageQuery: ORIGIN_IMAGE_QUERY[hub],
        },
      },
      {
        type: "TextBlock",
        props: { id: "text-1", text: intro },
      },
      ...picks.map((pick, i) => ({
        type: "DestinationHighlight",
        props: { id: `dest-${i + 1}`, destinationId: pick.destinationId },
      })),
      {
        type: "FAQAccordion",
        props: {
          id: "faq-1",
          heading: "Before you book",
          items: [
            {
              question: "Are these real-time prices?",
              answer:
                "They're estimates based on our own curated cost data for this route and season, not a live quote — the real price on the partner site may be a bit higher or lower depending on exact dates.",
            },
            {
              question: `Why these destinations from ${city}?`,
              answer: `We rank destinations by how well the full package — flight, hotel, and activities — fits a real budget flying out of ${hub}, not just which flight happens to be cheapest.`,
            },
          ],
        },
      },
      {
        type: "CTABanner",
        props: {
          id: "cta-1",
          heading: "See prices for your exact dates",
          subheading: `Tell us your budget and travel dates, and we'll show you what actually fits — from ${hub}.`,
          ctaLabel: "Start planning",
          ctaHref: appUrlWithOrigin,
        },
      },
    ],
  };

  writeFileSync(path.join(OUT_DIR, `${slug}.json`), JSON.stringify(data, null, 2) + "\n", "utf-8");
  written += 1;
  console.log(`wrote ${slug}.json — ${picks.map((p) => p.name).join(", ")}`);
}

console.log(`\n${written}/${ORIGIN_HUBS.length} hub pages written to ${OUT_DIR}`);
