"use client";

import { DATA_SOURCE } from "@/lib/api";
import { getAdvancedSummary } from "@/lib/api-advanced";
import { SectionBody, useApi } from "../intermediate/shared";
import { FindingsPanel, LimitsPanel } from "../minimum/Panels";
import { CorrelationSection } from "./CorrelationSection";
import { FlowSection } from "./FlowSection";
import { ZoneMapCard } from "./ZoneMapCard";

const PERIOD = "Jan 2023 – Dec 2025";

export function AdvancedDashboard() {
  const summary = useApi("advanced-summary", () => getAdvancedSummary());
  const period = summary.data?.period ?? PERIOD;

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <p className="text-sm font-medium tracking-wide text-text-subtle uppercase">Advanced level · Moses South</p>
        <h1 className="mt-2 text-4xl leading-tight font-semibold tracking-tight text-balance">
          Does power flowing south from the North Country move with congestion?
        </h1>
        <p className="mt-3 text-lg text-text-muted">
          Showing <span className="font-medium text-text tabular-nums">{period}</span> · Source: {DATA_SOURCE}
        </p>
        <p className="mt-3 text-text-muted">
          <span className="font-medium text-text">Moses South</span> is a NYISO interface in northern New York: the
          set of lines that carries power between the North Country and the rest of the state. NYPA&apos;s Smart Path
          Connect project upgrades lines in this corridor, but Moses South carries <em>all</em> southbound North
          Country flow, not only that project&apos;s. Positive flow = southbound, negative = northbound.
        </p>
      </header>

      <ZoneMapCard />
      <FlowSection />
      <CorrelationSection />

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
          Source: {DATA_SOURCE}. Period shown: {period}. Flow is in MW (the source column is named avg_flow_mwh);
          positive = southbound. Congestion is in $/MWh; negative = congestion raised the zone&apos;s price. Hourly
          joins drop unmatched hours rather than filling them. Correlation is not causation.
        </p>
      </footer>
    </div>
  );
}
