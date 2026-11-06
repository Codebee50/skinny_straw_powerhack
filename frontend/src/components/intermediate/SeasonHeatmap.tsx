"use client";

import { useState } from "react";
import { getSeasonal } from "@/lib/api-intermediate";
import type { SeasonalResponse } from "@/lib/types-intermediate";
import { fmtUsd } from "../minimum/format";
import { ChartCard, Segmented } from "../minimum/ui";
import { SectionBody, SectionTakeaway, YEAR_OPTIONS, caption, toYear, useApi, type YearOption } from "./shared";

// Diverging scale: warm (red) arm = congestion RAISED the price (negative), cool (blue) arm = lowered it.
// Neutral gray midpoint. Darker = larger magnitude. Text flips to white on the two darkest steps.
const NEUTRAL = "#f0efec";
const RAISED = ["#f7e1db", "#efb6a8", "#e3876f", "#c95840", "#9c3321"];
const LOWERED = ["#dde8f7", "#b4cdef", "#82aae2", "#4c84d0", "#2b5fae"];

function cellColor(v: number | null, maxAbs: number): { bg: string; fg: string } {
  if (v === null) return { bg: "transparent", fg: "#75756e" };
  const t = maxAbs > 0 ? Math.abs(v) / maxAbs : 0;
  if (t < 0.02) return { bg: NEUTRAL, fg: "#18181a" };
  const step = Math.min(4, Math.floor(t * 5));
  const ramp = v < 0 ? RAISED : LOWERED;
  return { bg: ramp[step], fg: step >= 3 ? "#ffffff" : "#18181a" };
}

function takeaway(data: SeasonalResponse): string {
  const raised = data.zones
    .map((z, col) => {
      const values = data.rows.map((r, row) => ({ season: r.season, v: data.matrix[row][col] }));
      const worst = values.filter((x) => x.v !== null).sort((a, b) => a.v! - b.v!)[0];
      return { zone: z, worst };
    })
    .filter((x) => x.worst && x.worst.v! < 0);
  if (!raised.length) return "Congestion lowered prices in every zone and season.";
  const counts = new Map<string, number>();
  raised.forEach((x) => counts.set(x.worst.season, (counts.get(x.worst.season) ?? 0) + 1));
  const [topSeason, n] = [...counts].sort((a, b) => b[1] - a[1])[0];
  const darkest = raised.sort((a, b) => a.worst.v! - b.worst.v!)[0];
  return (
    `${topSeason} is the worst season for ${n} of the ${raised.length} zones where congestion raised prices. ` +
    `Darkest cell: ${darkest.zone.label} in ${darkest.worst.season} (${fmtUsd(darkest.worst.v!)}/MWh).`
  );
}

export function SeasonHeatmap() {
  const [year, setYear] = useState<YearOption>("all");
  const state = useApi(`seasonal:${year}`, () => getSeasonal(toYear(year)));
  const data = state.data;

  return (
    <ChartCard
      title="Is congestion worse in winter or summer?"
      description={<SectionTakeaway state={state}>{takeaway}</SectionTakeaway>}
      caption={caption(data?.period)}
      controls={<Segmented label="Year" size="sm" options={YEAR_OPTIONS} value={year} onChange={setYear} />}
    >
      <SectionBody state={state} height="h-80" onReset={() => setYear("all")} resetLabel="Show all years">
        {(d) => <Heatmap data={d} />}
      </SectionBody>
    </ChartCard>
  );
}

function Heatmap({ data }: { data: SeasonalResponse }) {
  const maxAbs = Math.max(...data.matrix.flat().map((v) => Math.abs(v ?? 0)));
  return (
    <div className="px-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] table-fixed border-separate border-spacing-0.5 text-center">
          <caption className="sr-only">
            Hour-weighted average congestion cost ($/MWh) by season (rows) and zone (columns). Negative means
            congestion raised the price.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="w-24 pb-2 text-left text-sm font-medium text-text-subtle">
                Season
              </th>
              {data.zones.map((z) => (
                <th key={z.zone} scope="col" className="pb-2 align-bottom text-sm font-medium text-text-muted">
                  <span className="block text-base font-semibold text-text">{z.zone_letter}</span>
                  <span className="block leading-tight">{z.label.split(" · ")[1]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, r) => (
              <tr key={row.season}>
                <th scope="row" className="pr-3 text-left font-medium text-text">
                  {row.season}
                </th>
                {data.matrix[r].map((v, c) => {
                  const { bg, fg } = cellColor(v, maxAbs);
                  return (
                    <td
                      key={data.zones[c].zone}
                      title={`${data.zones[c].label}, ${row.season}: ${v === null ? "no data" : `${fmtUsd(v)}/MWh`}`}
                      className="h-14 rounded-md font-mono text-sm font-medium tabular-nums"
                      style={{ background: bg, color: fg }}
                    >
                      {v === null ? "–" : fmtUsd(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Legend maxAbs={maxAbs} />
      <p data-helper className="pt-2 text-sm text-text-muted">{data.note} Values are $/MWh, hour-weighted across months.</p>
      {data.data_notes.length > 0 && <p className="pt-1 text-sm text-text-subtle">Data note: {data.data_notes.join(" ")}</p>}
    </div>
  );
}

function Legend({ maxAbs }: { maxAbs: number }) {
  const swatches = [...[...RAISED].reverse(), NEUTRAL, ...LOWERED];
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-text-muted">
      <span>← Congestion raised the price ({fmtUsd(-maxAbs)})</span>
      <span className="flex overflow-hidden rounded" aria-hidden>
        {swatches.map((c, i) => (
          <span key={i} className="h-4 w-6" style={{ background: c }} />
        ))}
      </span>
      <span>Lowered it ({fmtUsd(maxAbs)}) →</span>
    </div>
  );
}
