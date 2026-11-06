import { apiGet } from "./api";
import type { Year } from "./types";
import type {
  AdvancedSummaryResponse,
  CorrelationLevel,
  CorrelationResponse,
  FlowTrendResponse,
  MapMetric,
  MapResponse,
} from "./types-advanced";

/** "/api/advanced/<endpoint>?a=1", dropping null/undefined params. Defaults are omitted so the
 * request matches the offline snapshot naming exactly. */
function path(endpoint: string, params: Record<string, string | number | null | undefined> = {}): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined) qs.set(k, String(v));
  const q = qs.toString();
  return `/api/advanced/${endpoint}${q ? `?${q}` : ""}`;
}

export const getFlowTrend = () => apiGet<FlowTrendResponse>(path("flow/trend"));

/** Default zones (D, F, J) are used by omitting `zones`. */
export const getFlowCorrelation = (level: CorrelationLevel) =>
  apiGet<CorrelationResponse>(path("flow/correlation", { level: level === "daily" ? null : level }));

export const getZoneMap = (year: Year | null, metric: MapMetric) =>
  apiGet<MapResponse>(path("map", { year, metric: metric === "congestion" ? null : metric }));

export const getAdvancedSummary = () => apiGet<AdvancedSummaryResponse>(path("summary"));
