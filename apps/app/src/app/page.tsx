import { getCloudflareContext } from "@opennextjs/cloudflare";
import { SearchForm } from "@/components/SearchForm";
import { SearchResults } from "@/components/SearchResults";
import { SearchProvider } from "@/components/SearchContext";
import { DiscoverSection } from "@/components/DiscoverSection";
import { CompassIcon, ShieldCheckIcon, DollarCircleIcon, WorldIcon } from "@/components/Icons";
import { getAppHeroImageUrl } from "@/lib/appHero";

const DEFAULT_HERO_IMAGE_URL = "/api/image-proxy?q=tropical+beach+sunset+aerial+palm+trees&fallback=beach";

const TRUST_ITEMS = [
  { icon: CompassIcon, title: "Smart recommendations", body: "We find the best destinations that fit your budget." },
  { icon: ShieldCheckIcon, title: "Safe & reliable", body: "We show you travel tips, safety info and weather." },
  { icon: DollarCircleIcon, title: "Save time & money", body: "Compare prices and book with our trusted partners." },
  { icon: WorldIcon, title: "Around the world", body: "From weekend getaways to big adventures." },
];

export default async function Home() {
  const { env } = await getCloudflareContext({ async: true });
  const heroImageUrl = (await getAppHeroImageUrl(env)) || DEFAULT_HERO_IMAGE_URL;

  return (
    <main className="flex flex-1 flex-col bg-bg">
      <SearchProvider>
      <div className="relative overflow-hidden">
        {/* La franja de foto llena exactamente la altura del contenido de
            arriba (título + form) vía `absolute inset-0` — antes tenía una
            altura fija adivinada a ojo que en la práctica quedaba más alta
            que el contenido real, dejando un hueco antes de la fila de
            confianza y, en algunos anchos, tapando sus íconos (reportado
            2026-08-13). `overflow-hidden` en el wrapper es un cinturón de
            seguridad extra para que la foto nunca se salga de su caja. */}
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- viene del proxy propio, no de next/image remote patterns */}
          <img src={heroImageUrl} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-white/70 to-bg dark:from-black/10 dark:via-black/60 dark:to-bg" />
          {/* eslint-disable-next-line @next/next/no-img-element -- asset local chico */}
          <img
            src="/mascot.png"
            alt=""
            className="pointer-events-none absolute bottom-2 right-4 hidden w-36 sm:right-8 sm:w-44 md:block lg:w-52"
          />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-8 px-6 pb-8 pt-14">
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="max-w-lg text-3xl font-bold text-ink sm:text-4xl">Where can you go with your budget?</h1>
            <p className="max-w-md text-muted">
              Tell us <span className="font-semibold text-highlight">your budget</span> and we&apos;ll do the rest.
            </p>
          </div>
          <SearchForm />
        </div>
      </div>

      {/* Fuera de la franja de foto a propósito — ver SearchContext.tsx.
          Antes los resultados vivían adentro del mismo bloque que la
          imagen de fondo, así que una lista larga estiraba la foto hasta
          cubrir toda esa área (bug real reportado por el usuario,
          2026-08-14: "la imagen de fondo se estira y cubre todo el
          fondo"). Ahora el hero solo mide título+form, y esto queda en
          fondo normal de la página sin importar cuántos resultados haya. */}
      <SearchResults />
      </SearchProvider>

      <div className="relative z-10 mx-auto grid w-full max-w-5xl grid-cols-2 gap-x-6 gap-y-8 px-6 pb-14 pt-4 sm:grid-cols-4">
        {TRUST_ITEMS.map((item) => (
          <div key={item.title} className="flex flex-col items-center gap-2 text-center sm:items-start sm:text-left">
            <item.icon className="h-7 w-7 text-highlight" />
            <p className="text-sm font-semibold text-ink">{item.title}</p>
            <p className="text-xs text-muted">{item.body}</p>
          </div>
        ))}
      </div>

      <div className="pb-16">
        <DiscoverSection />
      </div>
    </main>
  );
}
