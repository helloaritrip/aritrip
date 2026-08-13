import type { NextRequest } from "next/server";
import { verifyUserSession, type UserSession } from "@aritrips/data";

/**
 * Nombre de la cookie de sesión de usuario — compartida entre
 * /api/auth/google (la escribe), /api/auth/logout (la borra), y acá (la
 * lee/valida). Se pone en el dominio ".aritrips.com" al escribirla (ver
 * auth/google/route.ts) para que sea visible tanto en app.aritrips.com
 * como en aritrips.com — el botón de guardar de /deals vive en el segundo.
 */
export const USER_SESSION_COOKIE = "aritrips_session";

/** Devuelve la sesión válida, o null si no hay cookie, está vencida, o no hay USER_SESSION_SECRET configurado. */
export async function getUserSession(request: NextRequest, env: { USER_SESSION_SECRET?: string }): Promise<UserSession | null> {
  const secret = env.USER_SESSION_SECRET;
  if (!secret) return null;
  const token = request.cookies.get(USER_SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyUserSession(token, secret);
}
