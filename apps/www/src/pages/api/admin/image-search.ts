import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getAdminSession } from "../../../lib/requireAdminSession";

export const prerender = false;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

type SearchResult = { title: string; thumbUrl: string; source: "pexels" | "wikimedia" };

type WikimediaSearchResponse = {
  query?: {
    pages?: Record<string, { title?: string; imageinfo?: { url: string; thumburl?: string }[] }>;
  };
};

async function searchWikimedia(query: string): Promise<SearchResult[]> {
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
    if (!res.ok) return [];
    const data = (await res.json()) as WikimediaSearchResponse;
    const pages = Object.values(data.query?.pages ?? {});
    return pages
      .map((p): SearchResult | null => {
        const info = p.imageinfo?.[0];
        const thumbUrl = info?.thumburl ?? info?.url;
        if (!thumbUrl) return null;
        return { title: (p.title ?? "").replace(/^File:/, ""), thumbUrl, source: "wikimedia" };
      })
      .filter((r): r is SearchResult => r !== null);
  } catch {
    return [];
  }
}

type PexelsSearchResponse = {
  photos?: { photographer?: string; src?: { large2x?: string; large?: string } }[];
};

async function searchPexels(query: string, apiKey: string): Promise<SearchResult[]> {
  const searchUrl = new URL("https://api.pexels.com/v1/search");
  searchUrl.searchParams.set("query", query);
  searchUrl.searchParams.set("per_page", "6");
  searchUrl.searchParams.set("orientation", "landscape");

  try {
    const res = await fetch(searchUrl, { headers: { Authorization: apiKey } });
    if (!res.ok) return [];
    const data = (await res.json()) as PexelsSearchResponse;
    return (data.photos ?? [])
      .map((p): SearchResult | null => {
        const thumbUrl = p.src?.large2x ?? p.src?.large;
        if (!thumbUrl) return null;
        return { title: p.photographer ? `Photo by ${p.photographer}` : "Pexels photo", thumbUrl, source: "pexels" };
      })
      .filter((r): r is SearchResult => r !== null);
  } catch {
    return [];
  }
}

const MAX_QUERY_LENGTH = 120;

// Busca en las dos fuentes en paralelo y devuelve ambos sets, cada
// resultado etiquetado con su origen — a pedido explícito del usuario
// (2026-08-10): quiere las dos disponibles a la vez para elegir, no que
// Pexels reemplace a Wikimedia acá. Distinto de /api/image-proxy en
// apps/app, que sí prioriza una sobre otra porque ahí no hay a nadie
// eligiendo a mano — esto es justamente para elegir a mano.
export const GET: APIRoute = async ({ request, cookies }) => {
  const session = await getAdminSession(cookies, env);
  if (!session) return json({ error: "Not logged in." }, 401);

  const query = new URL(request.url).searchParams.get("q")?.slice(0, MAX_QUERY_LENGTH);
  if (!query) return json({ error: "Missing q." }, 400);

  const pexelsApiKey = (env as { PEXELS_API_KEY?: string }).PEXELS_API_KEY;

  const [pexelsResults, wikimediaResults] = await Promise.all([
    pexelsApiKey ? searchPexels(query, pexelsApiKey) : Promise.resolve([]),
    searchWikimedia(query),
  ]);

  return json({ results: [...pexelsResults, ...wikimediaResults] }, 200);
};
