"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { useAuth } from "@/components/AuthProvider";

export default function JoinPage() {
  const { user, loading, refresh } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/favorites");
  }, [loading, user, router]);

  async function handleCredential(credential: string) {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error || "Couldn't sign you in. Try again.");
        setSubmitting(false);
        return;
      }
      await refresh();
      router.replace("/favorites");
    } catch {
      setError("Couldn't sign you in. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-bg px-6 py-16 text-center">
      <div className="flex max-w-sm flex-col items-center gap-3">
        <h1 className="text-2xl font-semibold text-ink">Join AriTrips</h1>
        <p className="text-sm text-muted">
          Save your favorite trips and flight deals so you can find them again later — no spam, just a place to keep what
          catches your eye.
        </p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <GoogleSignInButton onCredential={handleCredential} />
        {submitting && <p className="text-xs text-muted">Signing you in…</p>}
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>

      <p className="max-w-xs text-xs text-muted">
        By continuing, you agree to our <a href="/terms" className="underline hover:text-accent">Terms</a> and{" "}
        <a href="/privacy" className="underline hover:text-accent">Privacy Policy</a>.
      </p>
    </main>
  );
}
