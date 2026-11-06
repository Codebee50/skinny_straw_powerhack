import { apiGet } from "./api";
import type { Year } from "./types";
import type {
  EventResponse,
  ExtremeDaysResponse,
  Granularity,
  HourlyResponse,
  IntermediateSummaryResponse,
  SeasonalResponse,
  TimeseriesResponse,
  WeekdayWeekendResponse,
} from "./types-intermediate";
import type { ZoneColumn } from "./zones";

/** Build "/api/intermediate/<endpoint>?a=1&b=2", dropping null/undefined params. */
function path(endpoint: string, params: Record<string, string | number | null | undefined> = {}): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined) qs.set(k, String(v));
  const q = qs.toString();
  return `/api/intermediate/${endpoint}${q ? `?${q}` : ""}`;
}

export const getTimeseries = (granularity: Granularity) =>
  // Monthly is the API default: omit it so the request matches the default snapshot exactly.
  apiGet<TimeseriesResponse>(path("timeseries", { granularity: granularity === "monthly" ? null : granularity }));

export const getSeasonal = (year: Year | null) => apiGet<SeasonalResponse>(path("seasonal", { year }));

export const getHourly = (zone: ZoneColumn, year: Year | null) =>
  apiGet<HourlyResponse>(path("hourly", { zone, year, months: "1,7" }));

export const getWeekdayWeekend = (year: Year | null) =>
  apiGet<WeekdayWeekendResponse>(path("weekday-weekend", { year }));

export const getExtremeDays = (zone: ZoneColumn, n = 10) =>
  apiGet<ExtremeDaysResponse>(path("extreme-days", { zone, n }));

export const getEvent = () => apiGet<EventResponse>(path("event"));

export const getIntermediateSummary = (year: Year | null = null) =>
  apiGet<IntermediateSummaryResponse>(path("summary", { year }));
