"use client";

import { useEffect, useEffectEvent, useState, type ReactNode } from "react";
import { ApiError, DATA_SOURCE, NeedsLiveDataError } from "@/lib/api";
import { YEARS, type Year } from "@/lib/types";
import { ZONES, type ZoneColumn } from "@/lib/zones";
import { InfoIcon, Skeleton } from "../minimum/ui";

// ---- colors -------------------------------------------------------------------

/**
 * Fixed series identity for the default top-3 zones (first three validated categorical slots).
 * Each also gets its own dash pattern so lines are distinguishable without color.
 */
export const ZONE_SERIES: Partial<Record<ZoneColumn, { color: string; dash?: string }>> = {
  K_long_island: { color: "#2a78d6" },
  J_new_york_city: { color: "#eb6834", dash: "8 4" },
  F_capital: { color: "#1baf7a", dash: "2 3" },
};
export const OTHER_ZONE = { color: "#8f8f87", dash: undefined };
export const seriesFor = (zone: ZoneColumn) => ZONE_SERIES[zone] ?? OTHER_ZONE;

/** Two-series comparisons (Jan vs Jul, weekday vs weekend). */
export const PAIR = {
  a: { color: "#2a78d6", dash: undefined },
  b: { color: "#eb6834", dash: "8 4" },
} as const;

// ---- data loading -------------------------------------------------------------

export interface ApiState<T> {
  data: T | null;
  error: Error | null;
  /** True while a request for the current key is in flight (previous data stays visible until it fails). */
  loading: boolean;
  retry: () => void;
}

/** Fetch `load()` whenever `key` changes. Keeps the previous data on screen while reloading. */
export function useApi<T>(key: string, load: () => Promise<T>): ApiState<T> {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ key: string | null; data: T | null; error: Error | null }>({
    key: null,
    data: null,
    error: null,
  });
  const requestKey = `${key}#${attempt}`;
  const run = useEffectEvent(() => load());

  useEffect(() => {
    let cancelled = false;
    run()
      .then((data) => !cancelled && setState({ key: requestKey, data, error: null }))
      .catch(
        (error: unknown) =>
          !cancelled &&
          setState((prev) => ({
            key: requestKey,
            data: prev.data,
            error: error instanceof Error ? error : new Error(String(error)),
          })),
      );
    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  const failed = state.key === requestKey && state.error !== null;
  return {
    // Never show the previous selection's data next to a failed request for the new one.
    data: failed ? null : state.data,
    error: failed ? state.error : null,
    loading: state.key !== requestKey,
    retry: () => setAttempt((n) => n + 1),
  };
}

/** Renders loading / error / needs-live states around a section's chart. */
export function SectionBody<T>({
  state,
  height,
  onReset,
  resetLabel,
  children,
}: {
  state: ApiState<T>;
  /** Tailwind height class for the skeleton, e.g. "h-96" */
  height: string;
  onReset?: () => void;
  resetLabel?: string;
  children: (data: T) => ReactNode;
}) {
  const { data, error, loading, retry } = state;

  if (error instanceof NeedsLiveDataError) {
    return (
      <div className={`flex ${height} flex-col items-start justify-center gap-3 rounded-lg bg-surface-2 px-6`}>
        <p className="flex items-center gap-2 font-semibold">
          <InfoIcon className="size-5 text-text-muted" />
          This selection needs live data
        </p>
        <p className="max-w-[60ch] text-text-muted">
          The data API isn&apos;t responding, and the saved offline snapshot only covers the default view.
        </p>
        <div className="flex gap-2">
          {onReset && (
            <button type="button" onClick={onReset} className={primaryButton}>
              {resetLabel ?? "Show default view"}
            </button>
          )}
          <button type="button" onClick={retry} className={secondaryButton}>
            Try live data again
          </button>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div role="alert" className={`flex ${height} flex-col items-start justify-center gap-3 rounded-lg bg-danger-subtle px-6`}>
        <p className="font-semibold text-danger">This chart couldn&apos;t load</p>
        <p className="max-w-[60ch] text-text-muted">
          {error instanceof ApiError ? error.message : String(error.message)}
        </p>
        <button type="button" onClick={retry} className={primaryButton}>
          Retry
        </button>
      </div>
    );
  }
  if (!data) return <Skeleton className={`${height} w-full`} />;
  return (
    <div aria-busy={loading} className={`transition-opacity duration-200 ${loading ? "opacity-60" : ""}`}>
      {children(data)}
    </div>
  );
}

const primaryButton =
  "h-10 rounded-lg bg-accent px-4 font-medium text-accent-fg transition-transform duration-150 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 active:scale-[0.98]";
const secondaryButton =
  "h-10 rounded-lg border border-border-strong bg-surface px-4 font-medium text-text hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

// ---- controls -----------------------------------------------------------------

export type YearOption = "all" | Year;
export const YEAR_OPTIONS: { value: YearOption; label: string }[] = [
  { value: "all", label: "All" },
  ...YEARS.map((y) => ({ value: y, label: String(y) })),
];
export const toYear = (y: YearOption): Year | null => (y === "all" ? null : y);

export function ZoneSelect({
  value,
  onChange,
  label = "Zone",
}: {
  value: ZoneColumn;
  onChange: (z: ZoneColumn) => void;
  label?: string;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm font-medium text-text-muted">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ZoneColumn)}
        className="h-10 rounded-lg border border-border-strong bg-surface px-3 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {ZONES.map((z) => (
          <option key={z.column} value={z.column}>
            {z.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// ---- text ---------------------------------------------------------------------

/** The one-line answer under each section's question. */
export function Takeaway({ children }: { children: ReactNode }) {
  return <span className="text-lg font-medium text-text">{children}</span>;
}

/** Takeaway computed from the section's data, or a status line while loading / unavailable. */
export function SectionTakeaway<T>({ state, children }: { state: ApiState<T>; children: (data: T) => string }) {
  if (state.data) return <Takeaway>{children(state.data)}</Takeaway>;
  if (state.error instanceof NeedsLiveDataError) return <span className="text-text-muted">Needs live data for this selection.</span>;
  if (state.error) return <span className="text-text-muted">Unavailable right now.</span>;
  return <span className="text-text-muted">Loading…</span>;
}

export const caption = (period: string | undefined) =>
  `Source: ${DATA_SOURCE} · Period shown: ${period ?? "Jan 2023 – Dec 2025"}`;

export const labelOf = (zone: ZoneColumn) => ZONES.find((z) => z.column === zone)?.label ?? zone;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "2025-07-01" -> "Tue 1 Jul 2025" (computed in UTC so the date never shifts). */
export function fmtDate(iso: string, withYear = true): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  const base = `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  return withYear ? `${base} ${d.getUTCFullYear()}` : base;
}

/** "2023-02" -> "Feb 2023" */
export const fmtYearMonth = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

/** Hour-beginning clock label for axis ticks: 0 -> "12 am", 15 -> "3 pm". */
export const fmtClock = (h: number) => `${h % 12 || 12} ${h < 12 ? "am" : "pm"}`;

/** Same as the backend's hour_label: 17 -> "5–6 pm". */
export function hourRange(h: number): string {
  const part = (x: number) => [String(x % 24 % 12 || 12), x % 24 < 12 ? "am" : "pm"] as const;
  const [a, ma] = part(h);
  const [b, mb] = part(h + 1);
  return ma === mb ? `${a}–${b} ${ma}` : `${a} ${ma}–${b} ${mb}`;
}

export function TooltipBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-sm shadow-[0_1px_2px_rgb(0_0_0/0.04),0_4px_12px_rgb(0_0_0/0.08)]">
      {children}
    </div>
  );
}

/** Legend swatch: a short line in the series color and dash pattern. */
export function LineSwatch({ color, dash }: { color: string; dash?: string }) {
  return (
    <svg width="24" height="10" aria-hidden className="shrink-0">
      <line x1="1" y1="5" x2="23" y2="5" stroke={color} strokeWidth="3" strokeDasharray={dash} strokeLinecap="round" />
    </svg>
  );
}
