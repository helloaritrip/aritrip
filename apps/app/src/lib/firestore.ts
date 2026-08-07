/**
 * Cliente mínimo de Firestore vía su REST API — no usamos el SDK
 * `firebase-admin` porque depende de APIs de Node (grpc, sockets TCP)
 * que no están garantizadas en el runtime de Cloudflare Workers. La
 * REST API + un JWT firmado con Web Crypto (`crypto.subtle`, nativo de
 * Workers, no depende de `nodejs_compat`) es el patrón recomendado para
 * escribir en Firestore desde edge/serverless.
 *
 * Requiere dos secrets de Cloudflare (`wrangler secret put`, nunca en el
 * repo): FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY, del service
 * account descargado en Firebase Console → Project Settings → Service
 * Accounts → Generate new private key.
 */

const PROJECT_ID = "aritrips";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const FIRESTORE_SCOPE = "https://www.googleapis.com/auth/datastore";

function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const b of arr) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// El access token dura ~1h — se cachea a nivel de módulo para no pedir uno
// nuevo en cada evento. Vive mientras el isolate del Worker esté caliente.
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(clientEmail: string, privateKeyPem: string): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.token;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: clientEmail,
    scope: FIRESTORE_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64url(new TextEncoder().encode(JSON.stringify(header)))}.${base64url(new TextEncoder().encode(JSON.stringify(claims)))}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${base64url(signature)}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to get Firestore access token: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

// Convierte un objeto JS plano a la representación de "Value" que pide la
// REST API de Firestore (cada campo necesita su tipo envuelto explícito).
function toFirestoreFields(obj: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") fields[key] = { stringValue: value };
    else if (typeof value === "number") fields[key] = { doubleValue: value };
    else if (typeof value === "boolean") fields[key] = { booleanValue: value };
    else if (value instanceof Date) fields[key] = { timestampValue: value.toISOString() };
  }
  return fields;
}

export async function writeFirestoreDocument(
  collection: string,
  data: Record<string, unknown>,
  credentials: { clientEmail: string; privateKey: string }
): Promise<void> {
  const accessToken = await getAccessToken(credentials.clientEmail, credentials.privateKey);
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
  });
  if (!res.ok) {
    throw new Error(`Firestore write failed: ${res.status} ${await res.text()}`);
  }
}
