/**
 * Modo prueba — marca los eventos de tracking como no-reales para que el
 * dashboard de /ari-admin/searches los pueda excluir del conteo hacia las
 * 1,000 búsquedas (2026-08-11, roadmap Fase 2). Se activa visitando
 * cualquier página de la app con ?test=1 una vez (ej.
 * app.aritrips.com/?test=1) y queda "pegado" el resto de la sesión del
 * navegador vía sessionStorage — no hace falta repetir el query param en
 * cada página, cierra sola al cerrar la pestaña. Pensado tanto para
 * pruebas manuales del founder desde su PC como para QA automatizado.
 */
const TEST_MODE_KEY = "ari_test_mode";

export function isTestMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("test") === "1") {
      sessionStorage.setItem(TEST_MODE_KEY, "1");
      return true;
    }
    return sessionStorage.getItem(TEST_MODE_KEY) === "1";
  } catch {
    return false;
  }
}
