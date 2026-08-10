import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { setDocument } from "@aritrips/data";
import { getAdminSession } from "../../../lib/requireAdminSession";
import {
  DEMO_SIZE_DEFAULTS,
  clampHomeLayoutValue,
  HOME_SECTION_IDS,
  DEFAULT_SECTION_ORDER,
  type DemoSectionSizes,
} from "../../../lib/homeLayoutConfig";

export const prerender = false;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const session = await getAdminSession(cookies, env);
  if (!session) return json({ error: "Not logged in." }, 401);

  const { FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = env;
  if (!FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) return json({ error: "Not configured." }, 503);
  const credentials = { clientEmail: FIREBASE_CLIENT_EMAIL, privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") };

  let body: Partial<Record<keyof DemoSectionSizes, number>> & { sectionOrder?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const data: Record<string, number | string | Date> = { updatedAt: new Date() };
  for (const key of Object.keys(DEMO_SIZE_DEFAULTS) as (keyof DemoSectionSizes)[]) {
    const raw = body[key];
    data[key] = clampHomeLayoutValue(key, typeof raw === "number" ? raw : DEMO_SIZE_DEFAULTS[key]);
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
  data.sectionOrder = JSON.stringify(completeOrder);

  await setDocument("siteConfig", "home", data, credentials);

  return json({ ok: true }, 200);
};
