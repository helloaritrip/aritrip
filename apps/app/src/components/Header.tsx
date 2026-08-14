import Link from "next/link";
import { BriefcaseIcon, TagIcon, MapIcon, HoneymoonIcon, GlobeIcon, ChevronDownIcon } from "@/components/Icons";

// Blog/Deals viven en aritrips.com (apps/www), no acá — un solo lugar de
// verdad para cada uno en vez de duplicarlos en las dos apps.
const MARKETING_URL = "https://aritrips.com";

// Barra idéntica a la de apps/www (TopNav.astro) a propósito (2026-08-13,
// a pedido del usuario: "esta barra de menu superior debe ser la misma
// para el home como para el app") — 4 links estáticos + un solo botón fijo
// "Join AriTrips". Antes esto cambiaba según sesión (My Favorites
// reemplazaba a Join cuando había sesión); se sacó esa lógica porque
// generaba dos barras visualmente distintas entre los dos sitios — la
// versión de apps/www es estática (Astro, sin JS), así que la de acá
// también se queda estática para que se vean iguales siempre, con o sin
// sesión iniciada.
export function Header() {
  return (
    <header className="sticky top-0 z-30 rounded-b-3xl bg-surface shadow-sm">
      {/* Menú mobile con el truco del checkbox (2026-08-15) — cero JS,
          igual que en TopNav.astro (apps/www): un <input type="checkbox">
          oculto + un <label> como botón + `peer-checked:` de Tailwind
          para mostrar el panel de abajo. Se mantiene sin useState a
          propósito para que este componente siga siendo estático, mismo
          criterio que el resto del archivo (ver comentario de arriba:
          "la versión de apps/www es estática... así que la de acá también
          se queda estática"). Antes en mobile solo se veían el logo y
          "Join AriTrips" — los otros 4 links desaparecían del todo por
          debajo de md (reportado 2026-08-15). */}
      <input type="checkbox" id="mobile-menu-toggle" className="peer hidden" />

      {/* Mobile: fila propia, logo / Join / hamburguesa (2026-08-15,
          corrección real reportada con captura) — antes compartía el grid
          de 3 columnas de desktop; con la columna del medio (el nav)
          vacía en mobile, Join y la hamburguesa quedaban apretados contra
          el logo en vez de repartidos por todo el ancho. Separado del
          grid de desktop para no pelear con sus reglas de ancho —
          `justify-between` con exactamente 3 hijos alcanza el
          logo-izquierda / Join-medio / hamburguesa-derecha pedido. */}
      <div className="flex items-center justify-between gap-3 px-6 py-3 md:hidden">
        <Link href="/" className="flex w-fit shrink-0 items-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- asset local chico, no vale la pena next/image acá */}
          <img src="/logo.webp" alt="AriTrips" className="h-7 w-auto" width={360} height={103} />
        </Link>

        <Link href="/join" className="shrink-0 rounded-full bg-muted/15 px-4 py-2 text-sm font-medium text-ink hover:bg-muted/25">
          Join AriTrips
        </Link>

        <label
          htmlFor="mobile-menu-toggle"
          aria-label="Toggle menu"
          className="flex shrink-0 cursor-pointer items-center justify-center rounded-full p-2 text-ink hover:bg-bg"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="M4 6h16" />
            <path d="M4 12h16" />
            <path d="M4 18h16" />
          </svg>
        </label>
      </div>

      {/* Grid de 3 columnas (1fr / auto / 1fr), no flex justify-between —
          con justify-between el nav del medio queda desplazado hacia la
          izquierda en cuanto el bloque de la derecha (selector + botón)
          pesa más que el logo de la izquierda. Con columnas 1fr iguales a
          los costados, el nav queda centrado de verdad respecto a la
          página, sin importar cuánto pesen los otros dos bloques
          (reportado 2026-08-13). */}
      <div className="mx-auto hidden max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-6 py-3 md:grid">
        <Link href="/" className="flex w-fit items-center justify-self-start">
          {/* eslint-disable-next-line @next/next/no-img-element -- asset local chico, no vale la pena next/image acá */}
          <img src="/logo.webp" alt="AriTrips" className="h-8 w-auto" width={360} height={103} />
        </Link>

        <nav className="flex items-center gap-7 text-sm font-medium text-ink justify-self-center">
          <Link href="/" className="flex items-center gap-1.5 hover:text-accent">
            <BriefcaseIcon className="h-4 w-4" />
            Trips
          </Link>
          <a href={`${MARKETING_URL}/deals`} className="flex items-center gap-1.5 hover:text-accent">
            <TagIcon className="h-4 w-4" />
            Deals
          </a>
          <a href={`${MARKETING_URL}/blog`} className="flex items-center gap-1.5 hover:text-accent">
            <MapIcon className="h-4 w-4" />
            Travel Guide
          </a>
          <Link href="/favorites" className="flex items-center gap-1.5 hover:text-accent">
            <HoneymoonIcon className="h-4 w-4" />
            My Favorites
          </Link>
        </nav>

        <div className="flex items-center justify-end gap-3 justify-self-end">
          {/* Decorativo por ahora — no hay sistema real de idiomas/monedas
              todavía, mismo criterio que otros "reservado, sin implementar"
              del proyecto (ver Roadmap). */}
          <button
            type="button"
            disabled
            className="flex items-center gap-1 rounded-full border border-rule px-3 py-1.5 text-xs font-medium text-muted"
          >
            <GlobeIcon className="h-3.5 w-3.5" />
            USD / EN
            <ChevronDownIcon className="h-3.5 w-3.5" />
          </button>

          <Link href="/join" className="shrink-0 rounded-full bg-muted/15 px-4 py-2 text-sm font-medium text-ink hover:bg-muted/25">
            Join AriTrips
          </Link>
        </div>
      </div>

      {/* Panel del menú mobile — oculto por default, visible cuando el
          checkbox de arriba está marcado. */}
      <nav className="hidden flex-col gap-1 border-t border-rule px-6 py-3 text-sm font-medium text-ink peer-checked:flex md:hidden">
        <Link href="/" className="flex items-center gap-2 rounded-md px-2 py-2.5 hover:bg-bg">
          <BriefcaseIcon className="h-4 w-4" />
          Trips
        </Link>
        <a href={`${MARKETING_URL}/deals`} className="flex items-center gap-2 rounded-md px-2 py-2.5 hover:bg-bg">
          <TagIcon className="h-4 w-4" />
          Deals
        </a>
        <a href={`${MARKETING_URL}/blog`} className="flex items-center gap-2 rounded-md px-2 py-2.5 hover:bg-bg">
          <MapIcon className="h-4 w-4" />
          Travel Guide
        </a>
        <Link href="/favorites" className="flex items-center gap-2 rounded-md px-2 py-2.5 hover:bg-bg">
          <HoneymoonIcon className="h-4 w-4" />
          My Favorites
        </Link>
      </nav>
    </header>
  );
}
