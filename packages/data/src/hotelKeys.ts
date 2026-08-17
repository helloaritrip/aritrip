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
 * calibración de precio en vivo hasta ahora).
 *
 * 2026-08-17: catálogo completo — los 48 destinos activos ya tienen los 3
 * tiers curados. Sigue siendo un ancla puntual por tier, no un promedio
 * (ver el motivo arriba).
 */
export interface HotelKeySet {
  budget?: string;
  mid: string;
  premium?: string;
}

export const HOTEL_KEYS: Record<string, HotelKeySet> = {
  cancun: { budget: "g150807-d13487681", mid: "g150807-d4418515", premium: "g150807-d642781" },
  "puerto-vallarta": { budget: "g150793-d152376", mid: "g150793-d152361", premium: "g150793-d1438800" },
  // Budget+premium para el resto del catálogo (2026-08-17) — cierra el
  // pendiente que quedaba desde el lote del 2026-08-15. Investigado con 4
  // agentes en paralelo agrupados por región contra TripAdvisor (mismo
  // criterio: nunca inventar un hotel_key). Dos geoIds no coinciden con el
  // de `mid` a propósito, no es un error — TripAdvisor indexa el mismo
  // lugar bajo nodos distintos (isla/parque vs. barrio/pueblo puntual) y
  // cada hotel_key solo necesita ser válido para SU hotel, no compartir
  // prefijo con los otros tiers: Aruba (mid usa el nodo de isla g147247,
  // budget/premium usan los nodos de barrio g147248/g147249) y Banff (mid
  // usa el nodo de parque g154910, budget/premium usan el nodo de pueblo
  // g154911).
  "punta-cana": { budget: "g147293-d12848220", mid: "g147293-d2687221", premium: "g147293-d149864" }, // budget: Bavaro Hostel, premium: Club Med Punta Cana
  "cabo-san-lucas": { budget: "g152515-d1223989", mid: "g152515-d153087", premium: "g152515-d672982" }, // budget: Bajas Cactus Hotel y Hostel, premium: Casa Dorada Los Cabos Resort & Spa
  tulum: { budget: "g150813-d6454395", mid: "g150813-d17168601", premium: "g150813-d23608358" }, // budget: Tubo Tulum Hostel, premium: Conrad Tulum Riviera Maya
  "costa-rica-guanacaste": { budget: "g309253-d1202971", mid: "g309253-d7805499", premium: "g309253-d530421" }, // ciudad real = Tamarindo; budget: Tamarindo Backpackers, premium: Capitán Suizo Beachfront Boutique Hotel
  cartagena: { budget: "g297476-d9808415", mid: "g297476-d7179581", premium: "g297476-d275130" }, // budget: Cartagena Hostel, premium: Sofitel Legend Santa Clara Cartagena
  medellin: { budget: "g297478-d1201826", mid: "g297478-d307377", premium: "g297478-d299105" }, // budget: Black Sheep Hostel Medellin, premium: InterContinental Medellin
  cusco: { budget: "g294314-d1642693", mid: "g294314-d301067", premium: "g294314-d2568957" }, // budget: Pariwana Hostel Cusco, premium: Palacio Nazarenas, A Belmond Hotel
  "buenos-aires": { budget: "g312741-d1404713", mid: "g312741-d1732676", premium: "g312741-d604652" }, // budget: America del Sur Hostel, premium: Palacio Duhau - Park Hyatt Buenos Aires
  "mexico-city": { budget: "g150800-d1136092", mid: "g150800-d186798", premium: "g150800-d152463" }, // budget: Hostal Condesa, premium: Four Seasons Hotel Mexico City
  nassau: { budget: "g147416-d15363567", mid: "g147416-d156301", premium: "g147416-d33971708" }, // budget: HumesHouse Hostel @ HillCrest, premium: The Beach at Atlantis
  "panama-city": { budget: "g294480-d1201914", mid: "g294480-d6440808", premium: "g294480-d2174846" }, // budget: Hostal Mamallena, premium: JW Marriott Panama
  roatan: { budget: "g292019-d2104874", mid: "g292019-d1134366", premium: "g292019-d587144" }, // budget: Georphi's Tropical Hideaway, premium: Paya Bay Resort
  aruba: { budget: "g147248-d152008", mid: "g147247-d148738", premium: "g147249-d301462" }, // budget: Talk of the Town Hotel & Beach Club (Oranjestad), premium: Bucuti & Tara Beach Resort Aruba (Palm-Eagle Beach)
  "new-orleans": { budget: "g60864-d93218", mid: "g60864-d111969", premium: "g60864-d23162833" }, // budget: La Quinta Inn & Suites New Orleans Downtown, premium: Four Seasons Hotel New Orleans
  "san-diego": { budget: "g60750-d115594", mid: "g60750-d112258", premium: "g60750-d10844211" }, // budget: HI San Diego Downtown Hostel, premium: Pendry San Diego
  banff: { budget: "g154911-d634882", mid: "g154910-d1641412", premium: "g154911-d184171" }, // budget: HI-Banff Alpine Centre, premium: Fairmont Banff Springs
  oaxaca: { budget: "g150801-d1656084", mid: "g150801-d1110207", premium: "g150801-d152776" }, // budget: Casa Angel Hostel, premium: Quinta Real Oaxaca
  "turks-and-caicos": { budget: "g147399-d11776193", mid: "g147399-d151306", premium: "g147399-d23283953" }, // budget: Sunset Ridge Hotel, premium: The Ritz-Carlton, Turks & Caicos
  "montego-bay": { budget: "g147311-d4702566", mid: "g147311-d155121", premium: "g147311-d27784693" }, // budget: Hotel Montego, premium: Half Moon Jamaica
  "las-vegas": { budget: "g45963-d91679", mid: "g45963-d97786", premium: "g45963-d503598" }, // budget: The D Las Vegas Hotel, premium: Wynn Las Vegas
  orlando: { budget: "g34515-d88214", mid: "g34515-d223017", premium: "g34515-d6523102" }, // budget: Rosen Inn Lake Buena Vista, premium: Four Seasons Resort Orlando at Walt Disney World Resort
  honolulu: { budget: "g60982-d285170", mid: "g60982-d208960", premium: "g60982-d90015" }, // budget: Hostelling International Waikiki, premium: Halekulani Hotel
  "quebec-city": { budget: "g155033-d260194", mid: "g155033-d1546398", premium: "g155033-d155587" }, // budget: HI Quebec - Auberge Internationale de Québec, premium: Fairmont Le Château Frontenac
  whistler: { budget: "g154948-d219677", mid: "g154948-d184247", premium: "g154948-d155554" }, // budget: Whistler Lodge Hostel, premium: Fairmont Chateau Whistler
  curacao: { budget: "g147278-d8071677", mid: "g147278-d150671", premium: "g147278-d150663" }, // budget: Curacao Suites Hotel, premium: Curacao Marriott Beach Resort
  mazatlan: { budget: "g150792-d3486765", mid: "g150792-d152750", premium: "g150792-d226267" }, // budget: Wandering Monkey Guesthouse, premium: Pueblo Bonito Emerald Bay Resort & Spa
  belize: { budget: "g291962-d1645908", mid: "g291962-d302854", premium: "g291962-d302868" }, // ciudad real = San Pedro, Ambergris Caye; budget: Pedro's Inn Backpacker Hostel, premium: Victoria House Resort & Spa
  aspen: { budget: "g29141-d120020", mid: "g29141-d27716614", premium: "g29141-d82763" }, // budget: St. Moritz Lodge & Condominiums, premium: The Little Nell
  "rio-de-janeiro": { budget: "g303506-d8747032", mid: "g303506-d305625", premium: "g303506-d301985" }, // budget: ibis budget RJ Copacabana, premium: Copacabana Palace, A Belmond Hotel
  "san-juan": { budget: "g147320-d2481661", mid: "g147320-d26555257", premium: "g147320-d6691692" }, // budget: Dreams Hotel Puerto Rico, premium: Condado Vanderbilt Hotel
  galapagos: { budget: "g297533-d13428531", mid: "g297533-d1058754", premium: "g297533-d495654" }, // ciudad real = Puerto Ayora, Santa Cruz Island; budget: Hostal Puerto Ayora, premium: Finch Bay Galapagos Hotel
  "grand-cayman": { budget: "g147367-d15835392", mid: "g147367-d149250", premium: "g147367-d302259" }, // budget: The Locale Hotel Grand Cayman, premium: The Ritz-Carlton, Grand Cayman
  "st-lucia": { budget: "g8843287-d149489", mid: "g8843287-d263008", premium: "g8843287-d263015" }, // budget: Bay Gardens Hotel, premium: Sandals Grande St. Lucian Spa & Beach Resort
  "antigua-guatemala": { budget: "g295366-d12960226", mid: "g295366-d1572778", premium: "g295366-d300278" }, // budget: Selina Antigua, premium: Hotel Casa Santo Domingo
  bogota: { budget: "g294074-d2388686", mid: "g294074-d562555", premium: "g294074-d301960" }, // budget: Masaya Hostel Bogota, premium: Four Seasons Hotel Bogota
  nashville: { budget: "g55229-d23478110", mid: "g55229-d14031179", premium: "g55229-d111960" }, // budget: La Quinta Inn & Suites Nashville Downtown Stadium, premium: The Hermitage Hotel
  guadalajara: { budget: "g150798-d12212082", mid: "g150798-d3248695", premium: "g150798-d676372" }, // budget: Hostel Hostalife, premium: Grand Fiesta Americana Guadalajara Country Club
  "iguazu-falls": { budget: "g312806-d4081485", mid: "g312806-d1638737", premium: "g312806-d13376769" }, // ciudad real = Puerto Iguazú, Argentina; budget: Poramba Hostel, premium: Awasi Iguazú, A Relais & Châteaux Hotel
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
