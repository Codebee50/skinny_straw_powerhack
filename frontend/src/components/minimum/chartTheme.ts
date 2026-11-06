import type { CorrelationGroupName } from "@/lib/types";
import type { ZoneLetter } from "@/lib/zones";

// SVG needs concrete values; these mirror the tokens in globals.css.
export const CHART = {
  text: "#18181a",
  textMuted: "#55554f",
  textSubtle: "#75756e",
  grid: "#e4e4df",
  axis: "#cfcfc8",
  surface: "#ffffff",
  accent: "#1f4fa3",
  accentSubtle: "#e8eef9",
  /** Non-highlighted bars: recessive but ≥3:1 on white. */
  muted: "#8f8f87",
  fontSize: 14,
} as const;

export type SymbolShape = "circle" | "square" | "triangle";

/**
 * Scatter groups: first three categorical slots of the validated reference palette
 * (blue, orange, aqua pass all-pairs CVD checks). Each group also gets its own marker
 * shape so identity never relies on color alone.
 */
export const GROUPS: readonly {
  name: CorrelationGroupName;
  short: string;
  letters: readonly ZoneLetter[];
  color: string;
  shape: SymbolShape;
}[] = [
  { name: "Upstate (A–E)", short: "A–E", letters: ["A", "B", "C", "D", "E"], color: "#2a78d6", shape: "circle" },
  {
    name: "Capital & Hudson Valley (F–I)",
    short: "F–I",
    letters: ["F", "G", "H", "I"],
    color: "#eb6834",
    shape: "square",
  },
  { name: "NYC & Long Island (J–K)", short: "J–K", letters: ["J", "K"], color: "#1baf7a", shape: "triangle" },
];

export const axisTick = { fill: CHART.textMuted, fontSize: CHART.fontSize };
export const axisLabel = { fill: CHART.textMuted, fontSize: CHART.fontSize, fontWeight: 500 };
