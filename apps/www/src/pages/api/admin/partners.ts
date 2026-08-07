import type { APIRoute } from "astro";
import { setDocument, PARTNER_CATEGORIES, type PartnerCategory } from "@aritrips/data";
import { getAdminSession } from "../../../lib/requireAdminSession";

export const prerender = false;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export const PUT: APIRoute = async ({ request, cookies, locals }) => {
  const session = await getAdminSession(cookies, locals.runtime.env);
  if (!session) return json({ error: "Not logged in." }, 401);

  const { FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = locals.runtime.env;
  if (!FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) return json({ error: "Not configured." }, 503);
  const credentials = { clientEmail: FIREBASE_CLIENT_EMAIL, privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") };

  let body: { category?: string; value?: string; active?: boolean };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const category = body.category as PartnerCategory | undefined;
  if (!category || !PARTNER_CATEGORIES.includes(category)) {
    return json({ error: "Invalid category." }, 400);
  }
  const value = typeof body.value === "string" ? body.value : "";
  const active = body.active !== false;

  await setDocument("partners", category, { category, value, active, updatedAt: new Date() }, credentials);

  return json({ ok: true }, 200);
};
