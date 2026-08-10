import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getAdminSession } from "../../../lib/requireAdminSession";

export const prerender = false;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

type WikimediaSearchResponse = {
  query?: {
    pages?: Record<string, { title?: string; imageinfo?: { url: string; thumburl?: string }[] }>;
  };
};

const MAX_QUERY_LENGTH = 120;

// Búsqueda con varios candidatos (gsrlimit=6) para elegir a mano — distinto
// del /api/image-proxy de apps/app, que solo trae el primer resultado para
// servir en vivo. Este vive en apps/www porque solo lo usa el panel de
// admin (2026-08-10, mecanismo para reemplazar fotos marcadas en /ari-admin/images).
export const GET: APIRoute = async ({ request, cookies }) => {
  const session = await getAdminSession(cookies, env);
  if (!session) return json({ error: "Not logged in." }, 401);

  const query = new URL(request.url).searchParams.get("q")?.slice(0, MAX_QUERY_LENGTH);
  if (!query) return json({ error: "Missing q." }, 400);

  const searchUrl = new URL("https://commons.wikimedia.org/w/api.php");
  searchUrl.searchParams.set("action", "query");
  searchUrl.searchParams.set("generator", "search");
  searchUrl.searchParams.set("gsrsearch", `${query} filetype:bitmap`);
  searchUrl.searchParams.set("gsrnamespace", "6");
  searchUrl.searchParams.set("gsrlimit", "6");
  searchUrl.searchParams.set("prop", "imageinfo");
  searchUrl.searchParams.set("iiprop", "url");
  searchUrl.searchParams.set("iiurlwidth", "800");
  searchUrl.searchParams.set("format", "json");
  searchUrl.searchParams.set("origin", "*");

  try {
    const res = await fetch(searchUrl, { headers: { "User-Agent": "AriTrips/0.1 (aritrips.com; helloari.trip@gmail.com)" } });
    if (!res.ok) return json({ results: [] }, 200);
    const data = (await res.json()) as WikimediaSearchResponse;
    const pages = Object.values(data.query?.pages ?? {});
    const results = pages
      .map((p) => {
        const info = p.imageinfo?.[0];
        const thumbUrl = info?.thumburl ?? info?.url;
        if (!thumbUrl) return null;
        return { title: (p.title ?? "").replace(/^File:/, ""), thumbUrl };
      })
      .filter((r): r is { title: string; thumbUrl: string } => r !== null);
    return json({ results }, 200);
  } catch {
    return json({ results: [] }, 200);
  }
};
