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

  // Borrado de cuenta (2026-08-15, roadmap de privacidad) — a diferencia
  // de la papelerita por favorito (armar/confirmar con un timeout), esto
  // borra TODO de una y no tiene vuelta atrás, así que pide escribir
  // "DELETE" a mano en vez de un segundo click — más fricción a propósito
  // para algo irreversible.
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}) as { error?: string });
        throw new Error(body.error ?? "Something went wrong.");
      }
      window.location.href = "/";
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Something went wrong.");
      setDeleting(false);
    }
  }

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

      <div className="mt-4 flex flex-col gap-3 rounded-lg border border-red-600/30 bg-red-600/5 p-5">
        <div>
          <h2 className="text-sm font-semibold text-red-700 dark:text-red-400">Delete account</h2>
          <p className="text-xs text-muted">
            Permanently deletes your profile and every favorite you&apos;ve saved. This can&apos;t be undone.
          </p>
        </div>

        {!showDeleteConfirm ? (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="w-fit rounded-md border border-red-600/40 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-600/10 dark:text-red-400"
          >
            Delete my account
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <label htmlFor="delete-confirm-input" className="text-xs text-muted">
              Type <span className="font-semibold text-ink">DELETE</span> to confirm.
            </label>
            <input
              id="delete-confirm-input"
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              autoComplete="off"
              className="w-full max-w-xs rounded-md border border-rule bg-surface px-3 py-2 text-base text-ink focus:outline focus:outline-2 focus:outline-red-600 sm:text-sm"
            />
            {deleteError && <p className="text-xs text-red-600 dark:text-red-400">{deleteError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={deleteConfirmText !== "DELETE" || deleting}
                onClick={handleDeleteAccount}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
              >
                {deleting ? "Deleting…" : "Permanently delete"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText("");
                  setDeleteError(null);
                }}
                disabled={deleting}
                className="rounded-md border border-rule px-3 py-1.5 text-sm font-medium text-ink hover:bg-bg"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
