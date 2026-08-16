import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getDocument, setDocument } from "@aritrips/data";
import { getAdminSession } from "../../../../lib/requireAdminSession";
import { upsertPageIndexEntries } from "../../../../lib/pagesIndex";

export const prerender = false;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function credentialsFrom(e: { FIREBASE_CLIENT_EMAIL?: string; FIREBASE_PRIVATE_KEY?: string }) {
  if (!e.FIREBASE_CLIENT_EMAIL || !e.FIREBASE_PRIVATE_KEY) return null;
  return { clientEmail: e.FIREBASE_CLIENT_EMAIL, privateKey: e.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") };
}

// GET no requiere sesión — lo usa también /p/[slug].astro (páginas
// públicas) para leer el contenido publicado. La escritura (PUT) sí.
export const GET: APIRoute = async ({ params }) => {
  const slug = params.slug;
  if (!slug) return json({ error: "Missing slug." }, 400);

  const credentials = credentialsFrom(env);
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

export const PUT: APIRoute = async ({ params, request, cookies }) => {
  const session = await getAdminSession(cookies, env);
  if (!session) return json({ error: "Not logged in." }, 401);

  const slug = params.slug;
  if (!slug) return json({ error: "Missing slug." }, 400);

  const credentials = credentialsFrom(env);
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
    featuredImageQuery?: string;
    content?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const status = body.status === "published" ? "published" : "draft";
  const description = (body.description ?? "").trim();

  // Sin esto, una página publicada sin descripción cae al fallback de
  // p/[slug].astro (repite el título como meta description) sin que
  // nadie lo note — auditoría SEO, 2026-08-09.
  if (status === "published" && !description) {
    return json({ error: "Add a description before publishing — it's used for the page's meta tag and social previews." }, 400);
  }

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
      description,
      country: body.country ?? "",
      city: body.city ?? "",
      continent: body.continent ?? "",
      language: body.language || "en",
      status,
      template: body.template || "custom",
      featuredImageQuery: body.featuredImageQuery ?? "",
      updatedAt: now,
      publishedAt,
      contentJson: JSON.stringify(body.content ?? { content: [], root: { props: { title: body.title ?? slug } } }),
    },
    credentials
  );

  // Mantiene pagesIndex/current al día en el momento de publicar — ver
  // pagesIndex.ts para el porqué (evita que Home/blog/sitemap tengan que
  // releer la colección `pages` completa en cada visita).
  await upsertPageIndexEntries(credentials, [
    {
      id: slug,
      title: body.title ?? slug,
      description,
      featuredImageQuery: body.featuredImageQuery ?? "",
      publishedAt: publishedAt?.toISOString(),
      updatedAt: now.toISOString(),
      status,
      template: body.template || "custom",
    },
  ]);

  return json({ ok: true }, 200);
};
