/**
 * Links de afiliados. Los marcadores/IDs por categoría ahora se leen de
 * Firestore (colección `partners`, editable desde /admin/partners en
 * apps/www) en vez de estar hardcodeados acá — 2026-08-07, panel de
 * admin. `buildPartnerLinks` se queda pura (arma URLs a partir de un
 * PartnerConfig ya resuelto); `getPartnerConfig` es la única pieza que
 * habla con Firestore, con cache en memoria (~5 min por isolate) y
 * fallback a estos mismos valores hardcodeados si Firestore no responde
 * — mismo principio defensivo que ya usa DiscoverSection: un problema
 * de Firestore nunca debe romper la búsqueda de un usuario.
 */
import {
  listDocuments,
  DEFAULT_PARTNER_CONFIG,
  type FirestoreCredentials,
  type PartnerCategory,
  type PartnerConfig,
} from "@aritrips/data";

export type { PartnerCategory, PartnerConfigEntry, PartnerConfig } from "@aritrips/data";

let cachedConfig: { config: PartnerConfig; expiresAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getPartnerConfig(env: { FIREBASE_CLIENT_EMAIL?: string; FIREBASE_PRIVATE_KEY?: string }): Promise<PartnerConfig> {
  if (cachedConfig && cachedConfig.expiresAt > Date.now()) return cachedConfig.config;
  if (!env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) return DEFAULT_PARTNER_CONFIG;

  try {
    const credentials: FirestoreCredentials = {
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    };
    const docs = await listDocuments("partners", credentials);
    const config: PartnerConfig = { ...DEFAULT_PARTNER_CONFIG };
    for (const doc of docs) {
      const category = doc.category as PartnerCategory;
      if (category in config && typeof doc.value === "string") {
        config[category] = { category, value: doc.value, active: doc.active !== false };
      }
    }
    cachedConfig = { config, expiresAt: Date.now() + CACHE_TTL_MS };
    return config;
  } catch (err) {
    console.error("[partners] Firestore read failed, falling back to defaults", err);
    return DEFAULT_PARTNER_CONFIG;
  }
}

export interface PartnerLinkInput {
  originAirportCode: string;
  destinationAirportCode: string;
  destinationName: string;
  startDate: string; // ISO yyyy-mm-dd
  endDate: string; // ISO yyyy-mm-dd
  adults: number;
}

export type PartnerLinks = Partial<Record<PartnerCategory, string>>;

export function buildPartnerLinks(input: PartnerLinkInput, config: PartnerConfig): PartnerLinks {
  const { destinationName, startDate, endDate, adults } = input;
  const rooms = Math.ceil(adults / 2);
  const links: PartnerLinks = {};

  if (config.flight.active) {
    const flight = new URL("https://www.kiwi.com/deep");
    flight.searchParams.set("affilid", config.flight.value);
    flight.searchParams.set("from", input.originAirportCode);
    flight.searchParams.set("to", input.destinationAirportCode);
    flight.searchParams.set("departure", startDate);
    flight.searchParams.set("return", endDate);
    flight.searchParams.set("adults", String(adults));
    links.flight = flight.toString();
  }

  if (config.hotel.active) {
    const hotel = new URL("https://www.booking.com/searchresults.html");
    hotel.searchParams.set("ss", destinationName);
    hotel.searchParams.set("checkin", startDate);
    hotel.searchParams.set("checkout", endDate);
    hotel.searchParams.set("group_adults", String(adults));
    hotel.searchParams.set("no_rooms", String(rooms));
    if (config.hotel.value) hotel.searchParams.set("aid", config.hotel.value);
    links.hotel = hotel.toString();
  }

  if (config.activity.active) {
    const activity = new URL("https://www.klook.com/search/result/");
    activity.searchParams.set("query", destinationName);
    activity.searchParams.set("aid", config.activity.value);
    links.activity = activity.toString();
  }

  // Seguro y eSIM no tienen deep link por destino disponible — el "value"
  // guardado es la URL completa de homepage con tracking, no un ID.
  if (config.insurance.active) links.insurance = config.insurance.value;
  if (config.esim.active) links.esim = config.esim.value;

  return links;
}
