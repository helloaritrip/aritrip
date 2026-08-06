import { ORIGIN_HUBS, type OriginHub } from "@travel-package-builder/data";

export const ORIGIN_LABELS: Record<OriginHub, string> = {
  JFK: "New York (JFK)",
  MIA: "Miami (MIA)",
  DFW: "Dallas (DFW)",
  LAX: "Los Angeles (LAX)",
  ORD: "Chicago (ORD)",
  YYZ: "Toronto (YYZ)",
  YVR: "Vancouver (YVR)",
  MEX: "Mexico City (MEX)",
  ATL: "Atlanta (ATL)",
  BOS: "Boston (BOS)",
  SEA: "Seattle (SEA)",
  DEN: "Denver (DEN)",
  IAH: "Houston (IAH)",
  PHX: "Phoenix (PHX)",
  SFO: "San Francisco (SFO)",
  YUL: "Montreal (YUL)",
};

export const ORIGIN_OPTIONS = ORIGIN_HUBS.map((code) => ({ value: code, label: ORIGIN_LABELS[code] }));
