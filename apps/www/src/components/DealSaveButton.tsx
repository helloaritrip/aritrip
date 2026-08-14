import { useEffect, useState } from "react";

/**
 * Corazón para guardar un flight deal desde aritrips.com/deals — a
 * diferencia de apps/app (que tiene su propio AuthProvider/contexto de
 * React), esta es una isla aislada (client:only="react", ver deals.astro)
 * sin nada compartido: llama directo a la API de app.aritrips.com con
 * `credentials: "include"` para que viaje la cookie de sesión (que se
 * firma con Domain=.aritrips.com justo para que esto funcione cross-
 * subdominio, ver requireUserSession.ts). CORS habilitado del lado del
 * servidor específicamente para este uso (apps/app/src/lib/cors.ts).
 */

const APP_URL = import.meta.env.PUBLIC_APP_URL ?? "http://localhost:3000";

export interface DealSaveButtonProps {
  dealId: string;
  name: string;
  country: string;
  imageUrl?: string;
  imageQuery: string;
  priceLabel: string;
  originLabel: string;
  travelLabel: string;
}

type AuthState = "checking" | "signed-out" | "signed-in";

export function DealSaveButton(props: DealSaveButtonProps) {
  const [auth, setAuth] = useState<AuthState>("checking");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${APP_URL}/api/auth/me`, { credentials: "include" })
      .then((res) => res.json() as Promise<{ user: unknown }>)
      .then((data) => setAuth(data.user ? "signed-in" : "signed-out"))
      .catch(() => setAuth("signed-out"));
  }, []);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    if (auth !== "signed-in") {
      window.location.href = `${APP_URL}/join`;
      return;
    }
    setBusy(true);
    try {
      if (saved) {
        await fetch(`${APP_URL}/api/favorites`, {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemType: "deal", itemId: props.dealId }),
        });
        setSaved(false);
      } else {
        await fetch(`${APP_URL}/api/favorites`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemType: "deal",
            itemId: props.dealId,
            snapshot: {
              name: props.name,
              country: props.country,
              imageUrl: props.imageUrl,
              imageQuery: props.imageQuery,
              priceLabel: props.priceLabel,
              originLabel: props.originLabel,
              travelLabel: props.travelLabel,
            },
          }),
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
      disabled={busy || auth === "checking"}
      aria-label={saved ? "Remove from favorites" : "Save to favorites"}
      aria-pressed={saved}
      className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm transition-transform hover:scale-105"
    >
      {/* SVG plano en vez de emoji — ver el mismo comentario en
          apps/app/src/components/SaveButton.tsx. */}
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
