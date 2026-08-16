import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getDocument, setDocument, ORIGIN_HUBS, type OriginHub } from "@aritrips/data";
import { getAdminSession } from "../../../lib/requireAdminSession";
import { buildHubPageContent } from "../../../lib/hubPageContent";
import { upsertPageIndexEntries, type PageIndexEntry } from "../../../lib/pagesIndex";

export const prerender = false;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// Re-genera el contenido Puck de las 24 páginas "Best trips from {city}"
// (mismo cálculo que scripts/generate-hub-pages.ts, ver hubPageContent.ts)
// y lo publica en Firestore — pensado para correr desde el botón en
// /ari-admin/pages cada vez que cambie la lógica de generación (ej. el
// fix de badges de scoring, 2026-08-11), sin depender de que alguien
// tenga las credenciales de Firestore a mano localmente: este endpoint
// corre dentro del Worker, que ya las tiene como binding.
//
// Solo pisa `contentJson` y `updatedAt` de cada doc existente — el resto
// de los campos (title/description/status/etc, seteados a mano desde el
// editor) se leen primero y se reescriben tal cual, porque Firestore
// PATCH sin updateMask reemplaza el documento entero (ver setDocument en
// packages/data/src/firestore.ts).
export const POST: APIRoute = async ({ cookies }) => {
  const session = await getAdminSession(cookies, env);
  if (!session) return json({ error: "Not logged in." }, 401);

  const { FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = env;
  if (!FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) return json({ error: "Not configured." }, 503);
  const credentials = { clientEmail: FIREBASE_CLIENT_EMAIL, privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") };

  const appUrl = "https://app.aritrips.com";
  const results: { slug: string; status: "updated" | "skipped" | "not_found" | "error" }[] = [];
  const indexEntries: PageIndexEntry[] = [];

  for (const hub of ORIGIN_HUBS as readonly OriginHub[]) {
    const built = buildHubPageContent(hub, appUrl);
    if (!built) continue;
    const { slug, data } = built;

    try {
      const existing = await getDocument("pages", slug, credentials);
      if (!existing) {
        results.push({ slug, status: "not_found" });
        continue;
      }
      // getDocument devuelve timestamps como string ISO (fromFirestoreFields
      // no los reconstruye a Date) — reconvertirlos acá evita que
      // toFirestoreFields los reescriba como stringValue en vez de
      // timestampValue al pasar por setDocument.
      const publishedAt = typeof existing.publishedAt === "string" ? new Date(existing.publishedAt) : undefined;
      await setDocument(
        "pages",
        slug,
        { ...existing, ...(publishedAt ? { publishedAt } : {}), contentJson: JSON.stringify(data), updatedAt: new Date() },
        credentials
      );
      results.push({ slug, status: "updated" });
      indexEntries.push({
        id: slug,
        title: String(existing.title ?? slug),
        description: String(existing.description ?? ""),
        featuredImageQuery: String(existing.featuredImageQuery ?? ""),
        publishedAt: publishedAt?.toISOString(),
        updatedAt: new Date().toISOString(),
        status: String(existing.status ?? "published"),
        template: String(existing.template ?? "custom"),
      });
    } catch (err) {
      console.error(`[republish-hub-pages] ${slug} failed`, err);
      results.push({ slug, status: "error" });
    }
  }

  await upsertPageIndexEntries(credentials, indexEntries);

  return json({ ok: true, results }, 200);
};
