"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { HoneymoonIcon, CalendarIcon, ChevronDownIcon } from "@/components/Icons";

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
 * (foto, fecha de alta, favoritos, cerrar sesión). El borrado de cuenta
 * también se movió acá — vivía como una caja roja grande y siempre
 * visible al fondo de /favorites, lo cual espantaba a gente que solo
 * quería ver lo que había guardado. Acá queda chico, un paso extra de
 * click para siquiera verlo.
 */
export function AccountMenu() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmingDelete(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setConfirmingDelete(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

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
          {!confirmingDelete ? (
            <>
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

              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="mt-2 w-full rounded-md px-2 py-1.5 text-left text-xs text-muted hover:text-red-600"
              >
                Delete account
              </button>
            </>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-ink">
                Permanently deletes your profile and every favorite you&apos;ve saved. Type{" "}
                <span className="font-semibold">DELETE</span> to confirm.
              </p>
              <input
                type="text"
                value={deleteText}
                onChange={(e) => setDeleteText(e.target.value)}
                autoComplete="off"
                className="w-full rounded-md border border-rule bg-surface px-3 py-2 text-sm text-ink focus:outline focus:outline-2 focus:outline-red-600"
              />
              {deleteError && <p className="text-xs text-red-600 dark:text-red-400">{deleteError}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={deleteText !== "DELETE" || deleting}
                  onClick={handleDeleteAccount}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
                >
                  {deleting ? "Deleting…" : "Permanently delete"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingDelete(false);
                    setDeleteText("");
                    setDeleteError(null);
                  }}
                  disabled={deleting}
                  className="rounded-md border border-rule px-3 py-1.5 text-xs font-medium text-ink hover:bg-bg"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
