/**
 * Sitemap simple, sin dependencia nueva (@astrojs/sitemap) — mismo
 * principio de "tecnología aburrida" que el resto del sitio. Lista la
 * home + cada página en src/content/pages/*.json, descubiertas con el
 * mismo import.meta.glob que ya usa src/pages/p/[slug].astro, así que
 * cualquier página nueva que se agregue ahí aparece acá solo sin tocar
 * este archivo.
 */
import type { APIRoute } from "astro";
import type { Data } from "@measured/puck";
import type { Props } from "../puck/config";

export const prerender = true;

const SITE_URL = "https://aritrips.com";

export const GET: APIRoute = () => {
  const modules = import.meta.glob<Data<Props>>("../content/pages/*.json", {
    eager: true,
    import: "default",
  });
  const slugs = Object.keys(modules).map((filePath) => filePath.split("/").pop()!.replace(/\.json$/, ""));

  const urls = [
    { loc: `${SITE_URL}/`, priority: "1.0" },
    ...slugs.map((slug) => ({ loc: `${SITE_URL}/p/${slug}/`, priority: "0.8" })),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    <priority>${u.priority}</priority>\n  </url>`).join("\n")}
</urlset>
`;

  return new Response(body, {
    headers: { "Content-Type": "application/xml" },
  });
};
