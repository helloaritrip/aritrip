/**
 * Fix puntual (2026-08-07): las 24 páginas "Best trips from {city}" se
 * migraron a Firestore con `description: ""` (migrate-to-firestore.ts
 * la hardcodea vacía) — Google mostraba el título repetido como snippet
 * de búsqueda en vez de una descripción real. Este script escribe una
 * meta descripción única por página, reusando el ángulo real de cada
 * hub (vuelos directos/con escala, destinos reales) del trabajo de
 * contenido de hoy.
 *
 * setDocument hace PATCH sin updateMask — eso reemplaza el documento
 * COMPLETO, no solo el campo que se pasa. Por eso este script primero
 * lee cada doc entero (getDocument) y recién after mergea `description`
 * antes de escribir — un PATCH con solo `{description}` habría borrado
 * title/status/contentJson/etc. de las 24 páginas en vivo.
 *
 * Correr con:
 *   FIREBASE_CLIENT_EMAIL=... FIREBASE_PRIVATE_KEY_FILE=... npx tsx scripts/set-hub-descriptions.ts
 */
import { readFileSync } from "node:fs";
import { getDocument, setDocument } from "../../../packages/data/src/firestore";
import { ORIGIN_HUBS, type OriginHub } from "../../../packages/data/src/types";
import { ORIGIN_LABELS } from "../../../packages/data/src/originGeo";
import { hubPageSlug } from "../src/lib/citySlug";

const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKeyFile = process.env.FIREBASE_PRIVATE_KEY_FILE;
if (!clientEmail || !privateKeyFile) {
  console.error("Missing FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY_FILE env vars.");
  process.exit(1);
}
const privateKeyRaw = readFileSync(privateKeyFile, "utf-8").trim();
const credentials = { clientEmail, privateKey: privateKeyRaw.replace(/\\n/g, "\n") };

const DESCRIPTIONS: Record<OriginHub, string> = {
  DFW: "Nonstop flights from DFW to Cancún, Oaxaca, and Aspen — real flight times and real trip costs for budget travel flying out of Dallas.",
  IAH: "Direct flights from Houston to Cancún and Oaxaca, plus real trip costs for Aspen — see which budget destinations actually fit flying out of IAH.",
  ATL: "Nonstop from Atlanta to Cancún and Aspen, real cost data for Oaxaca too — compare real trip costs for budget travel flying out of ATL.",
  CLT: "Charlotte's new seasonal nonstop to Aspen, direct flights to Cancún, and real costs for Oaxaca — budget trip ideas flying out of CLT.",
  MIA: "The fastest Cancún flight of any US hub, plus Grand Cayman and Oaxaca — real trip costs and flight times for budget travel out of Miami.",
  MCO: "Nassau in under 90 minutes, nonstop Cancún, and real costs for Oaxaca — budget trip ideas flying out of Orlando (MCO).",
  JFK: "Real trip costs and flight times to Cancún, Oaxaca, and Aspen from New York — see what actually fits your budget flying out of JFK.",
  BOS: "Nonstop to Cancún, real costs for Oaxaca and Aspen — budget trip ideas and honest flight times flying out of Boston (BOS).",
  IAD: "Nonstop Cancún, real costs for Oaxaca and Aspen, plus D.C.'s real connection to Aspen's policy world — budget trips flying out of IAD.",
  ORD: "One of the only hubs with nonstop flights to both Cancún and Aspen — real trip costs for budget travel flying out of Chicago (ORD).",
  DEN: "A 51-minute flight (or a scenic drive) to Aspen, nonstop Vegas, and real costs for Oaxaca — budget trips flying out of Denver (DEN).",
  PHX: "Daily nonstop Aspen in ski season, quick Vegas hops, and real costs for Oaxaca — budget trip ideas flying out of Phoenix (PHX).",
  LAS: "Real flight times and trip costs to Cancún, Oaxaca, and Aspen from Las Vegas — see what actually fits your budget flying out of LAS.",
  LAX: "Nonstop Oaxaca (rare for the US), easy Vegas hops, and real costs for Aspen — budget trip ideas flying out of LA (LAX).",
  SFO: "Seasonal nonstop Aspen, quick Vegas flights, and real costs for Oaxaca — budget trip ideas flying out of San Francisco (SFO).",
  SEA: "Real flight times and trip costs to Las Vegas, Oaxaca, and Aspen from Seattle — see what actually fits your budget flying out of SEA.",
  YYZ: "Nonstop Cancún, honest flight times to Oaxaca and Aspen, and the real Canadian snowbird pattern — budget trips flying out of Toronto (YYZ).",
  YVR: "Quick nonstop Vegas, real costs for Oaxaca, and why Aspen still draws Whistler locals — budget trip ideas flying out of Vancouver (YVR).",
  YUL: "Nonstop Cancún, real costs for Oaxaca, and the longest connection on this site to Aspen — budget trips flying out of Montreal (YUL).",
  MEX: "Nonstop domestic flights to Cancún, Oaxaca, and Cabo San Lucas — real trip costs for budget travel flying out of Mexico City (MEX).",
  GDL: "Cabo San Lucas is actually the shortest flight from Guadalajara — real trip costs for Cancún, Oaxaca, and Cabo flying out of GDL.",
  MTY: "Real trip costs and flight frequency for Cancún, Oaxaca, and Cabo San Lucas flying out of Monterrey (MTY) — see what fits your budget.",
  CUN: "Real trip costs for Punta Cana, Oaxaca, and Turks and Caicos flying out of Cancún — honest flight times, no fake nonstops.",
  PTY: "Real trip costs for Cancún, Medellín, and Grand Cayman flying out of Panama City's Copa hub — see what actually fits your budget.",
};

let updated = 0;

for (const hub of ORIGIN_HUBS as readonly OriginHub[]) {
  const label = ORIGIN_LABELS[hub];
  const slug = hubPageSlug(label);
  const description = DESCRIPTIONS[hub];

  const existing = await getDocument("pages", slug, credentials);
  if (!existing) {
    console.warn(`skip ${slug}: no existing Firestore doc found`);
    continue;
  }

  await setDocument("pages", slug, { ...existing, description }, credentials);
  updated += 1;
  console.log(`${slug}: description set (${description.length} chars)`);
}

console.log(`\n${updated}/${ORIGIN_HUBS.length} page descriptions updated.`);
