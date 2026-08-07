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
import { listDocuments } from "@aritrips/data";

export const prerender = false;

const SITE_URL = "https://aritrips.com";

export const GET: APIRoute = async ({ locals }) => {
  const { FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = locals.runtime.env;

  const urls = [{ loc: `${SITE_URL}/`, priority: "1.0" }];

  if (FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    try {
      const pages = await listDocuments("pages", {
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      });
      for (const page of pages) {
        if (page.status === "published") {
          urls.push({ loc: `${SITE_URL}/p/${page.id}/`, priority: "0.8" });
        }
      }
    } catch {
      // Sitemap parcial (solo la home) es mejor que un 500 — Google
      // reintenta solo en la próxima pasada.
    }
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    <priority>${u.priority}</priority>\n  </url>`).join("\n")}
</urlset>
`;

  return new Response(body, {
    headers: { "Content-Type": "application/xml" },
  });
};
