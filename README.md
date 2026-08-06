# Travel Package Builder

Plataforma de planificación de viajes por presupuesto. En vez de preguntar "¿a dónde querés viajar?", pregunta presupuesto/origen/fechas/intereses y devuelve los mejores destinos con el paquete completo (vuelo + hotel + actividades) listo para reservar vía afiliados.

## Documentos de arquitectura (Sprint -1, cerrada)

- [Roadmap & Sprint Plan](https://claude.ai/code/artifact/60dd0c4d-8669-4964-b674-759fb1946fb0)
- [Recommendation Engine Design](https://claude.ai/code/artifact/86550757-70e9-4028-9ff4-46147796e6ed)
- [Data Model](https://claude.ai/code/artifact/a76659cd-90e9-4a5e-a5ca-885f27beb9b2)
- [Affiliate Integration & API Contracts](https://claude.ai/code/artifact/306d04eb-e173-4d2d-a30c-383ed673da9c)
- [Frontend: Next.js + Astro](https://claude.ai/code/artifact/7d56e4bd-ac40-4e35-bc06-40b23f22bf9f)
- [Travel Intelligence Database](https://claude.ai/code/artifact/74a18849-b9aa-4e53-8a64-5a21c545d3ec)
- [System Architecture](https://claude.ai/code/artifact/3f3362ee-a043-4125-b6c5-aa8b07bf556e)

## Estructura del monorepo

```
apps/
  app/      Next.js 16 (App Router) — formulario, motor de recomendación, resultados, CTAs de afiliados. app.travelbuilder.com
  www/      Astro — landing/marketing/SEO. www.travelbuilder.com (ver apps/www/README.md)
packages/
  ui/       Componentes React + Tailwind y tokens de diseño (claro/oscuro), compartidos por ambos frontends
  data/     Tipos, catálogo de 30 destinos curados, motor de recomendación (fórmula v0), scripts de seed
```

## Estado

- [x] Sprints 0-5 completos (fundación, catálogo, formulario, motor de recomendación, resultados, CTAs de afiliados + tracking placeholder)
- [x] Sprint 6 parcial: páginas legales (`/privacy`, `/terms`), footer, fix de QA mobile
- [x] Catálogo: 30 destinos, 24 hubs de origen (incluye Panamá — fuera del scope US/CA/MX original, agregado porque es donde vive el fundador)
- [x] `apps/www` (Astro) — landing real con stats en vivo del catálogo, deploy a Cloudflare configurado
- [ ] Deploy real y proyecto Firestore real — requieren login interactivo (ver abajo)
- [ ] Puck (editor visual de contenido) — todavía no integrado, decisión pendiente
- [ ] Ampliar catálogo hacia 40-50 destinos (30 es el mínimo del rango, no el objetivo final)

## Correr localmente

```bash
npm install
npm run dev          # apps/app en http://localhost:3000
npm run build        # build de producción de apps/app

npm run build:www    # build de apps/www
cd apps/www && npx astro preview   # sirve el build real (ver nota de astro dev abajo)
```

## Pasos manuales pendientes (requieren tu cuenta, no se pueden automatizar)

1. **Cloudflare**: `cd apps/app && npx wrangler login` (sirve para ambas apps), después `npm run preview`/`npm run deploy` en `apps/app`, o `npx wrangler deploy` en `apps/www`.
2. **Firebase/Firestore**: `firebase login`, después `firebase projects:create` (o `firebase use --add` si ya existe un proyecto) para reemplazar el placeholder `REPLACE_WITH_REAL_FIREBASE_PROJECT_ID` en `.firebaserc`. Después `firebase deploy --only firestore:rules,firestore:indexes`.
3. **GitHub remoto**: `gh` CLI ya está instalado. Correr `gh auth login` (interactivo, requiere navegador), después `gh repo create travel-package-builder --private --source=. --remote=origin` y `git push -u origin master`.

## Notas técnicas (Windows)

- `@opennextjs/cloudflare` (apps/app) advierte que no es 100% compatible con Windows. El build funciona igual; si aparecen fallas al iterar, correr desde WSL es la solución recomendada por la herramienta.
- `astro dev` (apps/www) falla en este entorno con `require is not defined` — bug del runtime de Workers que el adaptador de Cloudflare emula localmente, no de nuestro código. `astro build` + `astro preview` funcionan sin problema (el sitio es 100% estático). Ver `apps/www/README.md`.

## Próximo paso

Elegir entre: ampliar el catálogo hacia 40-50 destinos, integrar Puck en `apps/www` para edición visual de contenido, o resolver los logins pendientes para tener un deploy real.
