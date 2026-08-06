# Travel Package Builder

Plataforma de planificación de viajes por presupuesto. En vez de preguntar "¿a dónde querés viajar?", pregunta presupuesto/origen/fechas/intereses y devuelve los mejores destinos con el paquete completo (vuelo + hotel + actividades + seguro + eSIM) listo para reservar vía afiliados.

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
  app/      Next.js (App Router) — formulario, motor de recomendación, futuro dashboard. app.travelbuilder.com
  www/      Astro — se crea en Sprint 1+, cuando exista contenido real para SEO. www.travelbuilder.com
packages/
  ui/       Componentes React + Tailwind y tokens de diseño (claro/oscuro), compartidos por ambos frontends
```

## Estado — Sprint 0 (fundación)

- [x] Monorepo con npm workspaces
- [x] `apps/app`: Next.js 16 + TypeScript + Tailwind v4, build y dev verificados
- [x] `packages/ui`: tokens claro/oscuro + componente `Button` de ejemplo, consumido por `apps/app`
- [x] Deploy a Cloudflare Workers configurado (`@opennextjs/cloudflare`), build local verificado
- [x] Skeleton de Firestore (`firestore.rules` cerrado por defecto — todo el acceso pasa por Workers, no por cliente)
- [ ] `apps/www` (Astro) — se crea en Sprint 1+
- [ ] Deploy real y proyecto Firestore real — requieren login interactivo (ver abajo)

## Correr localmente

```bash
npm install
npm run dev        # apps/app en http://localhost:3000
npm run build       # build de producción de apps/app
```

## Pasos manuales pendientes (requieren tu cuenta, no se pueden automatizar)

1. **Cloudflare**: `cd apps/app && npx wrangler login`, después `npm run preview` (prueba local en runtime de Workers) o `npm run deploy` (deploy real).
2. **Firebase/Firestore**: `firebase login`, después `firebase projects:create` (o `firebase use --add` si ya existe un proyecto) para reemplazar el placeholder `REPLACE_WITH_REAL_FIREBASE_PROJECT_ID` en `.firebaserc`. Después `firebase deploy --only firestore:rules,firestore:indexes`.
3. **GitHub remoto**: no hay `gh` CLI instalado en este entorno — crear el repo manualmente en GitHub y `git remote add origin <url>`, o instalar `gh` (`winget install GitHub.cli`) para hacerlo desde acá.

## Nota técnica

`@opennextjs/cloudflare` advierte que no es 100% compatible con Windows (recomienda WSL para uso prolongado). El build local funcionó igual en este entorno; si aparecen fallas impredecibles al iterar, correr desde WSL es la solución recomendada por la propia herramienta.

## Próximo paso

Sprint 1: modelo de datos en Firestore + catálogo de 30-50 destinos curados (ficha completa por destino, ver Travel Intelligence Database) para los 8 hubs de origen del MVP.
