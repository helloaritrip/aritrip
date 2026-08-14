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
  //
  // Budget + premium sumados 2026-08-15 (roadmap pendiente desde
  // 2026-08-07/08: "sumar 2-3 hoteles más por destino en gama alta y
  // media") — prioridad sobre estos 8 en vez del catálogo completo,
  // acordado con el usuario ("destinos con tráfico real comprobado" antes
  // que los 48 de una). Cada hotel investigado en vivo contra TripAdvisor
  // (nunca inventado, mismo criterio que Cancún/Puerto Vallarta) — no es
  // un promedio de varios hoteles por tier todavía, sigue siendo un ancla
  // puntual por tier, ver el comentario de arriba sobre por qué (el
  // endpoint /list de Xotelo que daría el promedio real está roto).
  "new-york": {
    budget: "g60763-d93437", // Hotel Edison (Times Square)
    mid: "g60763-d99354", // Moderne Hotel NYC (Midtown Manhattan)
    premium: "g60763-d113298", // Four Seasons Hotel New York
  },
  "san-francisco": {
    budget: "g60713-d265328", // HI San Francisco Downtown Hostel
    mid: "g60713-d15521276", // Hyatt Place San Francisco Downtown
    premium: "g60713-d81450", // The Ritz-Carlton, San Francisco
  },
  miami: {
    budget: "g34439-d85107", // Circa 39 Miami Beach
    mid: "g34439-d87012", // Beacon South Beach Hotel (Miami Beach)
    premium: "g34439-d85177", // Fontainebleau Miami Beach
  },
  "los-angeles": {
    budget: "g32655-d77859", // Stillwell Hotel (Downtown)
    mid: "g32655-d77798", // Sheraton Grand Los Angeles (Downtown/Financial District)
    premium: "g32655-d84463", // SLS Hotel, a Luxury Collection Hotel, Beverly Hills
  },
  chicago: {
    budget: "g35805-d7375440", // Freehand Chicago (River North)
    mid: "g35805-d111487", // Hilton Garden Inn Chicago Downtown/Magnificent Mile
    premium: "g35805-d114591", // Four Seasons Hotel Chicago
  },
  dallas: {
    budget: "g55711-d1631539", // Budget Inn
    mid: "g55711-d280902", // Dallas Marriott Downtown
    premium: "g55711-d659532", // The Ritz-Carlton, Dallas
  },
  toronto: {
    budget: "g155019-d1474474", // The Rex Hotel (Queen St Entertainment District)
    mid: "g155019-d183085", // Sheraton Centre Toronto Hotel
    premium: "g155019-d12483976", // BISHA, a Luxury Collection Hotel, Toronto
  },
  montreal: {
    budget: "g155032-d155208", // Hôtel Bonaparte (Old Montreal)
    mid: "g155032-d263978", // Hotel Nelligan (Old Montreal)
    premium: "g155032-d155207", // The Ritz-Carlton, Montreal
  },
};
