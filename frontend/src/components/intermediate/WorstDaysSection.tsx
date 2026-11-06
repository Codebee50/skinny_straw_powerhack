"use client";

import { useState } from "react";
import { getExtremeDays } from "@/lib/api-intermediate";
import type { ExtremeDaysResponse } from "@/lib/types-intermediate";
import type { ZoneColumn } from "@/lib/zones";
import { fmtUsd } from "../minimum/format";
import { ChartCard } from "../minimum/ui";
import { SectionBody, SectionTakeaway, ZoneSelect, caption, fmtDate, useApi } from "./shared";

const DEFAULT_ZONE: ZoneColumn = "J_new_york_city";

/** "7 of 10 in Winter", "8 of 10 on weekdays", "6 of 10 in 2025" */
function badges(data: ExtremeDaysResponse): string[] {
  const n = data.days.length;
  const p = data.common_patterns;
  const [season, sCount] = Object.entries(p.by_season).sort((a, b) => b[1] - a[1])[0];
  const [year, yCount] = Object.entries(p.by_year).sort((a, b) => b[1] - a[1])[0];
  const dayType = p.weekday >= p.weekend ? `${p.weekday} of ${n} on weekdays` : `${p.weekend} of ${n} on weekends`;
  return [`${sCount} of ${n} in ${season.toLowerCase()}`, dayType, `${yCount} of ${n} in ${year}`];
}

function takeaway(data: ExtremeDaysResponse): string {
  const first = data.days[0];
  if (!first) return "No days in this period.";
  const second = data.days[1];
  return (
    `${data.zone.label}'s worst day was ${fmtDate(first.date)} at ${fmtUsd(first.value)}/MWh` +
    (second ? `, ahead of ${fmtDate(second.date)} (${fmtUsd(second.value)}).` : ".")
  );
}

export function WorstDaysSection() {
  const [zone, setZone] = useState<ZoneColumn>(DEFAULT_ZONE);
  const state = useApi(`extreme:${zone}`, () => getExtremeDays(zone, 10));
  const data = state.data;
  return (
    <ChartCard
      title="The 10 worst days"
      description={<SectionTakeaway state={state}>{takeaway}</SectionTakeaway>}
      caption={caption(data?.period)}
      controls={<ZoneSelect value={zone} onChange={setZone} />}
    >
      <SectionBody state={state} height="h-[34rem]" onReset={() => setZone(DEFAULT_ZONE)} resetLabel="Show New York City">
        {(d) => <WorstDays data={d} />}
      </SectionBody>
    </ChartCard>
  );
}

function WorstDays({ data }: { data: ExtremeDaysResponse }) {
  return (
    <div className="px-3">
      <ul className="flex flex-wrap gap-2" aria-label="What these days have in common">
        {badges(data).map((b) => (
          <li key={b} className="rounded-md bg-accent-subtle px-2.5 py-1 font-medium text-accent">
            {b}
          </li>
        ))}
      </ul>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[24rem] text-left">
          <caption className="sr-only">
            The {data.n} days with the most negative average congestion in {data.zone.label}
          </caption>
          <thead>
            <tr className="border-b border-border text-sm text-text-subtle">
              <th scope="col" className="py-2 pr-3 font-medium">#</th>
              <th scope="col" className="py-2 pr-3 font-medium">Date</th>
              <th scope="col" className="py-2 pr-3 font-medium">Day type</th>
              <th scope="col" className="py-2 pr-3 font-medium">Season</th>
              <th scope="col" className="py-2 text-right font-medium whitespace-nowrap">
                Avg <span className="sr-only">congestion</span>($/MWh)
              </th>
            </tr>
          </thead>
          <tbody>
            {data.days.map((d, i) => (
              <tr key={d.date} className="border-b border-border last:border-b-0">
                <td className="py-2.5 pr-3 font-mono text-sm text-text-subtle tabular-nums">{i + 1}</td>
                <td className="py-2.5 pr-3 font-medium whitespace-nowrap text-text">{fmtDate(d.date)}</td>
                <td className="py-2.5 pr-3 text-text-muted">{d.is_weekend ? "Weekend" : "Weekday"}</td>
                <td className="py-2.5 pr-3 text-text-muted">{d.season}</td>
                <td className="py-2.5 text-right font-mono font-semibold tabular-nums text-text">{fmtUsd(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p data-helper className="pt-3 text-sm text-text-muted">
        Daily averages. Single 5-minute moments on these days were far more extreme.
      </p>
    </div>
  );
}
