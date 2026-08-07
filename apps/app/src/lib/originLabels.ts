// Movido a packages/data (2026-08-07) — apps/www también lo necesita para
// generar contenido por ciudad. Re-exportado acá para no romper imports
// existentes (`@/lib/originLabels`) en ResultCard/DestinationModal.
export { ORIGIN_LABELS, ORIGIN_OPTIONS } from "@aritrips/data";
