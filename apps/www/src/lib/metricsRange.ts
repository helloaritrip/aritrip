/**
 * Filtro de rango de fecha compartido entre /ari-admin/metrics y
 * /ari-admin/metrics/deals (2026-08-23, a pedido del usuario: mismo
 * selector 24h/semana/mes/todo que ya tiene Live Prices, pero acá además
 * tiene que recalcular las métricas de la página según el rango elegido).
 * "all" es el default explícito — sin ?range en la URL, las dos páginas
 * siguen mostrando exactamente lo mismo que mostraban antes de esto.
 */
export type MetricsRange = "day" | "week" | "month" | "all";

export const RANGE_OPTIONS: { value: MetricsRange; label: string }[] = [
  { value: "day", label: "Últimas 24 horas" },
  { value: "week", label: "Última semana" },
  { value: "month", label: "Último mes" },
  { value: "all", label: "Todo el tiempo" },
];

const RANGE_MS: Record<Exclude<MetricsRange, "all">, number> = {
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
};

export function parseRange(searchParams: URLSearchParams): MetricsRange {
  const raw = searchParams.get("range");
  return raw === "day" || raw === "week" || raw === "month" ? raw : "all";
}

/** ISO de corte para el rango, o null para "all" (sin filtro de fecha). */
export function rangeCutoffISO(range: MetricsRange): string | null {
  if (range === "all") return null;
  return new Date(Date.now() - RANGE_MS[range]).toISOString();
}
