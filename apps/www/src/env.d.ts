/// <reference types="astro/client" />

// Secrets del panel de admin (SESSION_SECRET) y de Firestore
// (FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY, mismos dos que ya tiene el
// worker de apps/app, puestos aparte porque son secrets — no se copian
// entre workers). Viven en Cloudflare (`wrangler secret put`), se leen en
// runtime vía `import { env } from "cloudflare:workers"` — Astro.locals.
// runtime.env fue removido en Astro v6/v7 (bug real encontrado
// 2026-08-07: tiraba 500 en producción hasta corregir esto).
//
// El tipo de `env` es `Cloudflare.Env` (namespace, no una interfaz global
// `Env` suelta) — así lo declara @cloudflare/workers-types, y así hay que
// extenderlo para que TypeScript haga el merge de declaraciones.
declare global {
  namespace Cloudflare {
    interface Env {
      SESSION_SECRET?: string;
      FIREBASE_CLIENT_EMAIL?: string;
      FIREBASE_PRIVATE_KEY?: string;
    }
  }
}

export {};
