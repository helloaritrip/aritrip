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

  // Caché real en el borde de Cloudflare, vía la Cache API (2026-08-15,
  // reemplaza el caché en memoria de dealsCache.ts/pagesCache.ts/etc. como
  // mecanismo principal de ahorro de lecturas) — se descubrió que ese
  // caché en memoria casi no ayudaba con tráfico bajo/espaciado como el
  // del dueño probando el sitio a mano: cada request de Cloudflare puede
  // caer en un "isolate" del Worker nuevo, y las variables en memoria de
  // ese caché se reinician vacías cada vez. La Cache API en cambio vive en
  // el borde, fuera del isolate — sobrevive aunque el Worker se reinicie.
  //
  // Dos "cachés" con vida distinta, para no pisarse entre sí:
  //  - `primaryCache` (Cloudflare la llama `caches.default`): la copia
  //    real, con el Cache-Control real de la página (s-maxage 5-10 min).
  //    Se chequea ANTES de siquiera llamar a next(), así que un HIT acá
  //    significa cero lecturas de Firestore — ni se ejecuta la lógica de
  //    la página.
  //  - `backupCache` (namespace separado): la copia de emergencia de
  //    stale-if-error, con TTL propio de 24h — necesita vivir más tiempo
  //    que la copia real, así que no puede ser la misma entrada.
  const path = url.pathname;
  const isPubliclyCacheable = context.request.method === "GET" && !path.startsWith("/ari-admin") && !path.startsWith("/api");
  // `caches.default` es una extensión de Cloudflare — el tipo `CacheStorage`
  // del lib DOM (que Astro carga para el código de cliente) no lo declara,
  // de ahí el cast.
  const primaryCache = (caches as unknown as { default: Cache }).default;
  const backupCache = await caches.open("stale-backup");
  // `cfContext` (antes `runtime.ctx`, ver env.d.ts) no existe en `astro dev`
  // local — sin él, se espera cada escritura al caché en vez de dispararla
  // en paralelo, solo en desarrollo.
  const cfContext = (context.locals as { cfContext?: { waitUntil: (p: Promise<unknown>) => void } }).cfContext;

  let response: Response | undefined;

  if (isPubliclyCacheable) {
    const hit = await primaryCache.match(context.request);
    if (hit) {
      const hitHeaders = new Headers(hit.headers);
      hitHeaders.set("X-Cache", "HIT");
      response = new Response(hit.body, { status: hit.status, headers: hitHeaders });
    }
  }

  if (!response) {
    response = await next();

    if (isPubliclyCacheable) {
      const isOk = response.status >= 200 && response.status < 300;
      // 404 también se cachea (TTL corto propio si la página no trae uno) —
      // bots probando slugs inventados bajo /p/* si no, pagan una lectura
      // real de Firestore cada vez que repiten el mismo intento.
      if (isOk || response.status === 404) {
        response.headers.set("X-Cache", "MISS");
        if (!response.headers.has("Cache-Control")) {
          response.headers.set("Cache-Control", "public, max-age=0, s-maxage=120");
        }
        const putPromise = primaryCache.put(context.request, response.clone());
        if (cfContext) cfContext.waitUntil(putPromise);
        else await putPromise;
      }

      if (isOk && response.headers.has("Cache-Control")) {
        const backupHeaders = new Headers(response.headers);
        backupHeaders.set("Cache-Control", "public, max-age=86400");
        const backup = new Response(response.clone().body, { status: response.status, headers: backupHeaders });
        const backupPutPromise = backupCache.put(context.request, backup);
        if (cfContext) cfContext.waitUntil(backupPutPromise);
        else await backupPutPromise;
      } else if (response.status >= 500) {
        const stale = await backupCache.match(context.request);
        if (stale) {
          const staleHeaders = new Headers(stale.headers);
          staleHeaders.set("X-Served-Stale", "1");
          response = new Response(stale.body, { status: 200, headers: staleHeaders });
        }
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
