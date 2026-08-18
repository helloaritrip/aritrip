import { destinations, destinationBaseStayCosts, type Destination } from "@aritrips/data";

/**
 * Arma el contenido Puck de una página individual de destino (/p/{id}) —
 * réplica del patrón usado por el script puntual (no versionado, "one-off",
 * ver commit 7247091) que generó las primeras 40. Ese script se perdió al
 * no comprometerse al repo, así que esta plantilla se reconstruyó leyendo
 * el HTML real de páginas ya publicadas (oaxaca, aspen) — no es texto
 * libre por destino: todo sale de los campos ya curados en
 * packages/data/src/destinations (2026-08-11, para los 8 destinos nuevos
 * EE.UU./Canadá).
 */

const APP_URL = "https://app.aritrips.com";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Agrupa meses en rangos contiguos (ej. [4,5,10,11] -> "April–May and October–November").
function formatMonthRanges(months: number[]): string {
  const sorted = [...months].sort((a, b) => a - b);
  const ranges: [number, number][] = [];
  for (const m of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && m === last[1] + 1) {
      last[1] = m;
    } else {
      ranges.push([m, m]);
    }
  }
  return ranges
    .map(([start, end]) => (start === end ? MONTH_NAMES[start - 1] : `${MONTH_NAMES[start - 1]}–${MONTH_NAMES[end - 1]}`))
    .join(" and ");
}

function celsiusToFahrenheit(c: number): number {
  return Math.round((c * 9) / 5 + 32);
}

// Frase de descriptor del subheading + hero, derivada de la primera
// entrada de idealTravelerProfile (curada a mano por destino).
const PROFILE_DESCRIPTOR: Record<string, string> = {
  foodies: "food-focused",
  culture_seekers: "culture-focused",
  digital_nomads: "slow-travel",
  luxury_seekers: "splurge-worthy",
  skiers: "ski",
  honeymoon: "romantic",
  adventure_seekers: "adventure-focused",
  nature_lovers: "nature-focused",
  couples: "romantic",
  families_young_kids: "family-friendly",
  families_older_kids: "family-friendly",
  first_time_visitors: "classic first-trip",
  solo_traveler: "easy solo",
  bachelor_bachelorette: "celebration",
  nightlife_seekers: "nightlife-focused",
  bucket_list: "bucket-list",
};

// Pluralización/fraseo irregular para la lista "regular pick for X, Y, and Z" —
// el resto de los tags solo cambia "_" por espacio.
const PROFILE_PLURAL: Record<string, string> = {
  honeymoon: "honeymooners",
  first_time_visitors: "first-time visitors",
  solo_traveler: "solo travelers",
  families_young_kids: "families with young kids",
  families_older_kids: "families with older kids",
  bachelor_bachelorette: "bachelor/bachelorette parties",
};

function formatProfileList(profiles: string[]): string {
  const words = profiles.map((p) => PROFILE_PLURAL[p] ?? p.replace(/_/g, " "));
  if (words.length === 1) return words[0];
  if (words.length === 2) return `${words[0]} and ${words[1]}`;
  return `${words.slice(0, -1).join(", ")}, and ${words[words.length - 1]}`;
}

// Baja la primera letra a minúscula para que la oración fluya ("On the
// ground, most trips here revolve around: mezcal tastings...") — pero no
// toca acrónimos (ej. "CN Tower" no debe volverse "cN Tower").
function lowerFirst(s: string): string {
  const firstWord = s.split(" ")[0];
  if (/^[A-Z]{2,}$/.test(firstWord)) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function withIndefiniteArticle(word: string): string {
  return /^[aeiou]/i.test(word) ? `an ${word}` : `a ${word}`;
}

function visaSentence(country: string): string {
  if (country === "United States") {
    return "No passport needed — it's a domestic U.S. trip, just a REAL ID or existing ID for the flight.";
  }
  return `U.S. citizens can enter ${country} visa-free for a standard tourist stay — just bring a passport valid for the length of your trip.`;
}

export function buildDestinationPageContent(destination: Destination) {
  const stay = destinationBaseStayCosts[destination.id];
  if (!stay) return null;

  const { name, country, region, idealTripLengthDays: days, idealTravelerProfile, signatureExperiences, insiderNotes } = destination;
  const bestSeason = [...destination.seasons].sort((a, b) => (a.costTier === b.costTier ? 0 : a.costTier === "low" ? -1 : 1))[0];
  const monthLabel = formatMonthRanges(bestSeason.months);
  const descriptor = PROFILE_DESCRIPTOR[idealTravelerProfile[0]] ?? "classic";
  const descriptorTrip = withIndefiniteArticle(`${descriptor} trip`);
  const profileList = formatProfileList(idealTravelerProfile);
  const visa = visaSentence(country);

  // heading (H1 visual) y pageTitle (<title> de SEO) separados a propósito
  // (2026-08-19, auditoría de SEO) — antes eran la misma variable. El H1
  // puede quedar limpio ("Tulum, Mexico") porque ya tiene la foto y el
  // contexto de la página alrededor; el <title> compite solo en una lista
  // de resultados de Google contra sitios que también dirían "Tulum,
  // Mexico" si lo dejáramos así — necesita señal real (costo/presupuesto)
  // para que alguien lo elija.
  const heading = `${name}, ${country}`;
  const pageTitle = `${name} Trip Cost — Flights, Hotels & Budget | AriTrips`;
  // Antes reusaba insiderNotes tal cual (nota práctica, ej. "vas a volar a
  // Cancún y trasladarte 1.5 horas..." para Tulum) — no coincide con lo
  // que de verdad está en vivo hoy (esa description se reconstruyó a mano
  // leyendo el HTML publicado, ver comentario de arriba del archivo, pero
  // nunca se actualizó acá cuando se escribió esta función). Quedaba una
  // bomba de tiempo: la próxima vez que se republicara cualquier página,
  // la description buena se pisaba silenciosamente por insiderNotes. Ahora
  // el código genera la misma description que ya está probada en vivo,
  // así que "republicar" ya no puede empeorarla.
  const description = `Real cost estimates for ${name}, ${country} — hotels, activities, best time to go, and how many days to plan. Not just a flight price.`;

  const content = [
    {
      type: "Hero",
      props: {
        id: "hero-1",
        heading,
        subheading: `${region} · ${days.min}–${days.max} days · ${withIndefiniteArticle(descriptor)} trip`,
        ctaLabel: "Find your trip",
        ctaHref: APP_URL,
        backgroundImageQuery: destination.imageQuery,
      },
    },
    {
      type: "TextBlock",
      props: {
        id: "text-intro",
        text: `${insiderNotes} ${name} tends to work best for travelers planning ${descriptorTrip} — it's a regular pick for ${profileList}.`,
      },
    },
    { type: "Heading", props: { id: "h-do", text: "What there is to do", level: "h2" } },
    {
      type: "TextBlock",
      props: {
        id: "text-do",
        text: `On the ground, most trips here revolve around a handful of things: ${signatureExperiences.map(lowerFirst).join("; ")}.`,
      },
    },
    { type: "ExperienceGallery", props: { id: "gallery-1", destinationId: destination.id } },
    { type: "Heading", props: { id: "h-know", text: "Good to know before you go", level: "h2" } },
    {
      type: "TextBlock",
      props: {
        id: "text-know",
        text: `The best-value window is ${monthLabel}, when crowds are thinner and average highs run around ${bestSeason.avgTempC.max}°C (${celsiusToFahrenheit(bestSeason.avgTempC.max)}°F). Most travelers plan ${days.min}–${days.max} days for ${name} — enough time to settle in without rushing. ${visa}`,
      },
    },
    { type: "Heading", props: { id: "h-cost", text: "What a trip here costs", level: "h2" } },
    {
      type: "TextBlock",
      props: {
        id: "text-cost",
        text: `Hotels here run roughly $${stay.avgHotelCostPerNightUSD.budget}–${stay.avgHotelCostPerNightUSD.premium} a night depending on tier (budget/mid/premium), and activities average around $${stay.avgActivityCostPerDayUSD} a day per person. These are curated estimates, not live quotes — real prices shift by season and exact dates. The fastest way to see what a full trip actually costs from your city is to run it through AriTrips: real flight, hotel, and activity costs together, not just a flight price.`,
      },
    },
    // "Destinos relacionados" (2026-08-16, auditoría de SEO — enlazado
    // interno entre páginas de destino) — ver el comentario en
    // RelatedDestinations en puck/config.tsx.
    { type: "RelatedDestinations", props: { id: "related-1", destinationId: destination.id, heading: "You might also like" } },
    {
      type: "FAQAccordion",
      props: {
        id: "faq-1",
        heading: "Frequently asked questions",
        items: [
          {
            question: `What's the best time to visit ${name}?`,
            answer: `The best-value window is ${monthLabel} — it's also the cheapest time to go. That's a value/crowds read, not the only good time — peak season works too if you don't mind higher rates and more company.`,
          },
          {
            question: `Do U.S. travelers need a visa for ${name}${country === "United States" ? "" : `, ${country}`}?`,
            answer: visa,
          },
          {
            question: `How many days should I plan for ${name}?`,
            answer: `Most travelers plan ${days.min}–${days.max} days. It also works well as a longer, slower trip if you have the time.`,
          },
        ],
      },
    },
    {
      type: "CTABanner",
      props: {
        id: "cta-1",
        heading: `See what a trip to ${name} costs from your city`,
        subheading: "Real flight, hotel, and activity costs — not just a flight price.",
        ctaLabel: "Find your trip",
        ctaHref: APP_URL,
      },
    },
  ];

  return {
    slug: destination.id,
    title: pageTitle,
    description,
    country,
    featuredImageQuery: destination.imageQuery,
    data: { root: { props: { title: pageTitle } }, content },
  };
}

export function findDestination(id: string): Destination | undefined {
  return destinations.find((d) => d.id === id);
}
