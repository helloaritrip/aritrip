// Movido a packages/data (2026-08-07) — el panel de admin en apps/www
// también necesita hablarle a Firestore. Re-exportado acá para no romper
// el import que ya usa /api/track.
export { writeFirestoreDocument, setDocument, getDocument, listDocuments, deleteDocument } from "@aritrips/data";
export type { FirestoreCredentials } from "@aritrips/data";
