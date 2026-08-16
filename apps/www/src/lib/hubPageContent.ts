import {
  ORIGIN_LABELS,
  ORIGIN_IMAGE_QUERY,
  destinations,
  generateAllPriceSnapshots,
  getDiscoverPicks,
  type OriginHub,
} from "@aritrips/data";
import { cityName, hubPageSlug } from "./citySlug";

/**
 * Construye el contenido Puck de una página "Best trips from {city}" —
 * compartido entre scripts/generate-hub-pages.ts (CLI, para desarrollo
 * local) y /api/admin/republish-hub-pages.ts (server-side, para
 * republicar sin necesitar credenciales de Firestore localmente — el
 * Worker desplegado ya las tiene, 2026-08-11).
 */
export function buildHubPageContent(hub: OriginHub, appUrl: string) {
  const label = ORIGIN_LABELS[hub];
  const city = cityName(label);
  const slug = hubPageSlug(label);

  const priceSnapshots = generateAllPriceSnapshots(destinations);
  const picks = getDiscoverPicks(hub, destinations, priceSnapshots);
  if (picks.length === 0) return null;

  const cheapest = [...picks].sort((a, b) => a.estimatedFromUSD - b.estimatedFromUSD)[0];
  const appUrlWithOrigin = `${appUrl}/?origin=${hub}`;

  const intro =
    `Flying out of ${hub}, a trip to ${cheapest.name} can start around $${cheapest.estimatedFromUSD.toLocaleString()} ` +
    `for flight, hotel, and activities together — not just the flight. Below: the most popular pick, our best-value ` +
    `pick, and one aspirational splurge — pulled from our own cost data, not guesses.`;

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
        // originAirportCode (2026-08-16, feedback del head: la página
        // promete "real flight, hotel, and activity costs" pero las cards
        // no mostraban ningún precio) — cada hub page ya sabe desde qué
        // aeropuerto está armada (es literalmente el parámetro de esta
        // función), así que puede pasarlo directo sin que nadie tenga que
        // elegirlo a mano por card.
        props: { id: `dest-${i + 1}`, destinationId: pick.destinationId, slot: pick.slot, originAirportCode: hub },
      })),
      // "Where can you travel from {city} on a budget?" (2026-08-16,
      // feedback del head) — responde directo la intención de búsqueda
      // detrás de "on a budget" en vez de dejarla implícita en 3 destinos
      // curados; también ayuda a que las 24 hub pages dejen de ser
      // template idéntico (el agrupamiento depende de qué es realmente
      // alcanzable en plata desde CADA hub).
      {
        type: "BudgetTierGrid",
        props: { id: "budget-1", heading: `Where can you travel from ${city} on a budget?`, originAirportCode: hub },
      },
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
              answer: `Each one plays a different role: the most popular destination travelers from ${hub} actually book, our top pick for value (full package — flight, hotel, and activities — for the money), and one aspirational splurge if you want to treat yourself. Not all three are meant to be "the best deal."`,
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

  return { slug, city, picks, data };
}
