"use client";

import { useEffect, useState, type FormEvent } from "react";
import { TextInput, Combobox, Chip } from "@aritrips/ui";
import { ORIGIN_HUBS, DEFAULT_ORIGIN_HUB, type OriginHub, type InterestTag } from "@aritrips/data";
import type { RecommendationResult } from "./ResultCard";
import { ORIGIN_OPTIONS } from "@/lib/originLabels";
import { trackEvent, newSearchId } from "@/lib/trackEvent";
import { useSearch } from "./SearchContext";
import {
  BeachIcon,
  AdventureIcon,
  CultureIcon,
  NightlifeIcon,
  FamilyIcon,
  HoneymoonIcon,
  PlaneIcon,
  CalendarIcon,
  PersonIcon,
  ChildIcon,
  WalletIcon,
  SparkleIcon,
} from "@/components/Icons";
import type { ComponentType, SVGProps } from "react";

// Google Flights limita a 9 pasajeros por búsqueda; KAYAK permite hasta 9
// adultos + 7 niños — referencia real de la industria, no un número
// arbitrario (investigado 2026-08-07 a pedido del usuario).
const MAX_ADULTS = 9;
const MAX_CHILDREN = 8;

function clampedNumberInput(raw: string, max: number): string {
  if (raw === "") return raw;
  const n = Number(raw);
  if (Number.isNaN(n)) return raw;
  return n > max ? String(max) : raw;
}

// Local date, not UTC — un date picker que use toISOString() puede
// mostrar "ayer" como mínimo cerca de medianoche para husos horarios
// negativos (América).
function getTodayISODate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// 6 opciones, no 8 (2026-08-09) — "Food" se fusionó en "Culture" y
// "Nature" en "Adventure" (mucho solapamiento para el usuario final);
// 6 chips entran en una sola línea del formulario en vez de partirse.
const INTEREST_OPTIONS: { value: InterestTag; label: string; icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { value: "beach", label: "Beach", icon: BeachIcon },
  { value: "adventure", label: "Adventure", icon: AdventureIcon },
  { value: "culture", label: "Culture", icon: CultureIcon },
  { value: "nightlife", label: "Nightlife", icon: NightlifeIcon },
  { value: "family", label: "Family", icon: FamilyIcon },
  { value: "honeymoon", label: "Honeymoon", icon: HoneymoonIcon },
];

type FormState = {
  originAirportCode: OriginHub;
  budgetUSD: string;
  startDate: string;
  endDate: string;
  adults: string;
  children: string;
  interests: InterestTag[];
};

const initialState: FormState = {
  originAirportCode: DEFAULT_ORIGIN_HUB,
  budgetUSD: "",
  startDate: "",
  endDate: "",
  adults: "1",
  children: "0",
  interests: [],
};

export function SearchForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const { status, setSearchState } = useSearch();
  const todayISODate = getTodayISODate();

  // Origen por defecto: ya no siempre Dallas. Prioridad: 1) ?origin=XXX en
  // la URL (viene de los links "Find your trip" de las páginas por ciudad
  // en apps/www, ej. best-trips-from-atlanta linkea con ?origin=ATL) — si
  // está, ni siquiera hace falta geo-detectar. 2) si no hay override,
  // reusa la misma detección por IP que ya usa /api/discover (gratis, sin
  // permiso del navegador). Si ninguna de las dos aplica, se queda con
  // DEFAULT_ORIGIN_HUB del estado inicial.
  //
  // ?budget=XXX (2026-08-16, feedback del head, punto 9) — mismo criterio
  // que origin: si viene en la URL (ej. desde un CTA de las hub pages tipo
  // "Find trips under $750"), precarga el campo en vez de que el usuario
  // tenga que re-tipear un número que ya dijo en la página de SEO. Set
  // aparte del de origin porque no depende de si hubo geo-detección o no.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const budgetParam = Number(params.get("budget"));
    if (Number.isFinite(budgetParam) && budgetParam > 0) {
      setForm((f) => ({ ...f, budgetUSD: String(Math.round(budgetParam)) }));
    }

    const originParam = params.get("origin");
    if (originParam && (ORIGIN_HUBS as readonly string[]).includes(originParam)) {
      setForm((f) => ({ ...f, originAirportCode: originParam as OriginHub }));
      return;
    }
    fetch("/api/discover")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { originAirportCode: OriginHub }) => {
        setForm((f) => ({ ...f, originAirportCode: data.originAirportCode }));
      })
      .catch(() => {
        // sin señal de geo — se queda con DEFAULT_ORIGIN_HUB, no es un error visible
      });
  }, []);

  function toggleInterest(tag: InterestTag) {
    setForm((f) => ({
      ...f,
      interests: f.interests.includes(tag) ? f.interests.filter((t) => t !== tag) : [...f.interests, tag],
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const budgetUSD = Number(form.budgetUSD);
    const adults = Number(form.adults);
    const children = Number(form.children || "0");

    if (!form.startDate || !form.endDate) {
      setError("Pick your travel dates.");
      return;
    }
    if (new Date(form.endDate) <= new Date(form.startDate)) {
      setError("Return date must be after the departure date.");
      return;
    }
    if (!budgetUSD || budgetUSD <= 0) {
      setError("Enter a budget greater than $0.");
      return;
    }
    if (!adults || adults < 1) {
      setError("At least 1 adult is required.");
      return;
    }
    if (adults > MAX_ADULTS) {
      setError(`Max ${MAX_ADULTS} adults per search.`);
      return;
    }
    if (children > MAX_CHILDREN) {
      setError(`Max ${MAX_CHILDREN} children per search.`);
      return;
    }
    if (form.interests.length === 0) {
      setError("Pick at least one interest.");
      return;
    }

    setSearchState({ status: "loading" });
    const currentSearchId = newSearchId();
    trackEvent({
      name: "search_performed",
      searchId: currentSearchId,
      originAirportCode: form.originAirportCode,
      budgetUSD,
      startDate: form.startDate,
      endDate: form.endDate,
    });
    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originAirportCode: form.originAirportCode,
          budgetUSD,
          startDate: form.startDate,
          endDate: form.endDate,
          adults,
          children,
          interests: form.interests,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      const data: { recommendations: RecommendationResult[] } = await res.json();
      for (const r of data.recommendations) {
        trackEvent({
          name: "recommendation_shown",
          searchId: currentSearchId,
          destinationId: r.destinationId,
          rank: r.rank,
          finalScore: r.finalScore,
          subScores: r.subScores,
        });
      }
      setSearchState({
        status: "done",
        results: data.recommendations,
        tripContext: { originAirportCode: form.originAirportCode, startDate: form.startDate, endDate: form.endDate, adults },
        searchId: currentSearchId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSearchState({ status: "error" });
    }
  }

  return (
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-xl flex-col gap-5 rounded-lg border border-rule bg-surface p-6 lg:mx-auto lg:w-fit lg:max-w-none"
      >
        {/* En mobile este bloque queda igual que siempre (flex-col, cada
            grupo apilado) — a pedido explícito del usuario (2026-08-13),
            solo el layout de desktop cambia a una sola fila. El truco es
            `lg:contents` en los dos wrappers grid: a partir de `lg` dejan
            de comportarse como grid y sus hijos pasan a ser ítems directos
            del flex-row de afuera, sin tocar ninguna clase de mobile. El
            `<form>` usa `lg:w-fit` para que el card se achique a lo que
            realmente ocupan los campos, sin aire de sobra a la derecha. */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:gap-4">
          <div className="lg:w-44">
            <Combobox
              label="Flying from"
              icon={<PlaneIcon className="h-4 w-4 text-highlight" />}
              name="origin"
              placeholder="Type a city or airport code..."
              value={form.originAirportCode}
              onChange={(value) => setForm((f) => ({ ...f, originAirportCode: value as OriginHub }))}
              options={ORIGIN_OPTIONS}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:contents">
            <div className="lg:w-36">
              <TextInput
                label="Departure date"
                icon={<CalendarIcon className="h-4 w-4 text-highlight" />}
                name="startDate"
                type="date"
                min={todayISODate}
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div className="lg:w-36">
              <TextInput
                label="Return date"
                icon={<CalendarIcon className="h-4 w-4 text-highlight" />}
                name="endDate"
                type="date"
                min={form.startDate || todayISODate}
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 sm:gap-4 lg:contents">
            <div className="lg:w-20">
              <TextInput
                label="Adults"
                icon={<PersonIcon className="h-4 w-4 text-highlight" />}
                name="adults"
                type="number"
                min={1}
                max={MAX_ADULTS}
                value={form.adults}
                onChange={(e) => setForm((f) => ({ ...f, adults: clampedNumberInput(e.target.value, MAX_ADULTS) }))}
              />
            </div>
            <div className="lg:w-20">
              <TextInput
                label="Children"
                icon={<ChildIcon className="h-4 w-4 text-highlight" />}
                name="children"
                type="number"
                min={0}
                max={MAX_CHILDREN}
                value={form.children}
                onChange={(e) => setForm((f) => ({ ...f, children: clampedNumberInput(e.target.value, MAX_CHILDREN) }))}
              />
            </div>
            <div className="col-span-2 lg:w-32 lg:col-span-1">
              <TextInput
                label="Budget (USD)"
                icon={<WalletIcon className="h-4 w-4 text-highlight" />}
                name="budget"
                type="number"
                min={0}
                placeholder="2000"
                value={form.budgetUSD}
                onChange={(e) => setForm((f) => ({ ...f, budgetUSD: e.target.value }))}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
            <SparkleIcon className="h-4 w-4 text-highlight" />
            What are you looking for?
          </span>
          {INTEREST_OPTIONS.map((opt) => (
            <Chip key={opt.value} pressed={form.interests.includes(opt.value)} onClick={() => toggleInterest(opt.value)}>
              <opt.icon className="h-4 w-4" />
              {opt.label}
            </Chip>
          ))}
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        {/* Botón nativo, no <Button> compartido — necesita ser un pill
            (rounded-full) y no estirarse a todo el ancho del card, y el
            `base` de Button ya trae rounded-md + no tiene self-center;
            pisar esas dos por className corre el riesgo de que Tailwind
            genere el CSS en un orden donde no gane la clase que se quiere
            (mismo problema documentado con bg-highlight vs bg-accent). */}
        <button
          type="submit"
          disabled={status === "loading"}
          className="inline-flex w-fit shrink-0 items-center justify-center gap-2 self-center rounded-full bg-highlight px-10 py-2.5 text-sm font-semibold text-highlight-ink transition-colors hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
        >
          {status === "loading" ? "Searching..." : "Find my trip"}
          {status !== "loading" && (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M5 12h14" />
              <path d="m13 6 6 6-6 6" />
            </svg>
          )}
        </button>
      </form>
  );
}
