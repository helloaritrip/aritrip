import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { destinations } from "./destinations";
import { generateAllPriceSnapshots } from "./priceSnapshots";

const isDryRun = process.argv.includes("--dry-run");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const priceSnapshots = generateAllPriceSnapshots(destinations);

  console.log(`Destinos: ${destinations.length}`);
  console.log(`PriceSnapshots generados: ${priceSnapshots.length}`);

  if (isDryRun) {
    const outDir = path.join(__dirname, "..", ".seed-output");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(path.join(outDir, "destinations.json"), JSON.stringify(destinations, null, 2));
    writeFileSync(path.join(outDir, "priceSnapshots.json"), JSON.stringify(priceSnapshots, null, 2));
    console.log(`\n--dry-run: nada se escribió en Firestore. Salida en packages/data/.seed-output/`);
    return;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId || projectId === "REPLACE_WITH_REAL_FIREBASE_PROJECT_ID") {
    console.error(
      "\nFalta FIREBASE_PROJECT_ID (o todavía es el placeholder de .firebaserc).\n" +
        "Pasos previos: `firebase login`, crear/linkear el proyecto real, reemplazar\n" +
        "el placeholder en .firebaserc, y correr con:\n" +
        "  FIREBASE_PROJECT_ID=<tu-project-id> npm run seed --workspace=packages/data\n" +
        "(usa credenciales por defecto de la app — corré `gcloud auth application-default login`\n" +
        "o `firebase login` primero, según cuál tengas configurado).\n"
    );
    process.exit(1);
  }

  const { initializeApp, applicationDefault } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");

  initializeApp({ credential: applicationDefault(), projectId });
  const db = getFirestore();

  console.log(`\nEscribiendo en Firestore (proyecto: ${projectId})...`);

  let batch = db.batch();
  let opsInBatch = 0;
  const commits: Promise<unknown>[] = [];

  async function addWrite(ref: FirebaseFirestore.DocumentReference, data: FirebaseFirestore.DocumentData) {
    batch.set(ref, data);
    opsInBatch++;
    if (opsInBatch >= 400) {
      commits.push(batch.commit());
      batch = db.batch();
      opsInBatch = 0;
    }
  }

  for (const destination of destinations) {
    await addWrite(db.collection("destinations").doc(destination.id), destination);
  }
  for (const snapshot of priceSnapshots) {
    const id = `${snapshot.destinationId}_${snapshot.originAirportCode}_${snapshot.month}`;
    await addWrite(db.collection("priceSnapshots").doc(id), snapshot);
  }
  if (opsInBatch > 0) commits.push(batch.commit());

  await Promise.all(commits);
  console.log(
    `Listo: ${destinations.length} destinations + ${priceSnapshots.length} priceSnapshots escritos.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
