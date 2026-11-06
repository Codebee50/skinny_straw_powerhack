import type { MapMetric, MapResponse, MapZone } from "@/lib/types-advanced";
import { fmtUsd } from "../minimum/format";

// Diverging scale for congestion (same steps as the When-page heatmap):
// warm = congestion RAISED the price (negative), cool = lowered it (positive), gray = no effect.
export const NEUTRAL = "#e4e3de";
export const RAISED = ["#f3cfc6", "#e9a08e", "#dc7259", "#c24a33", "#9c3321"];
export const LOWERED = ["#cfdff4", "#a3c2eb", "#729fdd", "#4a7fcb", "#2b5fae"];
// Sequential single hue for price (LBMP): light = cheaper, dark = more expensive.
export const PRICE = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95"];

const MIN_R = 7;
const MAX_R = 22;

export interface ZoneStyle {
  fill: string;
  /** Text color for the zone letter on top of the fill */
  text: string;
  /** Radius in px (area ∝ magnitude) */
  radius: number;
}

export function makeScale(data: Pick<MapResponse, "zones" | "metric" | "min" | "max">) {
  const values = data.zones.map((z) => z.value).filter((v): v is number => v !== null);
  const maxAbs = Math.max(...values.map(Math.abs), 1e-9);
  const lo = Math.min(...values);
  const hi = Math.max(...values);

  function style(v: number | null): ZoneStyle {
    if (v === null) return { fill: NEUTRAL, text: "#18181a", radius: MIN_R };
    if (data.metric === "congestion") {
      const t = Math.abs(v) / maxAbs;
      const radius = MIN_R + (MAX_R - MIN_R) * Math.sqrt(t);
      if (t < 0.02) return { fill: NEUTRAL, text: "#18181a", radius };
      const step = Math.min(4, Math.floor(t * 5));
      return { fill: (v < 0 ? RAISED : LOWERED)[step], text: step >= 3 ? "#ffffff" : "#18181a", radius };
    }
    const t = hi > lo ? (v - lo) / (hi - lo) : 1;
    const step = Math.min(PRICE.length - 1, Math.floor(t * PRICE.length));
    return { fill: PRICE[step], text: step >= 3 ? "#ffffff" : "#18181a", radius: MIN_R + (MAX_R - MIN_R) * Math.sqrt(v / hi) };
  }

  return { style, maxAbs, lo, hi };
}

/** Draw bigger circles first so smaller ones stay visible on top. */
export const drawOrder = (zones: MapZone[], scale: ReturnType<typeof makeScale>) =>
  [...zones].sort((a, b) => scale.style(b.value).radius - scale.style(a.value).radius);

export const metricLabel = (m: MapMetric) => (m === "congestion" ? "Avg congestion cost" : "Avg price (LBMP)");

export function describeValue(z: MapZone, metric: MapMetric): string {
  if (z.value === null) return "No data";
  if (metric === "lbmp") return `${fmtUsd(z.value)}/MWh average price`;
  if (z.value < 0) return `${fmtUsd(z.value)}/MWh: congestion raised the price`;
  if (z.value > 0) return `${fmtUsd(z.value)}/MWh: congestion lowered the price`;
  return "$0.00/MWh: no congestion effect";
}

/** New York State, a little padded: [[south, west], [north, east]]. */
export const NY_BOUNDS: [[number, number], [number, number]] = [
  [40.45, -79.9],
  [45.05, -71.8],
];
export const NY_CENTER: [number, number] = [42.9, -75.5];
