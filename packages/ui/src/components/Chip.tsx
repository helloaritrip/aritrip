import type { ButtonHTMLAttributes } from "react";

type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  pressed: boolean;
};

export function Chip({ pressed, className = "", ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        pressed ? "border-accent bg-accent text-accent-ink" : "border-rule text-ink hover:bg-bg"
      } ${className}`}
      {...props}
    />
  );
}
