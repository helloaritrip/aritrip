/**
 * Proxy de imágenes — busca en Wikimedia Commons (sin API key, a diferencia
 * de Unsplash que requiere cuenta de desarrollador que todavía no existe)
 * y sirve la imagen con cache agresivo. Nunca almacenamos fotos propias —
 * ver el principio de imágenes en la memoria del proyecto / System Architecture.
 */
const FALLBACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
  <rect width="800" height="500" fill="#c9ccd1"/>
  <text x="400" y="250" font-family="sans-serif" font-size="24" fill="#5b6472" text-anchor="middle">Image unavailable</text>
</svg>`;

function fallbackResponse(): Response {
  return new Response(FALLBACK_SVG, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

type WikimediaSearchResponse = {
  query?: {
    pages?: Record<string, { imageinfo?: { url: string; thumburl?: string }[] }>;
  };
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  if (!query) {
    return fallbackResponse();
  }

  try {
    const searchUrl = new URL("https://commons.wikimedia.org/w/api.php");
    searchUrl.searchParams.set("action", "query");
    searchUrl.searchParams.set("generator", "search");
    searchUrl.searchParams.set("gsrsearch", `${query} filetype:bitmap`);
    searchUrl.searchParams.set("gsrnamespace", "6");
    searchUrl.searchParams.set("gsrlimit", "1");
    searchUrl.searchParams.set("prop", "imageinfo");
    searchUrl.searchParams.set("iiprop", "url");
    searchUrl.searchParams.set("iiurlwidth", "1200");
    searchUrl.searchParams.set("format", "json");
    searchUrl.searchParams.set("origin", "*");

    const searchRes = await fetch(searchUrl, {
      headers: { "User-Agent": "TravelPackageBuilder/0.1 (MVP, dev environment)" },
    });
    if (!searchRes.ok) return fallbackResponse();

    const searchData = (await searchRes.json()) as WikimediaSearchResponse;
    const pages = searchData.query?.pages;
    const firstPage = pages ? Object.values(pages)[0] : undefined;
    const imageUrl = firstPage?.imageinfo?.[0]?.thumburl ?? firstPage?.imageinfo?.[0]?.url;
    if (!imageUrl) return fallbackResponse();

    const imageRes = await fetch(imageUrl, {
      headers: { "User-Agent": "TravelPackageBuilder/0.1 (MVP, dev environment)" },
    });
    if (!imageRes.ok || !imageRes.body) return fallbackResponse();

    return new Response(imageRes.body, {
      headers: {
        "Content-Type": imageRes.headers.get("content-type") ?? "image/jpeg",
        // Cache agresivo en el edge (Cloudflare) y en el navegador — la
        // query de imagen por destino es estática, no cambia entre búsquedas.
        "Cache-Control": "public, max-age=604800, immutable",
      },
    });
  } catch {
    return fallbackResponse();
  }
}
