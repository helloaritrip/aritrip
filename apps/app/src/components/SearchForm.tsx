"use client";

import { useState, type FormEvent } from "react";
import { TextInput, Select, Chip, Button } from "@travel-package-builder/ui";
import { ORIGIN_HUBS, type OriginHub, type InterestTag } from "@travel-package-builder/data";

const ORIGIN_LABELS: Record<OriginHub, string> = {
  JFK: "New York (JFK)",
  MIA: "Miami (MIA)",
  DFW: "Dallas (DFW)",
  LAX: "Los Angeles (LAX)",
  ORD: "Chicago (ORD)",
  YYZ: "Toronto (YYZ)",
  YVR: "Vancouver (YVR)",
  MEX: "Mexico City (MEX)",
};

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

export function SearchForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [submitted, setSubmitted] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleInterest(tag: InterestTag) {
    setForm((f) => ({
      ...f,
      interests: f.interests.includes(tag) ? f.interests.filter((t) => t !== tag) : [...f.interests, tag],
    }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const budget = Number(form.budgetUSD);
    const adults = Number(form.adults);

    if (!form.startDate || !form.endDate) {
      setError("Pick your travel dates.");
      return;
    }
    if (new Date(form.endDate) <= new Date(form.startDate)) {
      setError("Return date must be after the departure date.");
      return;
    }
    if (!budget || budget <= 0) {
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

    setSubmitted(form);
  }

  return (
    <div className="flex w-full max-w-xl flex-col gap-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-lg border border-rule bg-surface p-6">
        <Select
          label="Flying from"
          name="origin"
          value={form.originAirportCode}
          onChange={(e) => setForm((f) => ({ ...f, originAirportCode: e.target.value as OriginHub }))}
          options={ORIGIN_HUBS.map((code) => ({ value: code, label: ORIGIN_LABELS[code] }))}
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

        <div className="grid grid-cols-2 gap-4">
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

        <div className="grid grid-cols-2 gap-4">
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

        <Button type="submit">Find my trip</Button>
      </form>

      {submitted && (
        <div className="rounded-lg border border-accent bg-surface p-5 text-sm">
          <p className="mb-2 font-medium text-accent">Search captured — here&apos;s what you&apos;re planning:</p>
          <ul className="flex flex-col gap-1 text-muted">
            <li>From {ORIGIN_LABELS[submitted.originAirportCode]}</li>
            <li>Budget: ${Number(submitted.budgetUSD).toLocaleString()} total</li>
            <li>
              {submitted.startDate} → {submitted.endDate}
            </li>
            <li>
              {submitted.adults} adult{Number(submitted.adults) !== 1 ? "s" : ""}
              {Number(submitted.children) > 0 ? `, ${submitted.children} children` : ""}
            </li>
            <li>Interests: {submitted.interests.join(", ")}</li>
          </ul>
          <p className="mt-3 text-xs text-muted">
            The recommendation engine isn&apos;t built yet (Sprint 3) — this just confirms the form
            captures everything it needs to.
          </p>
        </div>
      )}
    </div>
  );
}
