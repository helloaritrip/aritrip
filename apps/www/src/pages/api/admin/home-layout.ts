import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { setDocument, destinations } from "@aritrips/data";
import { getAdminSession } from "../../../lib/requireAdminSession";
import { HOME_SECTION_IDS, DEFAULT_SECTION_ORDER, DEFAULT_DEMO_TRIP, type DemoTripContent } from "../../../lib/homeLayoutConfig";

export const prerender = false;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const destinationIds = new Set(destinations.map((d) => d.id));

export const POST: APIRoute = async ({ request, cookies }) => {
  const session = await getAdminSession(cookies, env);
  if (!session) return json({ error: "Not logged in." }, 401);

  const { FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = env;
  if (!FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) return json({ error: "Not configured." }, 503);
  const credentials = { clientEmail: FIREBASE_CLIENT_EMAIL, privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") };

  let body: { sectionOrder?: unknown } & Partial<Record<keyof DemoTripContent, unknown>>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  // Firestore (vía setDocument/toFirestoreFields) solo acepta valores
  // planos — un array real se guardaría silencioso como nada, así que va
  // como JSON serializado a mano (ver homeLayoutConfig.ts, que lo
  // deserializa de vuelta al leer).
  const sectionOrder = Array.isArray(body.sectionOrder)
    ? body.sectionOrder.filter((id): id is string => (HOME_SECTION_IDS as readonly string[]).includes(id))
    : DEFAULT_SECTION_ORDER;
  const completeOrder = [...new Set(sectionOrder)];
  for (const id of DEFAULT_SECTION_ORDER) {
    if (!completeOrder.includes(id)) completeOrder.push(id);
  }

  // setDocument hace PATCH sin updateMask — reemplaza el documento
  // COMPLETO, así que TODOS los campos (orden + oferta) se mandan juntos
  // en este único guardado, no en guardados separados que se pisarían
  // entre sí (ver la nota de este mismo bug ya encontrado una vez en
  // set-hub-descriptions.ts).
  const destinationId = typeof body.destinationId === "string" && destinationIds.has(body.destinationId) ? body.destinationId : DEFAULT_DEMO_TRIP.destinationId;
  const total = typeof body.total === "number" && body.total > 0 ? Math.round(body.total) : DEFAULT_DEMO_TRIP.total;
  const flight = typeof body.flight === "number" && body.flight >= 0 ? Math.round(body.flight) : DEFAULT_DEMO_TRIP.flight;
  const hotel = typeof body.hotel === "number" && body.hotel >= 0 ? Math.round(body.hotel) : DEFAULT_DEMO_TRIP.hotel;
  const activities = typeof body.activities === "number" && body.activities >= 0 ? Math.round(body.activities) : DEFAULT_DEMO_TRIP.activities;

  await setDocument(
    "siteConfig",
    "home",
    {
      sectionOrder: JSON.stringify(completeOrder),
      demoDestinationId: destinationId,
      demoFlag: typeof body.flag === "string" ? body.flag.trim().slice(0, 8) : DEFAULT_DEMO_TRIP.flag,
      demoBudgetLabel: typeof body.budgetLabel === "string" && body.budgetLabel.trim() ? body.budgetLabel.trim().slice(0, 40) : DEFAULT_DEMO_TRIP.budgetLabel,
      demoTotal: total,
      demoFlight: flight,
      demoHotel: hotel,
      demoActivities: activities,
      updatedAt: new Date(),
    },
    credentials
  );

  return json({ ok: true }, 200);
};
