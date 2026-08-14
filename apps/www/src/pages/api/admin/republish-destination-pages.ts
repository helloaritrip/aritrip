import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getDocument, setDocument, destinations } from "@aritrips/data";
import { getAdminSession } from "../../../lib/requireAdminSession";
import { buildDestinationPageContent } from "../../../lib/destinationPageContent";
import { upsertPageIndexEntries, type PageIndexEntry } from "../../../lib/pagesIndex";

export const prerender = false;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// Crea o actualiza la página /p/{id} de cada uno de los 48 destinos del
// catálogo — reemplaza a publish-destination-pages.ts (que solo creaba
// las que faltaban) ahora que también hace falta poder REGENERAR las 40
// que ya existían para que ganen bloques nuevos (ej. ExperienceGallery,
// 2026-08-11, a pedido del usuario tras ver las páginas: "les falta
// ilustrar el destino"). Igual que republish-hub-pages.ts: si la página
// ya existe, solo se pisa contentJson/updatedAt — el resto de los campos
// (title/description/status/etc, editables a mano desde el editor) se
// leen primero y se reescriben tal cual.
export const POST: APIRoute = async ({ cookies }) => {
  const session = await getAdminSession(cookies, env);
  if (!session) return json({ error: "Not logged in." }, 401);

  const { FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = env;
  if (!FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) return json({ error: "Not configured." }, 503);
  const credentials = { clientEmail: FIREBASE_CLIENT_EMAIL, privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") };

  const results: { slug: string; status: "created" | "updated" | "skipped_no_data" | "error" }[] = [];
  const indexEntries: PageIndexEntry[] = [];

  for (const destination of destinations) {
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
        results.push({ slug: built.slug, status: "updated" });
        indexEntries.push({
          id: built.slug,
          title: String(existing.title ?? built.title),
          description: String(existing.description ?? built.description),
          featuredImageQuery: String(existing.featuredImageQuery ?? built.featuredImageQuery),
          publishedAt: publishedAt?.toISOString(),
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
        results.push({ slug: built.slug, status: "created" });
        indexEntries.push({
          id: built.slug,
          title: built.title,
          description: built.description,
          featuredImageQuery: built.featuredImageQuery,
          publishedAt: now.toISOString(),
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

  return json({ ok: true, results }, 200);
};
