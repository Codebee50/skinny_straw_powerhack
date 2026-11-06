// Mirrors backend/app/schemas/advanced.py (/api/advanced/*). Keep in sync.

import type { Year, ZoneInfo } from "./types";

export interface AdvancedMeta {
  source: string;
  period: string;
}

// ---- /flow/trend ----

export interface FlowDay {
  date: string;
  /** Daily average flow, MW. Positive = southbound, negative = northbound. */
  flow_mw: number | null;
  /** Trailing 30-day mean, MW (null until 30 days exist). */
  rolling_30d: number | null;
}

export interface FlowMonth {
  month: string;
  year: Year;
  avg_flow_mw: number | null;
  days: number;
}

export interface DayValue {
  date: string;
  flow_mw: number | null;
}

export interface FlowYear {
  year: Year;
  avg_flow_mw: number | null;
  days: number;
  southbound_days: number;
  northbound_days: number;
  zero_days: number;
  share_southbound: number;
  share_northbound: number;
  /** Most northbound (lowest) day */
  min_day: DayValue;
  /** Most southbound (highest) day */
  max_day: DayValue;
}

export interface FlowTrendResponse extends AdvancedMeta {
  interface: string;
  unit: "MW";
  sign_convention: string;
  daily: FlowDay[];
  monthly: FlowMonth[];
  yearly: FlowYear[];
}

// ---- /flow/correlation ----

export type CorrelationLevel = "daily" | "hourly";
export type Strength = "very weak" | "weak" | "moderate" | "strong" | "not enough data";

export interface JoinStats {
  flow_rows: number;
  congestion_rows: number;
  matched: number;
  dropped_flow: number;
  dropped_congestion: number;
}

/** congestion = slope × flow + intercept */
export interface Fit {
  slope: number | null;
  slope_per_100mw: number | null;
  intercept: number | null;
}

export interface FlowPoint {
  time: string;
  flow_mw: number | null;
  congestion: number | null;
}

export interface YearCorrelation {
  year: Year;
  pearson: number | null;
  spearman: number | null;
  n: number;
  strength: Strength;
}

export interface ZoneCorrelation extends ZoneInfo {
  n: number;
  pearson: number | null;
  spearman: number | null;
  strength: Strength;
  fit: Fit;
  /** True when points are a random sample (hourly: max 3,000, fixed seed) */
  sampled: boolean;
  points: FlowPoint[];
  per_year: YearCorrelation[];
}

export interface CorrelationResponse extends AdvancedMeta {
  level: CorrelationLevel;
  join: JoinStats;
  zones: ZoneCorrelation[];
  reading: string;
  data_notes: string[];
}

// ---- /map ----

export type MapMetric = "congestion" | "lbmp";

export interface MapZone extends ZoneInfo {
  representative_city: string;
  latitude: number;
  longitude: number;
  /** Hour-weighted average over the period, $/MWh */
  value: number | null;
}

export interface MapResponse extends AdvancedMeta {
  year: Year | null;
  metric: MapMetric;
  column: string;
  unit: "$/MWh";
  zones: MapZone[];
  min: number | null;
  max: number | null;
  data_notes: string[];
}

// ---- /summary ----

export interface CorrelationSummary {
  zone: string;
  label: string;
  pearson: number | null;
  spearman: number | null;
  strength: Strength;
  n: number;
}

export interface AdvancedSummaryResponse extends AdvancedMeta {
  yearly_flow: FlowYear[];
  correlations: CorrelationSummary[];
  findings: string[];
  cannot_conclude: string[];
  data_notes: string[];
}
