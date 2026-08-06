import type { OriginBaseCost } from "../types";

/**
 * Costo base de vuelo (ida y vuelta, por pasajero) y duración por cada uno de
 * los 8 hubs de origen, para cada destino. Es el input humano real de la
 * curación de precios — de acá el generador de PriceSnapshot expande a los
 * 12 meses aplicando el multiplicador de temporada (ver priceSnapshots.ts),
 * en vez de tipear cientos de combinaciones a mano.
 *
 * Estimaciones de primer pase (temporada media), no cotización en vivo —
 * mismo disclaimer que destinations/index.ts.
 */
export const originBaseCosts: Record<string, OriginBaseCost[]> = {
  cancun: [
    { originAirportCode: "JFK", avgFlightCostUSD: 320, avgFlightDurationMinutes: 225 },
    { originAirportCode: "MIA", avgFlightCostUSD: 220, avgFlightDurationMinutes: 130 },
    { originAirportCode: "DFW", avgFlightCostUSD: 260, avgFlightDurationMinutes: 150 },
    { originAirportCode: "LAX", avgFlightCostUSD: 380, avgFlightDurationMinutes: 240 },
    { originAirportCode: "ORD", avgFlightCostUSD: 300, avgFlightDurationMinutes: 195 },
    { originAirportCode: "YYZ", avgFlightCostUSD: 340, avgFlightDurationMinutes: 220 },
    { originAirportCode: "YVR", avgFlightCostUSD: 450, avgFlightDurationMinutes: 330 },
    { originAirportCode: "MEX", avgFlightCostUSD: 140, avgFlightDurationMinutes: 105 },
  ],
  "puerto-vallarta": [
    { originAirportCode: "JFK", avgFlightCostUSD: 360, avgFlightDurationMinutes: 300 },
    { originAirportCode: "MIA", avgFlightCostUSD: 310, avgFlightDurationMinutes: 255 },
    { originAirportCode: "DFW", avgFlightCostUSD: 240, avgFlightDurationMinutes: 165 },
    { originAirportCode: "LAX", avgFlightCostUSD: 290, avgFlightDurationMinutes: 195 },
    { originAirportCode: "ORD", avgFlightCostUSD: 330, avgFlightDurationMinutes: 225 },
    { originAirportCode: "YYZ", avgFlightCostUSD: 380, avgFlightDurationMinutes: 270 },
    { originAirportCode: "YVR", avgFlightCostUSD: 340, avgFlightDurationMinutes: 240 },
    { originAirportCode: "MEX", avgFlightCostUSD: 130, avgFlightDurationMinutes: 95 },
  ],
  "punta-cana": [
    { originAirportCode: "JFK", avgFlightCostUSD: 310, avgFlightDurationMinutes: 225 },
    { originAirportCode: "MIA", avgFlightCostUSD: 290, avgFlightDurationMinutes: 165 },
    { originAirportCode: "DFW", avgFlightCostUSD: 400, avgFlightDurationMinutes: 270 },
    { originAirportCode: "LAX", avgFlightCostUSD: 520, avgFlightDurationMinutes: 375 },
    { originAirportCode: "ORD", avgFlightCostUSD: 380, avgFlightDurationMinutes: 255 },
    { originAirportCode: "YYZ", avgFlightCostUSD: 340, avgFlightDurationMinutes: 240 },
    { originAirportCode: "YVR", avgFlightCostUSD: 580, avgFlightDurationMinutes: 420 },
    { originAirportCode: "MEX", avgFlightCostUSD: 340, avgFlightDurationMinutes: 195 },
  ],
  "cabo-san-lucas": [
    { originAirportCode: "JFK", avgFlightCostUSD: 420, avgFlightDurationMinutes: 315 },
    { originAirportCode: "MIA", avgFlightCostUSD: 380, avgFlightDurationMinutes: 285 },
    { originAirportCode: "DFW", avgFlightCostUSD: 280, avgFlightDurationMinutes: 165 },
    { originAirportCode: "LAX", avgFlightCostUSD: 220, avgFlightDurationMinutes: 135 },
    { originAirportCode: "ORD", avgFlightCostUSD: 340, avgFlightDurationMinutes: 225 },
    { originAirportCode: "YYZ", avgFlightCostUSD: 420, avgFlightDurationMinutes: 300 },
    { originAirportCode: "YVR", avgFlightCostUSD: 310, avgFlightDurationMinutes: 195 },
    { originAirportCode: "MEX", avgFlightCostUSD: 190, avgFlightDurationMinutes: 130 },
  ],
  tulum: [
    { originAirportCode: "JFK", avgFlightCostUSD: 320, avgFlightDurationMinutes: 225 },
    { originAirportCode: "MIA", avgFlightCostUSD: 220, avgFlightDurationMinutes: 130 },
    { originAirportCode: "DFW", avgFlightCostUSD: 260, avgFlightDurationMinutes: 150 },
    { originAirportCode: "LAX", avgFlightCostUSD: 380, avgFlightDurationMinutes: 240 },
    { originAirportCode: "ORD", avgFlightCostUSD: 300, avgFlightDurationMinutes: 195 },
    { originAirportCode: "YYZ", avgFlightCostUSD: 340, avgFlightDurationMinutes: 220 },
    { originAirportCode: "YVR", avgFlightCostUSD: 450, avgFlightDurationMinutes: 330 },
    { originAirportCode: "MEX", avgFlightCostUSD: 140, avgFlightDurationMinutes: 105 },
  ],
  "costa-rica-guanacaste": [
    { originAirportCode: "JFK", avgFlightCostUSD: 420, avgFlightDurationMinutes: 315 },
    { originAirportCode: "MIA", avgFlightCostUSD: 260, avgFlightDurationMinutes: 165 },
    { originAirportCode: "DFW", avgFlightCostUSD: 360, avgFlightDurationMinutes: 240 },
    { originAirportCode: "LAX", avgFlightCostUSD: 430, avgFlightDurationMinutes: 330 },
    { originAirportCode: "ORD", avgFlightCostUSD: 400, avgFlightDurationMinutes: 285 },
    { originAirportCode: "YYZ", avgFlightCostUSD: 440, avgFlightDurationMinutes: 320 },
    { originAirportCode: "YVR", avgFlightCostUSD: 520, avgFlightDurationMinutes: 390 },
    { originAirportCode: "MEX", avgFlightCostUSD: 310, avgFlightDurationMinutes: 165 },
  ],
  cartagena: [
    { originAirportCode: "JFK", avgFlightCostUSD: 380, avgFlightDurationMinutes: 255 },
    { originAirportCode: "MIA", avgFlightCostUSD: 260, avgFlightDurationMinutes: 165 },
    { originAirportCode: "DFW", avgFlightCostUSD: 420, avgFlightDurationMinutes: 270 },
    { originAirportCode: "LAX", avgFlightCostUSD: 520, avgFlightDurationMinutes: 360 },
    { originAirportCode: "ORD", avgFlightCostUSD: 440, avgFlightDurationMinutes: 300 },
    { originAirportCode: "YYZ", avgFlightCostUSD: 460, avgFlightDurationMinutes: 320 },
    { originAirportCode: "YVR", avgFlightCostUSD: 620, avgFlightDurationMinutes: 450 },
    { originAirportCode: "MEX", avgFlightCostUSD: 380, avgFlightDurationMinutes: 225 },
  ],
  medellin: [
    { originAirportCode: "JFK", avgFlightCostUSD: 400, avgFlightDurationMinutes: 285 },
    { originAirportCode: "MIA", avgFlightCostUSD: 290, avgFlightDurationMinutes: 195 },
    { originAirportCode: "DFW", avgFlightCostUSD: 440, avgFlightDurationMinutes: 300 },
    { originAirportCode: "LAX", avgFlightCostUSD: 540, avgFlightDurationMinutes: 390 },
    { originAirportCode: "ORD", avgFlightCostUSD: 460, avgFlightDurationMinutes: 330 },
    { originAirportCode: "YYZ", avgFlightCostUSD: 480, avgFlightDurationMinutes: 350 },
    { originAirportCode: "YVR", avgFlightCostUSD: 640, avgFlightDurationMinutes: 480 },
    { originAirportCode: "MEX", avgFlightCostUSD: 400, avgFlightDurationMinutes: 255 },
  ],
  cusco: [
    { originAirportCode: "JFK", avgFlightCostUSD: 560, avgFlightDurationMinutes: 480 },
    { originAirportCode: "MIA", avgFlightCostUSD: 480, avgFlightDurationMinutes: 420 },
    { originAirportCode: "DFW", avgFlightCostUSD: 540, avgFlightDurationMinutes: 450 },
    { originAirportCode: "LAX", avgFlightCostUSD: 580, avgFlightDurationMinutes: 480 },
    { originAirportCode: "ORD", avgFlightCostUSD: 600, avgFlightDurationMinutes: 510 },
    { originAirportCode: "YYZ", avgFlightCostUSD: 640, avgFlightDurationMinutes: 540 },
    { originAirportCode: "YVR", avgFlightCostUSD: 700, avgFlightDurationMinutes: 570 },
    { originAirportCode: "MEX", avgFlightCostUSD: 460, avgFlightDurationMinutes: 390 },
  ],
  "buenos-aires": [
    { originAirportCode: "JFK", avgFlightCostUSD: 680, avgFlightDurationMinutes: 660 },
    { originAirportCode: "MIA", avgFlightCostUSD: 620, avgFlightDurationMinutes: 570 },
    { originAirportCode: "DFW", avgFlightCostUSD: 700, avgFlightDurationMinutes: 630 },
    { originAirportCode: "LAX", avgFlightCostUSD: 780, avgFlightDurationMinutes: 720 },
    { originAirportCode: "ORD", avgFlightCostUSD: 740, avgFlightDurationMinutes: 660 },
    { originAirportCode: "YYZ", avgFlightCostUSD: 760, avgFlightDurationMinutes: 690 },
    { originAirportCode: "YVR", avgFlightCostUSD: 860, avgFlightDurationMinutes: 780 },
    { originAirportCode: "MEX", avgFlightCostUSD: 580, avgFlightDurationMinutes: 480 },
  ],
  // Sin entrada para el hub MEX a propósito — ver insiderNotes de mexico-city.
  "mexico-city": [
    { originAirportCode: "JFK", avgFlightCostUSD: 280, avgFlightDurationMinutes: 255 },
    { originAirportCode: "MIA", avgFlightCostUSD: 260, avgFlightDurationMinutes: 195 },
    { originAirportCode: "DFW", avgFlightCostUSD: 210, avgFlightDurationMinutes: 150 },
    { originAirportCode: "LAX", avgFlightCostUSD: 260, avgFlightDurationMinutes: 210 },
    { originAirportCode: "ORD", avgFlightCostUSD: 260, avgFlightDurationMinutes: 225 },
    { originAirportCode: "YYZ", avgFlightCostUSD: 310, avgFlightDurationMinutes: 270 },
    { originAirportCode: "YVR", avgFlightCostUSD: 340, avgFlightDurationMinutes: 300 },
  ],
  nassau: [
    { originAirportCode: "JFK", avgFlightCostUSD: 340, avgFlightDurationMinutes: 195 },
    { originAirportCode: "MIA", avgFlightCostUSD: 220, avgFlightDurationMinutes: 75 },
    { originAirportCode: "DFW", avgFlightCostUSD: 420, avgFlightDurationMinutes: 240 },
    { originAirportCode: "LAX", avgFlightCostUSD: 560, avgFlightDurationMinutes: 360 },
    { originAirportCode: "ORD", avgFlightCostUSD: 440, avgFlightDurationMinutes: 225 },
    { originAirportCode: "YYZ", avgFlightCostUSD: 400, avgFlightDurationMinutes: 195 },
    { originAirportCode: "YVR", avgFlightCostUSD: 640, avgFlightDurationMinutes: 420 },
    { originAirportCode: "MEX", avgFlightCostUSD: 460, avgFlightDurationMinutes: 240 },
  ],
};

/** Costo de hotel/actividad — no varía por origen, solo por destino y temporada. */
export const destinationBaseStayCosts: Record<
  string,
  { avgHotelCostPerNightUSD: { budget: number; mid: number; premium: number }; avgActivityCostPerDayUSD: number }
> = {
  cancun: { avgHotelCostPerNightUSD: { budget: 60, mid: 140, premium: 320 }, avgActivityCostPerDayUSD: 55 },
  "puerto-vallarta": { avgHotelCostPerNightUSD: { budget: 45, mid: 100, premium: 230 }, avgActivityCostPerDayUSD: 45 },
  "punta-cana": { avgHotelCostPerNightUSD: { budget: 70, mid: 160, premium: 380 }, avgActivityCostPerDayUSD: 50 },
  "cabo-san-lucas": { avgHotelCostPerNightUSD: { budget: 90, mid: 220, premium: 500 }, avgActivityCostPerDayUSD: 70 },
  tulum: { avgHotelCostPerNightUSD: { budget: 70, mid: 180, premium: 420 }, avgActivityCostPerDayUSD: 60 },
  "costa-rica-guanacaste": { avgHotelCostPerNightUSD: { budget: 55, mid: 130, premium: 300 }, avgActivityCostPerDayUSD: 65 },
  cartagena: { avgHotelCostPerNightUSD: { budget: 50, mid: 120, premium: 280 }, avgActivityCostPerDayUSD: 45 },
  medellin: { avgHotelCostPerNightUSD: { budget: 35, mid: 80, premium: 190 }, avgActivityCostPerDayUSD: 35 },
  cusco: { avgHotelCostPerNightUSD: { budget: 40, mid: 90, premium: 220 }, avgActivityCostPerDayUSD: 60 },
  "buenos-aires": { avgHotelCostPerNightUSD: { budget: 45, mid: 100, premium: 240 }, avgActivityCostPerDayUSD: 45 },
  "mexico-city": { avgHotelCostPerNightUSD: { budget: 40, mid: 90, premium: 210 }, avgActivityCostPerDayUSD: 40 },
  nassau: { avgHotelCostPerNightUSD: { budget: 100, mid: 240, premium: 550 }, avgActivityCostPerDayUSD: 65 },
};
