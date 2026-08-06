import type { Config } from "@measured/puck";
import { destinations } from "@travel-package-builder/data";

// El proxy de imágenes vive en apps/app (no se duplica acá) — apuntar
// cross-origin al mismo endpoint público, sin problema de CORS para <img>.
const APP_URL = import.meta.env.PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Registro de bloques de Puck — lo que un editor de contenido (hoy, el
 * fundador) puede arrastrar para armar landing/guías/comparativas sin
 * tocar código. Usa los mismos tokens de packages/ui (clases de Tailwind
 * ya definidas), no un sistema de diseño aparte.
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

export type Props = {
  Hero: HeroProps;
  Heading: HeadingProps;
  TextBlock: TextBlockProps;
  CTAButton: CTAButtonProps;
  DestinationHighlight: DestinationHighlightProps;
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
      },
      defaultProps: {
        heading: "Find the best trip you can take on your budget.",
        subheading: "Flight, hotel, and activities — not just a flight price.",
        ctaLabel: "Start planning",
        ctaHref: "/",
      },
      render: ({ heading, subheading, ctaLabel, ctaHref }) => (
        <section className="flex flex-col items-center gap-6 px-6 py-20 text-center">
          <h1 className="max-w-2xl text-4xl font-semibold text-balance text-ink sm:text-5xl">{heading}</h1>
          <p className="max-w-xl text-lg text-muted">{subheading}</p>
          <a
            href={ctaHref}
            className="inline-flex items-center justify-center rounded-md bg-accent px-6 py-3 text-base font-medium text-accent-ink hover:opacity-90"
          >
            {ctaLabel}
          </a>
        </section>
      ),
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
              src={`${APP_URL}/api/image-proxy?q=${encodeURIComponent(destination.imageQuery)}`}
              alt={destination.name}
              className="h-48 w-full object-cover"
            />
            <div className="flex flex-col gap-2 p-5">
              <h3 className="text-lg font-semibold text-ink">
                {destination.name}, {destination.country}
              </h3>
              <p className="text-sm text-muted">{destination.insiderNotes}</p>
              <p className="text-xs uppercase tracking-wide text-accent">
                Value score: {destination.valueRating}/100
              </p>
            </div>
          </div>
        );
      },
    },
  },
};

export default config;
