"use client";

import { DATA_SOURCE } from "@/lib/api";
import { getIntermediateSummary } from "@/lib/api-intermediate";
import { FindingsPanel, LimitsPanel } from "../minimum/Panels";
import { EventSection } from "./EventSection";
import { HourlySection } from "./HourlySection";
import { SeasonHeatmap } from "./SeasonHeatmap";
import { SectionBody, useApi } from "./shared";
import { TrendSection } from "./TrendSection";
import { WeekdayWeekendSection } from "./WeekdayWeekendSection";
import { WorstDaysSection } from "./WorstDaysSection";

const PERIOD = "Jan 2023 – Dec 2025";

export function IntermediateDashboard() {
  const summary = useApi("summary", () => getIntermediateSummary());
  const topZones = summary.data?.top_zones.map((z) => z.zone) ?? null;
  const period = summary.data?.period ?? PERIOD;

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <p className="text-sm font-medium tracking-wide text-text-subtle uppercase">Intermediate level · When</p>
        <h1 className="mt-2 text-4xl leading-tight font-semibold tracking-tight text-balance">
          When does congestion hit New York hardest?
        </h1>
        <p className="mt-3 text-lg text-text-muted">
          Showing <span className="font-medium text-text tabular-nums">{period}</span> · Source: {DATA_SOURCE}
        </p>
        {summary.data && (
          <p className="mt-2 text-text-muted">
            Trends focus on the three zones with the heaviest congestion overall:{" "}
            <span className="font-medium text-text">{summary.data.top_zones.map((z) => z.label).join(", ")}</span>.
            Negative values mean congestion raised the price.
          </p>
        )}
      </header>

      <TrendSection />
      <SeasonHeatmap />
      <HourlySection />
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <WeekdayWeekendSection />
        <WorstDaysSection />
      </div>
      <EventSection topZones={topZones} />

      <SectionBody state={summary} height="h-64">
        {(s) => (
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <FindingsPanel findings={s.findings} />
            <LimitsPanel items={s.cannot_conclude} notes={s.data_notes} />
          </div>
        )}
      </SectionBody>

      <footer className="border-t border-border pt-4 text-sm text-text-subtle">
        <p>
          Source: {DATA_SOURCE}. Period shown: {period} (the Spotlight covers 1–7 Feb 2023). Averages across months are
          weighted by hours in each month; daily views use daily averages. Hours are local time, hour beginning.
          Congestion sign convention: negative = congestion raised the zone&apos;s price.
        </p>
      </footer>
    </div>
  );
}
