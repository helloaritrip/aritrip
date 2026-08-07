# apps/www — AriTrips marketing site

Astro + Tailwind v4 + React (islands vía `@astrojs/react`) + Cloudflare adapter. Sirve `aritrips.com` — contenido/SEO, no la aplicación (eso es `apps/app`, en `app.aritrips.com`). Ver el documento "Frontend: Next.js + Astro" (Sprint -1) para el razonamiento completo de por qué son dos frontends separados.

## Correr localmente

```bash
npm run build --workspace=apps/www
cd apps/www && npx astro preview
```

**Nota conocida:** `astro dev` (el modo con hot-reload) falla en Windows con
`require is not defined` — es un bug del runtime de Workers (workerd) que
el adaptador de Cloudflare usa para emular Workers durante el desarrollo,
no algo de nuestro código. `astro build` + `astro preview` sirven el sitio
real y funcionan sin problema (el sitio es 100% estático, no necesita esa
emulación para verse correctamente). Si esto molesta durante desarrollo
activo, correr desde WSL es la salida más probable — mismo patrón que la
advertencia de Windows de `@opennextjs/cloudflare` en `apps/app`.

## Editor de contenido (Puck)

`/admin/edit?slug=nombre-de-pagina` abre el editor visual. Flujo hoy (sin
backend real conectado todavía):

1. Armar la página arrastrando bloques (`Hero`, `Heading`, `TextBlock`,
   `CTAButton`, `DestinationHighlight` — este último tira datos reales del
   catálogo de `packages/data`, no texto inventado).
2. Click en "Publish" descarga un `.json`.
3. Guardar ese archivo en `src/content/pages/{slug}.json`.
4. `npm run build --workspace=apps/www` — la página aparece en `/p/{slug}`,
   100% estática (sin el editor, sin JS de Puck en la página pública).

Los `.json` de `src/content/pages/` se leen en build time vía
`import.meta.glob` (no `node:fs`) — con el adaptador de Cloudflare,
`getStaticPaths` corre dentro de una emulación del runtime de Workers
incluso en build, donde `node:fs` no se comporta como en Node normal.

**Seguridad — pendiente antes de cualquier deploy real:** `/admin/edit` no
tiene autenticación. Hoy no está linkeada desde ninguna página pública y
tiene `noindex`, pero eso no es protección real — antes de desplegar en
serio hay que ponerle auth o sacarla del build público.

## Deploy

Pendiente del `wrangler login` del usuario (mismo paso pendiente que
`apps/app`). Una vez autenticado: `npx wrangler deploy` desde esta carpeta,
o el flujo de Cloudflare Pages/Workers que se prefiera.
