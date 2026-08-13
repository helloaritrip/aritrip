import { defineMiddleware } from "astro:middleware";

// Consolida el sitio en una sola URL "canónica" por página — sin esto
// Google indexa http/https, www.aritrips.com/aritrips.com, y /p/slug
// vs /p/slug/ como páginas separadas, repartiendo autoridad entre
// duplicados (auditoría SEO, 2026-08-09; el caso http encontrado
// 2026-08-09 via Search Console: san-francisco había quedado indexado
// como http://, sin redirect a https). Hecho acá en vez de una regla
// de Cloudflare porque es código versionado, no configuración de panel.
export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);
  let changed = false;

  if (url.protocol === "http:") {
    url.protocol = "https:";
    changed = true;
  }

  if (url.hostname === "www.aritrips.com") {
    url.hostname = "aritrips.com";
    changed = true;
  }

  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.replace(/\/+$/, "");
    changed = true;
  }

  if (changed) {
    return context.redirect(url.toString(), 301);
  }

  let response = await next();

  // Respaldo de "última copia buena" en la Cache API de Cloudflare
  // (2026-08-15) — el Cache Rule creado desde el dashboard no estaba
  // generando HITs para este dominio (probado en vivo con curl: 0 de 12
  // intentos en 60s), así que stale-if-error nunca tenía nada de dónde
  // agarrarse. Se implementa acá en vez de depender de esa capa: cada
  // respuesta pública exitosa se guarda con un TTL propio de 24h (más
  // largo que el s-maxage real que ve el visitante), y si una respuesta
  // falla con un error real (5xx — ver Astro.response.status = 503 en
  // deals.astro/blog/index.astro/p/[slug].astro), se sirve esa copia
  // guardada en vez del error. No reemplaza el ahorro de lecturas de
  // Firestore de dealsCache.ts/pagesCache.ts — esto es solo el paracaídas
  // para cuando la página igual llega a fallar.
  const path = url.pathname;
  const isPubliclyCacheable = context.request.method === "GET" && !path.startsWith("/ari-admin") && !path.startsWith("/api");

  if (isPubliclyCacheable) {
    // `caches.default` es una extensión de Cloudflare — el tipo `CacheStorage`
    // del lib DOM (que Astro carga para el código de cliente) no lo declara,
    // de ahí el cast.
    const cache = (caches as unknown as { default: Cache }).default;
    // `cfContext` (antes `runtime.ctx`, ver env.d.ts) no existe en `astro dev`
    // local — sin él, se espera la escritura al caché en vez de dispararla
    // en paralelo, solo en desarrollo.
    const cfContext = (context.locals as { cfContext?: { waitUntil: (p: Promise<unknown>) => void } }).cfContext;

    if (response.status >= 200 && response.status < 300 && response.headers.has("Cache-Control")) {
      const backupHeaders = new Headers(response.headers);
      backupHeaders.set("Cache-Control", "public, max-age=86400");
      const backup = new Response(response.clone().body, { status: response.status, headers: backupHeaders });
      const putPromise = cache.put(context.request, backup);
      if (cfContext) cfContext.waitUntil(putPromise);
      else await putPromise;
    } else if (response.status >= 500) {
      const stale = await cache.match(context.request);
      if (stale) {
        const staleHeaders = new Headers(stale.headers);
        staleHeaders.set("X-Served-Stale", "1");
        response = new Response(stale.body, { status: 200, headers: staleHeaders });
      }
    }
  }

  // Headers de seguridad estándar (auditoría de seguridad, 2026-08-10) —
  // el más concreto es X-Frame-Options: sin él, /ari-admin/login se
  // puede incrustar en un iframe invisible en un sitio malicioso
  // (clickjacking) para engañar a un admin logueado. CSP queda afuera a
  // propósito por ahora: el editor Puck y el script de AdSense necesitan
  // una política armada y probada con cuidado, no una regla genérica que
  // podría romper el editor o los anuncios sin que nadie lo note.
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

  return response;
});
