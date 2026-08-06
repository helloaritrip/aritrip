"use client";

import { useState, type FormEvent } from "react";
import { TextInput, Combobox, Chip, Button } from "@travel-package-builder/ui";
import { type OriginHub, type InterestTag } from "@travel-package-builder/data";
import { ResultCard, type RecommendationResult, type TripContext } from "./ResultCard";
import { ORIGIN_OPTIONS } from "@/lib/originLabels";
import { trackEvent } from "@/lib/trackEvent";

const INTEREST_OPTIONS: { value: InterestTag; label: string }[] = [
  { value: "beach", label: "Beach" },
  { value: "adventure", label: "Adventure" },
  { value: "culture", label: "Culture" },
  { value: "nightlife", label: "Nightlife" },
  { value: "family", label: "Family" },
  { value: "honeymoon", label: "Honeymoon" },
  { value: "foodie", label: "Food" },
  { value: "nature", label: "Nature" },
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
  originAirportCode: "DFW",
  budgetUSD: "",
  startDate: "",
  endDate: "",
  adults: "2",
  children: "0",
  interests: [],
};

type SearchStatus = "idle" | "loading" | "done" | "error";

export function SearchForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [results, setResults] = useState<RecommendationResult[]>([]);
  const [tripContext, setTripContext] = useState<TripContext | null>(null);

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
    if (form.interests.length === 0) {
      setError("Pick at least one interest.");
      return;
    }

    setStatus("loading");
    trackEvent({ name: "search_performed", originAirportCode: form.originAirportCode, budgetUSD });
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
      setResults(data.recommendations);
      setTripContext({ originAirportCode: form.originAirportCode, startDate: form.startDate, endDate: form.endDate, adults });
      for (const r of data.recommendations) {
        trackEvent({ name: "recommendation_shown", destinationId: r.destinationId, rank: r.rank, finalScore: r.finalScore });
      }
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  }

  return (
    <div className="flex w-full max-w-xl flex-col gap-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-lg border border-rule bg-surface p-6">
        <Combobox
          label="Flying from"
          name="origin"
          placeholder="Type a city or airport code..."
          value={form.originAirportCode}
          onChange={(value) => setForm((f) => ({ ...f, originAirportCode: value as OriginHub }))}
          options={ORIGIN_OPTIONS}
        />

        <TextInput
          label="Total budget (USD)"
          name="budget"
          type="number"
          min={0}
          placeholder="2000"
          value={form.budgetUSD}
          onChange={(e) => setForm((f) => ({ ...f, budgetUSD: e.target.value }))}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInput
            label="Departure date"
            name="startDate"
            type="date"
            value={form.startDate}
            onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
          />
          <TextInput
            label="Return date"
            name="endDate"
            type="date"
            value={form.endDate}
            onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInput
            label="Adults"
            name="adults"
            type="number"
            min={1}
            value={form.adults}
            onChange={(e) => setForm((f) => ({ ...f, adults: e.target.value }))}
          />
          <TextInput
            label="Children"
            name="children"
            type="number"
            min={0}
            value={form.children}
            onChange={(e) => setForm((f) => ({ ...f, children: e.target.value }))}
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-ink">What are you looking for?</span>
          <div className="flex flex-wrap gap-2">
            {INTEREST_OPTIONS.map((opt) => (
              <Chip
                key={opt.value}
                pressed={form.interests.includes(opt.value)}
                onClick={() => toggleInterest(opt.value)}
              >
                {opt.label}
              </Chip>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <Button type="submit" disabled={status === "loading"}>
          {status === "loading" ? "Searching..." : "Find my trip"}
        </Button>
      </form>

      {status === "done" && results.length === 0 && (
        <div className="rounded-lg border border-rule bg-surface p-5 text-sm text-muted">
          No destinations fit that budget for those dates yet — our catalog is still growing (21 of the
          30-50 destinations planned). Try a higher budget or different dates.
        </div>
      )}

      {status === "done" && results.length > 0 && tripContext && (
        <div className="flex flex-col gap-3">
          {results.map((r) => (
            <ResultCard key={r.destinationId} result={r} tripContext={tripContext} />
          ))}
        </div>
      )}
    </div>
  );
}
