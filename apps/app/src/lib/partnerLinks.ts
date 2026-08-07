/**
 * Links de afiliados. Vuelos: Kiwi.com vía Travelpayouts, primera cuenta
 * de afiliado real aprobada (2026-08-07) — reemplaza a Google Flights,
 * que nunca tuvo programa de afiliados (no pagaba comisión, era solo un
 * link de búsqueda genérico). El resto de categorías (hotel/actividad/
 * seguro/eSIM) siguen siendo genéricas hasta que se aprueben esas cuentas
 * — mismo principio de adapter que el resto del proyecto: cuando se
 * aprueben, solo cambian estas funciones, no el resto del código.
 */

// Marcador de afiliado real de la cuenta de Travelpayouts (Kiwi.com),
// generado desde su panel — NO es secreto (va en URLs públicas que se
// muestran al usuario final), a diferencia de las credenciales de
// Firestore, que sí lo son.
const KIWI_AFFILIATE_ID = "travelpayoutsdeeplink_aritrips.com_151b853c366e4bd4acb1c8f5c-761476";

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

  const activity = new URL("https://www.getyourguide.com/s/");
  activity.searchParams.set("q", destinationName);

  return {
    flight: flight.toString(),
    hotel: hotel.toString(),
    activity: activity.toString(),
    // Seguro y eSIM no son específicos del destino/fechas de la misma forma
    // (seguro cubre el viaje completo, eSIM depende del país) — se linkea a
    // la página de inicio del proveedor, no a una búsqueda profunda, hasta
    // que haya una integración real.
    insurance: "https://www.worldnomads.com/travel-insurance",
    esim: "https://www.airalo.com/",
  };
}
