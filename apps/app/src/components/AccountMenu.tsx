"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { HoneymoonIcon, CalendarIcon, ChevronDownIcon, PersonIcon } from "@/components/Icons";

function formatJoinDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/**
 * Reemplaza el "Join AriTrips" fijo del Header cuando hay sesión
 * (2026-08-15, a pedido del usuario) — antes ese botón era estático a
 * propósito (ver el comentario en Header.tsx), pero eso significaba que
 * alguien ya logueado seguía viendo una invitación a unirse. Ahora es un
 * client component chico: logueado, se ve "My AriTrips" con un mini panel
 * (foto, fecha de alta, favoritos, cerrar sesión).
 *
 * Borrado de cuenta (2026-08-26) — se mudó de acá a /account. Vivía como
 * un botón de texto en este mismo menú, un click desde cualquier página
 * del sitio; a pedido del usuario ("que no esté afuera como está
 * actualmente") ahora hace falta entrar primero a "My Profile" para
 * siquiera verlo.
 */
export function AccountMenu() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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

  // Placeholder del mismo tamaño mientras se resuelve la sesión (fetch a
  // /api/auth/me) — evita que el layout salte entre "Join" y "My AriTrips"
  // apenas carga la página.
  if (loading) return <span className="h-[38px] w-[124px] shrink-0 rounded-full bg-muted/10" aria-hidden="true" />;

  if (!user) {
    return (
      <Link href="/join" className="shrink-0 rounded-full bg-muted/15 px-4 py-2 text-sm font-medium text-ink hover:bg-muted/25">
        Join AriTrips
      </Link>
    );
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-full bg-muted/15 px-4 py-2 text-sm font-medium text-ink hover:bg-muted/25"
      >
        My AriTrips
        <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
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
            <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
            Member since {formatJoinDate(user.createdAt)}
          </p>

          <div className="mt-3 flex flex-col gap-1 border-t border-rule pt-3">
            <Link href="/account" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-ink hover:bg-bg">
              <PersonIcon className="h-4 w-4" />
              My Profile
            </Link>
            <Link
              href="/favorites"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-ink hover:bg-bg"
            >
              <HoneymoonIcon className="h-4 w-4" />
              My Favorites
            </Link>
            <button
              type="button"
              onClick={async () => {
                setOpen(false);
                await signOut();
                router.push("/");
              }}
              className="rounded-md px-2 py-2 text-left text-sm text-ink hover:bg-bg"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
