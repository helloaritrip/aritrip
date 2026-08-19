import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { timingSafeEqual } from "@aritrips/data";
import { purgePageCache } from "../../../lib/purgePageCache";

export const prerender = false;

// Purga puntual por clave (2026-08-19) — separado de requireAdminSession
// a propósito: hace falta poder disparar esto desde afuera del navegador
// (ver purgePageCache.ts, la Cache API de Workers solo se puede tocar
// desde DENTRO de un Worker, no hay purga por API externa con el token de
// wrangler que ya usa este proyecto, que no tiene el scope de zona/caché).
// Mismo patrón de auth por secreto que ya usa apps/price-sync. Solo purga
// — nunca escribe contenido, así que el riesgo de exponerlo es bajo.
export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const key = url.searchParams.get("key") ?? "";
  if (!timingSafeEqual(key, env.PURGE_CACHE_KEY ?? "")) {
    return new Response("Not found", { status: 404 });
  }
  // `path` (2026-08-19) — el cluster de vuelos vive en /flights/{slug}, no
  // /p/{slug} (purgePageCache asume ese prefijo a propósito, es lo único
  // que existía cuando se escribió). Acepta cualquier path del sitio en
  // vez de sumar un purgeFlightRouteCache casi idéntico.
  const path = url.searchParams.get("path");
  const slug = url.searchParams.get("slug");
  if (path) {
    await purgePageCache(path, true);
    return new Response(JSON.stringify({ ok: true, path }), { headers: { "Content-Type": "application/json" } });
  }
  if (!slug) return new Response(JSON.stringify({ error: "Missing slug or path" }), { status: 400 });

  await purgePageCache(slug);
  return new Response(JSON.stringify({ ok: true, slug }), { headers: { "Content-Type": "application/json" } });
};
