/**
 * Links de afiliados — Fase 1 (MVP): genéricos, no personalizados a la
 * búsqueda con un ID de afiliado, porque todavía no hay ninguna cuenta de
 * partner aprobada (ver Affiliate Integration & API Contracts). Son URLs
 * públicas de búsqueda real de cada proveedor, no enlaces monetizados —
 * el día que se aprueben cuentas, estas mismas funciones son las que
 * cambian para agregar el parámetro de afiliado, no hay que tocar el resto
 * del código (mismo principio que StaticPriceAdapter → adapter real).
 */

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

  const flight = new URL("https://www.google.com/travel/flights");
  flight.searchParams.set("origin", originAirportCode);
  flight.searchParams.set("destination", destinationAirportCode);
  flight.searchParams.set("departure_date", startDate);
  flight.searchParams.set("return_date", endDate);
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
