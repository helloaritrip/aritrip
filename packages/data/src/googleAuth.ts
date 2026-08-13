/**
 * Verificación de un Google ID token (el `credential` que devuelve Google
 * Identity Services en el navegador) — sin ninguna librería de auth nueva,
 * mismo enfoque ya usado en firestore.ts para firmar el JWT del service
 * account: Web Crypto nativo (`crypto.subtle`), nada que dependa de Node.
 *
 * Deliberadamente NO se usa Firebase Auth (el SDK cliente de
 * `firebase/auth`) para esto — este proyecto ya evitó `firebase-admin` por
 * la misma razón (SDKs pesados con requisitos que no calzan con el runtime
 * de Cloudflare Workers) y ya construyó su propio sistema de sesión
 * firmada para el panel de admin (ver adminAuth.ts). Reusar ese mismo
 * patrón para las cuentas de usuario final evita traer un SDK nuevo y
 * mantiene un solo mecanismo de sesión en todo el proyecto: verificamos el
 * ID token de Google UNA vez en el servidor, y de ahí en más el usuario
 * queda identificado por nuestra propia cookie firmada (userAuth.ts), no
 * por nada de Google.
 */

const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);

interface GoogleJwk {
  kid: string;
  n: string;
  e: string;
  alg: string;
  kty: string;
}

// Cacheado a nivel de módulo (~1h) — mismo patrón que el access token de
// firestore.ts. Google rota estas claves con poca frecuencia; una hora de
// staleness en el peor caso es aceptable frente al costo de pedirlas en
// cada login.
let cachedJwks: { keys: GoogleJwk[]; expiresAt: number } | null = null;
const JWKS_CACHE_TTL_MS = 60 * 60 * 1000;

async function getGoogleJwks(): Promise<GoogleJwk[]> {
  if (cachedJwks && cachedJwks.expiresAt > Date.now()) return cachedJwks.keys;
  const res = await fetch(GOOGLE_JWKS_URL);
  if (!res.ok) throw new Error(`Failed to fetch Google JWKS: ${res.status}`);
  const data = (await res.json()) as { keys: GoogleJwk[] };
  cachedJwks = { keys: data.keys, expiresAt: Date.now() + JWKS_CACHE_TTL_MS };
  return data.keys;
}

function fromBase64url(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(str.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export interface GoogleIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture: string;
}

/**
 * Verifica firma, emisor, audiencia y expiración de un Google ID token.
 * Devuelve null (nunca lanza) ante cualquier token inválido/expirado/mal
 * formado — el llamador solo necesita distinguir "identidad confirmada" de
 * "no confirmada", no el motivo puntual.
 */
export async function verifyGoogleIdToken(idToken: string, expectedAudience: string): Promise<GoogleIdentity | null> {
  try {
    const parts = idToken.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;

    const header = JSON.parse(new TextDecoder().decode(fromBase64url(headerB64))) as { alg: string; kid: string };
    if (header.alg !== "RS256" || !header.kid) return null;

    const payload = JSON.parse(new TextDecoder().decode(fromBase64url(payloadB64))) as {
      iss: string;
      aud: string;
      exp: number;
      sub: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
      picture?: string;
    };

    if (!GOOGLE_ISSUERS.has(payload.iss)) return null;
    if (payload.aud !== expectedAudience) return null;
    if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return null;
    if (!payload.sub || !payload.email) return null;

    const jwks = await getGoogleJwks();
    const jwk = jwks.find((k) => k.kid === header.kid);
    if (!jwk) return null;

    const publicKey = await crypto.subtle.importKey(
      "jwk",
      { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, fromBase64url(signatureB64) as BufferSource, signedData);
    if (!valid) return null;

    return {
      sub: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified === true,
      name: payload.name ?? payload.email,
      picture: payload.picture ?? "",
    };
  } catch {
    return null;
  }
}
