import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getAdminSession } from "../../../lib/requireAdminSession";
import { setDocument, deleteDocument } from "@aritrips/data";

export const prerender = false;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// Un solo doc, no una colección — la portada de app.aritrips.com es una
// sola imagen a la vez, no algo que liste ni pagine.
const DOC_ID = "appHero";

export const POST: APIRoute = async ({ request, cookies }) => {
  const session = await getAdminSession(cookies, env);
  if (!session) return json({ error: "Not logged in." }, 401);

  const { FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = env;
  if (!FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) return json({ error: "Not configured." }, 503);
  const credentials = { clientEmail: FIREBASE_CLIENT_EMAIL, privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") };

  let body: { imageUrl?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  if (!body.imageUrl) return json({ error: "Missing imageUrl." }, 400);

  await setDocument("siteConfig", DOC_ID, { imageUrl: body.imageUrl, updatedAt: new Date() }, credentials);
  return json({ ok: true }, 200);
};

// Vuelve a la foto por default (query curada) — borra el override en vez
// de guardar un valor vacío, así apps/app no tiene que distinguir "sin
// doc" de "doc con imageUrl vacío".
export const DELETE: APIRoute = async ({ cookies }) => {
  const session = await getAdminSession(cookies, env);
  if (!session) return json({ error: "Not logged in." }, 401);

  const { FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = env;
  if (!FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) return json({ error: "Not configured." }, 503);
  const credentials = { clientEmail: FIREBASE_CLIENT_EMAIL, privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") };

  await deleteDocument("siteConfig", DOC_ID, credentials);
  return json({ ok: true }, 200);
};
