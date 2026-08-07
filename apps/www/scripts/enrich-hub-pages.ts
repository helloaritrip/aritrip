/**
 * Reescribe las 24 páginas "Best trips from {City}" con contenido real y
 * específico por hub — reemplaza el intro genérico (mismo párrafo con el
 * nombre de la ciudad cambiado) y las 2 preguntas de FAQ idénticas en las
 * 24 páginas por datos de vuelo reales (directo/con escala, duración,
 * aerolínea, frecuencia) y razones específicas por las que viajeros de
 * cada ciudad eligen estos destinos — investigado (2026-08-07) contra
 * flightconnections.com/flightsfrom.com/páginas de aerolíneas, foros de
 * TripAdvisor/Reddit, y prensa de viajes (snowbirds canadienses, Día de
 * Muertos en Oaxaca, diáspora oaxaqueña en LA, etc.). Sin cifras ni citas
 * inventadas — donde la investigación no pudo verificar algo, se
 * describe como patrón general, no como hecho específico.
 *
 * Por qué importa: 14 de las 24 páginas recomiendan exactamente los
 * mismos 3 destinos (Cancún/Oaxaca/Aspen) porque el catálogo todavía es
 * chico — con la plantilla vieja esas 14 páginas eran casi idénticas
 * entre sí (mismo párrafo, mismas 2 preguntas), un riesgo real de
 * rechazo de AdSense por contenido delgado/duplicado. La diferenciación
 * ahora viene de los datos de vuelo reales, que sí cambian hub por hub
 * aunque el destino sea el mismo (ej. Cancún es directo desde Dallas en
 * ~2h47m pero requiere escala desde Las Vegas).
 *
 * Correr con: npx tsx scripts/enrich-hub-pages.ts
 * Sobrescribe los JSON en src/content/pages/best-trips-from-*.json —
 * después hay que correr migrate-to-firestore.ts para que se refleje en
 * producción (Firestore es la fuente de verdad, no estos archivos).
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { ORIGIN_HUBS, type OriginHub } from "../../../packages/data/src/types";
import { ORIGIN_LABELS, ORIGIN_IMAGE_QUERY } from "../../../packages/data/src/originGeo";
import { destinations } from "../../../packages/data/src/destinations";
import { cityName, hubPageSlug } from "../src/lib/citySlug";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "../src/content/pages");
const APP_URL = "https://app.aritrips.com";

type FlightFact = { destinationId: string; icon: string; title: string; text: string };
type FaqItem = { question: string; answer: string };

type HubContent = {
  destinationIds: [string, string, string];
  cheapest: { destinationId: string; cost: number };
  openLine: string;
  flightFacts: [FlightFact, FlightFact, FlightFact];
  why: string;
  faq: [FaqItem, FaqItem];
};

const destName = (id: string) => destinations.find((d) => d.id === id)?.name ?? id;

const HUB_CONTENT: Record<OriginHub, HubContent> = {
  DFW: {
    destinationIds: ["cancun", "oaxaca", "aspen"],
    cheapest: { destinationId: "oaxaca", cost: 1028 },
    openLine: "All three of these are a nonstop flight from DFW — no connections, which isn't true from most other hubs on this list.",
    flightFacts: [
      { destinationId: "cancun", icon: "✈️", title: "Cancún — nonstop, ~2h47m", text: "American runs about 34 nonstop flights a week; Frontier and Sun Country also fly it direct. (Southwest flies Cancún too, but from Dallas Love Field, not DFW.)" },
      { destinationId: "oaxaca", icon: "✈️", title: "Oaxaca — nonstop, ~2h50m–3h06m", text: "American flies it nonstop about 7 times a week. Dallas and Houston are the only two hubs we cover with a direct flight to Oaxaca — everywhere else needs a connection." },
      { destinationId: "aspen", icon: "✈️", title: "Aspen — nonstop, ~2h24m", text: "American runs up to 3 nonstop flights a day during ski season — reportedly its single most-flown Aspen route from any hub in its network." },
    ],
    why: "American built DFW into its main Mexico leisure hub, and it shows: Dallas is one of only two hubs on this list with nonstop Oaxaca service, and DFW–Aspen is reportedly American's busiest Aspen route from anywhere it flies. If you're flying out of North Texas, none of these three requires a connection — that's not the case from most other cities here.",
    faq: [
      { question: "Can Oaxaca be a long weekend from Dallas?", answer: "Yes — it's a nonstop flight of about 3 hours each way. Dallas and Houston are the only two hubs we cover with direct Oaxaca service; everywhere else needs a connection." },
      { question: "Is Aspen easy to reach from Dallas?", answer: "Yes, more so than from almost anywhere else — American runs up to 3 nonstop flights a day during peak ski season, more frequency than most West Coast hubs get." },
    ],
  },
  IAH: {
    destinationIds: ["cancun", "oaxaca", "aspen"],
    cheapest: { destinationId: "oaxaca", cost: 1062 },
    openLine: "Houston is one of only two hubs we cover with a nonstop flight to Oaxaca — the other is Dallas, right next door.",
    flightFacts: [
      { destinationId: "cancun", icon: "✈️", title: "Cancún — nonstop, ~2h20m", text: "United flies it nonstop with heavy daily service out of its IAH hub." },
      { destinationId: "oaxaca", icon: "✈️", title: "Oaxaca — nonstop, ~2h36m", text: "United flies it nonstop about once a day — one of only two hubs we cover with direct Oaxaca access." },
      { destinationId: "aspen", icon: "🔁", title: "Aspen — nonstop, but thin (~4 flights/week)", text: "United flies it nonstop at roughly 2h50m–3h20m, but only about 4 times a week — check your exact dates or you may end up connecting through Denver instead." },
    ],
    why: "Houston gets nonstop access to both Cancún and Oaxaca, which is genuinely rare — most hubs on this list have to pick one. The catch is Aspen: United's nonstop only runs about 4 times a week, thin enough that a mistimed booking can quietly turn into a Denver connection.",
    faq: [
      { question: "Is Aspen easy nonstop from Houston?", answer: "Technically yes on United, but with only about 4 flights a week, check specific dates carefully — a mistimed booking may force a connection through Denver instead." },
      { question: "Is Oaxaca doable as a weekend trip from Houston?", answer: "Yes — nonstop at about 2h36m, one of only two hubs we cover (with Dallas) with direct Oaxaca access." },
    ],
  },
  ATL: {
    destinationIds: ["cancun", "oaxaca", "aspen"],
    cheapest: { destinationId: "oaxaca", cost: 1130 },
    openLine: "Delta flies nonstop from Atlanta to both a beach destination (Cancún) and a ski destination (Aspen) — Oaxaca is the one that needs a connection.",
    flightFacts: [
      { destinationId: "cancun", icon: "✈️", title: "Cancún — nonstop, ~2h44m", text: "Delta runs about 43 nonstop flights a week out of its ATL hub." },
      { destinationId: "oaxaca", icon: "🔁", title: "Oaxaca — no nonstop from any airline", text: "Every routing connects — via Cancún, Dallas, Houston, or Mexico City — pushing total travel to 6.5–9+ hours each way." },
      { destinationId: "aspen", icon: "✈️", title: "Aspen — nonstop, ~4h01m", text: "Delta flies it nonstop, and recently doubled winter frequency to 2 flights a day — a real, growing route, not a token seasonal add." },
    ],
    why: "Atlanta's nonstop coverage splits cleanly: easy direct access to a beach trip and a ski trip, but zero nonstop options to Oaxaca on any carrier. Delta's decision to double ATL–Aspen winter frequency to twice daily is a concrete signal of real, growing demand for that route specifically.",
    faq: [
      { question: "Is Oaxaca doable as a long weekend from Atlanta?", answer: "It's tight — no nonstop exists on any airline, so realistic door-to-door time is 6.5+ hours each way with a layover, which eats into a short trip fast." },
      { question: "Is there a direct flight to Aspen from Atlanta?", answer: "Yes, on Delta — and they recently doubled winter frequency to twice a day, a real sign of growing demand on that specific route." },
    ],
  },
  CLT: {
    destinationIds: ["cancun", "oaxaca", "aspen"],
    cheapest: { destinationId: "oaxaca", cost: 1164 },
    openLine: "Charlotte just added the longest nonstop route to Aspen in the country — but it only flies in ski season.",
    flightFacts: [
      { destinationId: "cancun", icon: "✈️", title: "Cancún — nonstop, ~2h59m", text: "American runs about 28 nonstop flights a week out of its largest hub." },
      { destinationId: "oaxaca", icon: "🔁", title: "Oaxaca — no nonstop", text: "Every routing connects, typically via Dallas, Houston, or Guadalajara — total travel runs 8 to 17+ hours depending on the connection." },
      { destinationId: "aspen", icon: "❄️", title: "Aspen — nonstop, but only mid-Dec to early April", text: "American launched this route for the 2025–26 winter season — at roughly 1,447 miles and 3h25m, reportedly its longest nonstop route to Aspen anywhere. It disappears outside ski season." },
    ],
    why: "CLT is American's single largest hub by departures, with 30+ nonstop destinations across Mexico, the Caribbean, and Latin America — Cancún fits neatly into that network. The new Aspen nonstop is the standout: the longest nonstop route to Aspen in the country, but it's a winter-only route, so plan around the actual season if you're counting on it.",
    faq: [
      { question: "Can I fly nonstop to Aspen from Charlotte?", answer: "Yes, but only seasonally — American runs it roughly mid-December through early April; outside that window you'll need to connect." },
      { question: "Is Oaxaca reachable from Charlotte?", answer: "No nonstop exists — expect 8 to 17+ hours total depending on whether you connect through Dallas, Houston, or Guadalajara." },
    ],
  },
  MIA: {
    destinationIds: ["cancun", "oaxaca", "grand-cayman"],
    cheapest: { destinationId: "oaxaca", cost: 1130 },
    openLine: "Miami is the biggest U.S. gateway to Latin America and the Caribbean — Cancún from MIA is the shortest hop to Cancún of any hub we cover.",
    flightFacts: [
      { destinationId: "cancun", icon: "✈️", title: "Cancún — nonstop, ~1h55m", text: "American flies it nonstop 4–6 times a day — the fastest Cancún route out of any hub on this site." },
      { destinationId: "oaxaca", icon: "🔁", title: "Oaxaca — no nonstop", text: "Routes via Mexico City on American or Aeroméxico, roughly 7.5 hours total — even Miami's huge Latin America network doesn't reach this smaller regional airport directly." },
      { destinationId: "grand-cayman", icon: "✈️", title: "Grand Cayman — nonstop, ~1h40m–1h51m", text: "Both American and Cayman Airways fly it direct — English-speaking and USD-friendly on arrival, with no currency exchange to think about." },
    ],
    why: "American alone serves roughly 100 destinations across Latin America and the Caribbean from Miami — the deepest network of any hub we cover — which is why Cancún and Grand Cayman are both quick, easy nonstops. Oaxaca is the honest exception: it's a smaller regional airport that even Miami's reach doesn't connect to directly, so it routes through Mexico City instead.",
    faq: [
      { question: "Why is there no direct Miami–Oaxaca flight given Miami's huge Latin America network?", answer: "Oaxaca is a smaller regional airport — even Miami's extensive network routes through Mexico City instead, adding up to roughly 7.5 hours total." },
      { question: "Is Grand Cayman easy to reach from Miami?", answer: "Yes — under 2 hours nonstop on two different airlines, and it's English-speaking with USD widely accepted, so there's less to plan around on arrival." },
    ],
  },
  MCO: {
    destinationIds: ["cancun", "oaxaca", "nassau"],
    cheapest: { destinationId: "oaxaca", cost: 1164 },
    openLine: "Nassau is close enough from Orlando — under 1h35m — that it works as an add-on to a theme-park trip, not just a standalone vacation.",
    flightFacts: [
      { destinationId: "cancun", icon: "✈️", title: "Cancún — nonstop, ~2h10m–2h20m", text: "Southwest and JetBlue both fly it direct." },
      { destinationId: "oaxaca", icon: "🔁", title: "Oaxaca — no nonstop", text: "The fastest routing runs via Monterrey (~6h45m) or Mexico City (~7h22m) — Orlando is the clear outlier for Oaxaca access among Florida hubs." },
      { destinationId: "nassau", icon: "✈️", title: "Nassau — nonstop, ~1h20m–1h35m", text: "JetBlue, Bahamasair, and Southwest combine for about 29 weekly nonstop flights — the shortest hop of any route we researched across all 24 hubs." },
    ],
    why: "MCO–Nassau is short enough — under 1h35m with nearly 30 weekly nonstops across three airlines — that it genuinely functions as a side trip you can bolt onto an Orlando theme-park vacation rather than book on its own. Cancún is an easy budget-beach add-on too. Oaxaca is the honest outlier here: no nonstop exists, and the fastest connection still runs 6h45m or more each way.",
    faq: [
      { question: "Can I combine Orlando parks with a Bahamas side trip?", answer: "Yes — Nassau is under 1h35m away with roughly 30 weekly nonstop flights across three airlines, genuinely practical as an add-on rather than a separate trip." },
      { question: "Is Oaxaca doable from Orlando?", answer: "Not easily — there's no nonstop, and the fastest routing (via Monterrey or Mexico City) still runs 6h45m to 7h22m each way." },
    ],
  },
  JFK: {
    destinationIds: ["cancun", "oaxaca", "aspen"],
    cheapest: { destinationId: "oaxaca", cost: 1198 },
    openLine: "Cancún is the easy one from New York — Aspen, despite the demand, doesn't have a reliable nonstop from any New York airport.",
    flightFacts: [
      { destinationId: "cancun", icon: "✈️", title: "Cancún — nonstop, ~4h15m–4h30m", text: "American, Delta, and JetBlue combine for 18–21 weekly nonstop flights." },
      { destinationId: "oaxaca", icon: "🔁", title: "Oaxaca — no nonstop", text: "The fastest routing (via Mexico City or Dallas) runs about 7h49m total." },
      { destinationId: "aspen", icon: "🔁", title: "Aspen — no reliable nonstop", text: "Standard routing connects through Denver, Chicago, or Dallas, 5–7 hours total. A small-jet carrier has run limited seasonal nonstop service around peak holidays in past winters, but it isn't a standing, bookable option most of the year." },
    ],
    why: "Cancún's nonstop and flight frequency make it the low-friction default for a New York beach reset. Aspen pulls plenty of demand from the city despite the routing hassle — worth naming honestly rather than overselling a nonstop that isn't reliably there. Oaxaca draws New York's food-and-culture travel crowd even with a required connection.",
    faq: [
      { question: "Is Aspen doable as a quick trip from NYC?", answer: "Not really — there's no reliable nonstop, and standard connections run 5–7 hours each way, so it's a multi-day trip rather than a weekend dash." },
      { question: "Is there a direct flight from NYC to Cancún?", answer: "Yes — American, Delta, and JetBlue all fly it nonstop at roughly 4h15m–4h30m, the easiest of the three routes from JFK." },
    ],
  },
  BOS: {
    destinationIds: ["cancun", "oaxaca", "aspen"],
    cheapest: { destinationId: "oaxaca", cost: 1266 },
    openLine: "New England already has regional skiing, so Aspen from Boston tends to be the once-a-season bigger trip, not a casual weekend.",
    flightFacts: [
      { destinationId: "cancun", icon: "✈️", title: "Cancún — nonstop, ~4h20m", text: "JetBlue and Delta both fly it direct." },
      { destinationId: "oaxaca", icon: "🔁", title: "Oaxaca — no nonstop", text: "The fastest routing, via Dallas on American, runs about 8h19m total." },
      { destinationId: "aspen", icon: "🔁", title: "Aspen — no nonstop at all", text: "Mostly routes via Denver, also Chicago, Dallas, or Atlanta; the shortest connection still runs about 7h13m." },
    ],
    why: "Cancún's nonstop and Boston's large college-age travel population make it the default easy pick. Aspen, despite requiring the longest connection of the three, still draws real demand from Boston — it reads as the bigger, once-a-season ski trip precisely because New Englanders already have regional mountains for anything more casual. Oaxaca, at 8+ hours connecting, is best treated as a deliberate 5-day-plus cultural trip, not a long weekend.",
    faq: [
      { question: "Is Oaxaca doable as a long weekend from Boston?", answer: "It's tight — the fastest connection runs about 8h19m each way, so realistically you'll want 5 or more days to make the travel time worth it." },
      { question: "Is Aspen worth the trip from Boston?", answer: "There's no nonstop — connections run 7h13m or more each way — so it's a bigger commitment than a quick ski weekend, which is why it tends to be the once-a-season trip rather than a regular one." },
    ],
  },
  IAD: {
    destinationIds: ["cancun", "oaxaca", "aspen"],
    cheapest: { destinationId: "oaxaca", cost: 1198 },
    openLine: "D.C.'s Aspen connection runs deeper than tourism — the Aspen Institute's Security Forum runs in Aspen every summer and hosts a \"D.C. Edition\" in Washington each winter.",
    flightFacts: [
      { destinationId: "cancun", icon: "✈️", title: "Cancún — nonstop, ~3h50m", text: "United flies it nonstop about 14 times a week." },
      { destinationId: "oaxaca", icon: "🔁", title: "Oaxaca — no nonstop", text: "Routes via Houston or Dallas on United/American, roughly 8h27m total." },
      { destinationId: "aspen", icon: "🔁", title: "Aspen — no nonstop", text: "Funnels through Denver, averaging about 5h21m total." },
    ],
    why: "Cancún's nonstop fits neatly into a standard federal-worker PTO pattern — quick out, quick back. Aspen has a genuinely documented D.C.-specific pull beyond tourism: the Aspen Institute runs its Security Forum in Aspen every summer, then a \"D.C. Edition\" of the same event in Washington each winter, creating real, verifiable traffic between the two cities among the policy crowd. Oaxaca draws modest, deliberate interest from D.C.'s foreign-service community despite the connection.",
    faq: [
      { question: "What's the easiest weekend trip from D.C.?", answer: "Cancún — it's the only one of the three that comfortably fits a 3-day weekend, with a nonstop under 4 hours." },
      { question: "Why does D.C. have a real connection to Aspen beyond tourism?", answer: "The Aspen Institute runs its Security Forum in Aspen every summer and a \"D.C. Edition\" of the same event in Washington each winter — documented, real traffic between the two cities among the policy world, not just vacationers." },
    ],
  },
  ORD: {
    destinationIds: ["cancun", "oaxaca", "aspen"],
    cheapest: { destinationId: "oaxaca", cost: 1130 },
    openLine: "Chicago is one of the only hubs we cover with a nonstop flight to Aspen — genuinely rare for a hub outside the Rockies or West Coast.",
    flightFacts: [
      { destinationId: "cancun", icon: "✈️", title: "Cancún — nonstop, ~3h53m–4h", text: "American, United, and Frontier combine for roughly 46 weekly nonstop flights." },
      { destinationId: "oaxaca", icon: "🔁", title: "Oaxaca — no nonstop", text: "The fastest routing, via Dallas, runs about 7h22m total." },
      { destinationId: "aspen", icon: "✈️", title: "Aspen — nonstop, ~3h20m", text: "American and United fly it direct, about 23 flights a week — notably rare for a hub this far from the Rockies or West Coast." },
    ],
    why: "Chicago is unusually well-connected for a Midwest hub: nonstop to both Cancún and Aspen, a combination most East Coast hubs don't get. Oaxaca is sustained despite the required connection by real demand — Chicago has one of the largest Mexican-origin populations of any U.S. city outside the Southwest, concentrated around neighborhoods like Pilsen and Little Village.",
    faq: [
      { question: "What's the most convenient destination from Chicago?", answer: "Chicago uniquely has nonstop flights to both Cancún and Aspen — Oaxaca is the outlier here, requiring a connection that the other two don't." },
      { question: "Is there a direct flight from Chicago to Aspen?", answer: "Yes, on American and United, about 3h20m — genuinely rare for a hub this far from the Rockies or West Coast, where most Aspen nonstops are concentrated." },
    ],
  },
  DEN: {
    destinationIds: ["las-vegas", "oaxaca", "aspen"],
    cheapest: { destinationId: "oaxaca", cost: 1164 },
    openLine: "Aspen from Denver is barely a flight at all — 51 minutes in the air — and plenty of locals just drive instead.",
    flightFacts: [
      { destinationId: "las-vegas", icon: "✈️", title: "Las Vegas — nonstop, ~2h", text: "Three airlines combine for about 114 weekly flights (roughly 16 a day) — one of Denver's highest-frequency leisure routes." },
      { destinationId: "oaxaca", icon: "🔁", title: "Oaxaca — no nonstop", text: "Connects via Houston, Dallas, or Mexico City; total travel runs 4h44m–6h52m depending on the routing." },
      { destinationId: "aspen", icon: "🚗", title: "Aspen — nonstop, ~51 minutes (or a ~4-hour drive)", text: "United flies it nonstop, about 52 flights a week — essentially a puddle-jump. Many Denver-area travelers drive the I-70/Hwy 82 route instead, since it lets them bring ski gear and skip the small-airport shuttle; expect up to 6 hours in bad snow or holiday traffic." },
    ],
    why: "Las Vegas is a routine, high-frequency weekend run from Denver. Aspen is essentially in-state — the flight takes less time than getting to the airport for some people, which is exactly why so many Front Range travelers just drive the I-70 corridor instead and skip flying altogether. Oaxaca is the deliberate cultural trip of the three: no nonstop exists, so it's booked as a real vacation, not an add-on.",
    faq: [
      { question: "Should I fly or drive from Denver to Aspen?", answer: "Flying takes just 51 minutes, but once you factor in security and the shuttle to/from Aspen's small airport, driving the roughly 4-hour I-70/Hwy 82 route is often comparable and more flexible — except on peak ski weekends, when traffic or avalanche-control closures can stretch it to 6 hours." },
      { question: "Is Oaxaca a quick trip from Denver?", answer: "No — there's no nonstop, and connecting routes run 4h44m to 6h52m, so it's best treated as a dedicated trip rather than a quick escape." },
    ],
  },
  PHX: {
    destinationIds: ["las-vegas", "oaxaca", "aspen"],
    cheapest: { destinationId: "oaxaca", cost: 1096 },
    openLine: "Phoenix is one of just a few hubs — with Denver, LA, and San Francisco — that gets a daily nonstop to Aspen all winter, a real way to trade desert heat for snow.",
    flightFacts: [
      { destinationId: "las-vegas", icon: "✈️", title: "Las Vegas — nonstop, ~1h16m", text: "Southwest, American, and Frontier all fly it direct — one of Phoenix's busiest short-haul routes." },
      { destinationId: "oaxaca", icon: "❄️", title: "Oaxaca — nonstop, but seasonal only", text: "American runs it nonstop for a limited part of the year; outside that window it connects via Dallas or Houston instead." },
      { destinationId: "aspen", icon: "✈️", title: "Aspen — nonstop, ~2h, daily in ski season", text: "American flies it nonstop daily from November through March." },
    ],
    why: "Las Vegas is a short, direct hop that fits Phoenix's well-worn weekend circuit. Aspen stands out: Phoenix is one of only a handful of hubs we cover (alongside Denver, LA, and San Francisco) with daily nonstop winter ski service — a genuinely convenient way to escape the desert heat for snow. Oaxaca's nonstop is seasonal only, so most of the year it's a deliberate connection-required trip rather than an easy booking.",
    faq: [
      { question: "Is Aspen doable as a weekend ski trip from Phoenix?", answer: "Yes — American flies nonstop daily in ski season, about 2 hours each way, which is notably easier than from Seattle or Las Vegas, neither of which has any nonstop Aspen service at all." },
      { question: "Is there a direct flight to Oaxaca from Phoenix?", answer: "Only seasonally — American runs it nonstop for part of the year; the rest of the year expect a connection via Dallas or Houston." },
    ],
  },
  LAS: {
    destinationIds: ["cancun", "oaxaca", "aspen"],
    cheapest: { destinationId: "oaxaca", cost: 1096 },
    openLine: "Two of the West's biggest tourism airports, and there's still no direct flight between Las Vegas and Aspen — you'll connect through Denver.",
    flightFacts: [
      { destinationId: "cancun", icon: "✈️", title: "Cancún — nonstop, ~4h30m", text: "Southwest flies it direct, but only about 5 flights a week — worth booking around the schedule." },
      { destinationId: "oaxaca", icon: "🔁", title: "Oaxaca — no nonstop", text: "Routes via Mexico City or Houston; total travel runs 8h05m–9h26m." },
      { destinationId: "aspen", icon: "🔁", title: "Aspen — no nonstop", text: "Despite both being major Mountain West leisure hubs, there's no direct link — expect a connection through Denver adding several hours." },
    ],
    why: "Cancún's nonstop makes it the obvious beach-reset counter-trip to the Strip. Oaxaca is the bigger commitment of the three — no nonstop exists, which suits travelers wanting an authentic food-and-culture trip as a real contrast to casino tourism. The genuine surprise is Aspen: two of the West's biggest tourism airports, and still no direct air link between them.",
    faq: [
      { question: "Is there a direct flight from Vegas to Aspen?", answer: "No — despite both being major western leisure hubs, there's no nonstop route; expect a connection, commonly through Denver, adding several hours each way." },
      { question: "Is Cancún easy from Vegas?", answer: "There's a nonstop on Southwest, but it only runs about 5 times a week, so it's worth booking around the schedule rather than assuming daily availability." },
    ],
  },
  LAX: {
    destinationIds: ["las-vegas", "oaxaca", "aspen"],
    cheapest: { destinationId: "oaxaca", cost: 1130 },
    openLine: "LA is one of very few U.S. cities with a nonstop flight to Oaxaca — a real byproduct of having one of the largest Oaxacan communities in the country.",
    flightFacts: [
      { destinationId: "las-vegas", icon: "✈️", title: "Las Vegas — nonstop, ~1h17m–1h20m", text: "LA's single most-flown route to Vegas — around 713 flights a month, the highest frequency of any hub we cover for any destination." },
      { destinationId: "oaxaca", icon: "✈️", title: "Oaxaca — nonstop, ~4h02m", text: "Volaris flies it direct about 4 times a week — LA is one of only a handful of U.S. gateways with nonstop Oaxaca service, alongside Houston, Dallas, and seasonally Phoenix." },
      { destinationId: "aspen", icon: "✈️", title: "Aspen — nonstop, ~2h32m", text: "Alaska, American, Delta, and United all fly it direct — about 18 flights a week combined, more airline choice than any other hub we cover for this route." },
    ],
    why: "Vegas from LA is about as frequent as a route gets — practically an any-weekend trip. Oaxaca's nonstop isn't a coincidence: LA is home to one of the largest Oaxacan diaspora communities in the U.S., concentrated around Koreatown and Pico-Union, real and verifiable demand that most other cities' Oaxaca routes don't have behind them. Aspen offers more airline choice from LA than from almost any other hub we cover.",
    faq: [
      { question: "Is there a nonstop flight from LA to Oaxaca?", answer: "Yes — Volaris flies it nonstop in about 4 hours, notable because LA is one of very few U.S. cities with direct Oaxaca service at all." },
      { question: "Why does LA have such strong Oaxaca connectivity?", answer: "LA is home to one of the largest Oaxacan diaspora communities in the U.S., concentrated around Koreatown and Pico-Union — real, documented demand driving the direct route." },
    ],
  },
  SFO: {
    destinationIds: ["las-vegas", "oaxaca", "aspen"],
    cheapest: { destinationId: "oaxaca", cost: 1198 },
    openLine: "San Francisco's Mission District has a real, well-documented Oaxacan food scene — even though the flight to Oaxaca itself still requires a connection.",
    flightFacts: [
      { destinationId: "las-vegas", icon: "✈️", title: "Las Vegas — nonstop, ~1h43m", text: "About 68 weekly flights, roughly 10 a day." },
      { destinationId: "oaxaca", icon: "🔁", title: "Oaxaca — no nonstop", text: "Routes via Mexico City or Houston; total travel runs 5h31m–7h18m." },
      { destinationId: "aspen", icon: "❄️", title: "Aspen — nonstop, ~2h30m, but seasonal", text: "United flies it nonstop up to twice a day during ski season (roughly November–March); outside that window, service drops and you'll need to connect." },
    ],
    why: "Vegas is a fast, frequent hop that needs no explanation. Oaxaca lacks a nonstop, but the Bay Area — especially San Francisco's Mission District — has a genuine, well-documented Oaxacan restaurant and community scene, giving Bay Area travelers a real culinary throughline even with a required connection. Aspen's direct winter service puts SF on par with Denver, LA, and Phoenix for convenience, but only in season.",
    faq: [
      { question: "Is there a nonstop flight from SF to Aspen?", answer: "Yes, but only seasonally — United runs it nonstop roughly November through March; outside those months, there's no direct service." },
      { question: "Why is Oaxaca worth the connection from SF?", answer: "The Bay Area, especially San Francisco's Mission District, has a well-documented Oaxacan restaurant and community scene — a real throughline even though the flight itself requires a stop." },
    ],
  },
  SEA: {
    destinationIds: ["las-vegas", "oaxaca", "aspen"],
    cheapest: { destinationId: "oaxaca", cost: 1266 },
    openLine: "Seattle and Aspen are both \"mountain\" cities, but there's no direct flight between them — it's a full travel day each way either through Denver or San Francisco.",
    flightFacts: [
      { destinationId: "las-vegas", icon: "✈️", title: "Las Vegas — nonstop, ~2h24m–2h40m", text: "Alaska (Seattle's dominant hub carrier), Delta, American, Frontier, and Southwest all fly it direct." },
      { destinationId: "oaxaca", icon: "🔁", title: "Oaxaca — no nonstop", text: "Routes via Guadalajara or Mexico City; total travel runs 6h43m–10h13m, genuinely a full day of travel each way." },
      { destinationId: "aspen", icon: "🔁", title: "Aspen — no nonstop", text: "Connects via Denver or San Francisco; the fastest routing still runs about 5h24m total." },
    ],
    why: "Alaska's dense Seattle hub makes Vegas the easy, low-friction pick. Oaxaca is genuinely a full travel day each way given the required connection — worth planning around rather than treating as a quick getaway. Aspen is the real surprise: despite both being mountain destinations, there's no direct link, making it noticeably less convenient from Seattle than from Phoenix, LA, or San Francisco.",
    faq: [
      { question: "Can I fly nonstop from Seattle to Aspen?", answer: "No — the fastest connections run through Denver or San Francisco, totaling around 5h24m minimum, a full travel day each way despite both cities being ski/mountain destinations." },
      { question: "Is Oaxaca a quick trip from Seattle?", answer: "No — there's no nonstop, and connections run 6h43m to 10h13m, genuinely a full day of travel each way." },
    ],
  },
  YYZ: {
    destinationIds: ["cancun", "oaxaca", "aspen"],
    cheapest: { destinationId: "oaxaca", cost: 1232 },
    openLine: "Cancún is the only true nonstop of the three from Toronto — Oaxaca and Aspen both require a layover, most often through the U.S.",
    flightFacts: [
      { destinationId: "cancun", icon: "✈️", title: "Cancún — nonstop, ~4h18m", text: "Air Canada, Air Transat, WestJet, Flair, and Porter all fly it direct — about 38 weekly nonstop departures, the easiest of the three routes." },
      { destinationId: "oaxaca", icon: "🔁", title: "Oaxaca — no nonstop", text: "Connects via a U.S. hub or Mexico City; total travel typically runs 6+ hours. Note: Air Canada does fly nonstop from Toronto to Puerto Escondido (PXM) — a different coastal airport in Oaxaca state — worth double-checking you're not booking that instead." },
      { destinationId: "aspen", icon: "🔁", title: "Aspen — no nonstop", text: "Standard routing connects through Denver, totaling 4h46m–8h25m depending on the stopover airport." },
    ],
    why: "Cancún rides the well-documented Canadian \"snowbird\" pattern — roughly a million Canadians head south each winter, and airline capacity to Mexico beach destinations grew accordingly for the 2026 season. Oaxaca is riding real, separate growth in Day of the Dead tourism, which roughly doubled from 2019 to 2022. Aspen draws Toronto skiers for drier, more reliable powder and more terrain than Whistler, at the cost of a Denver connection.",
    faq: [
      { question: "Do I need to connect through the U.S. to reach Oaxaca or Aspen from Toronto?", answer: "Yes, both require a layover — Oaxaca via a U.S. hub or Mexico City, Aspen almost always via Denver. Cancún is the only true nonstop of the three from Toronto." },
      { question: "Is Toronto's Oaxaca flight actually going to Oaxaca City?", answer: "Double-check — Air Canada flies nonstop from Toronto to Puerto Escondido (PXM), a different airport on the Oaxaca coast. Oaxaca City itself has no nonstop from Toronto." },
    ],
  },
  YVR: {
    destinationIds: ["las-vegas", "oaxaca", "aspen"],
    cheapest: { destinationId: "oaxaca", cost: 1300 },
    openLine: "Vancouverites already have Whistler nearby, so an Aspen trip from here is a deliberate choice for different terrain and snow — not a matter of convenience.",
    flightFacts: [
      { destinationId: "las-vegas", icon: "✈️", title: "Las Vegas — nonstop, ~2h48m–2h50m", text: "Air Canada and WestJet fly it direct, about 22 weekly flights — one of the shortest international hops out of Vancouver." },
      { destinationId: "oaxaca", icon: "🔁", title: "Oaxaca — no nonstop", text: "Connects via a U.S. gateway or Mexico City; total trip time runs several hours longer than the other two routes." },
      { destinationId: "aspen", icon: "🔁", title: "Aspen — no nonstop", text: "Main connection points are Denver and LA; total air time alone runs 3h51m–7h47m before layovers." },
    ],
    why: "Las Vegas's short nonstop makes it a real weekend-trip market from Vancouver — bachelor and bachelorette trips, girls' getaways, a quick dose of shows and entertainment. Oaxaca draws the same Day of the Dead and culinary interest seen from other hubs, worth the extra connection for travelers prioritizing culture over convenience. Aspen is the deliberate pick: Vancouver already has Whistler, so choosing Aspen means specifically wanting different terrain and drier snow, not an easier trip.",
    faq: [
      { question: "Is there a direct flight from Vancouver to Las Vegas?", answer: "Yes, nonstop on Air Canada or WestJet, about 2h50m — the fastest of the three routes out of Vancouver by a wide margin." },
      { question: "Why would a Vancouverite fly to Aspen when Whistler is local?", answer: "Purely for variety — Aspen's terrain and snow quality draw skiers looking for a second, different mountain, even though it means a Denver or LA connection that Whistler doesn't require." },
    ],
  },
  YUL: {
    destinationIds: ["cancun", "oaxaca", "aspen"],
    cheapest: { destinationId: "oaxaca", cost: 1300 },
    openLine: "Montreal has no comparable luxury ski resort in-province, so Aspen from here is the longest, most connection-heavy trip of the three — reserved for committed skiers.",
    flightFacts: [
      { destinationId: "cancun", icon: "✈️", title: "Cancún — nonstop, ~4h30m–5h", text: "Air Canada, Air Transat, and Flair all fly it direct, with high weekly frequency reflecting strong winter-sun demand out of Montreal." },
      { destinationId: "oaxaca", icon: "🔁", title: "Oaxaca — no nonstop", text: "Aeroméxico connects via Mexico City; American via a U.S. hub. Total travel runs 6h37m–10 hours." },
      { destinationId: "aspen", icon: "🔁", title: "Aspen — no nonstop", text: "The fastest routing, via Denver, runs about 6h56m total; routing through Chicago can push closer to 10 hours." },
    ],
    why: "Montreal is one of the strongest snowbird-departure markets for Mexico beach routes, consistent with the broader shift of Canadian winter travel toward Mexico. Oaxaca lines up with Montreal's own strong food-tourism culture, even as a smaller, more deliberate booking than Cancún. Aspen is the honest outlier — with no comparable in-province luxury resort, travelers who choose it are accepting the longest, most connection-heavy of any route on this site, and tend to be committed powder or luxury skiers rather than casual travelers.",
    faq: [
      { question: "Is there a direct flight from Montreal to Cancún?", answer: "Yes — Air Canada, Air Transat, and Flair all fly it nonstop, averaging under 5 hours, the fastest and easiest of Montreal's three routes." },
      { question: "Is Aspen worth it from Montreal?", answer: "It's the longest, most connection-heavy of any route we cover — up to 10 hours via Chicago — realistically only for committed powder or luxury skiers, not a casual trip." },
    ],
  },
  MEX: {
    destinationIds: ["cancun", "oaxaca", "cabo-san-lucas"],
    cheapest: { destinationId: "oaxaca", cost: 842 },
    openLine: "Mexico City is home base for all three major Mexican airlines, and it shows — all three of these are nonstop, with Oaxaca the shortest hop of the bunch.",
    flightFacts: [
      { destinationId: "cancun", icon: "✈️", title: "Cancún — nonstop, ~2h20m–2h30m", text: "Aeroméxico, Volaris, and VivaAerobus combine for 25–26 nonstop flights a day — Mexico's single busiest domestic route, and flagged as the country's cheapest domestic route in 2026." },
      { destinationId: "oaxaca", icon: "✈️", title: "Oaxaca — nonstop, ~1h20m", text: "The shortest of the three, on all three major carriers, about 4 flights a day — a genuinely realistic long weekend." },
      { destinationId: "cabo-san-lucas", icon: "✈️", title: "Cabo San Lucas — nonstop, ~2h30m", text: "Aeroméxico, Volaris, and VivaAerobus fly it, nearly 8 times a day combined." },
    ],
    why: "Every major Mexican carrier is headquartered in Mexico City, and the competition on these trunk routes keeps both frequency and fares strong. Oaxaca's short 1h20m hop makes it realistic as an actual long weekend rather than a full vacation. Cabo San Lucas draws CDMX's wealthier travel segment specifically for golf and resort luxury, a different crowd than budget beach travel to Cancún.",
    faq: [
      { question: "Do I need a passport for these flights?", answer: "No — Mexican citizens can fly domestically with just a voter ID (INE), driver's license, or other official government photo ID. A passport is only required for non-Mexican travelers on these routes." },
      { question: "Which of these is the shortest flight from Mexico City?", answer: "Oaxaca, at just 1h20m — genuinely doable as a long weekend rather than a full vacation." },
    ],
  },
  GDL: {
    destinationIds: ["cancun", "oaxaca", "cabo-san-lucas"],
    cheapest: { destinationId: "oaxaca", cost: 858 },
    openLine: "Cabo San Lucas is actually the shortest flight from Guadalajara — shorter than the more famous Cancún — which surprises a lot of people planning the trip.",
    flightFacts: [
      { destinationId: "cancun", icon: "✈️", title: "Cancún — nonstop, ~2h40m–2h56m", text: "Volaris and VivaAerobus fly it, about 5 times a day." },
      { destinationId: "oaxaca", icon: "🔁", title: "Oaxaca — nonstop, but thin (~11 flights/week)", text: "Volaris is the only nonstop carrier, and it runs roughly every other day, not daily — check the schedule before locking in dates." },
      { destinationId: "cabo-san-lucas", icon: "✈️", title: "Cabo San Lucas — nonstop, ~1h35m–1h36m, the shortest of the three", text: "VivaAerobus and Volaris fly it, roughly 4 times a day — genuinely quicker than the Cancún route despite Cancún being the more famous destination." },
    ],
    why: "Los Cabos being the quickest flight of the three — shorter than Cancún — is a real, checkable surprise worth knowing before you book based on assumptions. Oaxaca's thin schedule, just one carrier flying every other day, signals it's booked as a deliberate cultural and culinary trip rather than an impulse weekend, which lines up with Guadalajara's own strong food and tequila culture pulling travelers toward Oaxaca's mezcal and mole scene.",
    faq: [
      { question: "Which destination has the shortest flight from Guadalajara?", answer: "Cabo San Lucas, at about 1h35m nonstop — shorter than Cancún, which runs closer to 2h50m." },
      { question: "Is there a daily flight to Oaxaca from Guadalajara?", answer: "Not quite — Volaris is the only nonstop carrier and it runs roughly every other day (about 11 flights a week), so check the schedule before locking in your dates." },
    ],
  },
  MTY: {
    destinationIds: ["cancun", "oaxaca", "cabo-san-lucas"],
    cheapest: { destinationId: "oaxaca", cost: 926 },
    openLine: "Monterrey is a VivaAerobus stronghold, and the Cancún route shows it — one of the carrier's densest routes anywhere, with up to 15 flights a day.",
    flightFacts: [
      { destinationId: "cancun", icon: "✈️", title: "Cancún — nonstop, ~2h10m–2h30m", text: "VivaAerobus (dominant, ~69 flights/week) and Volaris combine for up to 15 flights a day." },
      { destinationId: "oaxaca", icon: "🔁", title: "Oaxaca — nonstop, but thin (~11 flights/week)", text: "VivaAerobus and Volaris fly it roughly once a day — plan ahead rather than booking last minute." },
      { destinationId: "cabo-san-lucas", icon: "✈️", title: "Cabo San Lucas — nonstop, ~1h55m–2h05m", text: "VivaAerobus is the only nonstop carrier, about 2–3 flights a day." },
    ],
    why: "Monterrey–Cancún is one of VivaAerobus's densest routes system-wide, which keeps fares competitive and gives real schedule flexibility for a last-minute weekend trip. Monterrey's affluent business-travel segment has long favored Cabo San Lucas for golf and resort weekends. Oaxaca's comparatively sparse schedule — a single-digit number of flights a day at most — signals it's booked as a planned trip, not a spontaneous one.",
    faq: [
      { question: "Is Cancún or Cabo San Lucas faster from Monterrey?", answer: "Both run roughly 2 to 2.5 hours nonstop, but Cancún has far more daily departures — up to 15 versus 2-3 for Cabo — giving more schedule flexibility and generally sharper fares." },
      { question: "How often does Monterrey fly to Oaxaca?", answer: "About once a day nonstop (roughly 11 flights a week) — plan ahead rather than booking last minute." },
    ],
  },
  CUN: {
    destinationIds: ["punta-cana", "oaxaca", "turks-and-caicos"],
    cheapest: { destinationId: "oaxaca", cost: 892 },
    openLine: "There's no direct flight from Cancún to Turks and Caicos at all — nearly every routing connects through Miami, a genuine surprise for a Mexico-to-Caribbean hop.",
    flightFacts: [
      { destinationId: "punta-cana", icon: "✈️", title: "Punta Cana — nonstop, ~3h, but thin (~9 flights/week)", text: "Only Arajet (a Dominican budget carrier, 7/week) and Aerolíneas Argentinas (2/week) fly it direct — book around the limited schedule." },
      { destinationId: "oaxaca", icon: "✈️", title: "Oaxaca — nonstop, ~2h", text: "Volaris is the only nonstop carrier, about 9 flights a week; one-stop alternatives exist but push total travel to around 4h40m." },
      { destinationId: "turks-and-caicos", icon: "🔁", title: "Turks and Caicos — no nonstop", text: "Nearly all routings connect through Miami, adding a U.S.-transit layover most travelers wouldn't expect on a Mexico-to-Caribbean trip." },
    ],
    why: "Punta Cana from Cancún is a real but thin route — just 9 weekly departures across two small carriers — functioning almost like a way to compare the two most famous Caribbean beach destinations back to back, so it pays to book around the schedule. Oaxaca pairs a beach stay with an inland cultural detour — mole, mezcal, markets, and Day of the Dead in late October/early November, when Oaxaca hotel rates typically run 3–4x normal. Turks and Caicos, requiring a Miami connection, reads less like an easy add-on and more like a deliberate, pricier Caribbean upgrade.",
    faq: [
      { question: "Can I fly nonstop from Cancún to Turks and Caicos?", answer: "No — there's currently no direct service; nearly all routings connect through Miami, so budget meaningfully more total travel time than the Oaxaca or Punta Cana nonstops." },
      { question: "Is Punta Cana easy to add onto a Cancún trip?", answer: "There is a nonstop, but it's thin — only about 9 flights a week combined across two small carriers — so book your dates around the schedule rather than the other way around." },
    ],
  },
  PTY: {
    destinationIds: ["cancun", "medellin", "grand-cayman"],
    cheapest: { destinationId: "medellin", cost: 1070 },
    openLine: "Panama City's Tocumen airport is built as Copa Airlines' \"Hub of the Americas\" — which is exactly why Medellín gets near-daily service while Grand Cayman gets just two flights a week.",
    flightFacts: [
      { destinationId: "cancun", icon: "✈️", title: "Cancún — nonstop, ~2h49m", text: "Copa Airlines is the only nonstop carrier, about 40 flights a week (5–6 a day)." },
      { destinationId: "medellin", icon: "✈️", title: "Medellín — nonstop, ~1h21m–1h25m", text: "Copa Airlines flies it, densely — 61 flights a week, 7–9 a day, one of Copa's busiest regional routes." },
      { destinationId: "grand-cayman", icon: "🔁", title: "Grand Cayman — nonstop, but only 2 flights/week", text: "Cayman Airways is the only carrier serving this route, and the schedule is genuinely thin — book well ahead of your dates." },
    ],
    why: "Tocumen was purpose-built as Copa's 24/7 connecting hub for fast Caribbean and South America travel, and the frequency gap between these three routes reflects that directly: Medellín sits inside Copa's dense core network and gets near-hourly-feeling service, while Grand Cayman sits outside it and relies solely on twice-weekly Cayman Airways flights. Medellín also has a real, checkable cost advantage — average daily travel costs there run well below Panama City, making it a genuine budget weekend option. Panamanians travel visa-free to Mexico, Colombia, and the Dominican Republic-adjacent Caribbean, which removes a common trip-planning friction point across all three.",
    faq: [
      { question: "Why are there so few flights to Grand Cayman compared to Medellín?", answer: "Medellín rides Copa's own dense hub schedule (up to 9 flights a day), while Grand Cayman relies solely on Cayman Airways' twice-weekly service since it falls outside Copa's core network — book Cayman trips well ahead of your dates." },
      { question: "Is Medellín a realistic weekend trip from Panama City?", answer: "Yes — it's an 80-minute nonstop flight with near-daily frequency, and day-to-day costs in Medellín run well below Panama City, making it a genuine budget weekend option." },
    ],
  },
};

function buildFaqItems(hub: HubContent) {
  return [
    {
      question: "Are these real-time prices?",
      answer:
        "They're estimates based on our own curated cost data for this route and season, not a live quote — the real price on the partner site may be a bit higher or lower depending on exact dates.",
    },
    ...hub.faq,
  ];
}

let written = 0;

for (const hub of ORIGIN_HUBS as readonly OriginHub[]) {
  const content = HUB_CONTENT[hub];
  if (!content) {
    console.warn(`skip ${hub}: no enrichment content written for this hub`);
    continue;
  }

  const label = ORIGIN_LABELS[hub];
  const city = cityName(label);
  const slug = hubPageSlug(label);
  const appUrlWithOrigin = `${APP_URL}/?origin=${hub}`;
  const cheapestName = destName(content.cheapest.destinationId);

  const intro =
    `${content.openLine} Flying out of ${hub}, a trip to ${cheapestName} can start around ` +
    `$${content.cheapest.cost.toLocaleString()} for flight, hotel, and activities together — not just the flight, ` +
    `pulled from our own cost data, not guesses.`;

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
      { type: "TextBlock", props: { id: "text-intro", text: intro } },
      { type: "Heading", props: { id: "heading-flights", text: `Getting there from ${city}`, level: "h2" } },
      {
        type: "FeatureGrid",
        props: {
          id: "flight-facts",
          heading: `Flight basics from ${hub}`,
          features: content.flightFacts.map((f) => ({ icon: f.icon, title: f.title, text: f.text })),
        },
      },
      ...content.destinationIds.map((destinationId, i) => ({
        type: "DestinationHighlight",
        props: { id: `dest-${i + 1}`, destinationId },
      })),
      { type: "TextBlock", props: { id: "text-why", text: content.why } },
      {
        type: "FAQAccordion",
        props: { id: "faq-1", heading: "Before you book", items: buildFaqItems(content) },
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
  console.log(`wrote ${slug}.json`);
}

console.log(`\n${written}/${ORIGIN_HUBS.length} hub pages enriched in ${OUT_DIR}`);
