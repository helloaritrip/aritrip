import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getDocument, setDocument, destinations } from "@aritrips/data";
import { getAdminSession } from "../../../lib/requireAdminSession";
import { buildDestinationPageContent } from "../../../lib/destinationPageContent";
import { upsertPageIndexEntries, type PageIndexEntry } from "../../../lib/pagesIndex";
import { purgePageCache } from "../../../lib/purgePageCache";

export const prerender = false;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// Lotes, no las 48 de una (2026-08-16, bug real reportado por el
// usuario: "no se pudo republicar") — cada destino gasta hasta 3
// subrequests (getDocument + setDocument + purgePageCache — la Cache
// API SÍ cuenta contra el límite, confirmado en logs en vivo con
// `wrangler tail` después de que agregar la purga rompiera un
// BATCH_SIZE de 20 que hasta entonces funcionaba bien; el comentario
// anterior acá asumía que no contaba, estaba mal). 48×3=144 pasa largo
// el límite de 50 subrequests/invocación de Cloudflare Workers (plan
// free) que ya rompió esto mismo una vez en apps/price-sync, ver el
// comentario ahí. 12×3=36 + ~2 del índice de páginas deja margen real.
// El cliente (ari-admin/pages/index.astro) llama esto en loop con
// `offset` creciente hasta agotar el catálogo.
const BATCH_SIZE = 12;

// Crea o actualiza la página /p/{id} de cada uno de los 48 destinos del
// catálogo — reemplaza a publish-destination-pages.ts (que solo creaba
// las que faltaban) ahora que también hace falta poder REGENERAR las 40
// que ya existían para que ganen bloques nuevos (ej. ExperienceGallery,
// 2026-08-11, a pedido del usuario tras ver las páginas: "les falta
// ilustrar el destino"). Igual que republish-hub-pages.ts: si la página
// ya existe, solo se pisa contentJson/updatedAt — el resto de los campos
// (title/description/status/etc, editables a mano desde el editor) se
// leen primero y se reescriben tal cual.
export const POST: APIRoute = async ({ cookies, request }) => {
  const session = await getAdminSession(cookies, env);
  if (!session) return json({ error: "Not logged in." }, 401);

  const { FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = env;
  if (!FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) return json({ error: "Not configured." }, 503);
  const credentials = { clientEmail: FIREBASE_CLIENT_EMAIL, privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") };

  const offset = Math.max(0, Number(new URL(request.url).searchParams.get("offset")) || 0);
  const batch = destinations.slice(offset, offset + BATCH_SIZE);

  const results: { slug: string; status: "created" | "updated" | "skipped_no_data" | "error" }[] = [];
  const indexEntries: PageIndexEntry[] = [];

  for (const destination of batch) {
    const built = buildDestinationPageContent(destination);
    if (!built) {
      results.push({ slug: destination.id, status: "skipped_no_data" });
      continue;
    }

    try {
      const existing = await getDocument("pages", built.slug, credentials);
      const now = new Date();

      if (existing) {
        const publishedAt = typeof existing.publishedAt === "string" ? new Date(existing.publishedAt) : undefined;
        await setDocument(
          "pages",
          built.slug,
          { ...existing, ...(publishedAt ? { publishedAt } : {}), contentJson: JSON.stringify(built.data), updatedAt: now },
          credentials
        );
        // Purga la caché de borde (2026-08-16, ver purgePageCache.ts) —
        // SÍ cuenta contra el límite de subrequests (ver BATCH_SIZE
        // arriba).
        await purgePageCache(built.slug);
        results.push({ slug: built.slug, status: "updated" });
        indexEntries.push({
          id: built.slug,
          title: String(existing.title ?? built.title),
          description: String(existing.description ?? built.description),
          featuredImageQuery: String(existing.featuredImageQuery ?? built.featuredImageQuery),
          publishedAt: publishedAt?.toISOString(),
          updatedAt: now.toISOString(),
          status: String(existing.status ?? "published"),
          template: String(existing.template ?? "destination"),
        });
      } else {
        await setDocument(
          "pages",
          built.slug,
          {
            slug: built.slug,
            title: built.title,
            description: built.description,
            country: built.country,
            city: "",
            continent: "",
            language: "en",
            status: "published",
            template: "destination",
            featuredImageQuery: built.featuredImageQuery,
            updatedAt: now,
            publishedAt: now,
            contentJson: JSON.stringify(built.data),
          },
          credentials
        );
        // Purga por si quedó cacheado un 404 de antes de que existiera
        // esta página (middleware.ts también cachea 404s).
        await purgePageCache(built.slug);
        results.push({ slug: built.slug, status: "created" });
        indexEntries.push({
          id: built.slug,
          title: built.title,
          description: built.description,
          featuredImageQuery: built.featuredImageQuery,
          publishedAt: now.toISOString(),
          updatedAt: now.toISOString(),
          status: "published",
          template: "destination",
        });
      }
    } catch (err) {
      console.error(`[republish-destination-pages] ${destination.id} failed`, err);
      results.push({ slug: destination.id, status: "error" });
    }
  }

  await upsertPageIndexEntries(credentials, indexEntries);

  const nextOffset = offset + BATCH_SIZE;
  return json({ ok: true, results, nextOffset, done: nextOffset >= destinations.length, total: destinations.length }, 200);
};
