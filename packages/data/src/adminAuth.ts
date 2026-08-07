/**
 * Auth del panel de admin — hash de contraseña (PBKDF2) y cookie de sesión
 * firmada (HMAC-SHA256), ambos con Web Crypto nativo (`crypto.subtle`),
 * mismo enfoque ya usado en firestore.ts para firmar el JWT del service
 * account. Sin librería de auth nueva ni sesión server-side que mantener
 * — la cookie firmada ES la sesión, se valida sola en cada request.
 */

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

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

// Comparación en tiempo constante — evita que una diferencia de timing en
// el string compare filtre información del hash/firma real.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const PBKDF2_ITERATIONS = 100_000;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" }, key, 256);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toHex(salt)}$${toHex(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const [, iterationsStr, saltHex, hashHex] = parts;
  const iterations = Number(iterationsStr);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: fromHex(saltHex) as BufferSource, iterations, hash: "SHA-256" },
    key,
    256
  );
  return timingSafeEqual(toHex(new Uint8Array(bits)), hashHex);
}

export type AdminSession = { adminId: string; email: string; exp: number };

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

export async function signSession(admin: { adminId: string; email: string }, secret: string): Promise<string> {
  const session: AdminSession = { ...admin, exp: Date.now() + SESSION_TTL_MS };
  const payload = base64url(new TextEncoder().encode(JSON.stringify(session)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return `${payload}.${base64url(signature)}`;
}

export async function verifySession(token: string, secret: string): Promise<AdminSession | null> {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "verify",
  ]);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    fromBase64url(signature) as BufferSource,
    new TextEncoder().encode(payload)
  );
  if (!valid) return null;

  try {
    const session = JSON.parse(new TextDecoder().decode(fromBase64url(payload))) as AdminSession;
    if (typeof session.exp !== "number" || session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}
