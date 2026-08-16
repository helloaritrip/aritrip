import type { Config } from "@measured/puck";
import {
  destinations,
  generatePriceSnapshotsForDestination,
  generateAllPriceSnapshots,
  estimateTripTotalUSD,
  getBudgetTiers,
  getDestinationsByTag,
  ORIGIN_OPTIONS,
  DEFAULT_TRIP_DAYS,
  DEFAULT_ADULTS,
  defaultMonth,
} from "@aritrips/data";

// El proxy de imágenes vive en apps/app (no se duplica acá) — apuntar
// cross-origin al mismo endpoint público, sin problema de CORS para <img>.
const APP_URL = import.meta.env.PUBLIC_APP_URL ?? "http://localhost:3000";

function imageProxyUrl(query: string, fallback: string): string {
  return `${APP_URL}/api/image-proxy?q=${encodeURIComponent(query)}&fallback=${encodeURIComponent(fallback)}`;
}

/**
 * Registro de bloques de Puck — lo que un editor de contenido (hoy, el
 * fundador) puede arrastrar para armar landing/guías/comparativas sin
 * tocar código. Usa los mismos tokens de packages/ui (clases de Tailwind
 * ya definidas), no un sistema de diseño aparte.
 *
 * Set de secciones "estilo Elementor" (2026-08-07): además de los 5
 * bloques originales (Hero/Heading/TextBlock/CTAButton/
 * DestinationHighlight), se agregó una librería de secciones más
 * completas y ya armadas visualmente — FeatureGrid, StatsBanner,
 * Testimonials, FAQAccordion, CTABanner, DestinationGrid,
 * ImageTextSplit — para poder construir páginas completas arrastrando
 * secciones en vez de armar todo bloque por bloque. FAQAccordion usa
 * <details>/<summary> nativo (no useState) para mantener 0 <script> en
 * las páginas públicas, mismo principio que el resto del sitio.
 */

const destinationOptions = destinations.map((d) => ({
  label: `${d.name}, ${d.country}`,
  value: d.id,
}));

// Precio real en DestinationHighlight (2026-08-16, feedback del head sobre
// las páginas "Best trips from X": prometen "real flight, hotel, and
// activity costs" arriba pero no mostraban ningún precio en las cards) —
// reusa el mismo motor de PriceSnapshot que ya arma /deals y los
// resultados del buscador, en vez de calcular nada nuevo. Curado, no
// overlay en vivo: generatePriceSnapshotsForDestination es puro/síncrono
// (sin fetch), a diferencia de applyLivePriceOverlay que necesita leer
// `livePrices` de Firestore — meter eso acá implicaría o una lectura de
// Firestore por card en cada visita (justo el problema que ya causó una
// caída de cuota una vez) o replatear cómo Puck pasa datos a sus bloques.
// El propio FAQ del sitio ya es honesto sobre esto ("estimates based on
// our own curated cost data... not a live quote") — mismo criterio acá.
const priceOriginOptions = [{ label: "— (no price shown)", value: "" }, ...ORIGIN_OPTIONS];

function priceInfoFor(destinationId: string, originAirportCode: string) {
  const destination = destinations.find((d) => d.id === destinationId);
  if (!destination) return null;

  let snapshots;
  try {
    snapshots = generatePriceSnapshotsForDestination(destination);
  } catch {
    // Faltan costos base curados para este destino (originBaseCosts.ts) —
    // no debería pasar para un destino activo, pero un bloque de Puck no
    // puede tirar un 500 por un dato de contenido faltante.
    return null;
  }

  // defaultMonth() (2026-08-16), no el mes calendario actual — mismo mes
  // de referencia que ya usa getDiscoverPicks/getBudgetTiers para esta
  // página. Con meses distintos, el mismo destino podía mostrar un total
  // distinto acá que en la sección de presupuesto de la misma página (el
  // multiplicador de temporada cambia por mes).
  const month = defaultMonth();
  const snapshot = snapshots.find((s) => s.originAirportCode === originAirportCode && s.month === month);
  if (!snapshot) return null; // sin costo curado para ESE origen puntual

  return {
    flightCostUSD: snapshot.avgFlightCostUSD,
    flightDurationMinutes: snapshot.avgFlightDurationMinutes,
    hotelPerNightUSD: snapshot.avgHotelCostPerNightUSD.mid,
    activityPerDayUSD: snapshot.avgActivityCostPerDayUSD,
    estimatedTripTotalUSD: Math.round(estimateTripTotalUSD(snapshot)),
  };
}

function formatFlightDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

type HeroProps = {
  heading: string;
  subheading: string;
  ctaLabel: string;
  ctaHref: string;
  backgroundImageQuery?: string;
  // URL fija a un archivo puntual de Wikimedia Commons, elegida a mano
  // desde /ari-admin/images (2026-08-10) — cuando está presente, salta
  // la búsqueda por texto de backgroundImageQuery por completo. Sin esto,
  // "aprobar" una foto en el panel no significaba nada: la búsqueda podía
  // devolver un archivo distinto la próxima vez que Wikimedia reindexara,
  // y encima no había forma de fijar CUÁL de varios resultados posibles
  // se quería en vez de dejarlo al azar del ranking de búsqueda.
  backgroundImageUrl?: string;
};

type HeadingProps = {
  text: string;
  level: "h1" | "h2" | "h3";
};

type TextBlockProps = {
  text: string;
};

type CTAButtonProps = {
  label: string;
  href: string;
  variant: "primary" | "secondary";
};

type DestinationHighlightProps = {
  destinationId: string;
  // Por qué este destino está en la página — los hubs "Best trips from
  // {city}" (generate-hub-pages.ts) muestran 3 destinos con roles
  // distintos (getDiscoverPicks: popular / recommended / dream), no 3
  // "mejores opciones" iguales. Sin esto, la tarjeta mostraba siempre
  // valueRating con la etiqueta "Value score" aunque el destino haya
  // sido elegido por ser el más lujoso (luxuryScore), no por ser buen
  // valor — se veía como una recomendación con puntaje bajo sin
  // explicación (bug real reportado por el usuario, 2026-08-11).
  // Vacío/undefined para páginas armadas a mano: se mantiene el
  // comportamiento anterior (solo Value score, sin badge).
  slot?: "popular" | "recommended" | "dream" | "";
  // "" (default) = sin precio, mismo comportamiento que antes de este
  // campo (2026-08-16) — ver priceInfoFor más abajo.
  originAirportCode?: string;
};

type FeatureGridProps = {
  heading: string;
  features: { icon: string; title: string; text: string }[];
};

type StatsBannerProps = {
  stats: { value: string; label: string }[];
};

type TestimonialsProps = {
  heading: string;
  testimonials: { quote: string; name: string; location: string }[];
};

type FAQAccordionProps = {
  heading: string;
  items: { question: string; answer: string }[];
};

type CTABannerProps = {
  heading: string;
  subheading: string;
  ctaLabel: string;
  ctaHref: string;
};

type DestinationGridProps = {
  heading: string;
  destinationIds: { destinationId: string }[];
};

type BudgetTierGridProps = {
  heading: string;
  originAirportCode: string;
};

type TripTypeGridProps = {
  heading: string;
  originAirportCode: string;
};

type ImageTextSplitProps = {
  imageQuery: string;
  heading: string;
  text: string;
  ctaLabel: string;
  ctaHref: string;
  imagePosition: "left" | "right";
};

type ExperienceGalleryProps = {
  destinationId: string;
};

export type Props = {
  Hero: HeroProps;
  Heading: HeadingProps;
  TextBlock: TextBlockProps;
  CTAButton: CTAButtonProps;
  DestinationHighlight: DestinationHighlightProps;
  BudgetTierGrid: BudgetTierGridProps;
  TripTypeGrid: TripTypeGridProps;
  FeatureGrid: FeatureGridProps;
  StatsBanner: StatsBannerProps;
  Testimonials: TestimonialsProps;
  FAQAccordion: FAQAccordionProps;
  CTABanner: CTABannerProps;
  DestinationGrid: DestinationGridProps;
  ImageTextSplit: ImageTextSplitProps;
  ExperienceGallery: ExperienceGalleryProps;
};

export const config: Config<Props> = {
  root: {
    fields: {
      title: { type: "text" },
    },
    defaultProps: { title: "Untitled page" },
    render: ({ children }) => <div>{children}</div>,
  },
  components: {
    Hero: {
      fields: {
        heading: { type: "text" },
        subheading: { type: "textarea" },
        ctaLabel: { type: "text" },
        ctaHref: { type: "text" },
        backgroundImageQuery: { type: "text" },
        backgroundImageUrl: { type: "text" },
      },
      defaultProps: {
        heading: "Find the best trip you can take on your budget.",
        subheading: "Flight, hotel, and activities — not just a flight price.",
        ctaLabel: "Start planning",
        ctaHref: "/",
        backgroundImageQuery: "",
        backgroundImageUrl: "",
      },
      render: ({ heading, subheading, ctaLabel, ctaHref, backgroundImageQuery, backgroundImageUrl }) => {
        const bg = backgroundImageQuery || undefined;
        // Una foto fijada a mano gana siempre — ver el comentario en
        // HeroProps.backgroundImageUrl.
        const imgSrc = backgroundImageUrl || (bg ? imageProxyUrl(bg, heading || bg) : undefined);
        const hasImage = Boolean(imgSrc);
        return (
          <section
            className={`relative flex flex-col items-center gap-6 overflow-hidden px-6 text-center ${
              hasImage ? "py-28 sm:py-40" : "py-20"
            }`}
          >
            {imgSrc && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- viene del proxy de imágenes propio, o de una URL fijada a mano */}
                <img
                  src={imgSrc}
                  alt=""
                  width="1200"
                  height="800"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                {/* Degradado oscuro de abajo hacia arriba — más fuerte donde va el texto,
                    para que el h1/subheading sean legibles sobre cualquier foto sin
                    necesitar curar el punto de contraste de cada imagen a mano. */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/55 to-black/20" />
              </>
            )}
            <h1
              className={`relative max-w-2xl text-4xl font-semibold text-balance sm:text-5xl ${
                hasImage ? "text-white" : "text-ink"
              }`}
            >
              {heading}
            </h1>
            <p className={`relative max-w-xl text-lg ${hasImage ? "text-white/85" : "text-muted"}`}>{subheading}</p>
            <a
              href={ctaHref}
              className="relative inline-flex items-center justify-center rounded-md bg-accent px-6 py-3 text-base font-medium text-accent-ink hover:opacity-90"
            >
              {ctaLabel}
            </a>
          </section>
        );
      },
    },
    Heading: {
      fields: {
        text: { type: "text" },
        level: {
          type: "select",
          options: [
            { label: "H1", value: "h1" },
            { label: "H2", value: "h2" },
            { label: "H3", value: "h3" },
          ],
        },
      },
      defaultProps: { text: "Heading", level: "h2" },
      // mx-auto + max-w-3xl (2026-08-11, bug real reportado por el usuario:
      // texto pegado al header, sin centrar, sin separación entre bloques)
      // — mismo ancho de columna de lectura que TextBlock/DestinationHighlight
      // de acá abajo, para que un heading y el párrafo que le sigue queden
      // alineados al mismo borde en vez de cada bloque de Puck usando su
      // propio ancho ad-hoc. Más margen arriba que abajo a propósito: separa
      // del bloque anterior sin alejarse de su propio párrafo siguiente.
      render: ({ text, level }) => {
        const Tag = level;
        return <Tag className="mx-auto mt-10 max-w-3xl px-6 text-2xl font-semibold text-balance text-ink">{text}</Tag>;
      },
    },
    TextBlock: {
      fields: {
        text: { type: "textarea" },
      },
      defaultProps: { text: "Write something here." },
      render: ({ text }) => <p className="mx-auto mt-4 max-w-3xl px-6 text-base leading-relaxed text-muted">{text}</p>,
    },
    CTAButton: {
      fields: {
        label: { type: "text" },
        href: { type: "text" },
        variant: {
          type: "select",
          options: [
            { label: "Primary", value: "primary" },
            { label: "Secondary", value: "secondary" },
          ],
        },
      },
      defaultProps: { label: "Learn more", href: "/", variant: "primary" },
      render: ({ label, href, variant }) => (
        <a
          href={href}
          className={
            variant === "primary"
              ? "inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:opacity-90"
              : "inline-flex items-center justify-center rounded-md border border-rule px-4 py-2 text-sm font-medium text-ink hover:bg-surface"
          }
        >
          {label}
        </a>
      ),
    },
    DestinationHighlight: {
      fields: {
        destinationId: { type: "select", options: destinationOptions },
        slot: {
          type: "select",
          options: [
            { label: "None (just show value score)", value: "" },
            { label: "Popular right now", value: "popular" },
            { label: "Best value pick", value: "recommended" },
            { label: "Dream trip (splurge)", value: "dream" },
          ],
        },
        // Origin airport (2026-08-16) — sin esto no hay forma de saber qué
        // ruta usar para el precio: esta misma card se puede usar en
        // páginas armadas desde cualquier origen. Dejar en "" (default)
        // no muestra ningún precio — compatible con las páginas ya
        // armadas antes de este campo, que van a seguir viéndose igual
        // hasta que alguien elija un origen a propósito.
        originAirportCode: { type: "select", options: priceOriginOptions },
      },
      defaultProps: { destinationId: destinations[0]?.id ?? "", slot: "", originAirportCode: "" },
      // Antes max-w-md (448px) apilado en columna — se veía como una card
      // de celular perdida en medio de una página de escritorio (2026-08-11,
      // bug real reportado por el usuario, con capturas). Ahora ocupa toda
      // la columna de lectura (max-w-3xl, igual que Heading/TextBlock) y es
      // horizontal en desktop (imagen a la izquierda, ficha a la derecha) —
      // mismo patrón ya probado en la card de ejemplo de la Home.
      render: ({ destinationId, slot, originAirportCode }) => {
        const destination = destinations.find((d) => d.id === destinationId);
        if (!destination) return <p className="mx-auto mt-4 max-w-3xl px-6 text-sm text-muted">Destination not found.</p>;

        // El badge y el score que se muestran dependen de POR QUÉ este
        // destino está acá — mostrar siempre "Value score" (valueRating)
        // sin importar el motivo real de la elección es lo que generaba la
        // confusión: un destino elegido por ser el más lujoso (luxuryScore)
        // mostraba un "Value score" bajo, como si fuera un error.
        const SLOT_INFO: Record<string, { badge: string; scoreLabel: string; score: number }> = {
          popular: { badge: "🔥 Popular right now", scoreLabel: "Popularity score", score: destination.popularityScore },
          recommended: { badge: "✅ Best value pick", scoreLabel: "Value score", score: destination.valueRating },
          dream: { badge: "✨ Dream trip (splurge)", scoreLabel: "Luxury score", score: destination.luxuryScore },
        };
        const info = slot ? SLOT_INFO[slot] : undefined;
        const priceInfo = originAirportCode ? priceInfoFor(destinationId, originAirportCode) : null;

        return (
          <div className="mx-auto mt-6 max-w-3xl px-6">
            <a
              href={`/p/${destination.id}`}
              className="flex flex-col overflow-hidden rounded-lg border border-rule bg-surface transition-shadow hover:shadow-md sm:flex-row"
            >
              <img
                src={imageProxyUrl(destination.imageQuery, destination.name)}
                alt={destination.name}
                width="320"
                height="220"
                className="h-48 w-full shrink-0 object-cover sm:h-auto sm:w-72"
              />
              <div className="flex flex-col justify-center gap-2 p-5">
                {info && (
                  <span className="w-fit rounded-full bg-highlight/10 px-2 py-0.5 text-xs font-medium text-highlight">
                    {info.badge}
                  </span>
                )}
                <h3 className="text-lg font-semibold text-ink">
                  {destination.name}, {destination.country}
                </h3>
                {priceInfo && (
                  <div className="flex flex-col gap-1 rounded-md bg-bg p-3">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink">
                      <span>
                        ✈️ ~${priceInfo.flightCostUSD.toLocaleString()} round trip · {formatFlightDuration(priceInfo.flightDurationMinutes)}
                      </span>
                      <span>🏨 ~${priceInfo.hotelPerNightUSD}/night</span>
                      <span>🎟️ ~${priceInfo.activityPerDayUSD}/day</span>
                    </div>
                    <p className="text-sm font-semibold text-ink">
                      Estimated {DEFAULT_TRIP_DAYS}-night trip for {DEFAULT_ADULTS}: ~${priceInfo.estimatedTripTotalUSD.toLocaleString()}
                    </p>
                  </div>
                )}
                <p className="text-sm text-muted">{destination.insiderNotes}</p>
                <p className="text-xs uppercase tracking-wide text-highlight">
                  {info ? info.scoreLabel : "Value score"}: {info ? info.score : destination.valueRating}/100
                </p>
                {priceInfo && (
                  <p className="text-[11px] text-muted">
                    Estimate based on our own curated cost data, not a live quote.
                  </p>
                )}
              </div>
            </a>
          </div>
        );
      },
    },
    // "You have $X — where can you go?" (2026-08-16, feedback del head:
    // agrupar por presupuesto responde mejor la intención real de
    // búsqueda — "best trips from Cancun on a budget" — que una lista de
    // "destinos populares" sin más contexto). getBudgetTiers reusa el
    // mismo estimateTripTotalUSD que DestinationHighlight, así que un
    // destino no puede aparecer acá con un total distinto al de su propia
    // card más arriba en la misma página.
    BudgetTierGrid: {
      fields: {
        heading: { type: "text" },
        originAirportCode: { type: "select", options: ORIGIN_OPTIONS },
      },
      defaultProps: { heading: "Where can you travel on a budget?", originAirportCode: ORIGIN_OPTIONS[0]?.value ?? "" },
      render: ({ heading, originAirportCode }) => {
        if (!originAirportCode) return <></>;
        const snapshots = generateAllPriceSnapshots(destinations);
        const tiers = getBudgetTiers(originAirportCode as (typeof ORIGIN_OPTIONS)[number]["value"], destinations, snapshots);
        if (tiers.length === 0) return <></>;

        return (
          <div className="mx-auto mt-10 max-w-3xl px-6">
            <h2 className="text-2xl font-semibold text-ink">{heading}</h2>
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {tiers.map((tier) => (
                <div key={tier.label} className="rounded-lg border border-rule bg-surface p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-highlight">{tier.label}</h3>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {tier.destinations.map((d) => (
                      <li key={d.destinationId}>
                        <a href={`/p/${d.destinationId}`} className="flex items-center justify-between gap-2 text-sm text-ink hover:text-accent">
                          <span className="truncate">{d.name}</span>
                          <span className="shrink-0 text-muted">~${d.estimatedTotalUSD.toLocaleString()}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">
              Estimated {DEFAULT_TRIP_DAYS}-night trip for {DEFAULT_ADULTS} — flight, hotel, and activities combined. Estimate based
              on our own curated cost data, not a live quote.
            </p>
          </div>
        );
      },
    },
    // "Best destinations by trip type" (2026-08-16, feedback del head,
    // punto 11) — cada destino ya trae `tags` reales (beach/culture/
    // family/etc, ver types.ts), así que esto agrupa un campo que ya
    // existe en vez de armar una taxonomía nueva. El más barato de los
    // que tienen ese tag y son alcanzables desde el origen, no "el más
    // popular" — coherente con la propuesta de valor del sitio.
    TripTypeGrid: {
      fields: {
        heading: { type: "text" },
        originAirportCode: { type: "select", options: ORIGIN_OPTIONS },
      },
      defaultProps: { heading: "Best destinations by trip type", originAirportCode: ORIGIN_OPTIONS[0]?.value ?? "" },
      render: ({ heading, originAirportCode }) => {
        if (!originAirportCode) return <></>;
        const snapshots = generateAllPriceSnapshots(destinations);
        const picks = getDestinationsByTag(originAirportCode as (typeof ORIGIN_OPTIONS)[number]["value"], destinations, snapshots);
        if (picks.length === 0) return <></>;

        return (
          <div className="mx-auto mt-10 max-w-3xl px-6">
            <h2 className="text-2xl font-semibold text-ink">{heading}</h2>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {picks.map((p) => (
                <a
                  key={p.tag}
                  href={`/p/${p.destinationId}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-rule bg-surface p-4 transition-shadow hover:shadow-md"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-highlight">{p.tagLabel}</p>
                    <p className="truncate text-sm font-semibold text-ink">
                      {p.name}, {p.country}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm text-muted">~${p.estimatedTotalUSD.toLocaleString()}</span>
                </a>
              ))}
            </div>
          </div>
        );
      },
    },
    // Fotos reales de las experiencias destacadas del destino (2026-08-11,
    // a pedido del usuario tras ver las páginas de destino: "les falta
    // ilustrar el destino"). Tira horizontal con scroll nativo (scroll-snap
    // CSS), no un carrusel con JS con flechas/estado — mismo principio de
    // "0 <script>" en páginas públicas que ya usa FAQAccordion (<details>
    // nativo en vez de useState). Cada foto sale de signatureExperiences,
    // no de un campo nuevo curado a mano — 48 destinos × hasta 3 fotos
    // habría sido demasiado para curar una por una.
    ExperienceGallery: {
      fields: {
        destinationId: { type: "select", options: destinationOptions },
      },
      defaultProps: { destinationId: destinations[0]?.id ?? "" },
      render: ({ destinationId }) => {
        const destination = destinations.find((d) => d.id === destinationId);
        if (!destination || destination.signatureExperiences.length === 0) return <></>;
        const photos = destination.signatureExperiences.slice(0, 3).map((experience) => ({
          caption: experience,
          // Sin el paréntesis aclaratorio ("(the world's 2nd largest)") —
          // ruido para una búsqueda de imagen, útil solo como texto.
          query: experience.replace(/\s*\([^)]*\)/g, "").trim(),
        }));
        return (
          <div className="mx-auto mt-6 max-w-3xl px-6">
            <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
              {photos.map((photo, i) => (
                <figure key={i} className="w-64 shrink-0 snap-start">
                  <img
                    src={imageProxyUrl(photo.query, destination.name)}
                    alt={photo.caption}
                    width="320"
                    height="220"
                    loading="lazy"
                    className="h-44 w-full rounded-lg object-cover"
                  />
                  <figcaption className="mt-1.5 text-xs text-muted">{photo.caption}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        );
      },
    },
    FeatureGrid: {
      fields: {
        heading: { type: "text" },
        features: {
          type: "array",
          arrayFields: {
            icon: { type: "text" },
            title: { type: "text" },
            text: { type: "textarea" },
          },
          getItemSummary: (item) => item.title || "Feature",
          defaultItemProps: { icon: "✈️", title: "Feature title", text: "Short description of the feature." },
          max: 6,
        },
      },
      defaultProps: {
        heading: "Why AriTrips",
        features: [
          { icon: "💰", title: "Budget-first", text: "Tell us what you can spend — we show you what actually fits." },
          { icon: "📦", title: "Full package", text: "Flight, hotel, and activities in one price, not just a flight." },
          { icon: "🔗", title: "Real booking links", text: "We link straight to real partners — no new accounts, no middleman." },
        ],
      },
      render: ({ heading, features }) => (
        <section className="flex flex-col items-center gap-8 px-6 py-14 text-center">
          <h2 className="text-2xl font-semibold text-ink">{heading}</h2>
          <div className="grid w-full max-w-4xl grid-cols-1 gap-6 sm:grid-cols-3">
            {features.map((f, i) => (
              <div key={i} className="flex flex-col items-center gap-2 rounded-lg border border-rule bg-surface p-6">
                <span className="text-3xl" aria-hidden="true">{f.icon}</span>
                <h3 className="text-base font-semibold text-ink">{f.title}</h3>
                <p className="text-sm text-muted">{f.text}</p>
              </div>
            ))}
          </div>
        </section>
      ),
    },
    StatsBanner: {
      fields: {
        stats: {
          type: "array",
          arrayFields: {
            value: { type: "text" },
            label: { type: "text" },
          },
          getItemSummary: (item) => item.value || "Stat",
          defaultItemProps: { value: "40", label: "destinations" },
          max: 4,
        },
      },
      defaultProps: {
        stats: [
          { value: "40", label: "destinations" },
          { value: "24", label: "cities you can fly from" },
        ],
      },
      render: ({ stats }) => (
        <section className="relative overflow-hidden bg-brand-blue-mid px-6 py-12 text-white">
          <div className="relative mx-auto flex max-w-4xl flex-wrap justify-center gap-x-12 gap-y-6 text-center">
            {stats.map((s, i) => (
              <div key={i}>
                <p className="text-4xl font-semibold">{s.value}</p>
                <p className="text-sm text-white/80">{s.label}</p>
              </div>
            ))}
          </div>
        </section>
      ),
    },
    Testimonials: {
      fields: {
        heading: { type: "text" },
        testimonials: {
          type: "array",
          arrayFields: {
            quote: { type: "textarea" },
            name: { type: "text" },
            location: { type: "text" },
          },
          getItemSummary: (item) => item.name || "Testimonial",
          defaultItemProps: { quote: "This is what they said.", name: "Traveler name", location: "City" },
          max: 6,
        },
      },
      defaultProps: {
        heading: "What travelers say",
        testimonials: [
          { quote: "Found a trip I actually could afford, in minutes.", name: "A traveler", location: "Dallas, TX" },
        ],
      },
      render: ({ heading, testimonials }) => (
        <section className="flex flex-col items-center gap-8 px-6 py-14 text-center">
          <h2 className="text-2xl font-semibold text-ink">{heading}</h2>
          <div className="grid w-full max-w-4xl grid-cols-1 gap-6 sm:grid-cols-3">
            {testimonials.map((t, i) => (
              <figure key={i} className="flex flex-col gap-3 rounded-lg border border-rule bg-surface p-6 text-left">
                <blockquote className="text-sm text-ink">&ldquo;{t.quote}&rdquo;</blockquote>
                <figcaption className="text-xs text-muted">
                  <span className="font-medium text-ink">{t.name}</span>
                  {t.location && <> · {t.location}</>}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ),
    },
    FAQAccordion: {
      fields: {
        heading: { type: "text" },
        items: {
          type: "array",
          arrayFields: {
            question: { type: "text" },
            answer: { type: "textarea" },
          },
          getItemSummary: (item) => item.question || "Question",
          defaultItemProps: { question: "New question", answer: "Answer goes here." },
          max: 12,
        },
      },
      defaultProps: {
        heading: "Frequently asked questions",
        items: [
          {
            question: "Are the prices real-time quotes?",
            answer: "They're estimates based on our own curated data, not live prices — the real price on the partner site may be higher or lower.",
          },
        ],
      },
      render: ({ heading, items }) => (
        <section className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 py-14">
          <h2 className="text-center text-2xl font-semibold text-ink">{heading}</h2>
          <div className="flex flex-col divide-y divide-rule rounded-lg border border-rule bg-surface">
            {items.map((item, i) => (
              <details key={i} className="group p-4">
                <summary className="cursor-pointer list-none text-sm font-medium text-ink marker:content-none">
                  <span className="flex items-center justify-between gap-2">
                    {item.question}
                    <span className="text-muted transition-transform group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="mt-2 text-sm text-muted">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      ),
    },
    CTABanner: {
      fields: {
        heading: { type: "text" },
        subheading: { type: "textarea" },
        ctaLabel: { type: "text" },
        ctaHref: { type: "text" },
      },
      defaultProps: {
        heading: "Ready to find your trip?",
        subheading: "Tell us your budget and we'll show you what fits.",
        ctaLabel: "Start planning",
        ctaHref: "/",
      },
      render: ({ heading, subheading, ctaLabel, ctaHref }) => (
        <section className="flex flex-col items-center gap-4 bg-highlight px-6 py-14 text-center text-highlight-ink">
          <h2 className="max-w-xl text-2xl font-semibold text-balance">{heading}</h2>
          <p className="max-w-md text-sm opacity-90">{subheading}</p>
          <a
            href={ctaHref}
            className="inline-flex items-center justify-center rounded-md bg-surface px-6 py-3 text-base font-medium text-ink hover:opacity-90"
          >
            {ctaLabel}
          </a>
        </section>
      ),
    },
    DestinationGrid: {
      fields: {
        heading: { type: "text" },
        destinationIds: {
          type: "array",
          arrayFields: {
            destinationId: { type: "select", options: destinationOptions },
          },
          getItemSummary: (item) => destinations.find((d) => d.id === item.destinationId)?.name ?? "Destination",
          defaultItemProps: { destinationId: destinations[0]?.id ?? "" },
          max: 6,
        },
      },
      defaultProps: {
        heading: "Destinations to consider",
        destinationIds: [{ destinationId: destinations[0]?.id ?? "" }, { destinationId: destinations[1]?.id ?? "" }, { destinationId: destinations[2]?.id ?? "" }],
      },
      render: ({ heading, destinationIds }) => (
        <section className="flex flex-col items-center gap-8 px-6 py-14 text-center">
          <h2 className="text-2xl font-semibold text-ink">{heading}</h2>
          <div className="grid w-full max-w-4xl grid-cols-1 gap-6 sm:grid-cols-3">
            {destinationIds
              .map((d) => destinations.find((dest) => dest.id === d.destinationId))
              .filter((d): d is NonNullable<typeof d> => Boolean(d))
              .map((destination) => (
                <a
                  key={destination.id}
                  href={`/p/${destination.id}`}
                  className="flex flex-col overflow-hidden rounded-lg border border-rule bg-surface text-left transition-shadow hover:shadow-md"
                >
                  <img
                    src={imageProxyUrl(destination.imageQuery, destination.name)}
                    alt={destination.name}
                    width="400"
                    height="128"
                    className="h-32 w-full object-cover"
                  />
                  <div className="flex flex-col gap-1 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted">{destination.country}</p>
                    <p className="font-semibold text-ink">{destination.name}</p>
                  </div>
                </a>
              ))}
          </div>
        </section>
      ),
    },
    ImageTextSplit: {
      fields: {
        imageQuery: { type: "text" },
        heading: { type: "text" },
        text: { type: "textarea" },
        ctaLabel: { type: "text" },
        ctaHref: { type: "text" },
        imagePosition: {
          type: "select",
          options: [
            { label: "Image on left", value: "left" },
            { label: "Image on right", value: "right" },
          ],
        },
      },
      defaultProps: {
        imageQuery: "travel destination beach sunset",
        heading: "Section heading",
        text: "Write a paragraph about this here.",
        ctaLabel: "Learn more",
        ctaHref: "/",
        imagePosition: "left",
      },
      render: ({ imageQuery, heading, text, ctaLabel, ctaHref, imagePosition }) => (
        <section
          className={`mx-auto flex w-full max-w-4xl flex-col items-center gap-8 px-6 py-14 sm:flex-row ${
            imagePosition === "right" ? "sm:flex-row-reverse" : ""
          }`}
        >
          <img
            src={imageProxyUrl(imageQuery, heading)}
            alt={heading}
            width="640"
            height="320"
            className="h-64 w-full flex-1 rounded-lg object-cover sm:h-80"
          />
          <div className="flex flex-1 flex-col items-start gap-3 text-left">
            <h2 className="text-2xl font-semibold text-ink">{heading}</h2>
            <p className="text-base text-muted">{text}</p>
            {ctaLabel && (
              <a
                href={ctaHref}
                className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:opacity-90"
              >
                {ctaLabel}
              </a>
            )}
          </div>
        </section>
      ),
    },
  },
};

export default config;
