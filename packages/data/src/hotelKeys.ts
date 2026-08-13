/**
 * Hoteles reales por destino, curados a mano, usados como ancla de precio
 * de mercado vía la API gratuita de Xotelo (xotelo.com — precios reales de
 * Booking.com/Agoda/Expedia/Trip.com sacados de TripAdvisor, sin necesidad
 * de cuenta ni token).
 *
 * El hotel_key viene directo de la URL de reseñas de TripAdvisor de ESE
 * hotel: https://www.tripadvisor.com/Hotel_Review-g{geoId}-d{hotelId}-
 * Reviews-...html → hotel_key = "g{geoId}-d{hotelId}".
 *
 * Por qué un hotel puntual por tier y no el promedio de toda la ciudad: el
 * endpoint /list de Xotelo (que sí da el promedio de una ciudad entera)
 * está roto en la práctica — devuelve error con exactamente los parámetros
 * que su propia documentación pide, probablemente por ser un proyecto
 * chico y no muy mantenido (confirmado independientemente por 2
 * investigaciones separadas). El endpoint /rates (un hotel puntual) sí
 * funciona bien, así que cada hotel actúa de "termómetro" de su gama —
 * no es un promedio, pero es un precio real, no inventado.
 *
 * `mid` es obligatorio (todo destino con datos de estadía curados tiene al
 * menos un ancla). `budget`/`premium` son opcionales — se suman de a
 * lotes, investigados con URLs reales de TripAdvisor, nunca inventados.
 * Ver applyLiveHotelPriceOverlay (livePrices.ts): un tier sin ancla real
 * sigue escalando proporcional al factor de `mid`, así que agregar más
 * tiers de a poco no rompe nada, solo mejora la precisión.
 *
 * 2026-08-13: primer lote de budget+premium (Cancún, Puerto Vallarta) +
 * relleno del hueco real que tenían los 8 destinos EE.UU./Canadá sumados
 * el 2026-08-11 (nunca habían tenido NINGÚN hotel curado, cero
 * calibración de precio en vivo hasta ahora). El resto del catálogo sigue
 * en un solo tier `mid`, mismo patrón incremental ya usado para el
 * catálogo de destinos (12→21→30→40→48) — no es un compromiso de
 * cobertura completa todavía.
 */
export interface HotelKeySet {
  budget?: string;
  mid: string;
  premium?: string;
}

export const HOTEL_KEYS: Record<string, HotelKeySet> = {
  cancun: { budget: "g150807-d13487681", mid: "g150807-d4418515", premium: "g150807-d642781" },
  "puerto-vallarta": { budget: "g150793-d152376", mid: "g150793-d152361", premium: "g150793-d1438800" },
  "punta-cana": { mid: "g147293-d2687221" },
  "cabo-san-lucas": { mid: "g152515-d153087" },
  tulum: { mid: "g150813-d17168601" },
  "costa-rica-guanacaste": { mid: "g309253-d7805499" },
  cartagena: { mid: "g297476-d7179581" },
  medellin: { mid: "g297478-d307377" },
  cusco: { mid: "g294314-d301067" },
  "buenos-aires": { mid: "g312741-d1732676" },
  "mexico-city": { mid: "g150800-d186798" },
  nassau: { mid: "g147416-d156301" },
  "panama-city": { mid: "g294480-d6440808" },
  roatan: { mid: "g292019-d1134366" },
  aruba: { mid: "g147247-d148738" },
  "new-orleans": { mid: "g60864-d111969" },
  "san-diego": { mid: "g60750-d112258" },
  banff: { mid: "g154910-d1641412" },
  oaxaca: { mid: "g150801-d1110207" },
  "turks-and-caicos": { mid: "g147399-d151306" },
  "montego-bay": { mid: "g147311-d155121" },
  "las-vegas": { mid: "g45963-d97786" },
  orlando: { mid: "g34515-d223017" },
  honolulu: { mid: "g60982-d208960" },
  "quebec-city": { mid: "g155033-d1546398" },
  whistler: { mid: "g154948-d184247" },
  curacao: { mid: "g147278-d150671" },
  mazatlan: { mid: "g150792-d152750" },
  belize: { mid: "g291962-d302854" },
  aspen: { mid: "g29141-d27716614" },
  "rio-de-janeiro": { mid: "g303506-d305625" },
  "san-juan": { mid: "g147320-d26555257" },
  galapagos: { mid: "g297533-d1058754" },
  "grand-cayman": { mid: "g147367-d149250" },
  "st-lucia": { mid: "g8843287-d263008" },
  "antigua-guatemala": { mid: "g295366-d1572778" },
  bogota: { mid: "g294074-d562555" },
  nashville: { mid: "g55229-d14031179" },
  guadalajara: { mid: "g150798-d3248695" },
  "iguazu-falls": { mid: "g312806-d1638737" },
  // Sumados 2026-08-13 — los 8 destinos EE.UU./Canadá agregados al catálogo
  // el 2026-08-11 nunca habían tenido hotel curado, así que hoy es el
  // primer dato real de precio de hotel que van a tener.
  "new-york": { mid: "g60763-d99354" }, // Moderne Hotel NYC (Midtown Manhattan)
  "san-francisco": { mid: "g60713-d15521276" }, // Hyatt Place San Francisco Downtown
  miami: { mid: "g34439-d87012" }, // Beacon South Beach Hotel (Miami Beach)
  "los-angeles": { mid: "g32655-d77798" }, // Sheraton Grand Los Angeles (Downtown/Financial District)
  chicago: { mid: "g35805-d111487" }, // Hilton Garden Inn Chicago Downtown/Magnificent Mile
  dallas: { mid: "g55711-d280902" }, // Dallas Marriott Downtown
  toronto: { mid: "g155019-d183085" }, // Sheraton Centre Toronto Hotel
  montreal: { mid: "g155032-d263978" }, // Hotel Nelligan (Old Montreal)
};
