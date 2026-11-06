"use client";

import { useEffect, useState } from "react";
import { ApiError, DATA_SOURCE, getMinimumData } from "@/lib/api";
import { YEARS, type MinimumData, type Year } from "@/lib/types";
import { FindingsPanel, LimitsPanel } from "./Panels";
import { PriceCongestionScatter } from "./PriceCongestionScatter";
import { StatCards, StatCardsSkeleton } from "./StatCards";
import { ChartCard, Segmented, Skeleton } from "./ui";
import { ZoneBarChart } from "./ZoneBarChart";
import { ZoneMapCard } from "../advanced/ZoneMapCard";

type YearOption = "all" | Year;
const YEAR_OPTIONS: { value: YearOption; label: string }[] = [
  { value: "all", label: "All" },
  ...YEARS.map((y) => ({ value: y, label: String(y) })),
];

const ALL_PERIOD = "Jan 2023 – Dec 2025";

type State =
  | { status: "loading"; data: MinimumData | null }
  | { status: "error"; message: string; data: MinimumData | null }
  | { status: "ok"; data: MinimumData };

export function MinimumDashboard() {
  const [year, setYear] = useState<YearOption>("all");
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State>({ status: "loading", data: null });

  useEffect(() => {
    let cancelled = false;
    getMinimumData(year === "all" ? null : year)
      .then((data) => !cancelled && setState({ status: "ok", data }))
      .catch(
        (err) =>
          !cancelled &&
          setState((prev) => ({
            status: "error",
            message: err instanceof ApiError ? err.message : String(err),
            data: prev.data,
          })),
      );
    return () => {
      cancelled = true;
    };
  }, [year, attempt]);

  const changeYear = (y: YearOption) => {
    if (y === year) return;
    setState((prev) => ({ status: "loading", data: prev.data }));
    setYear(y);
  };
  const retry = () => {
    setState((prev) => ({ status: "loading", data: prev.data }));
    setAttempt((n) => n + 1);
  };

  const data = state.status === "error" ? null : state.data;
  const period = data?.summary.period ?? (year === "all" ? ALL_PERIOD : `Jan ${year} – Dec ${year}`);
  const caption = `Source: ${DATA_SOURCE} · Period shown: ${period}`;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-3xl">
          <p className="text-sm font-medium tracking-wide text-text-subtle uppercase">Minimum level · Where</p>
          <h1 className="mt-2 text-4xl leading-tight font-semibold tracking-tight text-balance">
            Where does grid congestion raise electricity prices in New York?
          </h1>
          <p className="mt-3 text-lg text-text-muted">
            Showing <span className="font-medium text-text tabular-nums">{period}</span> · Source: {DATA_SOURCE}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span aria-live="polite" className="text-sm text-text-subtle">
            {state.status === "loading" && data ? "Updating…" : ""}
          </span>
          <Segmented label="Year" options={YEAR_OPTIONS} value={year} onChange={changeYear} />
        </div>
      </header>

      {/* Overview map: the Advanced-level map component, self-contained; follows this page's year filter. */}
      <ZoneMapCard year={year} title="Overview: where congestion raises prices" height={380} />

      {state.status === "error" ? (
        <ErrorState message={state.message} onRetry={retry} />
      ) : !data ? (
        <LoadingState />
      ) : (
        <div
          aria-busy={state.status === "loading"}
          className={`space-y-8 transition-opacity duration-200 ${state.status === "loading" ? "opacity-60" : ""}`}
        >
          <StatCards summary={data.summary} />

          <ChartCard
            title="Price vs. congestion, every zone and month"
            description="Points left of zero are months where congestion pushed the zone's price up. Prices sit higher the further left you go."
            caption={caption}
          >
            <PriceCongestionScatter data={data.scatter} />
          </ChartCard>

          <div className="grid gap-6 lg:grid-cols-2">
            <ZoneBarChart
              title="Average price by zone"
              description="Hour-weighted average LBMP. Top 3 most expensive highlighted."
              axisTitle="Average price, LBMP ($/MWh)"
              byZone={data.lbmp.by_zone}
              byRank={data.lbmp.by_rank}
              caption={caption}
            />
            <ZoneBarChart
              title="Average congestion cost by zone"
              description="Hour-weighted. Bars left of 0: congestion raised the price. Top 3 heaviest highlighted."
              axisTitle="Average congestion cost ($/MWh)"
              byZone={data.congestion.by_zone}
              byRank={data.congestion.by_rank}
              caption={caption}
              note="Negative = congestion raised the price"
            />
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-2">
            <FindingsPanel findings={data.summary.findings} />
            <LimitsPanel items={data.summary.cannot_conclude} notes={data.summary.data_notes} />
          </div>
        </div>
      )}

      <footer className="border-t border-border pt-4 text-sm text-text-subtle">
        <p>
          Source: {DATA_SOURCE}. Period shown: {period}. Averages across months are weighted by hours in each month.
          Congestion sign convention: negative = congestion raised the zone&apos;s price.
        </p>
      </footer>
    </div>
  );
}

function LoadingState() {
  return (
    <div aria-busy="true" aria-label="Loading charts" className="space-y-8">
      <StatCardsSkeleton />
      <Skeleton className="h-[38rem] w-full rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[34rem] rounded-xl" />
        <Skeleton className="h-[34rem] rounded-xl" />
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-border bg-surface p-8">
      <h2 className="text-xl font-semibold">The charts can&apos;t load because the data API isn&apos;t responding</h2>
      <p className="mt-2 text-text-muted">{message}</p>
      <p className="mt-1 text-text-muted">
        Start it from the repo root with <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-sm">npm run backend</code>,
        then try again.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 h-11 rounded-lg bg-accent px-5 font-medium text-accent-fg transition-transform duration-150 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 active:scale-[0.98]"
      >
        Retry loading data
      </button>
    </div>
  );
}
