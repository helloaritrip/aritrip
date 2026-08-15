/**
 * Sesión de usuario final (2026-08-13) — cookie firmada con HMAC-SHA256,
 * mismo patrón exacto que adminAuth.ts (Web Crypto nativo, sin librería de
 * sesión ni estado server-side que mantener). Se mantiene como archivo
 * aparte a propósito, no reutilizando signSession/verifySession de
 * adminAuth.ts: son dos audiencias distintas (administradores del panel
 * vs. cualquier visitante) con distinto TTL y forma de payload, y no vale
 * la pena arriesgar el código de auth del panel (ya en producción) para
 * ahorrar ~30 líneas.
 */

function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const b of arr) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(str.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export type UserSession = { uid: string; email: string; name: string; picture: string; createdAt: string; exp: number };

// 30 días, no 7 como el panel de admin — es un producto de consumo
// ("mantener la sesión iniciada"), no una herramienta interna donde
// conviene forzar reingreso seguido.
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// createdAt viaja en la sesión firmada (2026-08-15, para "Member since" en
// el menú de cuenta) — así /api/auth/me lo devuelve gratis, decodificando
// el JWT, sin pegarle a Firestore en cada carga de página solo para
// mostrar una fecha que nunca cambia.
export async function signUserSession(
  user: { uid: string; email: string; name: string; picture: string; createdAt: string },
  secret: string
): Promise<string> {
  const session: UserSession = { ...user, exp: Date.now() + SESSION_TTL_MS };
  const payload = base64url(new TextEncoder().encode(JSON.stringify(session)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return `${payload}.${base64url(signature)}`;
}

export async function verifyUserSession(token: string, secret: string): Promise<UserSession | null> {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify("HMAC", key, fromBase64url(signature) as BufferSource, new TextEncoder().encode(payload));
  if (!valid) return null;

  try {
    const session = JSON.parse(new TextDecoder().decode(fromBase64url(payload))) as UserSession;
    if (typeof session.exp !== "number" || session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}
