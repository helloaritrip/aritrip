import type { InterestTag } from "@aritrips/data";
import { BeachIcon, AdventureIcon, CultureIcon, NightlifeIcon, FamilyIcon, HoneymoonIcon } from "@/components/Icons";
import type { ComponentType, SVGProps } from "react";

export type { InterestTag };

// Extraído de SearchForm.tsx (2026-08-26) para que /account pueda mostrar
// los mismos 6 chips sin duplicar la lista — 6, no 8 (2026-08-09): "Food"
// se fusionó en "Culture" y "Nature" en "Adventure" (mucho solapamiento
// para el usuario final).
export const INTEREST_OPTIONS: { value: InterestTag; label: string; icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { value: "beach", label: "Beach", icon: BeachIcon },
  { value: "adventure", label: "Adventure", icon: AdventureIcon },
  { value: "culture", label: "Culture", icon: CultureIcon },
  { value: "nightlife", label: "Nightlife", icon: NightlifeIcon },
  { value: "family", label: "Family", icon: FamilyIcon },
  { value: "honeymoon", label: "Honeymoon", icon: HoneymoonIcon },
];

export const INTEREST_VALUES: InterestTag[] = INTEREST_OPTIONS.map((o) => o.value);

// Forma del perfil guardado (2026-08-26) — compartida entre
// /api/profile/route.ts, SearchForm.tsx y /account/page.tsx. Vive acá y no
// en el route handler para que un client component pueda importarla sin
// acoplarse a un archivo de servidor.
export type SavedProfile = {
  originAirportCode?: string;
  budgetUSD?: number;
  interests?: InterestTag[];
};
