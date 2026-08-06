import type { SelectHTMLAttributes } from "react";

type SelectOption = { value: string; label: string };

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: SelectOption[];
};

export function Select({ label, id, name, options, className = "", ...props }: SelectProps) {
  const selectId = id ?? name;
  return (
    <label htmlFor={selectId} className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-ink">{label}</span>
      <select
        id={selectId}
        name={name}
        className={`rounded-md border border-rule bg-surface px-3 py-2 text-ink focus:outline focus:outline-2 focus:outline-accent ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
