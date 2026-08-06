# apps/www — Travel Package Builder marketing site

Astro + Tailwind v4 + React (islands vía `@astrojs/react`) + Cloudflare adapter. Sirve `www.travelbuilder.com` — contenido/SEO, no la aplicación (eso es `apps/app`). Ver el documento "Frontend: Next.js + Astro" (Sprint -1) para el razonamiento completo de por qué son dos frontends separados.

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

## Deploy

Pendiente del `wrangler login` del usuario (mismo paso pendiente que
`apps/app`). Una vez autenticado: `npx wrangler deploy` desde esta carpeta,
o el flujo de Cloudflare Pages/Workers que se prefiera.
