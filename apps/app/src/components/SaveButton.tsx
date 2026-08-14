"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { trackEvent } from "@/lib/trackEvent";

export type FavoriteSnapshot = {
  name: string;
  country?: string;
  imageUrl?: string;
  imageQuery?: string;
  priceLabel?: string;
  originLabel?: string;
  travelLabel?: string;
};

/**
 * Corazón para guardar/quitar un favorito — no arranca sabiendo si el
 * ítem ya estaba guardado (necesitaría traer la lista completa de
 * favoritos en cada card, no vale la pena para v1); si el usuario ya lo
 * había guardado antes, el primer click en esta sesión lo va a marcar
 * como "guardando de nuevo" en vez de "quitando" — inofensivo (el POST es
 * un upsert, no crea duplicados), solo un desajuste visual chico.
 */
export function SaveButton({
  itemType,
  itemId,
  snapshot,
  className = "",
  searchId,
}: {
  itemType: "destination" | "deal";
  itemId: string;
  snapshot: FavoriteSnapshot;
  className?: string;
  // Último eslabón del funnel Search → Recommendation → Click → Favorite
  // (2026-08-15) — solo lo pasa ResultCard (viene de una búsqueda de Ari
  // Core); el resto de los usos de este botón queda sin searchId, igual
  // que ya hace recommendation_clicked.
  searchId?: string;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      router.push("/join");
      return;
    }
    setBusy(true);
    try {
      if (saved) {
        await fetch("/api/favorites", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemType, itemId }),
        });
        setSaved(false);
        trackEvent({ name: "favorite_removed", itemType, itemId, searchId });
      } else {
        await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemType, itemId, snapshot }),
        });
        setSaved(true);
        trackEvent({ name: "favorite_saved", itemType, itemId, searchId });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-label={saved ? "Remove from favorites" : "Save to favorites"}
      aria-pressed={saved}
      className={`flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm transition-transform hover:scale-105 ${className}`}
    >
      {/* SVG plano en vez de emoji (2026-08-15, a pedido del usuario:
          "quiero que sea un color mate, no con relieve como es
          actualmente, ya que casi no se distingue") — el emoji 🤍 se
          renderiza con el brillo/relieve del set de emojis del sistema,
          apenas visible sobre fotos claras. Mismo path que el ícono de
          "My Favorites" del nav, para consistencia visual. Gris mate
          (text-muted, el mismo de fondo del botón "Join AriTrips")
          cuando no está guardado; naranja de marca (text-highlight),
          relleno, cuando sí. */}
      <svg
        viewBox="0 0 24 24"
        fill={saved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`h-4 w-4 ${saved ? "text-highlight" : "text-muted"}`}
      >
        <path d="M12 20s-7-4.4-9.5-8.8C.9 8 2.4 4.5 5.8 4.1c1.9-.2 3.6.8 4.7 2.4a.6.6 0 0 0 1 0c1.1-1.6 2.8-2.6 4.7-2.4 3.4.4 4.9 3.9 3.3 7.1C19 15.6 12 20 12 20Z" />
      </svg>
    </button>
  );
}
