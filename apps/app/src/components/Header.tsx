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
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- asset local chico, no vale la pena next/image acá */}
          <img src="/mascot.png" alt="" className="h-9 w-9 rounded-xl object-cover" />
          <span className="text-xl font-extrabold tracking-tight">
            <span className="text-ink">ari</span>
            <span className="text-highlight">trips</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-medium text-ink md:flex">
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

        <div className="flex items-center gap-3">
          {/* Decorativo por ahora — no hay sistema real de idiomas/monedas
              todavía, mismo criterio que otros "reservado, sin implementar"
              del proyecto (ver Roadmap). */}
          <button
            type="button"
            disabled
            className="hidden items-center gap-1 rounded-full border border-rule px-3 py-1.5 text-xs font-medium text-muted sm:flex"
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
    </header>
  );
}
