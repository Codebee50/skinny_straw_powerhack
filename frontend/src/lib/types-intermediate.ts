// Mirrors backend/app/schemas/intermediate.py (/api/intermediate/*). Keep in sync.

import type { Season, Year, ZoneInfo } from "./types";
import type { ZoneColumn } from "./zones";

export interface IntermediateMeta {
  source: string;
  /** e.g. "Jan 2023 – Dec 2025" or "1 Feb 2023 – 7 Feb 2023" */
  period: string;
}

/** zone column name -> $/MWh (null when missing) */
export type ZoneValues = Partial<Record<ZoneColumn, number | null>>;

// ---- /timeseries ----

export type Granularity = "monthly" | "daily";

export interface TimeseriesPoint {
  /** "2023-01" (monthly) or "2023-01-31" (daily) */
  x: string;
  values: ZoneValues;
  /** Daily only: trailing 30-day mean per zone (null until 30 days exist) */
  rolling_30d: ZoneValues | null;
}

export interface WorstMonth {
  year: Year;
  month: number;
  month_label: string;
  value: number;
}

export interface TimeseriesResponse extends IntermediateMeta {
  granularity: Granularity;
  zones: ZoneInfo[];
  default_zones: boolean;
  points: TimeseriesPoint[];
  /** Per zone, the 3 most negative months, worst first */
  worst_months: Partial<Record<ZoneColumn, WorstMonth[]>>;
  data_notes: string[];
}

// ---- /seasonal ----

export interface SeasonRow {
  season: Season;
  hours: number;
  values: ZoneValues;
}

export interface SeasonalResponse extends IntermediateMeta {
  year: Year | null;
  seasons: Season[];
  zones: ZoneInfo[];
  /** rows = seasons (Winter→Fall), columns = zones (A→K) */
  matrix: (number | null)[][];
  rows: SeasonRow[];
  note: string;
  data_notes: string[];
}

// ---- /hourly ----

export interface HourPoint {
  /** Hour beginning, local time (17 = 5–6 pm) */
  hour: number;
  label: string;
  value: number | null;
}

export interface MonthProfile {
  month: number;
  month_name: string;
  years: Year[];
  points: HourPoint[];
  /** Most negative hour */
  peak: HourPoint;
}

export interface HourlyResponse extends IntermediateMeta {
  zone: ZoneInfo;
  year: Year | null;
  profiles: MonthProfile[];
}

// ---- /weekday-weekend ----

export interface WeekdayWeekendRow extends ZoneInfo {
  weekday: number;
  weekend: number;
  /** weekday − weekend; negative = weekdays more congested */
  difference: number;
  weekday_days: number;
  weekend_days: number;
}

export interface WeekdayWeekendResponse extends IntermediateMeta {
  year: Year | null;
  zones: WeekdayWeekendRow[];
}

// ---- /extreme-days ----

export interface ExtremeDay {
  date: string;
  day_of_week: string;
  is_weekend: boolean;
  year: Year;
  month: number;
  season: Season;
  value: number;
  other_zones: ZoneValues;
}

export interface CommonPatterns {
  by_season: Record<Season, number>;
  by_year: Record<string, number>;
  weekday: number;
  weekend: number;
}

export interface ExtremeDaysResponse extends IntermediateMeta {
  zone: ZoneInfo;
  year: Year | null;
  n: number;
  days: ExtremeDay[];
  common_patterns: CommonPatterns;
}

// ---- /event ----

export interface EventRow {
  /** "YYYY-MM-DD HH:MM", hour beginning, local time */
  timestamp: string;
  values: ZoneValues;
}

export interface ZoneMin {
  value: number | null;
  timestamp: string;
}

export interface EventResponse extends IntermediateMeta {
  start: string;
  end: string;
  zones: ZoneInfo[];
  rows: EventRow[];
  zone_min: Partial<Record<ZoneColumn, ZoneMin>>;
  /** Hours absent from the raw file (not filled) */
  missing_hours: string[];
  /** Spring-forward hours that don't exist in local time */
  dst_skipped_hours: string[];
}

// ---- /summary ----

export interface IntermediateSummaryResponse extends IntermediateMeta {
  year: Year | null;
  top_zones: ZoneInfo[];
  findings: string[];
  cannot_conclude: string[];
  data_notes: string[];
}
