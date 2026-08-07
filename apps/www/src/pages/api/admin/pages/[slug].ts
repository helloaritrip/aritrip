import type { APIRoute } from "astro";
import { getDocument, setDocument } from "@aritrips/data";
import { getAdminSession } from "../../../../lib/requireAdminSession";

export const prerender = false;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function credentialsFrom(env: { FIREBASE_CLIENT_EMAIL?: string; FIREBASE_PRIVATE_KEY?: string }) {
  if (!env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) return null;
  return { clientEmail: env.FIREBASE_CLIENT_EMAIL, privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") };
}

// GET no requiere sesión — lo usa también /p/[slug].astro (páginas
// públicas) para leer el contenido publicado. La escritura (PUT) sí.
export const GET: APIRoute = async ({ params, locals }) => {
  const slug = params.slug;
  if (!slug) return json({ error: "Missing slug." }, 400);

  const credentials = credentialsFrom(locals.runtime.env);
  if (!credentials) return json({ error: "Not configured." }, 503);

  const doc = await getDocument("pages", slug, credentials);
  if (!doc) return json({ error: "Not found." }, 404);

  let content: unknown = null;
  try {
    content = typeof doc.contentJson === "string" ? JSON.parse(doc.contentJson) : null;
  } catch {
    content = null;
  }

  return json({ ...doc, content }, 200);
};

export const PUT: APIRoute = async ({ params, request, cookies, locals }) => {
  const session = await getAdminSession(cookies, locals.runtime.env);
  if (!session) return json({ error: "Not logged in." }, 401);

  const slug = params.slug;
  if (!slug) return json({ error: "Missing slug." }, 400);

  const credentials = credentialsFrom(locals.runtime.env);
  if (!credentials) return json({ error: "Not configured." }, 503);

  let body: {
    title?: string;
    description?: string;
    country?: string;
    city?: string;
    continent?: string;
    language?: string;
    status?: string;
    template?: string;
    content?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const status = body.status === "published" ? "published" : "draft";
  const now = new Date();

  // Preserva publishedAt original si ya estaba publicada — solo se
  // "re-sella" la fecha la primera vez que pasa a published. Para un
  // draft que nunca se publicó, directamente no se manda el campo (queda
  // ausente en el documento, no "publicado hoy a las 0hs").
  const existing = await getDocument("pages", slug, credentials);
  const existingPublishedAt = typeof existing?.publishedAt === "string" ? existing.publishedAt : undefined;
  const publishedAt = status === "published" ? new Date(existingPublishedAt ?? now.toISOString()) : undefined;

  await setDocument(
    "pages",
    slug,
    {
      slug,
      title: body.title ?? slug,
      description: body.description ?? "",
      country: body.country ?? "",
      city: body.city ?? "",
      continent: body.continent ?? "",
      language: body.language || "en",
      status,
      template: body.template || "custom",
      updatedAt: now,
      publishedAt,
      contentJson: JSON.stringify(body.content ?? { content: [], root: { props: { title: body.title ?? slug } } }),
    },
    credentials
  );

  return json({ ok: true }, 200);
};
