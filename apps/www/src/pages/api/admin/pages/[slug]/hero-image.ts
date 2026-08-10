import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import type { Data } from "@measured/puck";
import { getDocument, setDocument, destinations } from "@aritrips/data";
import { getAdminSession } from "../../../../../lib/requireAdminSession";
import type { Props } from "../../../../../puck/config";

export const prerender = false;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// Endpoint quirúrgico: solo toca el backgroundImageUrl del bloque Hero,
// preservando todos los demás campos de la página tal cual estaban
// (título, descripción, status...) — a propósito, en vez de reusar el PUT
// de pages/[slug].ts, que espera el payload completo de "Publicar" del
// editor Puck y hubiera sido fácil de usar mal desde este flujo más chico
// (2026-08-10, mecanismo de reemplazo de fotos en /ari-admin/images).
export const POST: APIRoute = async ({ params, request, cookies }) => {
  const session = await getAdminSession(cookies, env);
  if (!session) return json({ error: "Not logged in." }, 401);

  const slug = params.slug;
  if (!slug) return json({ error: "Missing slug." }, 400);

  const { FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = env;
  if (!FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) return json({ error: "Not configured." }, 503);
  const credentials = { clientEmail: FIREBASE_CLIENT_EMAIL, privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") };

  let body: { imageUrl?: string; label?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  // Dominios permitidos para fijar como foto de portada — las dos fuentes
  // que devuelve /api/admin/image-search (2026-08-10: el usuario quiere
  // las dos disponibles, no que una reemplace a la otra). Sin esta lista
  // blanca, este endpoint sería un proxy abierto para fijar cualquier URL
  // externa como imagen de una página.
  const ALLOWED_IMAGE_HOSTS = ["upload.wikimedia.org", "images.pexels.com"];
  const imageUrl = body.imageUrl;
  let imageHost: string | null = null;
  try {
    imageHost = imageUrl ? new URL(imageUrl).hostname : null;
  } catch {
    imageHost = null;
  }
  if (!imageUrl || !imageHost || !ALLOWED_IMAGE_HOSTS.includes(imageHost)) {
    return json({ error: `imageUrl must be from one of: ${ALLOWED_IMAGE_HOSTS.join(", ")}` }, 400);
  }

  const doc = await getDocument("pages", slug, credentials);
  if (!doc || typeof doc.contentJson !== "string") return json({ error: "Page not found." }, 404);

  let data: Data<Props>;
  try {
    data = JSON.parse(doc.contentJson) as Data<Props>;
  } catch {
    return json({ error: "Page content is corrupted." }, 500);
  }

  const heroBlock = data.content.find((c) => c.type === "Hero");
  if (!heroBlock) return json({ error: "This page has no Hero block." }, 400);

  const heroProps = heroBlock.props as { backgroundImageUrl?: string; backgroundImageQuery?: string };
  heroProps.backgroundImageUrl = imageUrl;
  if (body.label) heroProps.backgroundImageQuery = body.label;

  const now = new Date();
  const publishedAt =
    doc.status === "published" ? new Date(typeof doc.publishedAt === "string" ? doc.publishedAt : now.toISOString()) : undefined;

  await setDocument(
    "pages",
    slug,
    {
      slug,
      title: String(doc.title ?? slug),
      description: String(doc.description ?? ""),
      country: String(doc.country ?? ""),
      city: String(doc.city ?? ""),
      continent: String(doc.continent ?? ""),
      language: String(doc.language ?? "en"),
      status: String(doc.status ?? "draft"),
      template: String(doc.template ?? "custom"),
      featuredImageQuery: String(doc.featuredImageQuery ?? ""),
      updatedAt: now,
      publishedAt,
      contentJson: JSON.stringify(data),
    },
    credentials
  );

  // Elegir una foto a mano es la revisión — se marca aprobada sola, sin
  // que haga falta un segundo clic en el grid de /ari-admin/images.
  await setDocument("imageReviews", slug, { slug, status: "approved", reviewedBy: session.email, reviewedAt: now }, credentials);

  // Si el slug de la página coincide con un destino real del catálogo
  // (ej. "cancun"), la foto elegida ACÁ también se guarda como la foto
  // canónica de ese destino — así se ve igual en las cards de
  // recomendación/Discover de apps/app, no solo en esta guía (2026-08-10,
  // a pedido del usuario: "que vayan acorde a las fotos que hemos
  // seleccionado"). Páginas hub (ej. "best-trips-from-panama-city") no
  // coinciden con ningún destinationId, así que no disparan esto — su
  // foto es del hub, no de un destino puntual.
  const isDirectDestinationPage = destinations.some((d) => d.id === slug);
  if (isDirectDestinationPage) {
    await setDocument("destinationImages", slug, { destinationId: slug, imageUrl, updatedAt: now }, credentials);
  }

  return json({ ok: true }, 200);
};
