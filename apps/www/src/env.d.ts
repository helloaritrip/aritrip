/// <reference types="astro/client" />

// Secrets del panel de admin (SESSION_SECRET) y de Firestore
// (FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY, mismos dos que ya tiene el
// worker de apps/app, puestos aparte porque son secrets — no se copian
// entre workers). Viven en Cloudflare (`wrangler secret put`), se leen en
// runtime vía Astro.locals.runtime.env, nunca embebidos en el build como
// import.meta.env.ADMIN_USERNAME/PASSWORD (el mecanismo viejo que este
// panel reemplaza).
declare namespace App {
  interface Locals {
    runtime: {
      env: {
        SESSION_SECRET?: string;
        FIREBASE_CLIENT_EMAIL?: string;
        FIREBASE_PRIVATE_KEY?: string;
      };
    };
  }
}
