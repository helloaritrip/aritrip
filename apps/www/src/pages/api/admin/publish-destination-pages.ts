import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getDocument, setDocument } from "@aritrips/data";
import { getAdminSession } from "../../../lib/requireAdminSession";
import { buildDestinationPageContent, findDestination } from "../../../lib/destinationPageContent";

export const prerender = false;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// Los 8 destinos EE.UU./Canadá agregados al catálogo el 2026-08-11 —
// nunca tuvieron página propia (a diferencia de los otros 40, ver
// destinationPageContent.ts). Publica una página nueva para cada uno si
// todavía no existe — no pisa una página existente con el mismo slug
// (si alguna ya fue creada/editada a mano, se deja intacta).
const NEW_DESTINATION_IDS = ["new-york", "san-francisco", "miami", "los-angeles", "chicago", "dallas", "toronto", "montreal"];

export const POST: APIRoute = async ({ cookies }) => {
  const session = await getAdminSession(cookies, env);
  if (!session) return json({ error: "Not logged in." }, 401);

  const { FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = env;
  if (!FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) return json({ error: "Not configured." }, 503);
  const credentials = { clientEmail: FIREBASE_CLIENT_EMAIL, privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") };

  const results: { slug: string; status: "published" | "skipped_exists" | "skipped_no_data" | "error" }[] = [];

  for (const id of NEW_DESTINATION_IDS) {
    try {
      const existing = await getDocument("pages", id, credentials);
      if (existing) {
        results.push({ slug: id, status: "skipped_exists" });
        continue;
      }

      const destination = findDestination(id);
      const built = destination ? buildDestinationPageContent(destination) : null;
      if (!built) {
        results.push({ slug: id, status: "skipped_no_data" });
        continue;
      }

      const now = new Date();
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
      results.push({ slug: id, status: "published" });
    } catch (err) {
      console.error(`[publish-destination-pages] ${id} failed`, err);
      results.push({ slug: id, status: "error" });
    }
  }

  return json({ ok: true, results }, 200);
};
