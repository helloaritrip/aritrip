/**
 * Purga la copia de `/p/{slug}` en la Cache API de Cloudflare (2026-08-16,
 * bug real reportado por el usuario: publicó/republicó una página y
 * seguía viendo una copia vieja hasta 1h después, en dos navegadores
 * distintos — confirmado que era la caché de borde compartida
 * (middleware.ts), no caché local del navegador). Antes de esto, publicar
 * escribía Firestore al instante pero la copia cacheada en el borde
 * seguía sirviéndose hasta que expirara sola (hasta s-maxage=3600) — la
 * propia promesa de "SSR = publicar es instantáneo" (ver el comentario
 * en pages/p/[slug].astro) no se cumplía en la práctica una vez que se
 * agregó el caché de borde el 2026-08-15.
 *
 * Best-effort a propósito — si la purga falla, la publicación en sí ya
 * se guardó bien en Firestore; el peor caso es volver al comportamiento
 * de antes (esperar el TTL), no perder el contenido publicado.
 *
 * Ojo si esto se llama en loop (ej. republish-hub-pages.ts,
 * republish-destination-pages.ts): la llamada a `cache.delete()` SÍ
 * cuenta contra el límite de 50 subrequests/invocación de Cloudflare
 * Workers (plan free) — confirmado en logs en vivo con `wrangler tail`
 * después de que agregar esto rompiera un batch que hasta entonces
 * funcionaba bien. No es gratis solo por no ser un `fetch` a un host
 * externo.
 */
// `isFullPath` (2026-08-19) — el cluster de vuelos vive en /flights/{slug},
// no /p/{slug}. `false` mantiene el comportamiento original para todos los
// call sites existentes (republish-*.ts, que solo conocen páginas /p/).
export async function purgePageCache(slugOrPath: string, isFullPath = false): Promise<void> {
  try {
    const cache = (caches as unknown as { default?: Cache }).default;
    if (!cache) return;
    const path = isFullPath ? slugOrPath : `/p/${slugOrPath}`;
    await cache.delete(new Request(`https://aritrips.com${path}`));
  } catch {
    // best-effort, ver comentario de arriba
  }
}
