"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { TextInput, Combobox, Chip } from "@aritrips/ui";
import { ORIGIN_HUBS, type OriginHub, type InterestTag } from "@aritrips/data";
import { ORIGIN_OPTIONS } from "@/lib/originLabels";
import { INTEREST_OPTIONS, type SavedProfile } from "@/lib/interestOptions";
import { PlaneIcon, WalletIcon, SparkleIcon } from "@/components/Icons";

/**
 * "My Profile" (2026-08-26, a pedido del usuario) — 3 campos que
 * SearchForm.tsx ya le pide en cada búsqueda (origen/presupuesto/
 * intereses), guardados una vez para precargar el buscador la próxima
 * vez. El borrado de cuenta también vive acá ahora, no en el menú "My
 * AriTrips" del header — mismo espíritu que el moved-from-/favorites
 * original (ver el comentario viejo en AccountMenu.tsx): un paso extra
 * de navegación antes de siquiera verlo, en vez de un click en un menú
 * que se abre desde cualquier página.
 */
export default function AccountPage() {
  const { user, loading, refresh, signOut } = useAuth();
  const router = useRouter();

  const [originAirportCode, setOriginAirportCode] = useState<string>("");
  const [budgetUSD, setBudgetUSD] = useState("");
  const [interests, setInterests] = useState<InterestTag[]>([]);
  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { profile: SavedProfile | null } | null) => {
        const profile = data?.profile;
        if (profile?.originAirportCode) setOriginAirportCode(profile.originAirportCode);
        if (typeof profile?.budgetUSD === "number") setBudgetUSD(String(profile.budgetUSD));
        if (profile?.interests) setInterests(profile.interests);
      })
      .finally(() => setProfileLoading(false));
  }, [user]);

  function toggleInterest(tag: InterestTag) {
    setSaved(false);
    setInterests((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const budget = Number(budgetUSD);
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originAirportCode: originAirportCode || null,
          budgetUSD: Number.isFinite(budget) && budget > 0 ? budget : null,
          interests,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}) as { error?: string });
        throw new Error(body.error ?? "Something went wrong.");
      }
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

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
          <h1 className="text-2xl font-semibold text-ink">My Profile</h1>
          <p className="text-sm text-muted">Sign in to save your travel preferences and manage your account.</p>
        </div>
        <GoogleSignInButton
          onCredential={async (credential) => {
            await fetch("/api/auth/google", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ credential }),
            });
            await refresh();
          }}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 bg-bg px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold text-ink">My Profile</h1>
        <p className="text-sm text-muted">Save your usual trip details so the search starts pre-filled next time.</p>
      </div>

      {profileLoading ? (
        <p className="text-sm text-muted">Loading your profile…</p>
      ) : (
        <form onSubmit={handleSave} className="flex flex-col gap-5 rounded-lg border border-rule bg-surface p-6">
          <div>
            <Combobox
              label="Usual flying from"
              icon={<PlaneIcon className="h-4 w-4 text-highlight" />}
              name="origin"
              placeholder="Type a city or airport code..."
              value={originAirportCode}
              onChange={(value) => {
                setSaved(false);
                setOriginAirportCode(value);
              }}
              options={ORIGIN_OPTIONS}
            />
          </div>

          <div className="max-w-[10rem]">
            <TextInput
              label="Usual budget (USD)"
              icon={<WalletIcon className="h-4 w-4 text-highlight" />}
              name="budget"
              type="number"
              min={0}
              placeholder="2000"
              value={budgetUSD}
              onChange={(e) => {
                setSaved(false);
                setBudgetUSD(e.target.value);
              }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
              <SparkleIcon className="h-4 w-4 text-highlight" />
              Usual interests
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {INTEREST_OPTIONS.map((opt) => (
                <Chip key={opt.value} pressed={interests.includes(opt.value)} onClick={() => toggleInterest(opt.value)}>
                  <opt.icon className="h-4 w-4" />
                  {opt.label}
                </Chip>
              ))}
            </div>
          </div>

          {saveError && <p className="text-sm text-red-600 dark:text-red-400">{saveError}</p>}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-fit items-center justify-center rounded-full bg-highlight px-8 py-2.5 text-sm font-semibold text-highlight-ink transition-colors hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            {saved && <span className="text-sm text-muted">Saved.</span>}
          </div>
        </form>
      )}

      <div className="flex flex-col gap-3 border-t border-rule pt-6 text-sm text-muted">
        <p>
          Signed in as <span className="text-ink">{user.email}</span>.{" "}
          <button
            type="button"
            onClick={async () => {
              await signOut();
              router.push("/");
            }}
            className="underline hover:text-ink"
          >
            Sign out
          </button>
        </p>

        {/* Borrado de cuenta discreto (2026-08-26, a pedido del usuario:
            "que no esté afuera como está actualmente" — antes vivía como
            un botón de texto en el menú "My AriTrips", accesible desde
            cualquier página del sitio con un solo click). Acá requiere
            entrar primero a /account, y sigue colapsado por default. */}
        {!confirmingDelete ? (
          <button type="button" onClick={() => setConfirmingDelete(true)} className="self-start text-xs text-muted hover:text-red-600">
            Delete account
          </button>
        ) : (
          <div className="flex flex-col gap-2 rounded-md border border-rule bg-surface p-4">
            <p className="text-xs text-ink">
              Permanently deletes your profile and every favorite you&apos;ve saved. Type <span className="font-semibold">DELETE</span> to
              confirm.
            </p>
            <input
              type="text"
              value={deleteText}
              onChange={(e) => setDeleteText(e.target.value)}
              autoComplete="off"
              className="w-full max-w-xs rounded-md border border-rule bg-surface px-3 py-2 text-sm text-ink focus:outline focus:outline-2 focus:outline-red-600"
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
    </main>
  );
}
