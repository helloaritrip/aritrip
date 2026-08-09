import { defineMiddleware } from "astro:middleware";

// Consolida el sitio en una sola URL "canónica" por página — sin esto
// Google indexa http/https, www.aritrips.com/aritrips.com, y /p/slug
// vs /p/slug/ como páginas separadas, repartiendo autoridad entre
// duplicados (auditoría SEO, 2026-08-09; el caso http encontrado
// 2026-08-09 via Search Console: san-francisco había quedado indexado
// como http://, sin redirect a https). Hecho acá en vez de una regla
// de Cloudflare porque es código versionado, no configuración de panel.
export const onRequest = defineMiddleware((context, next) => {
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

  return next();
});
