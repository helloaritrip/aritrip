import { getDocument, type FirestoreCredentials } from "@aritrips/data";

/**
 * Valores de layout (en px) para la sección "What can Ari find for you?"
 * de la Home — antes hardcodeados como clases arbitrarias de Tailwind
 * (pl-24, h-64, etc.), lo que significaba que cada ajuste de espaciado
 * pedido por el usuario requería que yo edite código y haga deploy. Varias
 * rondas de ida y vuelta por captura de pantalla (2026-08-10) no
 * convergían rápido, así que esto se volvió editable a mano desde
 * /ari-admin/home-layout, con vista previa en vivo — el mismo objeto de
 * config alimenta tanto el editor como la Home real.
 */
export interface HomeLayoutConfig {
  mascotHeight: number;
  rowGap: number;
  cardPadLeft: number;
  photoWidth: number;
  photoHeight: number;
  cardTextPad: number;
}

export const HOME_LAYOUT_DEFAULTS: HomeLayoutConfig = {
  mascotHeight: 256,
  rowGap: 24,
  cardPadLeft: 128,
  photoWidth: 208,
  photoHeight: 256,
  cardTextPad: 20,
};

// Límites de seguridad — sin esto, un valor mal tipeado en el editor
// (ej. 9999) podría romper el layout de la Home para todo el mundo hasta
// el próximo ajuste.
const BOUNDS: Record<keyof HomeLayoutConfig, [number, number]> = {
  mascotHeight: [80, 500],
  rowGap: [0, 200],
  cardPadLeft: [0, 400],
  photoWidth: [80, 500],
  photoHeight: [80, 500],
  cardTextPad: [0, 100],
};

export function clampHomeLayoutValue(key: keyof HomeLayoutConfig, value: number): number {
  const [min, max] = BOUNDS[key];
  if (Number.isNaN(value)) return HOME_LAYOUT_DEFAULTS[key];
  return Math.min(max, Math.max(min, Math.round(value)));
}

export async function getHomeLayoutConfig(credentials: FirestoreCredentials | null): Promise<HomeLayoutConfig> {
  if (!credentials) return HOME_LAYOUT_DEFAULTS;
  try {
    const doc = await getDocument("siteConfig", "home", credentials);
    if (!doc) return HOME_LAYOUT_DEFAULTS;
    const config = { ...HOME_LAYOUT_DEFAULTS };
    for (const key of Object.keys(HOME_LAYOUT_DEFAULTS) as (keyof HomeLayoutConfig)[]) {
      const raw = doc[key];
      if (typeof raw === "number") config[key] = clampHomeLayoutValue(key, raw);
    }
    return config;
  } catch {
    return HOME_LAYOUT_DEFAULTS;
  }
}
