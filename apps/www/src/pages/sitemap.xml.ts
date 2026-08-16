/**
 * Sitemap simple, sin dependencia nueva (@astrojs/sitemap) — mismo
 * principio de "tecnología aburrida" que el resto del sitio. Lista la
 * home + cada página publicada en Firestore (colección `pages`) — ahora
 * que /p/[slug].astro lee de ahí en vez de src/content/pages/*.json
 * (2026-08-07, panel de admin), el sitemap tiene que leer la misma
 * fuente para no quedar desincronizado con lo que realmente existe.
 * SSR (no prerender): necesita el request-time env para las credenciales
 * de Firestore, igual que /p/[slug].astro.
 */
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getCachedPageIndex } from "../lib/pagesCache";

export const prerender = false;

const SITE_URL = "https://aritrips.com";

export const GET: APIRoute = async () => {
  const { FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = env;

  const urls: { loc: string; priority: string; lastmod?: string }[] = [
    { loc: `${SITE_URL}/`, priority: "1.0" },
    { loc: `${SITE_URL}/blog`, priority: "0.7" },
    { loc: `${SITE_URL}/deals`, priority: "0.8" },
  ];

  if (FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    try {
      const pages = await getCachedPageIndex({
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      });
      for (const page of pages) {
        if (page.status === "published") {
          // Sin barra final — coincide con la URL canónica que ahora
          // fuerza middleware.ts (auditoría SEO, 2026-08-09).
          // lastmod (2026-08-16, auditoría SEO) — solo si el índice ya
          // trae updatedAt; páginas publicadas antes de este campo no lo
          // tienen todavía y se listan sin lastmod en vez de mentir con
          // una fecha inventada.
          urls.push({ loc: `${SITE_URL}/p/${page.id}`, priority: "0.8", lastmod: page.updatedAt?.slice(0, 10) });
        }
      }
    } catch {
      // Sitemap parcial (solo la home) es mejor que un 500 — Google
      // reintenta solo en la próxima pasada.
    }
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url>\n    <loc>${u.loc}</loc>\n    <priority>${u.priority}</priority>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ""}\n  </url>`
  )
  .join("\n")}
</urlset>
`;

  return new Response(body, {
    // Cache de borde en Cloudflare (2026-08-14, ver dealsCache.ts para el
    // porqué) — Googlebot pega acá seguido; sin esto cada rastreo volvía
    // a leer Firestore. `public` + `s-maxage` cachea en el CDN sin afectar
    // caché de navegador (no hay `max-age`, así que el browser no cachea).
    // s-maxage subido de 600 a 1800 (2026-08-15, auditoría de lecturas) —
    // Googlebot no necesita el sitemap al segundo.
    headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=0, s-maxage=3600" },
  });
};
