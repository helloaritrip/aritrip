import { useEffect, useRef, useState } from "react";

/**
 * Versión de apps/www del AccountMenu de apps/app (2026-08-15) — mismo
 * pedido del usuario, esta vez para aritrips.com: "el botón My AriTrips no
 * funciona igual en deals y travel guide, cuando ya estás logueado muestra
 * igual join". Antes esto era deliberadamente estático acá (ver el
 * comentario viejo en TopNav.astro) para que las dos barras se vieran
 * siempre iguales — pero eso significaba que alguien logueado seguía
 * viendo la invitación a unirse en CUALQUIER página de aritrips.com. Se
 * corrige con el mismo patrón que ya usa DealSaveButton.tsx en este mismo
 * archivo: isla aislada (client:only="react", sin nada compartido con
 * apps/app), que llama cross-origin a app.aritrips.com con
 * `credentials: "include"` — la cookie de sesión ya está firmada con
 * Domain=.aritrips.com justo para esto. CORS ya habilitado en /api/auth/me
 * (lo usa DealSaveButton) y /api/account; se agregó a /api/auth/logout acá
 * al lado.
 */

const APP_URL = import.meta.env.PUBLIC_APP_URL ?? "http://localhost:3000";

type User = { uid: string; email: string; name: string; picture: string; createdAt?: string };
type AuthState = { status: "checking" } | { status: "signed-out" } | { status: "signed-in"; user: User };

function formatJoinDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function AccountMenu() {
  const [auth, setAuth] = useState<AuthState>({ status: "checking" });
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${APP_URL}/api/auth/me`, { credentials: "include" })
      .then((res) => res.json() as Promise<{ user: User | null }>)
      .then((data) => setAuth(data.user ? { status: "signed-in", user: data.user } : { status: "signed-out" }))
      .catch(() => setAuth({ status: "signed-out" }));
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  async function handleSignOut() {
    setOpen(false);
    await fetch(`${APP_URL}/api/auth/logout`, { method: "POST", credentials: "include" }).catch(() => {});
    window.location.reload();
  }

  if (auth.status === "checking") {
    return <span className="h-[38px] w-[124px] shrink-0 rounded-full bg-muted/10" aria-hidden="true" />;
  }

  if (auth.status === "signed-out") {
    return (
      <a href={`${APP_URL}/join`} className="shrink-0 rounded-full bg-muted/15 px-4 py-2 text-sm font-medium text-ink hover:bg-muted/25">
        Join AriTrips
      </a>
    );
  }

  const { user } = auth;

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-full bg-muted/15 px-4 py-2 text-sm font-medium text-ink hover:bg-muted/25"
      >
        My AriTrips
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-72 rounded-xl border border-rule bg-surface p-4 text-left shadow-lg">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- foto de Google, dominio externo, no vale next/image para un avatar chico */}
            <img src={user.picture} alt="" className="h-10 w-10 shrink-0 rounded-full" referrerPolicy="no-referrer" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
              <p className="truncate text-xs text-muted">{user.email}</p>
            </div>
          </div>

          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0">
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M8 3v4M16 3v4M3 10h18" />
            </svg>
            Member since {formatJoinDate(user.createdAt)}
          </p>

          <div className="mt-3 flex flex-col gap-1 border-t border-rule pt-3">
            <a
              href={`${APP_URL}/account`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-ink hover:bg-bg"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7" />
              </svg>
              My Profile
            </a>
            <a
              href={`${APP_URL}/favorites`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-ink hover:bg-bg"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M12 20s-7-4.4-9.5-8.8C.9 8 2.4 4.5 5.8 4.1c1.9-.2 3.6.8 4.7 2.4a.6.6 0 0 0 1 0c1.1-1.6 2.8-2.6 4.7-2.4 3.4.4 4.9 3.9 3.3 7.1C19 15.6 12 20 12 20Z" />
              </svg>
              My Favorites
            </a>
            <button type="button" onClick={handleSignOut} className="rounded-md px-2 py-2 text-left text-sm text-ink hover:bg-bg">
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
