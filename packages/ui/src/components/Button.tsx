import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary";

type ButtonAsButton = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  href?: undefined;
};

type ButtonAsAnchor = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: Variant;
  href: string;
};

type ButtonProps = ButtonAsButton | ButtonAsAnchor;

const base =
  "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
  "disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:opacity-90",
  secondary: "border border-rule text-ink hover:bg-surface",
};

/** Botón compartido — si recibe `href` se renderiza como link (uso estático en Astro, sin necesitar hidratación). */
export function Button({ variant = "primary", className = "", href, ...props }: ButtonProps) {
  const classes = `${base} ${variants[variant]} ${className}`;
  if (href !== undefined) {
    return <a href={href} className={classes} {...(props as AnchorHTMLAttributes<HTMLAnchorElement>)} />;
  }
  return <button className={classes} {...(props as ButtonHTMLAttributes<HTMLButtonElement>)} />;
}
