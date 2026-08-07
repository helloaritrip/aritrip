/**
 * Compartido entre scripts/generate-hub-pages.ts (arma el nombre de
 * archivo) y la homepage (arma el link) — si esto se duplica y se
 * desincroniza, los links de "browse by city" apuntan a páginas que no
 * existen. Única fuente de verdad para el slug de una ciudad.
 */
const ACCENTS: Record<string, string> = {
  á: "a", é: "e", í: "i", ó: "o", ú: "u", ñ: "n", ü: "u",
  Á: "a", É: "e", Í: "i", Ó: "o", Ú: "u", Ñ: "n", Ü: "u",
};

export function cityName(label: string): string {
  return label.replace(/\s*\([A-Z]{3}\)$/, "");
}

export function slugify(text: string): string {
  const noAccents = Array.from(text)
    .map((ch) => ACCENTS[ch] ?? ch)
    .join("");
  return noAccents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function hubPageSlug(cityLabel: string): string {
  return `best-trips-from-${slugify(cityName(cityLabel))}`;
}
