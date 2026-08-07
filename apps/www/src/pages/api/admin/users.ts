import type { APIRoute } from "astro";
import { getDocument, setDocument, listDocuments, deleteDocument, hashPassword } from "@aritrips/data";
import { getAdminSession } from "../../../lib/requireAdminSession";

export const prerender = false;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const session = await getAdminSession(cookies, locals.runtime.env);
  if (!session) return json({ error: "Not logged in." }, 401);

  const { FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = locals.runtime.env;
  if (!FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) return json({ error: "Not configured." }, 503);
  const credentials = { clientEmail: FIREBASE_CLIENT_EMAIL, privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") };

  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password;
  if (!email || !password || password.length < 8) {
    return json({ error: "Email and a password of at least 8 characters are required." }, 400);
  }

  const existing = await getDocument("admins", email, credentials);
  if (existing) return json({ error: "An admin with that email already exists." }, 409);

  const passwordHash = await hashPassword(password);
  await setDocument("admins", email, { email, passwordHash, createdAt: new Date() }, credentials);

  return json({ ok: true }, 200);
};

export const DELETE: APIRoute = async ({ request, cookies, locals }) => {
  const session = await getAdminSession(cookies, locals.runtime.env);
  if (!session) return json({ error: "Not logged in." }, 401);

  const { FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = locals.runtime.env;
  if (!FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) return json({ error: "Not configured." }, 503);
  const credentials = { clientEmail: FIREBASE_CLIENT_EMAIL, privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") };

  const email = new URL(request.url).searchParams.get("email")?.trim().toLowerCase();
  if (!email) return json({ error: "Missing email." }, 400);

  // Nunca permitir quedarse sin ningún admin — sería un panel al que
  // nadie más puede volver a entrar.
  const all = await listDocuments("admins", credentials);
  if (all.length <= 1) {
    return json({ error: "Can't remove the last admin account." }, 400);
  }

  await deleteDocument("admins", email, credentials);
  return json({ ok: true }, 200);
};
