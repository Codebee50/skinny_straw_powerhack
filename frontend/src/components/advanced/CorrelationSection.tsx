"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { getFlowCorrelation } from "@/lib/api-advanced";
import type { CorrelationLevel, CorrelationResponse, FlowPoint, ZoneCorrelation } from "@/lib/types-advanced";
import { CHART, axisLabel, axisTick } from "../minimum/chartTheme";
import { fmtR, fmtUsd, fmtUsdTick } from "../minimum/format";
import { ChartCard, Segmented } from "../minimum/ui";
import { SectionBody, SectionTakeaway, TooltipBox, caption, fmtDate, useApi } from "../intermediate/shared";
import { fmtMw } from "./FlowSection";

const LEVELS = [
  { value: "daily", label: "Daily" },
  { value: "hourly", label: "Hourly" },
] as const;

const DOT = CHART.accent;

function takeaway(d: CorrelationResponse): string {
  const parts = d.zones.map((z) => `${z.label.split(" · ")[1]} ${fmtR(z.pearson)} (${z.strength})`);
  const allWeak = d.zones.every((z) => z.strength === "very weak" || z.strength === "weak");
  return (
    `${allWeak ? "At most weak links" : "Links"} at the ${d.level} level: ${parts.join(", ")}. ` +
    "Moving together is not cause and effect."
  );
}

/** Round, symmetric-ish domain around the data, in steps of `step`. */
function niceDomain(values: number[], step: number): [number, number] {
  return [Math.floor(Math.min(...values) / step) * step, Math.ceil(Math.max(...values) / step) * step];
}

function percentileDomain(values: number[], lo: number, hi: number, step: number): [number, number] {
  const s = [...values].sort((a, b) => a - b);
  const q = (p: number) => s[Math.floor(p * (s.length - 1))];
  return [Math.floor(Math.min(q(lo), 0) / step) * step, Math.ceil(Math.max(q(hi), 0) / step) * step];
}

export function CorrelationSection() {
  const [level, setLevel] = useState<CorrelationLevel>("daily");
  const state = useApi(`corr:${level}`, () => getFlowCorrelation(level));
  return (
    <ChartCard
      title="Does Moses South flow move with congestion?"
      description={<SectionTakeaway state={state}>{takeaway}</SectionTakeaway>}
      caption={caption(state.data?.period)}
      controls={<Segmented label="Time resolution" size="sm" options={LEVELS} value={level} onChange={setLevel} />}
    >
      <SectionBody state={state} height="h-[28rem]" onReset={() => setLevel("daily")} resetLabel="Show daily view">
        {(d) => <Panels data={d} />}
      </SectionBody>
    </ChartCard>
  );
}

function Panels({ data }: { data: CorrelationResponse }) {
  const hourly = data.level === "hourly";
  const xDomain = useMemo(
    () => niceDomain(data.zones.flatMap((z) => z.points.map((p) => p.flow_mw ?? 0)), 500),
    [data],
  );
  return (
    <div className="px-2">
      <div className="grid gap-4 lg:grid-cols-3">
        {data.zones.map((z) => (
          <ZoneScatter key={z.zone} zone={z} xDomain={xDomain} hourly={hourly} />
        ))}
      </div>
      <div className="mt-4 space-y-1 text-sm text-text-muted">
        <p data-helper>{data.reading}</p>
        <p data-helper>
          {hourly
            ? `${data.join.matched.toLocaleString("en-US")} hours matched; ${data.join.dropped_flow} flow and ${data.join.dropped_congestion} congestion hours had no partner and were dropped, not filled. Dots are a random sample of up to 3,000 per zone; r uses every matched hour. The y-axis is clipped to the middle 98% of hours.`
            : `${data.join.matched.toLocaleString("en-US")} days matched (daily averages). Dashed line = straight-line fit.`}
        </p>
        {data.data_notes.length > 0 && <p className="text-text-subtle">Data note: {data.data_notes.join(" ")}</p>}
      </div>
      <PerYearTable zones={data.zones} level={data.level} />
    </div>
  );
}

function ZoneScatter({ zone, xDomain, hourly }: { zone: ZoneCorrelation; xDomain: [number, number]; hourly: boolean }) {
  const points = zone.points.filter((p): p is FlowPoint & { flow_mw: number; congestion: number } => p.flow_mw !== null && p.congestion !== null);
  const ys = points.map((p) => p.congestion);
  const yDomain = hourly ? percentileDomain(ys, 0.01, 0.99, 10) : percentileDomain(ys, 0, 1, 10);
  const { slope, intercept } = zone.fit;
  const fit =
    slope !== null && intercept !== null
      ? ([xDomain[0], xDomain[1]].map((x) => ({ x, y: slope * x + intercept })) as [
          { x: number; y: number },
          { x: number; y: number },
        ])
      : null;

  return (
    <figure className="min-w-0 rounded-lg border border-border p-3">
      <figcaption>
        <span className="block text-lg font-semibold tracking-tight text-text">
          {zone.label}: r = {fmtR(zone.pearson)}, {zone.strength}
        </span>
        <span className="block text-sm text-text-muted tabular-nums">
          Spearman {fmtR(zone.spearman)} · n = {zone.n.toLocaleString("en-US")}
          {zone.fit.slope_per_100mw !== null && ` · ${fmtUsd(zone.fit.slope_per_100mw)}/MWh per +100 MW`}
        </span>
      </figcaption>
      <div className="mt-2 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 8, bottom: 32, left: 4 }}>
            <CartesianGrid stroke={CHART.grid} />
            <XAxis
              type="number"
              dataKey="flow_mw"
              domain={xDomain}
              tickCount={5}
              tickFormatter={(v: number) => `${v < 0 ? "−" : ""}${Math.abs(v).toLocaleString("en-US")}`}
              tick={{ ...axisTick, fontSize: 12 }}
              stroke={CHART.axis}
              label={{ value: "Flow (MW, + = south)", position: "bottom", offset: 12, ...axisLabel, fontSize: 13 }}
            />
            <YAxis
              type="number"
              dataKey="congestion"
              domain={yDomain}
              allowDataOverflow
              tickFormatter={fmtUsdTick}
              tick={{ ...axisTick, fontSize: 12 }}
              stroke={CHART.axis}
              width={52}
              label={{ value: "Congestion ($/MWh)", angle: -90, position: "insideLeft", offset: 4, dy: 60, ...axisLabel, fontSize: 13 }}
            />
            <ReferenceLine y={0} stroke={CHART.text} strokeWidth={1} />
            <ReferenceLine x={0} stroke={CHART.axis} strokeWidth={1} />
            <Tooltip content={<PointTip hourly={hourly} />} cursor={{ strokeDasharray: "3 3" }} />
            {/* ZAxis range is dot AREA in px²: ~r 1.6 hourly, ~r 2.3 daily */}
            <ZAxis range={hourly ? [8, 8] : [16, 16]} />
            <Scatter
              data={points}
              fill={DOT}
              fillOpacity={hourly ? 0.25 : 0.35}
              shape="circle"
              isAnimationActive={false}
            />
            {fit && <ReferenceLine segment={fit} stroke={CHART.text} strokeWidth={2} strokeDasharray="6 4" ifOverflow="hidden" />}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

function PointTip({ active, payload, hourly }: { active?: boolean; payload?: readonly { payload?: unknown }[]; hourly: boolean }) {
  const p = payload?.[0]?.payload as FlowPoint | undefined;
  if (!active || !p) return null;
  return (
    <TooltipBox>
      <p className="font-semibold text-text">
        {fmtDate(p.time)}
        {hourly && `, ${p.time.slice(11)}`}
      </p>
      <dl className="mt-1 grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 tabular-nums">
        <dt className="text-text-muted">Flow</dt>
        <dd className="text-right font-medium">{p.flow_mw === null ? "–" : fmtMw(p.flow_mw)}</dd>
        <dt className="text-text-muted">Congestion</dt>
        <dd className="text-right font-medium">{p.congestion === null ? "–" : `${fmtUsd(p.congestion)}/MWh`}</dd>
      </dl>
    </TooltipBox>
  );
}

function PerYearTable({ zones, level }: { zones: ZoneCorrelation[]; level: CorrelationLevel }) {
  const years = [...new Set(zones.flatMap((z) => z.per_year.map((y) => y.year)))].sort();
  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[30rem] text-left">
        <caption className="pb-2 text-left text-sm font-medium text-text-muted">
          Correlation by year ({level}, Pearson r)
        </caption>
        <thead>
          <tr className="border-b border-border text-sm text-text-subtle">
            <th scope="col" className="py-2 pr-4 font-medium">
              Zone
            </th>
            {years.map((y) => (
              <th key={y} scope="col" className="py-2 pr-4 text-right font-medium">
                {y}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {zones.map((z) => (
            <tr key={z.zone} className="border-b border-border last:border-b-0">
              <th scope="row" className="py-2 pr-4 font-medium text-text">
                {z.label}
              </th>
              {years.map((y) => {
                const c = z.per_year.find((p) => p.year === y);
                return (
                  <td key={y} className="py-2 pr-4 text-right tabular-nums">
                    <span className="font-mono font-medium text-text">{fmtR(c?.pearson ?? null)}</span>{" "}
                    <span className="text-sm text-text-muted">{c?.strength ?? ""}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
