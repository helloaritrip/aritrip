/**
 * Cliente mínimo de Firestore vía su REST API — no usamos el SDK
 * `firebase-admin` porque depende de APIs de Node (grpc, sockets TCP)
 * que no están garantizadas en el runtime de Cloudflare Workers. La
 * REST API + un JWT firmado con Web Crypto (`crypto.subtle`, nativo de
 * Workers, no depende de `nodejs_compat`) es el patrón recomendado para
 * escribir en Firestore desde edge/serverless.
 *
 * Movido de apps/app a packages/data (2026-08-07) — el panel de admin en
 * apps/www también necesita hablarle a Firestore (colecciones admins/
 * partners/pages), y esto evita duplicar la lógica de JWT/Web Crypto en
 * las dos apps.
 *
 * Requiere dos secrets de Cloudflare (`wrangler secret put`, nunca en el
 * repo): FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY, del service
 * account descargado en Firebase Console → Project Settings → Service
 * Accounts → Generate new private key. Antes solo el worker de apps/app
 * los tenía configurados — apps/www necesita los mismos dos, puestos
 * aparte (son secrets, no se pueden copiar de un worker a otro).
 */

const PROJECT_ID = "aritrips";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const FIRESTORE_SCOPE = "https://www.googleapis.com/auth/datastore";
const DOCS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

export type FirestoreCredentials = { clientEmail: string; privateKey: string };

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
// nuevo en cada request. Vive mientras el isolate del Worker esté caliente.
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
// REST API de Firestore. Solo tipos planos (string/number/boolean/Date) —
// alcanza para todo lo que guarda este proyecto (eventos, admins,
// partners, y páginas de Puck serializadas como un string de JSON, no
// como estructura anidada real).
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

// Inverso de toFirestoreFields — lee lo que devuelve la REST API de vuelta
// a un objeto JS plano.
function fromFirestoreFields(fields: Record<string, unknown> | undefined): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  if (!fields) return obj;
  for (const [key, wrapped] of Object.entries(fields)) {
    const v = wrapped as Record<string, unknown>;
    if ("stringValue" in v) obj[key] = v.stringValue;
    else if ("doubleValue" in v) obj[key] = v.doubleValue;
    else if ("integerValue" in v) obj[key] = Number(v.integerValue);
    else if ("booleanValue" in v) obj[key] = v.booleanValue;
    else if ("timestampValue" in v) obj[key] = v.timestampValue;
  }
  return obj;
}

async function authedFetch(url: string, credentials: FirestoreCredentials, init: RequestInit = {}): Promise<Response> {
  const accessToken = await getAccessToken(credentials.clientEmail, credentials.privateKey);
  return fetch(url, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${accessToken}` },
  });
}

/** Crea un documento con ID auto-generado por Firestore (uso: eventos de analytics, donde no hace falta un ID predecible). */
export async function writeFirestoreDocument(
  collection: string,
  data: Record<string, unknown>,
  credentials: FirestoreCredentials
): Promise<void> {
  const res = await authedFetch(`${DOCS_BASE}/${collection}`, credentials, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
  });
  if (!res.ok) {
    throw new Error(`Firestore write failed: ${res.status} ${await res.text()}`);
  }
}

/** Crea o reemplaza un documento con un ID elegido (upsert) — uso: admins, partners, pages, donde el ID importa (email, categoría, slug). */
export async function setDocument(
  collection: string,
  docId: string,
  data: Record<string, unknown>,
  credentials: FirestoreCredentials
): Promise<void> {
  const res = await authedFetch(`${DOCS_BASE}/${collection}/${encodeURIComponent(docId)}`, credentials, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
  });
  if (!res.ok) {
    throw new Error(`Firestore set failed: ${res.status} ${await res.text()}`);
  }
}

/** Lee un documento por ID. Devuelve null si no existe. */
export async function getDocument(
  collection: string,
  docId: string,
  credentials: FirestoreCredentials
): Promise<Record<string, unknown> | null> {
  const res = await authedFetch(`${DOCS_BASE}/${collection}/${encodeURIComponent(docId)}`, credentials);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Firestore get failed: ${res.status} ${await res.text()}`);
  }
  const doc = (await res.json()) as { fields?: Record<string, unknown> };
  return fromFirestoreFields(doc.fields);
}

/** Lista todos los documentos de una colección, cada uno con su `id` incluido. */
export async function listDocuments(
  collection: string,
  credentials: FirestoreCredentials
): Promise<(Record<string, unknown> & { id: string })[]> {
  const res = await authedFetch(`${DOCS_BASE}/${collection}?pageSize=300`, credentials);
  if (!res.ok) {
    throw new Error(`Firestore list failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { documents?: { name: string; fields?: Record<string, unknown> }[] };
  return (data.documents ?? []).map((doc) => ({
    id: doc.name.split("/").pop() ?? "",
    ...fromFirestoreFields(doc.fields),
  }));
}

/** Borra un documento por ID. No falla si ya no existe. */
export async function deleteDocument(collection: string, docId: string, credentials: FirestoreCredentials): Promise<void> {
  const res = await authedFetch(`${DOCS_BASE}/${collection}/${encodeURIComponent(docId)}`, credentials, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Firestore delete failed: ${res.status} ${await res.text()}`);
  }
}
