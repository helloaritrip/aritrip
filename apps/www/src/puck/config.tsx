import type { Config } from "@measured/puck";
import { destinations } from "@aritrips/data";

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

type HeroProps = {
  heading: string;
  subheading: string;
  ctaLabel: string;
  ctaHref: string;
  backgroundImageQuery?: string;
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

type ImageTextSplitProps = {
  imageQuery: string;
  heading: string;
  text: string;
  ctaLabel: string;
  ctaHref: string;
  imagePosition: "left" | "right";
};

export type Props = {
  Hero: HeroProps;
  Heading: HeadingProps;
  TextBlock: TextBlockProps;
  CTAButton: CTAButtonProps;
  DestinationHighlight: DestinationHighlightProps;
  FeatureGrid: FeatureGridProps;
  StatsBanner: StatsBannerProps;
  Testimonials: TestimonialsProps;
  FAQAccordion: FAQAccordionProps;
  CTABanner: CTABannerProps;
  DestinationGrid: DestinationGridProps;
  ImageTextSplit: ImageTextSplitProps;
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
      },
      defaultProps: {
        heading: "Find the best trip you can take on your budget.",
        subheading: "Flight, hotel, and activities — not just a flight price.",
        ctaLabel: "Start planning",
        ctaHref: "/",
        backgroundImageQuery: "",
      },
      render: ({ heading, subheading, ctaLabel, ctaHref, backgroundImageQuery }) => {
        const bg = backgroundImageQuery || undefined;
        const hasImage = Boolean(bg);
        return (
          <section
            className={`relative flex flex-col items-center gap-6 overflow-hidden px-6 text-center ${
              hasImage ? "py-28 sm:py-40" : "py-20"
            }`}
          >
            {bg && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- viene del proxy de imágenes propio */}
                <img
                  src={imageProxyUrl(bg, bg)}
                  alt=""
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
      render: ({ text, level }) => {
        const Tag = level;
        return <Tag className="text-2xl font-semibold text-ink">{text}</Tag>;
      },
    },
    TextBlock: {
      fields: {
        text: { type: "textarea" },
      },
      defaultProps: { text: "Write something here." },
      render: ({ text }) => <p className="max-w-2xl text-base leading-relaxed text-muted">{text}</p>,
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
      },
      defaultProps: { destinationId: destinations[0]?.id ?? "" },
      render: ({ destinationId }) => {
        const destination = destinations.find((d) => d.id === destinationId);
        if (!destination) return <p className="text-sm text-muted">Destination not found.</p>;
        return (
          <div className="mx-auto flex max-w-md flex-col overflow-hidden rounded-lg border border-rule bg-surface">
            <img
              src={imageProxyUrl(destination.imageQuery, destination.name)}
              alt={destination.name}
              className="h-48 w-full object-cover"
            />
            <div className="flex flex-col gap-2 p-5">
              <h3 className="text-lg font-semibold text-ink">
                {destination.name}, {destination.country}
              </h3>
              <p className="text-sm text-muted">{destination.insiderNotes}</p>
              <p className="text-xs uppercase tracking-wide text-highlight">
                Value score: {destination.valueRating}/100
              </p>
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
                <div key={destination.id} className="flex flex-col overflow-hidden rounded-lg border border-rule bg-surface text-left">
                  <img
                    src={imageProxyUrl(destination.imageQuery, destination.name)}
                    alt={destination.name}
                    className="h-32 w-full object-cover"
                  />
                  <div className="flex flex-col gap-1 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted">{destination.country}</p>
                    <p className="font-semibold text-ink">{destination.name}</p>
                  </div>
                </div>
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
