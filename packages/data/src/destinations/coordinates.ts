/**
 * Coordenadas del centro/zona turística de cada destino — separadas del
 * fichero principal como `originBaseCosts.ts`, mismo patrón (una curación
 * distinta, no parte de la ficha editorial). Se usan para el mapa embebido
 * en ResultCard (OpenStreetMap, sin API key) — no hace falta precisión de
 * agrimensor, sirve con el centro de la ciudad o zona hotelera.
 */
export const destinationCoordinates: Record<string, { lat: number; lng: number }> = {
  cancun: { lat: 21.1619, lng: -86.8515 },
  "puerto-vallarta": { lat: 20.6534, lng: -105.2253 },
  "punta-cana": { lat: 18.5601, lng: -68.3725 },
  "cabo-san-lucas": { lat: 22.8905, lng: -109.9167 },
  tulum: { lat: 20.2114, lng: -87.4654 },
  "costa-rica-guanacaste": { lat: 10.6247, lng: -85.44 },
  cartagena: { lat: 10.391, lng: -75.4794 },
  medellin: { lat: 6.2442, lng: -75.5812 },
  cusco: { lat: 13.5319, lng: -71.9675 },
  "buenos-aires": { lat: -34.6037, lng: -58.3816 },
  "mexico-city": { lat: 19.4326, lng: -99.1332 },
  nassau: { lat: 25.048, lng: -77.3554 },
  "panama-city": { lat: 8.9824, lng: -79.5199 },
  roatan: { lat: 16.3252, lng: -86.5335 },
  aruba: { lat: 12.5211, lng: -69.9683 },
  "new-orleans": { lat: 29.9511, lng: -90.0715 },
  "san-diego": { lat: 32.7157, lng: -117.1611 },
  banff: { lat: 51.1784, lng: -115.5708 },
  oaxaca: { lat: 17.0732, lng: -96.7266 },
  "turks-and-caicos": { lat: 21.794, lng: -72.2653 },
  "montego-bay": { lat: 18.4762, lng: -77.8939 },
  "las-vegas": { lat: 36.1699, lng: -115.1398 },
  orlando: { lat: 28.5383, lng: -81.3792 },
  honolulu: { lat: 21.3069, lng: -157.8583 },
  "quebec-city": { lat: 46.8139, lng: -71.208 },
  whistler: { lat: 50.1163, lng: -122.9574 },
  curacao: { lat: 12.1696, lng: -68.99 },
  mazatlan: { lat: 23.2494, lng: -106.4111 },
  belize: { lat: 17.9268, lng: -87.9689 },
  aspen: { lat: 39.1911, lng: -106.8175 },
  "rio-de-janeiro": { lat: -22.9068, lng: -43.1729 },
  "san-juan": { lat: 18.4655, lng: -66.1057 },
  galapagos: { lat: -0.7393, lng: -90.3082 },
  "grand-cayman": { lat: 19.3133, lng: -81.2546 },
  "st-lucia": { lat: 13.9094, lng: -60.9789 },
  "antigua-guatemala": { lat: 14.5586, lng: -90.7295 },
  bogota: { lat: 4.711, lng: -74.0721 },
  nashville: { lat: 36.1627, lng: -86.7816 },
  guadalajara: { lat: 20.6597, lng: -103.3496 },
  "iguazu-falls": { lat: -25.6953, lng: -54.4367 },
};
