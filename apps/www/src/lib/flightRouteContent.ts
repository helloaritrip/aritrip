import {
  destinations,
  originBaseCosts,
  destinationBaseStayCosts,
  generatePriceSnapshotsForDestination,
  estimateTripTotalUSD,
  getFlightClassPrices,
  defaultMonth,
  ORIGIN_LABELS,
  ORIGIN_IMAGE_QUERY,
  type Destination,
  type OriginHub,
} from "@aritrips/data";
import type { Data } from "@measured/puck";
import type { Props } from "../puck/config";

const APP_URL = "https://app.aritrips.com";

/**
 * Fase 1 del cluster "Origen → Destino" (2026-08-19, plan de SEO acordado
 * con el usuario tras revisar la propuesta del head) — 5 orígenes reales
 * (por tráfico real medido con ?mode=top-routes en price-sync, excluyendo
 * PTY: es casi con certeza tráfico de prueba del propio fundador, no
 * visitantes reales) × 5 destinos de playa/ocio clásicos del catálogo.
 * Deliberadamente chico — no las ~30 combinaciones que sugería el head de
 * entrada, para no publicar antes de tener señal real de qué páginas
 * funcionan (ver Search Console, chequeo pendiente ~2026-08-30).
 */
const PHASE_1_ORIGINS: OriginHub[] = ["DFW", "MIA", "ATL", "JFK", "LAX"];
const PHASE_1_DESTINATIONS = ["cancun", "aruba", "punta-cana", "cabo-san-lucas", "puerto-vallarta"];

export interface FlightRoutePair {
  originCode: OriginHub;
  destinationId: string;
}

export const FLIGHT_ROUTE_PAIRS: FlightRoutePair[] = PHASE_1_ORIGINS.flatMap((originCode) =>
  PHASE_1_DESTINATIONS.map((destinationId) => ({ originCode, destinationId }))
);

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function originCitySlug(originCode: OriginHub): string {
  const label = ORIGIN_LABELS[originCode] ?? originCode;
  return slugify(label.replace(/\s*\([A-Z]{3}\)$/, ""));
}

export function flightRouteSlug(originCode: OriginHub, destinationId: string): string {
  return `${originCitySlug(originCode)}-to-${destinationId}`;
}

const SLUG_TO_PAIR = new Map<string, FlightRoutePair>(FLIGHT_ROUTE_PAIRS.map((p) => [flightRouteSlug(p.originCode, p.destinationId), p]));

export function parseFlightRouteSlug(slug: string): FlightRoutePair | null {
  return SLUG_TO_PAIR.get(slug) ?? null;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatMonthRanges(months: number[]): string {
  const sorted = [...months].sort((a, b) => a - b);
  const ranges: [number, number][] = [];
  for (const m of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && m === last[1] + 1) last[1] = m;
    else ranges.push([m, m]);
  }
  return ranges
    .map(([start, end]) => (start === end ? MONTH_NAMES[start - 1] : `${MONTH_NAMES[start - 1]}–${MONTH_NAMES[end - 1]}`))
    .join(" and ");
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// Mismo hash que ya usa destinationPageContent.ts — cada ruta usa siempre
// el mismo índice en las listas de abajo, así la voz de una página es
// consistente de punta a punta y no cambia si se regenera.
function variantIndex(id: string, poolSize: number): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return hash % poolSize;
}

// Ganchos de apertura (2026-08-19, a pedido del usuario: "que el contenido
// sea humano, tenga aura y buena energía") — investigado antes de escribir
// (Going.com: los buenos artículos de vuelos/costos abren con algo
// específico y vivo, no "flights from X to Y start at $Z"; Nomads.com:
// ancla el número a lo que de verdad significa, no lo dejes suelto). Cada
// uno usa la duración y el precio REALES de esta ruta puntual, no una
// plantilla vacía — con 25 páginas y datos que sí varían ruta a ruta, el
// riesgo real de "contenido delgado" es bajo si el gancho usa esos datos.
const INTRO_HOOKS = [
  (origin: string, dest: string, duration: string) =>
    `${duration} in the air and you're trading ${origin} for ${dest}. Here's what that actually costs, real numbers, not a teaser rate that vanishes at checkout.`,
  (origin: string, dest: string, duration: string) =>
    `${origin} to ${dest} runs about ${duration} — short enough that the flight barely eats into the trip. What follows is the real cost, start to finish.`,
  (origin: string, dest: string, duration: string) =>
    `From ${origin}, ${dest} is closer than most people assume: ${duration} of flying and a fare that's usually within reach. Here's the honest breakdown.`,
  (origin: string, dest: string, duration: string) =>
    `The flight from ${origin} to ${dest} clocks in around ${duration}. Everything below is what a real trip on this route costs — flight, hotel, and the total.`,
  (origin: string, dest: string, duration: string) =>
    `${duration} out of ${origin} and you're in ${dest}. Worth knowing before you start looking at dates: here's what people actually pay.`,
];

// Anclar el número a lo que significa (hallazgo de la investigación en
// Nomads.com) — no solo "$X round trip", sino qué tipo de asiento cubre
// ese precio y cuánto más cuesta subir de cabina.
const COST_FRAMINGS = [
  (economic: number, premiumLabel: string, premium: number) =>
    `That $${economic} figure is economy, the seat most people actually book. Want more room or the front cabin? ${premiumLabel} runs closer to $${premium} on this route — worth it for a long flight, overkill for a short hop.`,
  (economic: number, premiumLabel: string, premium: number) =>
    `$${economic} gets you economy on this route. If legroom matters more than saving money, ${premiumLabel} lands around $${premium} — a real jump, so it's worth deciding on purpose, not by accident.`,
  (economic: number, premiumLabel: string, premium: number) =>
    `Economy is the $${economic} you'll see most often searching this route. ${premiumLabel} costs roughly $${premium} — a meaningful step up in price, and in comfort.`,
  (economic: number, premiumLabel: string, premium: number) =>
    `$${economic} is the economy fare — what most seats on this route actually sell for. ${premiumLabel} pushes that to about $${premium}, which only tends to make sense on the longer routes.`,
  (economic: number, premiumLabel: string, premium: number) =>
    `Most seats on this route go for around $${economic}, economy. ${premiumLabel} runs about $${premium} if you'd rather pay for the extra space.`,
];

const TOTAL_FRAMINGS = [
  (days: number, total: number, hotelMid: number) =>
    `Add a $${hotelMid}-a-night hotel and a ${days}-day stay, and a real trip on this route lands around $${total} per person — flight and hotel together, not just the flight.`,
  (days: number, total: number, hotelMid: number) =>
    `Put a ${days}-night hotel at around $${hotelMid} a night on top of the flight, and the whole trip runs about $${total} per person — the number that actually matters when you're deciding whether this fits your budget.`,
  (days: number, total: number, hotelMid: number) =>
    `Once you add ${days} nights of hotel (around $${hotelMid} a night) to the flight, the real total per person comes out to about $${total} — not just the fare Google shows you.`,
  (days: number, total: number, hotelMid: number) =>
    `A ${days}-day trip, hotel included at roughly $${hotelMid} a night, runs about $${total} per person all in. That's the number worth budgeting against, not the flight alone.`,
];

const TIMING_HOOKS = [
  (cheap: string, expensive: string) =>
    `${cheap} is when this route is cheapest — thinner crowds, better rates. ${expensive} is the other end: still worth going, just pay peak-season prices for it.`,
  (cheap: string, expensive: string) =>
    `Fly in ${cheap} and you'll pay the least. ${expensive} is peak season on this route — great if the timing works, just budget for it.`,
  (cheap: string, expensive: string) =>
    `${cheap} tends to be the value window on this route. ${expensive} runs the other direction — busier, pricier, still a fine trip if that's when you can go.`,
  (cheap: string, expensive: string) =>
    `The cheapest stretch to book this route is ${cheap}. ${expensive} is when demand (and price) peaks — worth knowing before you lock in dates.`,
];

// Destinos sin variación estacional real (2026-08-19, bug real encontrado
// en vivo: Aruba solo tiene 1 temporada cubriendo los 12 meses en
// destinations/index.ts — "cheapest months" y "priciest months" salían
// como el mismo "January–December", una comparación sin sentido). En vez
// de forzar un contraste que no existe, se dice la verdad — que además es
// un dato real y positivo para este puñado de destinos ("clima estable
// todo el año", el mismo hecho que ya vive en insiderNotes).
const STABLE_WEATHER_HOOKS = [
  (dest: string) => `${dest} doesn't really have a bad season — prices here stay fairly steady year-round, so timing this trip is more about your schedule than chasing a deal.`,
  (dest: string) => `There's no real high or low season for ${dest} — the weather (and the price) barely moves month to month. Book around your own calendar, not the forecast.`,
  (dest: string) => `${dest} is one of the rare spots where "best time to go" isn't really a question — prices and weather stay consistent all year, so any month works.`,
];

export interface FlightRouteContent {
  slug: string;
  originCode: OriginHub;
  originCityLabel: string;
  originImageQuery: string;
  destination: Destination;
  heading: string;
  pageTitle: string;
  description: string;
  flightCostUSD: number;
  durationLabel: string;
  puckData: Data<Props>;
  faqItems: { question: string; answer: string }[];
}

export function buildFlightRouteContent(originCode: OriginHub, destinationId: string): FlightRouteContent | null {
  const destination = destinations.find((d) => d.id === destinationId);
  const stay = destinationBaseStayCosts[destinationId];
  const base = originBaseCosts[destinationId]?.find((b) => b.originAirportCode === originCode);
  if (!destination || !stay || !base) return null;

  const originLabel = ORIGIN_LABELS[originCode] ?? originCode;
  const originCity = originLabel.replace(/\s*\([A-Z]{3}\)$/, "");
  const slug = flightRouteSlug(originCode, destinationId);
  const v = variantIndex(slug, 5);

  const durationLabel = formatDuration(base.avgFlightDurationMinutes);
  const classPrices = getFlightClassPrices(base.avgFlightCostUSD, base.avgFlightDurationMinutes);
  const premiumLabel = classPrices.standard ? "Business" : "Business/First";

  let snapshots;
  try {
    snapshots = generatePriceSnapshotsForDestination(destination);
  } catch {
    return null;
  }
  const month = defaultMonth();
  const refSnapshot = snapshots.find((s) => s.originAirportCode === originCode && s.month === month) ?? snapshots.find((s) => s.originAirportCode === originCode);
  const fiveDayTotal = refSnapshot ? Math.round(estimateTripTotalUSD(refSnapshot, 5, 1)) : null;
  const sevenDayTotal = refSnapshot ? Math.round(estimateTripTotalUSD(refSnapshot, 7, 1)) : null;

  const hasSeasonalVariation = destination.seasons.length > 1;
  const sortedByCost = [...destination.seasons].sort((a, b) => {
    const rank = { low: 0, medium: 1, high: 2 };
    return rank[a.costTier] - rank[b.costTier];
  });
  const cheapSeason = sortedByCost[0];
  const expensiveSeason = sortedByCost[sortedByCost.length - 1];
  const cheapMonths = formatMonthRanges(cheapSeason.months);
  const expensiveMonths = formatMonthRanges(expensiveSeason.months);

  const heading = `${originCity} to ${destination.name}`;
  const pageTitle = `${originCity} to ${destination.name} — Flight Cost & Best Time to Go | AriTrips`;
  const description = `What a trip from ${originCity} to ${destination.name} really costs — flight price, flight time, hotel, and the best months to go. Real curated estimates, not a teaser rate.`;

  const introText = `${INTRO_HOOKS[v](originCity, destination.name, durationLabel)} ${COST_FRAMINGS[v](
    classPrices.economic,
    premiumLabel,
    classPrices.premium
  )}`;

  const totalText =
    fiveDayTotal !== null
      ? TOTAL_FRAMINGS[v % TOTAL_FRAMINGS.length](5, fiveDayTotal, stay.avgHotelCostPerNightUSD.mid)
      : `Hotels here run around $${stay.avgHotelCostPerNightUSD.mid} a night at the mid tier.`;

  const timingText = hasSeasonalVariation
    ? TIMING_HOOKS[v % TIMING_HOOKS.length](cheapMonths, expensiveMonths)
    : STABLE_WEATHER_HOOKS[v % STABLE_WEATHER_HOOKS.length](destination.name);

  const stats1 = [
    { value: `$${base.avgFlightCostUSD}`, label: "Typical flight (round trip)" },
    { value: durationLabel, label: "Flight time" },
    { value: `$${stay.avgHotelCostPerNightUSD.mid}`, label: "Hotel per night (mid-tier)" },
    ...(fiveDayTotal !== null ? [{ value: `$${fiveDayTotal}`, label: "5-day trip, per person" }] : []),
  ];

  const stats2 = [
    { value: `$${classPrices.economic}`, label: "Economy" },
    ...(classPrices.standard ? [{ value: `$${classPrices.standard}`, label: "Premium economy" }] : []),
    { value: `$${classPrices.premium}`, label: premiumLabel },
  ];

  const faqItems = [
    {
      question: `How much does a flight from ${originCity} to ${destination.name} cost?`,
      answer: `Economy typically runs around $${classPrices.economic} round trip. That's a curated estimate based on typical fares for this route, not a live quote — actual prices move with season and how far ahead you book.`,
    },
    {
      question: `How long is the flight from ${originCity} to ${destination.name}?`,
      answer: `About ${durationLabel} in the air, based on typical routing for this pair.`,
    },
    {
      question: `What's the cheapest time to fly ${originCity} to ${destination.name}?`,
      answer: hasSeasonalVariation
        ? `${cheapMonths} tends to be the best-value window for ${destination.name} — lighter crowds, better rates. ${expensiveMonths} is peak season, still a good trip, just pricier.`
        : `${destination.name} doesn't have a strong high or low season — prices and weather stay fairly consistent year-round, so there's no real "cheapest" window to chase here.`,
    },
    {
      question: `What does a full trip from ${originCity} to ${destination.name} cost, not just the flight?`,
      answer:
        fiveDayTotal !== null && sevenDayTotal !== null
          ? `A 5-day trip runs about $${fiveDayTotal} per person, and 7 days about $${sevenDayTotal} — flight and hotel together at the mid tier. AriTrips can show the real number for your exact dates and party size.`
          : `Add hotel (around $${stay.avgHotelCostPerNightUSD.mid}/night at the mid tier) to the flight above for the real trip cost — AriTrips can show the exact number for your dates.`,
  },
  ];

  const puckData: Data<Props> = {
    root: { props: { title: pageTitle } },
    content: [
      {
        type: "Hero",
        props: {
          id: "hero-1",
          heading,
          subheading: `${durationLabel} flight · from $${base.avgFlightCostUSD} round trip`,
          ctaLabel: "Find your trip",
          ctaHref: APP_URL,
          backgroundImageQuery: destination.imageQuery,
        },
      },
      { type: "TextBlock", props: { id: "text-intro", text: introText } },
      { type: "StatsBanner", props: { id: "stats-main", stats: stats1 } },
      { type: "TextBlock", props: { id: "text-total", text: totalText } },
      { type: "Heading", props: { id: "heading-class", text: "Cabin prices on this route", level: "h2" } },
      { type: "StatsBanner", props: { id: "stats-class", stats: stats2 } },
      { type: "Heading", props: { id: "heading-timing", text: "When to fly this route", level: "h2" } },
      { type: "TextBlock", props: { id: "text-timing", text: timingText } },
      { type: "FAQAccordion", props: { id: "faq-1", heading: "Common questions", items: faqItems } },
      {
        type: "CTABanner",
        props: {
          id: "cta-1",
          heading: `See what ${destination.name} costs from ${originCity} right now`,
          subheading: "Real flight, hotel, and activity costs together — not just a flight price.",
          ctaLabel: "Find your trip",
          ctaHref: APP_URL,
        },
      },
    ],
  };

  return {
    slug,
    originCode,
    originCityLabel: originCity,
    originImageQuery: ORIGIN_IMAGE_QUERY[originCode] ?? "",
    destination,
    heading,
    pageTitle,
    description,
    flightCostUSD: base.avgFlightCostUSD,
    durationLabel,
    puckData,
    faqItems,
  };
}
