/**
 * Publica las primeras 3 entradas del blog (2026-08-09), a pedido
 * explícito del usuario. Investigadas con 3 agentes en paralelo contra
 * datos reales (Mincetur/Embratur/estadísticas de aeropuertos vía ASUR/
 * GAP/OMA/AICM, Skyscanner Travel Trends, tourism boards oficiales) —
 * no listas inventadas. Los 26 destinos entre las 3 entradas coinciden
 * exactos con el catálogo curado, así que cada uno usa el bloque
 * DestinationHighlight real (foto + insiderNotes + value score) además
 * del texto investigado.
 *
 * Mismo patrón que enrich-hub-pages.ts / set-hub-descriptions.ts:
 * arma el Puck JSON acá y lo sube directo a Firestore (colección
 * `pages`, template="blog").
 *
 * Correr con:
 *   FIREBASE_CLIENT_EMAIL=... FIREBASE_PRIVATE_KEY_FILE=... npx tsx scripts/create-blog-posts.ts
 */
import { readFileSync } from "node:fs";
import { setDocument } from "../../../packages/data/src/firestore";

const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKeyFile = process.env.FIREBASE_PRIVATE_KEY_FILE;
if (!clientEmail || !privateKeyFile) {
  console.error("Missing FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY_FILE env vars.");
  process.exit(1);
}
const privateKeyRaw = readFileSync(privateKeyFile, "utf-8").trim();
const credentials = { clientEmail, privateKey: privateKeyRaw.replace(/\\n/g, "\n") };

type Entry = { rank: number; name: string; destinationId: string; text: string };

function destinationSection(entry: Entry) {
  return [
    { type: "Heading", props: { id: `h-${entry.destinationId}`, text: `${entry.rank}. ${entry.name}`, level: "h3" } },
    { type: "TextBlock", props: { id: `t-${entry.destinationId}`, text: entry.text } },
    { type: "DestinationHighlight", props: { id: `d-${entry.destinationId}`, destinationId: entry.destinationId } },
  ];
}

function buildPost(opts: {
  slug: string;
  title: string;
  description: string;
  featuredImageQuery: string;
  heroSubheading: string;
  intro: string;
  entries: Entry[];
}) {
  const content = [
    {
      type: "Hero",
      props: {
        id: "hero-1",
        heading: opts.title,
        subheading: opts.heroSubheading,
        ctaLabel: "Find your trip",
        ctaHref: "https://app.aritrips.com",
        backgroundImageQuery: opts.featuredImageQuery,
      },
    },
    { type: "TextBlock", props: { id: "text-intro", text: opts.intro } },
    ...opts.entries.flatMap(destinationSection),
    {
      type: "CTABanner",
      props: {
        id: "cta-1",
        heading: "See what actually fits your budget",
        subheading: "Real flight, hotel, and activity costs for any of these — not just a flight price.",
        ctaLabel: "Find your trip",
        ctaHref: "https://app.aritrips.com",
      },
    },
  ];

  return {
    slug: opts.slug,
    title: opts.title,
    description: opts.description,
    country: "",
    city: "",
    continent: "",
    language: "en",
    status: "published",
    template: "blog",
    featuredImageQuery: opts.featuredImageQuery,
    updatedAt: new Date(),
    publishedAt: new Date(),
    contentJson: JSON.stringify({ root: { props: { title: opts.title } }, content }),
  };
}

const caribbean = buildPost({
  slug: "best-caribbean-destinations-for-us-travelers",
  title: "The 12 Most-Searched Caribbean Destinations for US Travelers",
  description:
    "Ranked with real 2024-2025 visitor data — the 12 Caribbean destinations Americans are actually searching for and booking right now, from Cancún to Turks and Caicos.",
  featuredImageQuery: "caribbean turquoise beach aerial palm trees",
  heroSubheading: "Ranked with real visitor and search data, not guesses — see which of these actually fits your budget.",
  intro:
    "The Caribbean isn't one market — it's a dozen different countries competing for the same American traveler, and the data shows some clear winners. We pulled real 2024–2025 visitor arrival figures, airport traffic, and search-trend reporting — not just vibes — to rank the destinations US travelers are actually booking and searching for right now.",
  entries: [
    {
      rank: 1,
      name: "Cancún / Riviera Maya, Mexico",
      destinationId: "cancun",
      text: "Cancún International handles roughly 15 million passengers a year, with dozens of daily nonstops from hubs like Dallas, Atlanta, Houston, and Newark — more US flight options than almost anywhere else in the region. The destination logged a record 21 million visitors in 2023. The Hotel Zone itself is a man-made barrier island built specifically for tourism in the 1970s — it didn't exist as a resort strip before that.",
    },
    {
      rank: 2,
      name: "Punta Cana, Dominican Republic",
      destinationId: "punta-cana",
      text: "The Dominican Republic is the single most-visited country in the Caribbean, and Americans are its largest visitor group by far — 2.7 million US arrivals in 2025 alone. Punta Cana anchors the world's largest concentration of all-inclusive resorts. Off the coast near Samaná, the DR hosts a genuine humpback whale nursery (January–March) — a wildlife draw most beach-resort destinations simply can't offer.",
    },
    {
      rank: 3,
      name: "Nassau / Paradise Island, Bahamas",
      destinationId: "nassau",
      text: "Americans make up roughly 85% of the Bahamas' international arrivals — the highest US concentration of any major Caribbean destination — helped by a short hop from Florida that's often under an hour. The islands pulled in over 11.2 million total visitors in 2024, with cruise traffic alone accounting for 7.8 million passengers. Nassau is also the gateway to Royal Caribbean's private Perfect Day at CocoCay, itself now a standalone search draw.",
    },
    {
      rank: 4,
      name: "San Juan, Puerto Rico",
      destinationId: "san-juan",
      text: "Puerto Rico is a US territory — no passport required for US citizens, same currency, same cell and postal systems — which makes it feel closer to domestic travel than anywhere else on this list. Luis Muñoz Marín airport handled over 5.1 million passengers in 2022, with tourism revenue up 39% over pre-pandemic levels. El Yunque, Puerto Rico's rainforest, is the only tropical rainforest in the entire US National Forest System.",
    },
    {
      rank: 5,
      name: "Montego Bay, Jamaica",
      destinationId: "montego-bay",
      text: "Jamaica logged a record 4.1 million visitors in 2024, and the US has emerged as its largest and most influential source market — ahead of Canada, the UK, and every European market combined. Montego Bay is where the modern all-inclusive resort brand was born (Sandals was founded here), and its airport serves more direct US routes than any other in Jamaica.",
    },
    {
      rank: 6,
      name: "Providenciales / Grand Turk, Turks and Caicos",
      destinationId: "turks-and-caicos",
      text: "This is the most search-verifiable entry on this list: Skyscanner's 2025 travel trends report named Grand Turk the #1 trending destination specifically for US travelers, citing a 528% jump in US search volume in a single six-month stretch. Grace Bay Beach on Providenciales is repeatedly ranked the world's #1 beach by TripAdvisor's Travelers' Choice awards — a big part of what's driving that spike.",
    },
    {
      rank: 7,
      name: "Aruba",
      destinationId: "aruba",
      text: "Aruba sits outside the Caribbean hurricane belt, which gives it near-guaranteed sun even during fall storm season — a concrete, practical reason travelers search for it when other islands carry real hurricane risk. It crossed 1 million US visitors in a single year for the first time in 2024. Its arid, cactus-dotted landscape is technically a desert climate — visually unlike almost anywhere else in the Caribbean.",
    },
    {
      rank: 8,
      name: "Grand Cayman",
      destinationId: "grand-cayman",
      text: "US visitors made up 84% of stayover arrivals in early 2024 — the highest US concentration on this list besides the Bahamas — backed by direct American, Delta, and United service from multiple hubs. Stingray City, a sandbar where wild southern stingrays gather in shallow water, is one of the most-booked single excursions in the entire Caribbean cruise and resort market.",
    },
    {
      rank: 9,
      name: "Roatán, Honduras",
      destinationId: "roatan",
      text: "Roatán became the most-visited cruise destination in all of Central America in 2024, drawing 1.7 million cruise passengers — most arriving on US-based lines sailing out of Texas and Florida. It sits on the Mesoamerican Barrier Reef, the second-largest reef system on Earth, making it one of the cheapest places in the hemisphere to get scuba certified.",
    },
    {
      rank: 10,
      name: "Saint Lucia",
      destinationId: "st-lucia",
      text: "Saint Lucia posted a record 435,959 stay-over visitors in 2024, up 14% from the year before — and the US is its largest single source market at 54% of arrivals, growing on the back of newer nonstop routes from JFK and other East Coast hubs. The Pitons, twin volcanic spires and a UNESCO World Heritage Site, sit next to Sulphur Springs, marketed as the world's only drive-in volcano.",
    },
    {
      rank: 11,
      name: "Curaçao",
      destinationId: "curacao",
      text: "The Netherlands still edges out the US as Curaçao's top source market — a legacy of Dutch colonial ties — but American arrivals are growing the fastest, up 30% year-over-year in 2024. Like Aruba, it sits outside the hurricane belt, and new direct JetBlue and United routes from the Northeast are driving the surge. Willemstad's Handelskade waterfront, a row of pastel Dutch colonial buildings, is a UNESCO World Heritage Site and one of the most-photographed streets in the Caribbean.",
    },
    {
      rank: 12,
      name: "Belize (Ambergris Caye)",
      destinationId: "belize",
      text: "Belize logged 562,405 overnight visitors in 2024, up 21% and nearly 12% above pre-pandemic 2019 levels — with the US supplying about 69% of all overnight arrivals. English is Belize's official language, removing a barrier most other entries on this list don't share. The Great Blue Hole, made famous by Jacques Cousteau, remains one of the most bucket-listed dive sites anywhere in the world.",
    },
  ],
});

const mexico = buildPost({
  slug: "best-mexico-destinations-for-us-travelers",
  title: "The 7 Most-Visited Destinations in Mexico for US Travelers",
  description:
    "Ranked by real airport traffic data — the 7 Mexican destinations Americans actually fly to most, from Cancún's record numbers to Tulum's fastest-growing airport.",
  featuredImageQuery: "mexico beach resort aerial turquoise",
  heroSubheading: "Ranked by real 2025 airport traffic — not a guess at which Mexican destinations Americans actually fly to most.",
  intro:
    "Mexico's tourism board didn't have its destination-level numbers online when we checked, so we went straight to a source that's even harder to fake: airport passenger traffic. Here are the 7 Mexican destinations Americans actually fly to most, ranked by real 2025 numbers from the airports themselves.",
  entries: [
    {
      rank: 1,
      name: "Cancún",
      destinationId: "cancun",
      text: "Cancún International is Mexico's busiest airport for international traffic, handling 19.4 million passengers in 2025 — and it's documented as the non-US airport with the most US destinations served of any airport outside the country, with nonstops from JFK, LAX, Miami, Chicago, Dallas, and dozens of secondary markets. The Great Mesoamerican Reef, the second-largest barrier reef system on Earth, runs offshore — world-class diving is a 10-minute boat ride from the hotel zone.",
    },
    {
      rank: 2,
      name: "Mexico City",
      destinationId: "mexico-city",
      text: "Mexico City International handled 44.6 million passengers in 2025 — Mexico's busiest airport overall and the third-busiest in all of Latin America — anchored by dense nonstop US service from nearly every major carrier. It's the largest metro area in North America at roughly 22 million people, with one of the highest museum counts of any city on Earth: over 150, including a UNESCO World Heritage historic center.",
    },
    {
      rank: 3,
      name: "Guadalajara",
      destinationId: "guadalajara",
      text: "Guadalajara's airport moved 18.7 million passengers in 2025, and its top 7 US routes alone — LA, Chicago, Dallas, Houston, Oakland, Fresno, and Las Vegas — totaled over 1.6 million passengers combined. Worth being honest about: this is driven heavily by travelers visiting family, not resort tourism, a genuinely different reason to visit than most of this list. It's the birthplace of mariachi music, and the nearby town of Tequila — a UNESCO-listed agave landscape — is a popular day trip for distillery tours.",
    },
    {
      rank: 4,
      name: "Los Cabos",
      destinationId: "cabo-san-lucas",
      text: "Los Cabos International ranks 4th in Mexico for international passenger traffic (7.5 million in 2025), with Los Angeles, Dallas, and Phoenix as its busiest routes — reflecting how much West Coast and Southwest proximity drives this destination, alongside heavy all-inclusive resort development. El Arco, or Land's End, marks the literal meeting point of the Pacific Ocean and the Sea of Cortez, and gray whale season (December–April) overlaps almost exactly with the best weather window.",
    },
    {
      rank: 5,
      name: "Puerto Vallarta",
      destinationId: "puerto-vallarta",
      text: "Puerto Vallarta's airport is one of Mexico's fastest-growing, up 2.1% to 6.9 million passengers in 2025 and ranking 5th nationally for international traffic — with LA, Dallas, and Phoenix as its busiest routes. The town's global profile traces back to the 1964 film The Night of the Iguana, starring Richard Burton, which turned a sleepy fishing village into an international destination almost overnight.",
    },
    {
      rank: 6,
      name: "Tulum",
      destinationId: "tulum",
      text: "Tulum International only opened in December 2023, and it's already the fastest-growing entry on this list: from 39,768 passengers in its first month to 1.25 million in 2025, with year-round nonstops now running from Atlanta, Dallas, Miami, and Houston. It's the only major Maya archaeological site built directly on a coastal cliff — ancient ruins and turquoise Caribbean water in the same frame, something no other Maya site can offer.",
    },
    {
      rank: 7,
      name: "Oaxaca",
      destinationId: "oaxaca",
      text: "Oaxaca's airport is smaller in absolute terms (1.86 million passengers in 2025) but a genuine growth story — its own operator credits the increase mainly to the area's rising popularity as a tourist destination, and its top three routes (Dallas, LA, Houston) are all nonstop US service. It's the mezcal capital of Mexico, and its Day of the Dead celebrations are widely regarded as among the most traditional and least commercialized anywhere in the country.",
    },
  ],
});

const southAmerica = buildPost({
  slug: "best-south-america-destinations-for-us-travelers",
  title: "The 7 Most-Visited South America Destinations for US Travelers",
  description:
    "From Machu Picchu's 1.5 million annual visitors to Rio's steady climb in US arrivals — the 7 South American destinations Americans travel to most, backed by real tourism-board data.",
  featuredImageQuery: "machu picchu peru mountains sunrise",
  heroSubheading: "Backed by real tourism-board data from Peru, Brazil, Colombia, and Ecuador — not a guess at where Americans actually go.",
  intro:
    "South America doesn't get the same volume of US searches as Mexico or the Caribbean, but the travelers who do go tend to go big — bucket-list landmarks, multi-country itineraries, weeks not long weekends. We pulled real visitor data from Peru, Brazil, Colombia, and Ecuador's own tourism authorities to rank where Americans are actually going.",
  entries: [
    {
      rank: 1,
      name: "Cusco / Machu Picchu, Peru",
      destinationId: "cusco",
      text: "Machu Picchu is Peru's single most-visited site, now drawing over 1.5 million visitors a year, and the US is Peru's #2 international source market overall — 566,000 American arrivals in the first 11 months of 2025 alone, second only to Chile. Peru raised the daily visitor cap to 4,500 (up to 5,600 in peak season) in 2024 just to manage the crowding. Go in the dry season, May through September — permits sell out months in advance.",
    },
    {
      rank: 2,
      name: "Cartagena, Colombia",
      destinationId: "cartagena",
      text: "Cartagena is one of the fastest-growing US-connected leisure markets in South America right now: United Airlines is launching new nonstop routes from Houston and Washington Dulles in December 2026, citing growing leisure demand by name. It's also a major Caribbean cruise port. The walled Old City, Ciudad Amurallada, is a UNESCO World Heritage Site — the December–April dry season is the best window to see it.",
    },
    {
      rank: 3,
      name: "Rio de Janeiro, Brazil",
      destinationId: "rio-de-janeiro",
      text: "Rio has the highest documented count of US visitor arrivals of any South American destination we checked: 759,637 in 2025, up from 728,537 in 2024 — a steady, multi-year climb, not a one-off spike. Christ the Redeemer is one of the official New7Wonders of the World. Skip Carnival (Feb/March) if you want the same weather with a fraction of the crowds and prices — April–June and September–November are nearly identical climate-wise.",
    },
    {
      rank: 4,
      name: "Buenos Aires, Argentina",
      destinationId: "buenos-aires",
      text: "Argentina is South America's single most-visited country overall, pulling in a record 7.4 million international visitors, and Buenos Aires specifically has seen a well-documented surge in American travelers tied to favorable peso exchange rates over the past two years. March–May and September–November (fall and spring) are the sweet spots — mild weather without the humid December–February summer crowds.",
    },
    {
      rank: 5,
      name: "Iguazú Falls",
      destinationId: "iguazu-falls",
      text: "Iguazú is a UNESCO World Heritage Site and an official New7Wonders of Nature — roughly three times wider than Niagara — and functions as the standard add-on for American travelers already booking Buenos Aires or Rio, reachable via direct flights to either the Argentine or Brazilian side. The Argentine side gives you close-up walkway views right over the falls; the Brazilian side gives the panoramic overlook. Most guides recommend budgeting a full day for each.",
    },
    {
      rank: 6,
      name: "Galápagos Islands, Ecuador",
      destinationId: "galapagos",
      text: "The Galápagos are the bucket-list wildlife and diving destination that shaped Darwin's theory of evolution, and Ecuador's own tourism data shows American travelers have historically been the single largest nationality visiting, typically transiting through Quito. Conservation caps limit the islands to roughly 200,000 visitors a year. May through December brings calmer seas, plus the best window to see blue-footed booby mating displays and new sea lion pups.",
    },
    {
      rank: 7,
      name: "Medellín, Colombia",
      destinationId: "medellin",
      text: "Medellín has one of the most documented tourism turnarounds anywhere in South America — from a city defined by its troubled 1990s reputation to a top US leisure and digital-nomad destination, a shift extensively covered in American travel press. It's nicknamed the ‘City of Eternal Spring’ for its steady 60–75°F climate at roughly 4,900 feet of elevation, and its Metrocable gondola system — built to connect hillside neighborhoods to the city center — doubles as one of the best scenic rides in the city.",
    },
  ],
});

async function main() {
  for (const post of [caribbean, mexico, southAmerica]) {
    await setDocument("pages", post.slug, post, credentials);
    console.log(`${post.slug}: published`);
  }
}
main();
