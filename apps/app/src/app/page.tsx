import { SearchForm } from "@/components/SearchForm";
import { DiscoverSection } from "@/components/DiscoverSection";
import { CompassIcon, ShieldCheckIcon, DollarCircleIcon, WorldIcon } from "@/components/Icons";

const TRUST_ITEMS = [
  { icon: CompassIcon, title: "Smart recommendations", body: "We find the best destinations that fit your budget." },
  { icon: ShieldCheckIcon, title: "Safe & reliable", body: "We show you travel tips, safety info and weather." },
  { icon: DollarCircleIcon, title: "Save time & money", body: "Compare prices and book with our trusted partners." },
  { icon: WorldIcon, title: "Around the world", body: "From weekend getaways to big adventures." },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col bg-bg">
      <div className="relative">
        {/* Franja de foto a altura fija (2026-08-13, referencia visual del
            usuario) — deliberadamente NO "inset-0 h-full" sobre todo el
            bloque: eso haría que la imagen se estire hasta el fondo de los
            resultados de búsqueda si la lista crece. Con altura fija, el
            degradé ya se resolvió a bg antes de esa altura y lo que venga
            después (resultados) queda en fondo normal de la página. */}
        <div className="absolute inset-x-0 top-0 h-[720px] overflow-hidden sm:h-[640px] lg:h-[580px]">
          {/* eslint-disable-next-line @next/next/no-img-element -- viene del proxy propio, no de next/image remote patterns */}
          <img
            src="/api/image-proxy?q=tropical+beach+sunset+aerial+palm+trees&fallback=beach"
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-white/70 to-bg dark:from-black/10 dark:via-black/60 dark:to-bg" />
          {/* eslint-disable-next-line @next/next/no-img-element -- asset local chico */}
          <img
            src="/mascot.png"
            alt=""
            className="pointer-events-none absolute bottom-2 right-4 hidden w-36 sm:right-8 sm:w-44 md:block lg:w-52"
          />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-8 px-6 pb-16 pt-14">
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="max-w-lg text-3xl font-bold text-ink sm:text-4xl">Where can you go with your budget?</h1>
            <p className="max-w-md text-muted">
              Tell us <span className="font-semibold text-highlight">your budget</span> and we&apos;ll do the rest.
            </p>
          </div>
          <SearchForm />
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-x-6 gap-y-8 px-6 py-14 sm:grid-cols-4">
        {TRUST_ITEMS.map((item) => (
          <div key={item.title} className="flex flex-col items-center gap-2 text-center sm:items-start sm:text-left">
            <item.icon className="h-7 w-7 text-highlight" />
            <p className="text-sm font-semibold text-ink">{item.title}</p>
            <p className="text-xs text-muted">{item.body}</p>
          </div>
        ))}
      </div>

      <DiscoverSection />
    </main>
  );
}
