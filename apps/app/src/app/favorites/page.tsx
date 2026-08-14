"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

type FavoriteSnapshot = {
  name?: string;
  country?: string;
  imageUrl?: string;
  imageQuery?: string;
  price?: number;
  priceLabel?: string;
  discountPercent?: number;
  originLabel?: string;
  travelLabel?: string;
};

type Favorite = { itemType: "destination" | "deal"; itemId: string; snapshot: FavoriteSnapshot; createdAt: string };

function imageProxyUrl(query: string, fallback: string): string {
  return `/api/image-proxy?q=${encodeURIComponent(query)}&fallback=${encodeURIComponent(fallback)}`;
}

function favoriteKey(item: Favorite): string {
  return `${item.itemType}-${item.itemId}`;
}

export default function FavoritesPage() {
  const { user, loading, refresh } = useAuth();
  const [favorites, setFavorites] = useState<Favorite[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Doble confirmación con la papelerita (2026-08-15, a pedido del
  // usuario) — el primer click "arma" el botón (se pone rojo), el
  // segundo click sobre el MISMO ítem recién borra de verdad. Se
  // desarma solo a los 3s si no se confirma, para que no quede un botón
  // "armado" esperando un toque accidental más tarde.
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!confirmingKey) return;
    const timer = setTimeout(() => setConfirmingKey(null), 3000);
    return () => clearTimeout(timer);
  }, [confirmingKey]);

  const loadFavorites = useCallback(async () => {
    try {
      const res = await fetch("/api/favorites");
      if (!res.ok) {
        setError("Couldn't load your favorites right now.");
        return;
      }
      const data = (await res.json()) as { favorites: Favorite[] };
      setFavorites(data.favorites);
    } catch {
      setError("Couldn't load your favorites right now.");
    }
  }, []);

  useEffect(() => {
    if (user) loadFavorites();
  }, [user, loadFavorites]);

  async function remove(item: Favorite) {
    await fetch("/api/favorites", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemType: item.itemType, itemId: item.itemId }),
    });
    setFavorites((prev) => prev?.filter((f) => !(f.itemType === item.itemType && f.itemId === item.itemId)) ?? null);
  }

  function handleTrashClick(item: Favorite) {
    const key = favoriteKey(item);
    if (confirmingKey === key) {
      setConfirmingKey(null);
      remove(item);
    } else {
      setConfirmingKey(key);
    }
  }

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center bg-bg px-6 py-16">
        <p className="text-sm text-muted">Loading…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-bg px-6 py-16 text-center">
        <div className="flex max-w-sm flex-col items-center gap-2">
          <h1 className="text-2xl font-semibold text-ink">My Favorites</h1>
          <p className="text-sm text-muted">Sign in to save and see the trips and flight deals you&apos;ve favorited.</p>
        </div>
        <GoogleSignInButton onCredential={async (credential) => {
          await fetch("/api/auth/google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ credential }),
          });
          await refresh();
        }} />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 bg-bg px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold text-ink">My Favorites</h1>
        <p className="text-sm text-muted">Trips and flight deals you&apos;ve saved, {user.name}.</p>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {favorites && favorites.length === 0 && (
        <div className="rounded-lg border border-dashed border-rule bg-surface/50 p-10 text-center text-sm text-muted">
          Nothing saved yet — look for the heart icon on trips and flight deals.
        </div>
      )}

      {favorites === null && !error && <p className="text-sm text-muted">Loading your favorites…</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {favorites?.map((f) => (
          <div key={`${f.itemType}-${f.itemId}`} className="flex flex-col overflow-hidden rounded-lg border border-rule bg-surface">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- viene de un proxy propio, no de next/image remote patterns */}
              <img
                src={f.snapshot.imageUrl || imageProxyUrl(f.snapshot.imageQuery || f.snapshot.name || "", f.snapshot.name || "")}
                alt={f.snapshot.name ?? f.itemId}
                className="h-32 w-full object-cover"
                loading="lazy"
              />
              <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-ink">
                {f.itemType === "deal" ? "Flight deal" : "Trip"}
              </span>
              {/* Papelerita en la esquina con doble confirmación
                  (2026-08-15, a pedido del usuario) — reemplaza el link de
                  texto "Remove" de abajo. Primer click arma el botón (se
                  pone rojo), segundo click sobre el mismo ítem borra de
                  verdad; se desarma solo a los 3s si no se confirma. */}
              <button
                type="button"
                onClick={() => handleTrashClick(f)}
                aria-label={confirmingKey === favoriteKey(f) ? "Confirm remove from favorites" : "Remove from favorites"}
                className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full shadow-sm transition-colors ${
                  confirmingKey === favoriteKey(f) ? "bg-red-600 text-white" : "bg-white/90 text-muted hover:text-red-600"
                }`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                  <path d="M4 7h16" />
                  <path d="M6 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" />
                  <path d="M6 7v13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                </svg>
              </button>
            </div>
            <div className="flex flex-col gap-1 p-4">
              <p className="text-sm font-semibold text-ink">{f.snapshot.name ?? f.itemId}</p>
              {f.snapshot.country && <p className="text-xs text-muted">{f.snapshot.country}</p>}
              {f.snapshot.priceLabel && <p className="text-sm font-medium text-accent">{f.snapshot.priceLabel}</p>}
              {f.snapshot.originLabel && <p className="text-xs text-muted">From {f.snapshot.originLabel}</p>}
              {f.snapshot.travelLabel && <p className="text-xs text-muted">{f.snapshot.travelLabel}</p>}
              {confirmingKey === favoriteKey(f) && <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">Tap the trash icon again to remove.</p>}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
