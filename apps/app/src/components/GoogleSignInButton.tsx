"use client";

import { useEffect, useRef } from "react";

/**
 * Botón real de Google (Google Identity Services, script liviano cargado
 * on-demand — no el SDK de firebase/auth) — ver googleAuth.ts/userAuth.ts
 * en packages/data para por qué se eligió este camino en vez de Firebase
 * Auth. `NEXT_PUBLIC_GOOGLE_CLIENT_ID` no es secreto, se pone en .env como
 * cualquier otra variable pública del build.
 */

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, string>) => void;
        };
      };
    };
  }
}

let scriptLoadPromise: Promise<void> | null = null;
function loadGoogleIdentityScript(): Promise<void> {
  if (typeof window !== "undefined" && window.google?.accounts?.id) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;
  scriptLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(script);
  });
  return scriptLoadPromise;
}

export function GoogleSignInButton({ onCredential }: { onCredential: (credential: string) => void }) {
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    let cancelled = false;
    loadGoogleIdentityScript().then(() => {
      if (cancelled || !buttonRef.current || !window.google) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => onCredential(response.credential),
      });
      window.google.accounts.id.renderButton(buttonRef.current, { theme: "outline", size: "large", shape: "pill", width: "280" });
    });
    return () => {
      cancelled = true;
    };
  }, [onCredential]);

  if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
    return <p className="text-sm text-muted">Sign-in isn&apos;t configured yet.</p>;
  }

  return <div ref={buttonRef} />;
}
