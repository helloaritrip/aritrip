/**
 * Un hotel de gama media real por destino, curado a mano (2026-08-07),
 * usado como ancla de precio de mercado para ese destino vía la API
 * gratuita de Xotelo (xotelo.com — precios reales de Booking.com/Agoda/
 * Expedia sacados de TripAdvisor, sin necesidad de cuenta ni token).
 *
 * El hotel_key viene directo de la URL de reseñas de TripAdvisor de ESE
 * hotel: https://www.tripadvisor.com/Hotel_Review-g{geoId}-d{hotelId}-
 * Reviews-...html → hotel_key = "g{geoId}-d{hotelId}".
 *
 * Por qué un solo hotel y no el promedio de toda la ciudad: el endpoint
 * /list de Xotelo (que sí da el promedio de una ciudad entera) está roto
 * en la práctica — devuelve error con exactamente los parámetros que su
 * propia documentación pide, probablemente por ser un proyecto chico y
 * no muy mantenido (confirmado independientemente por 2 investigaciones
 * separadas). El endpoint /rates (un hotel puntual) sí funciona bien,
 * así que este hotel actúa de "termómetro" del mercado — no es un
 * promedio, pero es un precio real, no inventado.
 *
 * Pendiente para más adelante (a pedido del usuario, 2026-08-07): sumar
 * 2-3 hoteles más por destino en distintas gamas (media y alta) para
 * tener una señal más rica que un solo hotel — hoy es deliberadamente
 * solo gama media, uno por destino.
 */
export const HOTEL_KEYS: Record<string, string> = {
  cancun: "g150807-d4418515",
  "puerto-vallarta": "g150793-d152361",
  "punta-cana": "g147293-d2687221",
  "cabo-san-lucas": "g152515-d153087",
  tulum: "g150813-d17168601",
  "costa-rica-guanacaste": "g309253-d7805499",
  cartagena: "g297476-d7179581",
  medellin: "g297478-d307377",
  cusco: "g294314-d301067",
  "buenos-aires": "g312741-d1732676",
  "mexico-city": "g150800-d186798",
  nassau: "g147416-d156301",
  "panama-city": "g294480-d6440808",
  roatan: "g292019-d1134366",
  aruba: "g147247-d148738",
  "new-orleans": "g60864-d111969",
  "san-diego": "g60750-d112258",
  banff: "g154910-d1641412",
  oaxaca: "g150801-d1110207",
  "turks-and-caicos": "g147399-d151306",
  "montego-bay": "g147311-d155121",
  "las-vegas": "g45963-d97786",
  orlando: "g34515-d223017",
  honolulu: "g60982-d208960",
  "quebec-city": "g155033-d1546398",
  whistler: "g154948-d184247",
  curacao: "g147278-d150671",
  mazatlan: "g150792-d152750",
  belize: "g291962-d302854",
  aspen: "g29141-d27716614",
  "rio-de-janeiro": "g303506-d305625",
  "san-juan": "g147320-d26555257",
  galapagos: "g297533-d1058754",
  "grand-cayman": "g147367-d149250",
  "st-lucia": "g8843287-d263008",
  "antigua-guatemala": "g295366-d1572778",
  bogota: "g294074-d562555",
  nashville: "g55229-d14031179",
  guadalajara: "g150798-d3248695",
  "iguazu-falls": "g312806-d1638737",
};
