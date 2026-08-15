import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { verifyGoogleIdToken, getDocument, setDocument, signUserSession } from "@aritrips/data";
import { USER_SESSION_COOKIE } from "@/lib/requireUserSession";

export async function POST(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const { FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, USER_SESSION_SECRET } = env;
  // No es un secreto (es el Client ID público de OAuth), pero vive como
  // variable de build (.env, NEXT_PUBLIC_) igual que PUBLIC_APP_URL en
  // apps/www — Next.js la inlinea en el bundle server Y client.
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  if (!FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY || !USER_SESSION_SECRET || !clientId) {
    return NextResponse.json({ error: "Sign-in isn't configured yet." }, { status: 503 });
  }

  let body: { credential?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!body.credential) return NextResponse.json({ error: "Missing credential." }, { status: 400 });

  const identity = await verifyGoogleIdToken(body.credential, clientId);
  if (!identity || !identity.emailVerified) {
    return NextResponse.json({ error: "Could not verify Google sign-in." }, { status: 401 });
  }

  const credentials = { clientEmail: FIREBASE_CLIENT_EMAIL, privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") };
  const uid = identity.sub;

  // setDocument reemplaza el documento COMPLETO (ver nota en firestore.ts)
  // — leer primero y mergear preserva createdAt en logins posteriores.
  const existing = await getDocument("users", uid, credentials).catch(() => null);
  const now = new Date();
  const createdAt = existing && typeof existing.createdAt === "string" ? new Date(existing.createdAt) : now;
  await setDocument(
    "users",
    uid,
    {
      ...(existing ?? {}),
      uid,
      email: identity.email,
      name: identity.name,
      picture: identity.picture,
      updatedAt: now,
      createdAt,
    },
    credentials
  );

  const token = await signUserSession(
    { uid, email: identity.email, name: identity.name, picture: identity.picture, createdAt: createdAt.toISOString() },
    USER_SESSION_SECRET
  );

  const res = NextResponse.json({
    ok: true,
    user: { uid, email: identity.email, name: identity.name, picture: identity.picture, createdAt: createdAt.toISOString() },
  });
  res.cookies.set(USER_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    domain: ".aritrips.com",
    maxAge: 60 * 60 * 24 * 30, // 30 días, igual que la vida de la sesión firmada
  });
  return res;
}
