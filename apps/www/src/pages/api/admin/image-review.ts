import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { setDocument } from "@aritrips/data";
import { getAdminSession } from "../../../lib/requireAdminSession";

export const prerender = false;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const VALID_STATUSES = new Set(["approved", "flagged"]);

export const POST: APIRoute = async ({ request, cookies }) => {
  const session = await getAdminSession(cookies, env);
  if (!session) return json({ error: "Not logged in." }, 401);

  const { FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = env;
  if (!FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) return json({ error: "Not configured." }, 503);
  const credentials = { clientEmail: FIREBASE_CLIENT_EMAIL, privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") };

  let body: { slug?: string; status?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const slug = body.slug;
  const status = body.status;
  if (!slug || !status || !VALID_STATUSES.has(status)) {
    return json({ error: "Invalid slug or status." }, 400);
  }

  await setDocument("imageReviews", slug, { slug, status, reviewedBy: session.email, reviewedAt: new Date() }, credentials);

  return json({ ok: true }, 200);
};
