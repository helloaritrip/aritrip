/**
 * Migración puntual (2026-08-07, panel de admin): sube a Firestore lo que
 * hasta ahora vivía en código/archivos locales —
 *   1. Colección `partners`: los 5 valores hardcodeados en
 *      apps/app/src/lib/partnerLinks.ts (DEFAULT_PARTNER_CONFIG).
 *   2. Colección `pages`: los 25 .json en src/content/pages/, con el
 *      esquema más rico (title/description/country/city/continent/
 *      language/status/template) además del content de Puck.
 *
 * Requiere las credenciales del service account por variables de
 * entorno (nunca hardcodeadas acá):
 *   FIREBASE_CLIENT_EMAIL=... FIREBASE_PRIVATE_KEY=... npx tsx scripts/migrate-to-firestore.ts
 *
 * Es intencionalmente idempotente (usa setDocument/upsert) — correrlo de
 * nuevo no duplica nada, solo pisa con los mismos valores.
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { setDocument } from "../../../packages/data/src/firestore";
import { DEFAULT_PARTNER_CONFIG } from "../../../packages/data/src/partners";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGES_DIR = path.join(__dirname, "../src/content/pages");

const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
// FIREBASE_PRIVATE_KEY_FILE (ruta a un archivo con la key) en vez de la
// key directo en la variable de entorno — evita problemas de escaping de
// shell con los caracteres especiales de un PEM en la línea de comando.
const privateKeyFile = process.env.FIREBASE_PRIVATE_KEY_FILE;
if (!clientEmail || !privateKeyFile) {
  console.error("Missing FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY_FILE env vars.");
  process.exit(1);
}
const privateKeyRaw = readFileSync(privateKeyFile, "utf-8").trim();
const credentials = { clientEmail, privateKey: privateKeyRaw.replace(/\\n/g, "\n") };

async function migratePartners() {
  console.log("\n=== Seeding partners ===");
  for (const [category, entry] of Object.entries(DEFAULT_PARTNER_CONFIG)) {
    await setDocument("partners", category, { ...entry, updatedAt: new Date() }, credentials);
    console.log(`  ${category}: seeded`);
  }
}

async function migratePages() {
  console.log("\n=== Migrating pages ===");
  const files = readdirSync(PAGES_DIR).filter((f) => f.endsWith(".json"));
  const now = new Date();

  for (const file of files) {
    const slug = file.replace(/\.json$/, "");
    const raw = readFileSync(path.join(PAGES_DIR, file), "utf-8");
    const content = JSON.parse(raw);
    const title = (content?.root?.props?.title as string | undefined) || slug;

    await setDocument(
      "pages",
      slug,
      {
        slug,
        title,
        description: "",
        country: "",
        city: "",
        continent: "",
        language: "en",
        status: "published",
        template: slug.startsWith("best-trips-from-") ? "hub" : "custom",
        updatedAt: now,
        publishedAt: now,
        contentJson: JSON.stringify(content),
      },
      credentials
    );
    console.log(`  ${slug}: migrated`);
  }
}

await migratePartners();
await migratePages();
console.log("\nDone.");
