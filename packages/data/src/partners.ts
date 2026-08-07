/**
 * Tipos y valores por defecto de los partners de afiliados — compartidos
 * entre apps/app (arma los links reales, ver src/lib/partnerLinks.ts) y
 * apps/www (panel de admin en /admin/partners). Cada categoría vive como
 * un documento en la colección Firestore `partners`; estos son los
 * valores reales de hoy, usados tanto para sembrar Firestore por primera
 * vez como de fallback si Firestore no responde.
 */

export type PartnerCategory = "flight" | "hotel" | "activity" | "insurance" | "esim";

export const PARTNER_CATEGORIES: PartnerCategory[] = ["flight", "hotel", "activity", "insurance", "esim"];

export interface PartnerConfigEntry {
  category: PartnerCategory;
  value: string;
  active: boolean;
}

export type PartnerConfig = Record<PartnerCategory, PartnerConfigEntry>;

export const PARTNER_LABELS: Record<PartnerCategory, { name: string; valueLabel: string; helpText: string }> = {
  flight: {
    name: "Flights — Kiwi.com",
    valueLabel: "Affiliate ID (affilid)",
    helpText: "Travelpayouts marker, e.g. travelpayoutsdeeplink_aritrips.com_...-761476",
  },
  hotel: {
    name: "Hotel — Booking.com",
    valueLabel: "Affiliate ID (aid), optional",
    helpText: "Leave empty until the Booking.com affiliate account is approved — links still work without it.",
  },
  activity: {
    name: "Activities — Klook",
    valueLabel: "Affiliate ID (aid)",
    helpText: "Travelpayouts marker, e.g. api|13694|...-761476|pid|761476",
  },
  insurance: {
    name: "Insurance — EKTA",
    valueLabel: "Full affiliate URL",
    helpText: "No per-destination deep link exists — this is the homepage URL with tracking.",
  },
  esim: {
    name: "eSIM — Saily",
    valueLabel: "Full affiliate URL",
    helpText: "No per-destination deep link exists — this is the homepage URL with tracking.",
  },
};

// Valores reales de hoy (2026-08-07) — NO son secretos, van en URLs
// públicas que se muestran al usuario final.
export const DEFAULT_PARTNER_CONFIG: PartnerConfig = {
  flight: { category: "flight", value: "travelpayoutsdeeplink_aritrips.com_151b853c366e4bd4acb1c8f5c-761476", active: true },
  hotel: { category: "hotel", value: "", active: true },
  activity: { category: "activity", value: "api|13694|98e20227f64d4986a885e31b8-761476|pid|761476", active: true },
  insurance: {
    category: "insurance",
    value: "https://ektatraveling.com?sub_id=8a42d90caacb4d49ba702b049-761476&utm_source=travelpayouts",
    active: true,
  },
  esim: {
    category: "esim",
    value: "https://go.saily.site/aff_c?aff_id=8014&aff_sub=73bf4e0c4d474cfe94abf1c05-761476&offer_id=126",
    active: true,
  },
};
