import {
  ORIGIN_LABELS,
  ORIGIN_IMAGE_QUERY,
  destinations,
  generateAllPriceSnapshots,
  getDiscoverPicks,
  getBudgetTiers,
  getDestinationsByTag,
  DEFAULT_TRIP_DAYS,
  DEFAULT_ADULTS,
  type OriginHub,
} from "@aritrips/data";
import { cityName, hubPageSlug } from "./citySlug";

// Resumen narrativo de cierre (2026-08-16, feedback del head, puntos 11 y
// 16: la página necesita más profundidad, y las 24 hub pages necesitan
// diferenciarse de verdad entre sí) — arma 2-4 oraciones reales a partir
// de los picks por tipo de viaje que ya calcula getDestinationsByTag, no
// texto de relleno: varía en HECHOS y en estructura según qué tags
// existan y qué sea barato desde ESE origen puntual, no solo en el
// nombre de la ciudad.
function narrativeSummary(city: string, hub: string, cheapestName: string, tagPicks: ReturnType<typeof getDestinationsByTag>): string {
  const pick = (tag: string) => tagPicks.find((p) => p.tag === tag);
  // `mentioned` (no comparaciones pairwise sueltas) — con 5+ nights/2
  // adultos el mismo destino gana varios tags seguido, y no tiene sentido
  // repetir "X es la mejor opción" dos veces en 3 oraciones.
  const mentioned = new Set([cheapestName]);
  const sentences: string[] = [
    `If you're flying out of ${hub} on a tight budget, ${cheapestName} is hard to beat right now.`,
  ];

  const beach = pick("beach");
  if (beach && !mentioned.has(beach.name)) {
    sentences.push(`Want sand and surf specifically? ${beach.name} is the best-value beach trip from ${city}.`);
    mentioned.add(beach.name);
  }
  const family = pick("family");
  if (family && !mentioned.has(family.name)) {
    sentences.push(`Traveling with kids? ${family.name} tends to work best for families flying from ${hub}.`);
    mentioned.add(family.name);
  }
  const honeymoon = pick("honeymoon");
  if (honeymoon && !mentioned.has(honeymoon.name)) {
    sentences.push(`Planning something more romantic? ${honeymoon.name} is our top honeymoon pick from ${city} right now.`);
    mentioned.add(honeymoon.name);
  }
  const adventure = pick("adventure");
  if (adventure && !mentioned.has(adventure.name)) {
    sentences.push(`For something more active, ${adventure.name} is currently the best-value adventure trip from ${hub}.`);
    mentioned.add(adventure.name);
  }
  return sentences.join(" ");
}

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

  // Reusados también por la intro/resumen/FAQs de más abajo (2026-08-16)
  // — mismos datos que ya arman BudgetTierGrid/TripTypeGrid en la propia
  // página, para que el texto no diga un número distinto al que muestra
  // el bloque de arriba.
  const tiers = getBudgetTiers(hub, destinations, priceSnapshots);
  const tagPicks = getDestinationsByTag(hub, destinations, priceSnapshots);
  const cheapestTier = tiers[0];
  const cheapestOverall = cheapestTier?.destinations[0];

  // Mantra de AriTrips explícito (2026-08-16, feedback del head, punto 5:
  // "tu producto no es 'find cheap flights', es 'find trips you can
  // actually afford'") — antes la diferenciación quedaba implícita en el
  // subheading del Hero; acá se dice directo, y se adelantan las 2
  // secciones nuevas (budget/trip type) en vez de solo mencionar los 3
  // picks curados.
  const intro =
    `We compare the total cost of getting away from ${city} — not just the flight. Flight, hotel, and activity prices ` +
    `are combined to show which destinations actually fit your budget, flying out of ${hub}. Right now a trip to ` +
    `${cheapest.name} can start around $${cheapest.estimatedFromUSD.toLocaleString()} for ${DEFAULT_TRIP_DAYS} nights. ` +
    `Below: our top 3 picks, a full breakdown by budget, and our picks by trip type.`;

  const closingSummary = cheapestOverall
    ? narrativeSummary(city, hub, cheapestOverall.name, tagPicks)
    : null;

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
      // "Best destinations by trip type" (2026-08-16, feedback del head,
      // punto 11) — agrega variedad de keywords/intención de búsqueda a
      // cada hub page sin copy artificial, y ayuda a que las 24 páginas
      // dejen de ser el mismo template (qué tags "ganan" depende de
      // verdad de qué es alcanzable en plata desde ESE hub).
      {
        type: "TripTypeGrid",
        props: { id: "trip-type-1", heading: `Best destinations from ${city} by trip type`, originAirportCode: hub },
      },
      // Resumen de cierre (2026-08-16) — ver narrativeSummary arriba;
      // null solo si el catálogo no cubre ningún destino con tag desde
      // este origen, no debería pasar en la práctica pero un contenido
      // faltante no debe romper la página.
      ...(closingSummary ? [{ type: "TextBlock", props: { id: "text-2", text: closingSummary } }] : []),
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
            {
              question: "How does AriTrips calculate the trip cost?",
              answer: `Each estimate combines three real cost categories for a ${DEFAULT_TRIP_DAYS}-night trip for ${DEFAULT_ADULTS}: round-trip flights, a mid-range hotel, and a daily activities budget. We start from curated cost data for that route and season, checked periodically against real flight prices to keep it grounded — see "Are these real-time prices?" above for the caveat.`,
            },
            {
              question: "What's included in the estimated trip price?",
              answer: `Round-trip flights for ${DEFAULT_ADULTS}, a mid-range hotel for ${DEFAULT_TRIP_DAYS} nights, and a daily activities budget. It doesn't include meals beyond that activities budget, travel insurance, or airport transfers.`,
            },
            ...(cheapestOverall
              ? [
                  {
                    question: `What is the cheapest destination from ${city} right now?`,
                    answer: `Right now, ${cheapestOverall.name} is the most affordable pick from ${city} — an estimated $${cheapestOverall.estimatedTotalUSD.toLocaleString()} for ${DEFAULT_TRIP_DAYS} nights for ${DEFAULT_ADULTS}. See the full budget breakdown above for more options.`,
                  },
                ]
              : []),
            ...(cheapestTier && Number.isFinite(cheapestTier.maxUSD)
              ? [
                  {
                    question: `Where can I travel from ${city} for under $${cheapestTier.maxUSD.toLocaleString()}?`,
                    answer: `${cheapestTier.destinations.length} destination${cheapestTier.destinations.length === 1 ? "" : "s"} from ${city} come in under $${cheapestTier.maxUSD.toLocaleString()} for a ${DEFAULT_TRIP_DAYS}-night trip for ${DEFAULT_ADULTS} — see "Where can you travel from ${city} on a budget?" above for the full list.`,
                  },
                ]
              : []),
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
