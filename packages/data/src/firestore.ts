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

/**
 * Lista todos los documentos de una colección, cada uno con su `id`
 * incluido. Pagina de verdad (sigue `nextPageToken` hasta agotarlo) —
 * antes cortaba en 300 documentos fijos, silencioso (sin error, solo
 * devolvía una porción), lo que hacía que colecciones que crecen más
 * allá de eso (ej. `livePrices`, camino a 1088 rutas) dieran conteos y
 * resultados incompletos sin ningún aviso. Colecciones chicas (Partners,
 * Admins, Pages) terminan en una sola vuelta igual que antes.
 */
export async function listDocuments(
  collection: string,
  credentials: FirestoreCredentials
): Promise<(Record<string, unknown> & { id: string })[]> {
  const results: (Record<string, unknown> & { id: string })[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${DOCS_BASE}/${collection}`);
    url.searchParams.set("pageSize", "300");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await authedFetch(url.toString(), credentials);
    if (!res.ok) {
      throw new Error(`Firestore list failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as { documents?: { name: string; fields?: Record<string, unknown> }[]; nextPageToken?: string };
    for (const doc of data.documents ?? []) {
      results.push({ id: doc.name.split("/").pop() ?? "", ...fromFirestoreFields(doc.fields) });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return results;
}

/**
 * Página ordenada de una colección — a diferencia de `listDocuments`
 * (que solo hace un GET simple, sin orden garantizado, tope fijo de
 * 300), esto usa el endpoint `:runQuery` de Firestore para pedir
 * explícitamente "ordenado por X, del más nuevo al más viejo, página N
 * de tamaño M". Necesario para que la sección "Actividad reciente" del
 * panel de admin siempre muestre lo más reciente de verdad, sin
 * importar cuántos miles de eventos se acumulen (bug real encontrado
 * 2026-08-10: sin esto, una vez pasados los primeros 300 documentos,
 * Firestore puede devolver cualquier subconjunto, no necesariamente el
 * más reciente).
 */
/**
 * `valueType` (2026-08-23) — Firestore solo matchea un fieldFilter contra
 * el MISMO tipo de valor que tiene el campo guardado, no hace coerción.
 * `capturedAt` (priceHistory) se escribe como string ISO (`toFirestoreFields`
 * lo manda como stringValue), pero `createdAt` (events) se escribe como
 * `new Date()` — eso `toFirestoreFields` lo serializa como timestampValue.
 * Un filtro con stringValue contra un campo timestampValue no tira error,
 * simplemente no matchea NUNCA (0 resultados silencioso) — bug real
 * encontrado al agregar el filtro de rango a /ari-admin/metrics. Default
 * "string" para no romper los usos existentes (favorites.uid, capturedAt).
 */
export type FieldFilterWhere = { field: string; op: "EQUAL" | "GREATER_THAN_OR_EQUAL"; value: string; valueType?: "string" | "timestamp" };

function buildFieldFilter(where: FieldFilterWhere) {
  return {
    fieldFilter: {
      field: { fieldPath: where.field },
      op: where.op,
      value: where.valueType === "timestamp" ? { timestampValue: where.value } : { stringValue: where.value },
    },
  };
}

// Array = AND compuesto (2026-08-25, para el dashboard ejecutivo del admin:
// contar "search_performed en los últimos 7 días" necesita 2 condiciones a
// la vez, `name == X` y `createdAt >= corte`). Un solo FieldFilterWhere
// sigue funcionando igual que antes, sin compositeFilter de por medio.
function buildFilter(where: FieldFilterWhere | FieldFilterWhere[]) {
  const wheres = Array.isArray(where) ? where : [where];
  if (wheres.length === 1) return buildFieldFilter(wheres[0]);
  return { compositeFilter: { op: "AND", filters: wheres.map(buildFieldFilter) } };
}

export async function queryDocuments(
  collection: string,
  credentials: FirestoreCredentials,
  options: {
    orderByField?: string;
    direction?: "ASCENDING" | "DESCENDING";
    limit?: number;
    offset?: number;
    // Filtro de igualdad simple (2026-08-14) — agregado para que
    // /api/favorites pueda pedirle a Firestore solo los docs de UN
    // usuario en vez de traer la colección `favorites` entera y filtrar
    // del lado del servidor (mismo antipatrón de "leer toda la colección"
    // que agotó la cuota gratis de Firestore, ver dealsCache.ts).
    // GREATER_THAN_OR_EQUAL sumado (2026-08-23) para cortes por fecha
    // (ej. "capturedAt >= hace 24h") — ver FieldFilterWhere para por qué
    // `valueType` importa.
    where?: FieldFilterWhere | FieldFilterWhere[];
  }
): Promise<(Record<string, unknown> & { id: string })[]> {
  const structuredQuery: Record<string, unknown> = { from: [{ collectionId: collection }] };
  if (options.orderByField) {
    structuredQuery.orderBy = [{ field: { fieldPath: options.orderByField }, direction: options.direction ?? "DESCENDING" }];
  }
  if (typeof options.limit === "number") structuredQuery.limit = options.limit;
  if (options.offset) structuredQuery.offset = options.offset;
  if (options.where) {
    structuredQuery.where = buildFilter(options.where);
  }
  const body = { structuredQuery };
  const res = await authedFetch(`${DOCS_BASE}:runQuery`, credentials, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Firestore query failed: ${res.status} ${await res.text()}`);
  }
  const results = (await res.json()) as { document?: { name: string; fields?: Record<string, unknown> } }[];
  return results
    .filter((r): r is { document: { name: string; fields?: Record<string, unknown> } } => Boolean(r.document))
    .map((r) => ({ id: r.document.name.split("/").pop() ?? "", ...fromFirestoreFields(r.document.fields) }));
}

/**
 * Cuenta los documentos de una colección sin traerlos — usa la agregación
 * nativa de Firestore, no cuenta del lado del cliente. `where` opcional
 * (2026-08-23, para el contador de "precios actualizados" del admin de
 * Live Prices) filtra antes de contar, ej. `capturedAt >= hace 24h` — sigue
 * siendo una sola lectura de agregación, no trae los documentos.
 */
export async function countDocuments(
  collection: string,
  credentials: FirestoreCredentials,
  where?: FieldFilterWhere | FieldFilterWhere[]
): Promise<number> {
  const structuredQuery: Record<string, unknown> = { from: [{ collectionId: collection }] };
  if (where) structuredQuery.where = buildFilter(where);
  const body = {
    structuredAggregationQuery: {
      structuredQuery,
      aggregations: [{ alias: "count", count: {} }],
    },
  };
  const res = await authedFetch(`${DOCS_BASE}:runAggregationQuery`, credentials, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Firestore count failed: ${res.status} ${await res.text()}`);
  }
  const results = (await res.json()) as { result?: { aggregateFields?: { count?: { integerValue?: string } } } }[];
  return Number(results[0]?.result?.aggregateFields?.count?.integerValue ?? 0);
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
