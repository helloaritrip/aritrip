"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

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
}: {
  itemType: "destination" | "deal";
  itemId: string;
  snapshot: FavoriteSnapshot;
  className?: string;
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
      } else {
        await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemType, itemId, snapshot }),
        });
        setSaved(true);
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
      className={`flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-base shadow-sm transition-transform hover:scale-105 ${className}`}
    >
      {saved ? "❤️" : "🤍"}
    </button>
  );
}
