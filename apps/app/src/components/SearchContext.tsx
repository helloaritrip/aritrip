"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { RecommendationResult, TripContext } from "./ResultCard";

/**
 * Separa el estado de resultados del <form> mismo (2026-08-14) — antes
 * SearchForm devolvía form + lista de resultados juntos en un solo
 * componente, así que la franja de foto del hero (que envuelve al form
 * para ponerle un fondo) terminaba envolviendo también la lista de
 * resultados, y se estiraba con ella (bug real reportado por el usuario:
 * "la imagen de fondo se estira y cubre todo el fondo"). Con esto,
 * page.tsx puede poner <SearchForm /> adentro del hero (con foto) y
 * <SearchResults /> afuera (fondo normal de la página), compartiendo
 * estado por contexto en vez de por props/composición.
 */

export type SearchStatus = "idle" | "loading" | "done" | "error";

interface SearchState {
  status: SearchStatus;
  results: RecommendationResult[];
  tripContext: TripContext | null;
  searchId: string | null;
}

interface SearchContextValue extends SearchState {
  setSearchState: (update: Partial<SearchState>) => void;
}

const initialState: SearchState = { status: "idle", results: [], tripContext: null, searchId: null };

const SearchContext = createContext<SearchContextValue>({ ...initialState, setSearchState: () => {} });

export function SearchProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SearchState>(initialState);
  const setSearchState = (update: Partial<SearchState>) => setState((s) => ({ ...s, ...update }));
  return <SearchContext.Provider value={{ ...state, setSearchState }}>{children}</SearchContext.Provider>;
}

export function useSearch(): SearchContextValue {
  return useContext(SearchContext);
}
