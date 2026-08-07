// Declaración manual de los secrets propios (además de los que genera
// `wrangler types` en cloudflare-env.d.ts, gitignored a propósito porque
// ese archivo es autogenerado — este es un archivo aparte, hecho a mano,
// para que no se pisen). Estos secrets viven en Cloudflare
// (`wrangler secret put`), no en wrangler.jsonc. Ver src/lib/firestore.ts.
declare global {
  interface CloudflareEnv {
    FIREBASE_CLIENT_EMAIL?: string;
    FIREBASE_PRIVATE_KEY?: string;
  }
}

export {};
