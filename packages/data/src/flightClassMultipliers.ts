/**
 * Tiers de clase de vuelo (economic/standard/premium) — 2026-08-17, mismo
 * espíritu que hotelKeys.ts (budget/mid/premium) pero con una diferencia
 * de fondo: un hotel real existe siempre, una cabina de avión no. Acá NO
 * hay un ancla en vivo por tier (Travelpayouts solo cachea la tarifa más
 * barata que gente real buscó — casi nunca business/premium en rutas de
 * ocio) — son multiplicadores curados, investigados una vez contra
 * tarifas reales (Google Flights/Kayak/sitio de la aerolínea) sobre 9
 * rutas representativas del catálogo (3 por rango de duración), no
 * inventados.
 *
 * `economic` = el precio real que ya calcula el motor (curado +
 * recalibrado en vivo + ajuste por anticipación) — no se toca acá, ya es
 * "la tarifa más barata", que es justo lo que tiene que ser.
 *
 * `premium` = la cabina más alta que venda la aerolínea en esa ruta (le
 * dicen "Business" o "First" según la aerolínea/ruta, tratado como el
 * mismo concepto — el usuario confirmó que no hace falta distinguirlos).
 *
 * `standard` (premium economy) — hallazgo real de la investigación, no
 * un dato que faltaba cargar: en rutas cortas/medias (Caribe/México/
 * Centroamérica, el grueso del catálogo) casi ninguna aerolínea vende
 * premium economy de verdad — American/United/Copa/JetBrue solo tienen
 * Economy + Business en esos mercados de fuselaje angosto. Inventar un
 * número ahí sería mostrarle al usuario una tarifa que no puede reservar
 * en ningún lado. Por eso `standard` solo existe en el rango largo
 * (7h+), donde sí es un producto real y bien tarifado. Decisión
 * confirmada con el usuario (no un supuesto): 2 tiers en corto/medio,
 * 3 en largo — ver getFlightClassPrices.
 *
 * Investigación real por rango (9 rutas, tarifas de ida y vuelta,
 * ventana ~2-3 meses adelante, fuente Google Flights/Kayak/aerolínea):
 *  - Corto (<3h — Cancún, Nassau, Cabo, etc.): MIA-CUN ($329→$654,
 *    1.99x), MIA-NAS ($293-332→$623-707, ~2.2-2.4x), DFW-CUN ($303→
 *    $994, 3.28x). Premium economy: no existe en ninguna de las 3 —
 *    lo único real es un upsell de asiento con más espacio (~1.1x),
 *    no una cabina aparte.
 *  - Medio (3-7h — Cartagena, Panamá, Costa Rica, etc.): JFK-CTG
 *    ($365→$929, 2.55x), ORD-PTY ($799→~$1.050-1.553, ruidoso, ~1.6x),
 *    MIA-LIR ($430→$1.206, 2.80x). Premium economy: tampoco existe —
 *    Copa confirmado como Economy/Economy Extra/Business únicamente,
 *    sin cabina premium en toda su flota.
 *  - Largo (7h+ — Buenos Aires, Río, Iguazú, etc.): JFK-EZE ($850→
 *    premium economy $2.124/2.50x, business $4.000/4.71x), YYZ-GIG
 *    (business ratio 2.55x pero de una tarifa promocional de 2024,
 *    tratada como outlier), MIA-EZE ($800→premium economy $2.451/
 *    3.06x, business ~$3.992/4.99x). Acá sí hay cabina premium economy
 *    real en LATAM/American/Air Canada.
 */

export type HaulLength = "short" | "medium" | "long";

// Quiebres elegidos sobre la distribución real de avgFlightDurationMinutes
// del catálogo (952 rutas): p50=240min, p75=330min, p90=480min — corto/
// medio/largo quedan con 273/726/137 rutas cada uno, los 3 con volumen
// suficiente para que el tier tenga sentido.
const SHORT_MAX_MINUTES = 180;
const MEDIUM_MAX_MINUTES = 420;

export function classifyHaulLength(durationMinutes: number): HaulLength {
  if (durationMinutes <= SHORT_MAX_MINUTES) return "short";
  if (durationMinutes <= MEDIUM_MAX_MINUTES) return "medium";
  return "long";
}

export interface HaulMultipliers {
  standard?: number; // ausente a propósito en short/medium — ver comentario de arriba
  premium: number;
}

export const FLIGHT_CLASS_MULTIPLIERS: Record<HaulLength, HaulMultipliers> = {
  short: { premium: 2.3 },
  medium: { premium: 2.5 },
  long: { standard: 2.8, premium: 4.5 },
};

export interface FlightClassPrices {
  economic: number;
  standard?: number;
  premium: number;
}

/**
 * economicPriceUSD ya viene con todos los ajustes del motor aplicados
 * (curado/recalibrado + anticipación) — acá solo se multiplica, no se
 * vuelve a tocar ese número.
 */
export function getFlightClassPrices(economicPriceUSD: number, durationMinutes: number): FlightClassPrices {
  const haul = classifyHaulLength(durationMinutes);
  const multipliers = FLIGHT_CLASS_MULTIPLIERS[haul];
  return {
    economic: Math.round(economicPriceUSD),
    ...(multipliers.standard ? { standard: Math.round(economicPriceUSD * multipliers.standard) } : {}),
    premium: Math.round(economicPriceUSD * multipliers.premium),
  };
}
