import { verifySession, type AdminSession } from "@aritrips/data";

/**
 * Nombre de la cookie de sesión del panel — compartido entre login.ts
 * (la escribe), logout.ts (la borra) y acá (la lee/valida). Un solo lugar
 * para no desincronizar el nombre entre los tres.
 */
export const SESSION_COOKIE = "admin_session";

type CookieReader = { get(name: string): { value: string } | undefined };

/** Devuelve la sesión válida, o null si no hay cookie, está vencida, o no hay SESSION_SECRET configurado. */
export async function getAdminSession(cookies: CookieReader, env: { SESSION_SECRET?: string }): Promise<AdminSession | null> {
  const secret = env.SESSION_SECRET;
  if (!secret) return null;
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token, secret);
}
