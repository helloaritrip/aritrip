import type { InputHTMLAttributes, ReactNode } from "react";

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  icon?: ReactNode;
};

export function TextInput({ label, icon, id, name, className = "", ...props }: TextInputProps) {
  const inputId = id ?? name;
  return (
    <label htmlFor={inputId} className="flex flex-col gap-1.5 text-sm">
      <span className="flex items-center gap-1.5 font-medium text-ink">
        {icon}
        {label}
      </span>
      <input
        id={inputId}
        name={name}
        // text-base (16px) en mobile, no el text-sm heredado del <label> —
        // Safari en iOS hace zoom automático al enfocar un input con menos
        // de 16px, lo que se siente como que "la pantalla se descalibra y
        // se mueve" al llenar el formulario (reportado 2026-08-15). De
        // sm para arriba vuelve a 14px, mismo tamaño visual de siempre en
        // desktop — el zoom automático es un comportamiento solo mobile.
        className={`rounded-md border border-rule bg-surface px-3 py-2 text-base text-ink placeholder:text-muted focus:outline focus:outline-2 focus:outline-accent sm:text-sm ${className}`}
        {...props}
      />
    </label>
  );
}
