import type { InputHTMLAttributes } from "react";

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function TextInput({ label, id, name, className = "", ...props }: TextInputProps) {
  const inputId = id ?? name;
  return (
    <label htmlFor={inputId} className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-ink">{label}</span>
      <input
        id={inputId}
        name={name}
        className={`rounded-md border border-rule bg-surface px-3 py-2 text-ink placeholder:text-muted focus:outline focus:outline-2 focus:outline-accent ${className}`}
        {...props}
      />
    </label>
  );
}
