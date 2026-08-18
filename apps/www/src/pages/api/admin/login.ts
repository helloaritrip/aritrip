import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getDocument, verifyPassword, signSession } from "@aritrips/data";
import { SESSION_COOKIE } from "../../../lib/requireAdminSession";

export const prerender = false;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const { FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, SESSION_SECRET, LOGIN_LIMITER } = env as typeof env & {
    LOGIN_LIMITER?: { limit: (opts: { key: string }) => Promise<{ success: boolean }> };
  };
  if (!FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY || !SESSION_SECRET) {
    return json({ error: "Admin panel isn't configured yet (missing secrets)." }, 503);
  }

  // Freno de fuerza bruta (2026-08-19, auditoría de seguridad) — sin esto
  // no había ningún límite a cuántas contraseñas se podían probar contra
  // un email de admin conocido. Por IP, no por email — así tampoco sirve
  // para tumbar el acceso legítimo de un admin real spameando su propio
  // email desde otra IP.
  if (LOGIN_LIMITER) {
    const clientIp = request.headers.get("cf-connecting-ip") ?? "unknown";
    const { success } = await LOGIN_LIMITER.limit({ key: clientIp });
    if (!success) return json({ error: "Too many attempts. Try again in a minute." }, 429);
  }

  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password;
  if (!email || !password) {
    return json({ error: "Email and password are required." }, 400);
  }

  const credentials = { clientEmail: FIREBASE_CLIENT_EMAIL, privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") };

  const admin = await getDocument("admins", email, credentials).catch(() => null);
  const passwordHash = admin?.passwordHash;
  if (!admin || typeof passwordHash !== "string" || !(await verifyPassword(password, passwordHash))) {
    // Mismo mensaje para "no existe" y "contraseña incorrecta" — no darle
    // a un atacante pistas de qué emails son cuentas reales.
    return json({ error: "Invalid email or password." }, 401);
  }

  const token = await signSession({ adminId: email, email }, SESSION_SECRET);
  cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    // Strict, no Lax (auditoría de seguridad, 2026-08-10) — no existe
    // ningún flujo legítimo que entre al panel desde un link externo,
    // así que no hay costo real y cierra el margen que Lax deja abierto.
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 días, igual que la vida de la sesión firmada
  });

  return json({ ok: true }, 200);
};
