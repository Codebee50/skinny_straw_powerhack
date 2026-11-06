// Mirrors backend/app/schemas/minimum.py (/api/minimum/*). Keep in sync.

import type { Region, ZoneColumn, ZoneLetter } from "./zones";

export type Year = 2023 | 2024 | 2025;
export const YEARS: readonly Year[] = [2023, 2024, 2025];

export interface ZoneInfo {
  zone: ZoneColumn;
  zone_letter: ZoneLetter;
  /** e.g. "J · New York City" */
  label: string;
  region: Region;
}

export interface Period {
  source: string;
  /** e.g. "Jan 2023 – Dec 2025" */
  period: string;
  /** Selected year, or null for all years */
  year: Year | null;
}

// ---- /scatter ----

export type Season = "Winter" | "Spring" | "Summer" | "Fall";

export interface ScatterPoint extends ZoneInfo {
  year: Year;
  month: number;
  season: Season;
  avg_lbmp: number;
  avg_congestion_cost: number;
}

export interface OverallCorrelation {
  r: number | null;
  n: number;
}

export type CorrelationGroupName =
  | "Upstate (A–E)"
  | "Capital & Hudson Valley (F–I)"
  | "NYC & Long Island (J–K)";

export interface GroupCorrelation {
  group: CorrelationGroupName;
  zone_letters: ZoneLetter[];
  r: number | null;
  n: number;
}

export interface Correlations {
  overall: OverallCorrelation;
  groups: GroupCorrelation[];
}

/** avg_lbmp = slope × avg_congestion_cost + intercept */
export interface LinearFit {
  x: "avg_congestion_cost";
  y: "avg_lbmp";
  slope: number | null;
  intercept: number | null;
}

export interface ScatterResponse extends Period {
  points: ScatterPoint[];
  correlations: Correlations;
  fit: LinearFit;
}

// ---- /ranking/* ----

export interface RankedZone extends ZoneInfo {
  /** Hour-weighted average, $/MWh */
  value: number;
  rank: number;
  is_top3: boolean;
}

export interface WorstMoment {
  /** Most negative single 5-minute congestion value, $/MWh */
  value: number;
  year: Year;
  month: number;
  month_label: string;
}

export interface RankedCongestionZone extends RankedZone {
  worst_moment: WorstMoment;
}

export interface LbmpRankingResponse extends Period {
  metric: "avg_lbmp";
  unit: "$/MWh";
  rank_order: string;
  /** Geographic order A→K */
  by_zone: RankedZone[];
  by_rank: RankedZone[];
}

export interface CongestionRankingResponse extends Period {
  metric: "avg_congestion_cost";
  unit: "$/MWh";
  rank_order: string;
  /** Geographic order A→K */
  by_zone: RankedCongestionZone[];
  by_rank: RankedCongestionZone[];
}

// ---- /summary ----

export interface SummaryResponse extends Period {
  top3_price: RankedZone[];
  top3_congestion: RankedCongestionZone[];
  correlations: Correlations;
  findings: string[];
  cannot_conclude: string[];
  data_notes: string[];
}

export interface MinimumData {
  scatter: ScatterResponse;
  lbmp: LbmpRankingResponse;
  congestion: CongestionRankingResponse;
  summary: SummaryResponse;
}
