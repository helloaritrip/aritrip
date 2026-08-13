/**
 * Set de íconos de línea, inline SVG (2026-08-13) — sin librería de íconos
 * nueva ni PNGs sueltos: son pocos, chicos, y se necesitan en varios
 * colores/tamaños (nav, chips de interés, fila de confianza), así que un
 * componente por ícono que herede `currentColor` es más simple que
 * gestionar assets. Trazo 1.75, redondeado, mismo lenguaje visual liviano
 * en los diez.
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function BriefcaseIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M3 12h18" />
    </svg>
  );
}

export function TagIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 11.5V5a2 2 0 0 1 2-2h6.5a2 2 0 0 1 1.42.59l8 8a2 2 0 0 1 0 2.82l-6.59 6.59a2 2 0 0 1-2.82 0l-8-8A2 2 0 0 1 3 11.5Z" />
      <circle cx="8" cy="8" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function MapIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M9 4 3 6.5v13L9 17l6 3 6-2.5v-13L15 7 9 4Z" />
      <path d="M9 4v13" />
      <path d="M15 7v13" />
    </svg>
  );
}

export function GlobeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z" />
    </svg>
  );
}

export function BeachIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M2 21c3-1.5 6-1.5 9 0 3-1.5 6-1.5 9 0" />
      <path d="M12 3c0 6-4 8-9 8 1-5 4-8 9-8Z" />
      <path d="M12 3c0 6 4 8 9 8-1-5-4-8-9-8Z" />
      <path d="M12 3v14" />
    </svg>
  );
}

export function AdventureIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m4 20 6-11 3 5 2-3 5 9Z" />
      <path d="m11 20 2-9 2 3" />
    </svg>
  );
}

export function CultureIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 21h16" />
      <path d="M5 21V10M9 21V10M15 21V10M19 21V10" />
      <path d="m3 10 9-6 9 6Z" />
    </svg>
  );
}

export function NightlifeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 4h14l-7 9-7-9Z" />
      <path d="M12 13v7" />
      <path d="M8 20h8" />
    </svg>
  );
}

export function FamilyIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="8.5" cy="7" r="2.75" />
      <circle cx="16" cy="8" r="2.25" />
      <path d="M2.5 20c0-3.5 2.5-5.5 6-5.5s6 2 6 5.5" />
      <path d="M14.5 14.7c2.5.4 4 2.1 4 5.3" />
    </svg>
  );
}

export function HoneymoonIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 20s-7-4.4-9.5-8.8C.9 8 2.4 4.5 5.8 4.1c1.9-.2 3.6.8 4.7 2.4a.6.6 0 0 0 1 0c1.1-1.6 2.8-2.6 4.7-2.4 3.4.4 4.9 3.9 3.3 7.1C19 15.6 12 20 12 20Z" />
    </svg>
  );
}

export function CompassIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m14.5 9.5-2 5-3 1.5 2-5 3-1.5Z" />
    </svg>
  );
}

export function ShieldCheckIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function DollarCircleIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10" />
      <path d="M14.5 9.5c0-1.1-1.1-2-2.5-2s-2.5.9-2.5 2c0 3 5 1.5 5 4.5 0 1.1-1.1 2-2.5 2s-2.5-.9-2.5-2" />
    </svg>
  );
}

export function WorldIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 9h18M3 15h18" />
      <path d="M12 3a16 16 0 0 1 3.5 9A16 16 0 0 1 12 21a16 16 0 0 1-3.5-9A16 16 0 0 1 12 3Z" />
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function PlaneIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 19 21 12 3.5 5l1.5 6.2L15 12l-10 .8Z" />
    </svg>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  );
}

export function PersonIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c0-4 3-6.5 7.5-6.5s7.5 2.5 7.5 6.5" />
    </svg>
  );
}

export function ChildIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="6" r="2.5" />
      <path d="M12 8.5v6M8 12l4-1.5 4 1.5M9 20l3-5.5 3 5.5" />
    </svg>
  );
}

export function WalletIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
      <path d="M16 12h3" />
      <path d="M3 9h18" />
    </svg>
  );
}

export function SparkleIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M11 2v4M11 16v4M2 11h4M16 11h4" />
      <path d="m5.5 5.5 2 2M14.5 14.5l2 2M5.5 16.5l2-2M14.5 7.5l2-2" />
    </svg>
  );
}
