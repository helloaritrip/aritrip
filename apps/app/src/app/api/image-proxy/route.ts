/**
 * Proxy de imágenes — busca en Wikimedia Commons (sin API key, a diferencia
 * de Unsplash que requiere cuenta de desarrollador que todavía no existe)
 * y sirve la imagen con cache agresivo. Nunca almacenamos fotos propias —
 * ver el principio de imágenes en la memoria del proyecto / System Architecture.
 *
 * `q` (imageQuery curado, ej. "cancun turquoise beach aerial") es específico
 * a propósito para traer una foto temática, pero la búsqueda de Wikimedia no
 * maneja bien frases de 4-5 conceptos combinados — para el 90% de los
 * destinos del catálogo esa query no encontraba nada y caía siempre al SVG
 * de fallback (bug real encontrado 2026-08-06, no una falta de cobertura de
 * Wikimedia). Por eso ahora hay un segundo intento con `fallback` (el
 * nombre propio del destino, ej. "Cancún") antes de rendirse — mismo
 * proveedor, sin sumar una fuente nueva.
 *
 * Caché real en el borde de Cloudflare (2026-08-10, a partir de datos
 * reales de Web Analytics) — el `Cache-Control` que ya se mandaba solo
 * ayudaba al navegador de quien ya había cargado esa imagen antes; nadie
 * más se beneficiaba, así que cada visitante nuevo pagaba el viaje
 * completo a Wikimedia (búsqueda + descarga) para queries que el catálogo
 * repite todo el tiempo (~40 destinos, un puñado de queries fijas). Eso
 * explicaba tanto los outliers de LCP (hasta ~3s) como parte del CLS —
 * ver Cache API de Cloudflare Workers.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";

const FALLBACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
  <rect width="800" height="500" fill="#c9ccd1"/>
  <text x="400" y="250" font-family="sans-serif" font-size="24" fill="#5b6472" text-anchor="middle">Image unavailable</text>
</svg>`;

function fallbackResponse(status = 200): Response {
  return new Response(FALLBACK_SVG, {
    status,
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

async function searchWikimediaImageUrl(query: string): Promise<string | null> {
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
    headers: { "User-Agent": "AriTrips/0.1 (aritrips.com; helloari.trip@gmail.com)" },
  });
  if (!searchRes.ok) return null;

  const searchData = (await searchRes.json()) as WikimediaSearchResponse;
  const pages = searchData.query?.pages;
  const firstPage = pages ? Object.values(pages)[0] : undefined;
  return firstPage?.imageinfo?.[0]?.thumburl ?? firstPage?.imageinfo?.[0]?.url ?? null;
}

// Límite de largo — sin esto un pedido con query gigante es una forma
// barata de generar trabajo real (búsqueda + descarga contra Wikimedia)
// por cada byte extra que no aporta nada a la búsqueda en sí
// (auditoría de seguridad, 2026-08-10). Las queries reales del catálogo
// tienen 20-60 caracteres.
const MAX_QUERY_LENGTH = 120;

export async function GET(request: Request) {
  // Cache real, compartida entre TODOS los visitantes — se chequea antes
  // que nada, incluso antes del rate limit, porque un hit de caché es
  // prácticamente gratis y no necesita protegerse como sí necesita el
  // camino que sí le pega a Wikimedia. La URL completa (incluye ?q=&
  // fallback=) es la clave — misma query, mismo resultado siempre.
  const cache = (globalThis as unknown as { caches?: { default: Cache } }).caches?.default;
  if (cache) {
    try {
      const cached = await cache.match(request);
      if (cached) return cached;
    } catch {
      // Sin acceso a la Cache API en este entorno (ej. local dev) — seguir sin caché.
    }
  }

  // Rate limit propio (Workers Rate Limiting API, no depende del plan de
  // Cloudflare) — sin esto, cada pedido dispara 1-2 llamadas reales a
  // Wikimedia sin ningún tope de cuántas veces por minuto (auditoría de
  // seguridad, 2026-08-10).
  let ctx: { waitUntil: (p: Promise<unknown>) => void } | null = null;
  try {
    const cf = await getCloudflareContext({ async: true });
    ctx = cf.ctx;
    const limiter = (cf.env as { IMAGE_PROXY_LIMITER?: { limit: (opts: { key: string }) => Promise<{ success: boolean }> } })
      .IMAGE_PROXY_LIMITER;
    if (limiter) {
      const clientIp = request.headers.get("cf-connecting-ip") ?? "unknown";
      const { success } = await limiter.limit({ key: clientIp });
      if (!success) return fallbackResponse(429);
    }
  } catch {
    // Si el binding no está disponible (ej. entorno local sin Cloudflare
    // context), no bloqueamos el proxy — mismo criterio "fail open" que
    // el resto de las integraciones externas del proyecto.
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.slice(0, MAX_QUERY_LENGTH) ?? null;
  const fallbackQuery = searchParams.get("fallback")?.slice(0, MAX_QUERY_LENGTH) ?? null;
  if (!query) {
    return fallbackResponse();
  }

  try {
    let imageUrl = await searchWikimediaImageUrl(query);
    if (!imageUrl && fallbackQuery && fallbackQuery !== query) {
      imageUrl = await searchWikimediaImageUrl(fallbackQuery);
    }
    if (!imageUrl) return fallbackResponse();

    const imageRes = await fetch(imageUrl, {
      headers: { "User-Agent": "AriTrips/0.1 (aritrips.com; helloari.trip@gmail.com)" },
    });
    if (!imageRes.ok || !imageRes.body) return fallbackResponse();

    const response = new Response(imageRes.body, {
      headers: {
        "Content-Type": imageRes.headers.get("content-type") ?? "image/jpeg",
        // Cache agresivo en el edge (Cloudflare) y en el navegador — la
        // query de imagen por destino es estática, no cambia entre búsquedas.
        "Cache-Control": "public, max-age=604800, immutable",
      },
    });

    // Solo se cachean imágenes reales, nunca el SVG de fallback — así una
    // query que hoy no encuentra nada en Wikimedia se puede reintentar
    // más adelante en vez de quedar "atascada" en el fallback por una semana.
    if (cache && ctx) {
      ctx.waitUntil(cache.put(request, response.clone()));
    }

    return response;
  } catch {
    return fallbackResponse();
  }
}
