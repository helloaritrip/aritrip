/**
 * Links de afiliados. Vuelos: Kiwi.com vía Travelpayouts, primera cuenta
 * de afiliado real aprobada (2026-08-07) — reemplaza a Google Flights,
 * que nunca tuvo programa de afiliados (no pagaba comisión, era solo un
 * link de búsqueda genérico). El resto de categorías (hotel/actividad/
 * seguro/eSIM) siguen siendo genéricas hasta que se aprueben esas cuentas
 * — mismo principio de adapter que el resto del proyecto: cuando se
 * aprueben, solo cambian estas funciones, no el resto del código.
 */

// Marcadores de afiliado reales de la cuenta de Travelpayouts — NO son
// secretos (van en URLs públicas que se muestran al usuario final), a
// diferencia de las credenciales de Firestore, que sí lo son.
const KIWI_AFFILIATE_ID = "travelpayoutsdeeplink_aritrips.com_151b853c366e4bd4acb1c8f5c-761476";
// Actividades: Klook en vez de GetYourGuide mientras esa solicitud está
// en revisión en Travelpayouts (pide sitios con 2+ meses de antigüedad,
// aritrips.com todavía no los tiene) — cambiar acá el día que se apruebe.
const KLOOK_AFFILIATE_ID = "api|13694|98e20227f64d4986a885e31b8-761476|pid|761476";
// eSIM: Saily en vez de Airalo — Airalo vía Travelpayouts resultó ser un
// revendedor de su programa nativo en Impact.com (mismo destino final,
// sin ventaja), así que se dejó pendiente aplicar directo a Impact
// aparte. Saily paga mejor (15% fijo) y es una relación directa.
const SAILY_AFFILIATE_URL =
  "https://go.saily.site/aff_c?aff_id=8014&aff_sub=73bf4e0c4d474cfe94abf1c05-761476&offer_id=126";
// Seguro: EKTA, primera cuenta real de esta categoría (25% de comisión,
// ya aprobada en Travelpayouts) — reemplaza el placeholder de World
// Nomads (nunca tuvo cuenta real; World Nomads/CJ sigue en cola aparte).
const EKTA_AFFILIATE_URL = "https://ektatraveling.com?sub_id=8a42d90caacb4d49ba702b049-761476&utm_source=travelpayouts";

export interface PartnerLinkInput {
  originAirportCode: string;
  destinationAirportCode: string;
  destinationName: string;
  startDate: string; // ISO yyyy-mm-dd
  endDate: string; // ISO yyyy-mm-dd
  adults: number;
}

export interface PartnerLinks {
  flight: string;
  hotel: string;
  activity: string;
  insurance: string;
  esim: string;
}

export function buildPartnerLinks(input: PartnerLinkInput): PartnerLinks {
  const { originAirportCode, destinationAirportCode, destinationName, startDate, endDate, adults } = input;
  const rooms = Math.ceil(adults / 2);

  const flight = new URL("https://www.kiwi.com/deep");
  flight.searchParams.set("affilid", KIWI_AFFILIATE_ID);
  flight.searchParams.set("from", originAirportCode);
  flight.searchParams.set("to", destinationAirportCode);
  flight.searchParams.set("departure", startDate);
  flight.searchParams.set("return", endDate);
  flight.searchParams.set("adults", String(adults));

  const hotel = new URL("https://www.booking.com/searchresults.html");
  hotel.searchParams.set("ss", destinationName);
  hotel.searchParams.set("checkin", startDate);
  hotel.searchParams.set("checkout", endDate);
  hotel.searchParams.set("group_adults", String(adults));
  hotel.searchParams.set("no_rooms", String(rooms));

  const activity = new URL("https://www.klook.com/search/result/");
  activity.searchParams.set("query", destinationName);
  activity.searchParams.set("aid", KLOOK_AFFILIATE_ID);

  return {
    flight: flight.toString(),
    hotel: hotel.toString(),
    activity: activity.toString(),
    // Seguro no tiene deep link por destino disponible — homepage con el
    // tracking intacto, mismo patrón que antes de tener cuentas reales,
    // pero ahora con comisión real de verdad.
    insurance: EKTA_AFFILIATE_URL,
    esim: SAILY_AFFILIATE_URL,
  };
}
