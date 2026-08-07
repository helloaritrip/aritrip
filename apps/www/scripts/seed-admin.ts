/**
 * Seed puntual del primer administrador del panel (2026-08-07). Correr
 * una sola vez:
 *   FIREBASE_CLIENT_EMAIL=... FIREBASE_PRIVATE_KEY_FILE=... \
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx scripts/seed-admin.ts
 */
import { readFileSync } from "node:fs";
import { setDocument } from "../../../packages/data/src/firestore";
import { hashPassword } from "../../../packages/data/src/adminAuth";

const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKeyFile = process.env.FIREBASE_PRIVATE_KEY_FILE;
const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD;

if (!clientEmail || !privateKeyFile || !adminEmail || !adminPassword) {
  console.error("Missing FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY_FILE / ADMIN_EMAIL / ADMIN_PASSWORD env vars.");
  process.exit(1);
}

const privateKeyRaw = readFileSync(privateKeyFile, "utf-8").trim();
const credentials = { clientEmail, privateKey: privateKeyRaw.replace(/\\n/g, "\n") };

const passwordHash = await hashPassword(adminPassword);
await setDocument("admins", adminEmail, { email: adminEmail, passwordHash, createdAt: new Date() }, credentials);

console.log(`Admin seeded: ${adminEmail}`);
