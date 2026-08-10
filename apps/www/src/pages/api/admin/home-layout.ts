import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { setDocument } from "@aritrips/data";
import { getAdminSession } from "../../../lib/requireAdminSession";
import { HOME_LAYOUT_DEFAULTS, clampHomeLayoutValue, type HomeLayoutConfig } from "../../../lib/homeLayoutConfig";

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

  let body: Partial<Record<keyof HomeLayoutConfig, number>>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const data: Record<string, number | Date> = { updatedAt: new Date() };
  for (const key of Object.keys(HOME_LAYOUT_DEFAULTS) as (keyof HomeLayoutConfig)[]) {
    const raw = body[key];
    data[key] = clampHomeLayoutValue(key, typeof raw === "number" ? raw : HOME_LAYOUT_DEFAULTS[key]);
  }

  await setDocument("siteConfig", "home", data, credentials);

  return json({ ok: true }, 200);
};
