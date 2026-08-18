import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { writeFirestoreDocument, destinations, ORIGIN_LABELS } from "@aritrips/data";
import { getAdminSession } from "../../../lib/requireAdminSession";

export const prerender = false;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const destinationIds = new Set(destinations.map((d) => d.id));
const originCodes = new Set(Object.keys(ORIGIN_LABELS));

// Precios cargados a mano (2026-08-18, a pedido del usuario: "si es
// posible que yo mismo colabore buscando precios y pasandotelos") — el
// mismo esquema que ya escribe apps/price-sync a `priceHistory`, con
// source:"manual" para distinguirlos en el admin. Nunca toca `livePrices`
// (el precio que ve el usuario del sitio) — un solo chequeo manual no
// debería mover lo que se muestra en producción, solo suma una fila más
// al historial de investigación.
export const POST: APIRoute = async ({ request, cookies }) => {
  const session = await getAdminSession(cookies, env);
  if (!session) return json({ error: "Not logged in." }, 401);

  const { FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = env;
  if (!FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) return json({ error: "Not configured." }, 503);
  const credentials = { clientEmail: FIREBASE_CLIENT_EMAIL, privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") };

  let body: { destinationId?: string; originAirportCode?: string; price?: number; departureDate?: string; sourceSite?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const { destinationId, originAirportCode, price, departureDate, sourceSite, note } = body;

  if (!destinationId || !destinationIds.has(destinationId)) return json({ error: "Invalid destination." }, 400);
  if (!originAirportCode || !originCodes.has(originAirportCode)) return json({ error: "Invalid origin." }, 400);
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0 || price > 20000) {
    return json({ error: "Price must be a number between 1 and 20000." }, 400);
  }
  const departure = departureDate ? new Date(departureDate) : null;
  if (!departure || Number.isNaN(departure.getTime())) return json({ error: "Invalid departure date." }, 400);
  if (typeof sourceSite !== "string" || sourceSite.trim().length === 0 || sourceSite.length > 40) {
    return json({ error: "Tell us which site you checked (e.g. Kiwi, Google Flights)." }, 400);
  }

  const daysAhead = Math.round((departure.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  const advanceMonthsBucket = Math.max(1, Math.round(daysAhead / 30));
  const searchPeriod = `${departure.getFullYear()}-${String(departure.getMonth() + 1).padStart(2, "0")}`;

  await writeFirestoreDocument(
    "priceHistory",
    {
      type: "flight",
      source: "manual",
      destinationId,
      originAirportCode,
      avgFlightCostUSD: Math.round(price),
      searchPeriod,
      capturedAt: new Date().toISOString(),
      advanceMonthsBucket,
      sourceSite: sourceSite.trim().slice(0, 40),
      note: typeof note === "string" ? note.trim().slice(0, 200) : "",
      enteredBy: session.email,
    },
    credentials
  );

  return json({ ok: true }, 200);
};
