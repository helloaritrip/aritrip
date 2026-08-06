import { ORIGIN_HUBS, type OriginHub } from "./types";

/** Coordenadas aproximadas de cada hub — solo para elegir el más cercano a una ubicación detectada. */
export const ORIGIN_HUB_COORDS: Record<OriginHub, { lat: number; lon: number }> = {
  JFK: { lat: 40.64, lon: -73.78 },
  MIA: { lat: 25.8, lon: -80.29 },
  DFW: { lat: 32.9, lon: -97.04 },
  LAX: { lat: 33.94, lon: -118.41 },
  ORD: { lat: 41.98, lon: -87.9 },
  YYZ: { lat: 43.68, lon: -79.63 },
  YVR: { lat: 49.19, lon: -123.18 },
  MEX: { lat: 19.44, lon: -99.07 },
  ATL: { lat: 33.64, lon: -84.43 },
  BOS: { lat: 42.36, lon: -71.01 },
  SEA: { lat: 47.45, lon: -122.31 },
  DEN: { lat: 39.86, lon: -104.67 },
  IAH: { lat: 29.98, lon: -95.34 },
  PHX: { lat: 33.43, lon: -112.01 },
  SFO: { lat: 37.62, lon: -122.38 },
  YUL: { lat: 45.47, lon: -73.74 },
};

/** Fallback cuando no hay señal de geolocalización (dev local sin proxy de Cloudflare, o visitante fuera del footprint). */
export const DEFAULT_ORIGIN_HUB: OriginHub = "DFW";

function haversineDistanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Hub curado más cercano a una lat/long detectada (ej. de request.cf en Cloudflare). */
export function nearestOriginHub(location: { lat: number; lon: number }): OriginHub {
  let closest: OriginHub = DEFAULT_ORIGIN_HUB;
  let closestDistance = Infinity;
  for (const hub of ORIGIN_HUBS) {
    const distance = haversineDistanceKm(location, ORIGIN_HUB_COORDS[hub]);
    if (distance < closestDistance) {
      closestDistance = distance;
      closest = hub;
    }
  }
  return closest;
}
