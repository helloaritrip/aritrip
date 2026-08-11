/**
 * Genera una página "Best trips from {City}" por cada uno de los 24 hubs
 * de origen, usando los mismos picks reales que ya calcula la sección
 * Discover del producto (getDiscoverPicks) — no copy genérico repetido:
 * cada página se arma con los 3 destinos que de verdad rinden mejor desde
 * ESE hub (popular / mejor valor / más aspiracional), con su ficha curada
 * real (insiderNotes, valueRating) vía el bloque DestinationHighlight que
 * ya existe.
 *
 * La construcción del contenido vive en src/lib/hubPageContent.ts,
 * compartida con /api/admin/republish-hub-pages.ts (que hace lo mismo
 * pero escribiendo directo a Firestore desde el Worker desplegado, sin
 * pisar el resto de los campos del documento — ver ese archivo).
 *
 * Correr con: npx tsx scripts/generate-hub-pages.ts
 *
 * Sobrescribe los JSON en src/content/pages/best-trips-from-*.json. Si
 * alguna de estas páginas se edita a mano desde el editor de Puck más
 * adelante, no volver a correr este script sobre ella sin guardar esos
 * cambios manuales antes (no hay merge, pisa el archivo entero).
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
// Import directo, no vía el "export *" agregado de packages/data/src/index.ts:
// tsx corriendo standalone (no a través del bundler de Next.js/Astro) no
// resuelve bien esa reexportación en cadena.
import { ORIGIN_HUBS, type OriginHub } from "../../../packages/data/src/types";
import { buildHubPageContent } from "../src/lib/hubPageContent";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "../src/content/pages");
const APP_URL = "https://app.aritrips.com";

let written = 0;

for (const hub of ORIGIN_HUBS as readonly OriginHub[]) {
  const result = buildHubPageContent(hub, APP_URL);
  if (!result) {
    console.warn(`skip ${hub}: no picks available (catálogo no cubre este hub para 5 noches / 2 adultos)`);
    continue;
  }
  const { slug, picks, data } = result;
  writeFileSync(path.join(OUT_DIR, `${slug}.json`), JSON.stringify(data, null, 2) + "\n", "utf-8");
  written += 1;
  console.log(`wrote ${slug}.json — ${picks.map((p) => p.name).join(", ")}`);
}

console.log(`\n${written}/${ORIGIN_HUBS.length} hub pages written to ${OUT_DIR}`);
