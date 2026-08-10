import type { Destination } from "./types";

/**
 * Una foto elegida a mano para un destino desde /ari-admin/images (Pexels o
 * Wikimedia, fijada a una URL exacta, no una búsqueda por texto) — mismo
 * principio que LiveFlightPrice en livePrices.ts: vive en Firestore, no en
 * el catálogo estático, y se aplica como overlay antes de puntuar/armar la
 * respuesta. Un doc por destinationId (colección `destinationImages`).
 */
export interface LiveDestinationImage {
  destinationId: string;
  imageUrl: string;
}

/**
 * Aplica las fotos fijadas a mano sobre el catálogo — sin efecto si no hay
 * ninguna para un destino (cae de vuelta a la búsqueda en vivo por
 * imageQuery, tal como ya funcionaba). Mismo principio "nunca rompe una
 * búsqueda" que applyLivePriceOverlay.
 */
export function applyImageOverlay(destinations: Destination[], images: LiveDestinationImage[]): Destination[] {
  if (images.length === 0) return destinations;

  const urlByDestination = new Map(images.map((i) => [i.destinationId, i.imageUrl]));

  return destinations.map((d) => {
    const imageUrl = urlByDestination.get(d.id);
    return imageUrl ? { ...d, imageUrl } : d;
  });
}
