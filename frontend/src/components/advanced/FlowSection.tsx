"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getFlowTrend } from "@/lib/api-advanced";
import type { FlowTrendResponse, FlowYear } from "@/lib/types-advanced";
import { CHART, axisLabel, axisTick } from "../minimum/chartTheme";
import { ChartCard } from "../minimum/ui";
import {
  LineSwatch,
  SectionBody,
  SectionTakeaway,
  TooltipBox,
  caption,
  fmtDate,
  fmtYearMonth,
  useApi,
} from "../intermediate/shared";

// Direction colors (not congestion): southbound = blue, northbound = orange (validated pair).
export const SOUTH = "#2a78d6";
export const NORTH = "#eb6834";

/** % of days southbound, from the day counts (the API's 3-decimal share can round the other way). */
const southPct = (y: FlowYear) => Math.round((100 * y.southbound_days) / y.days);

export const fmtMw = (v: number, signed = true) =>
  `${signed && v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 })} MW`;

function takeaway(d: FlowTrendResponse): string {
  const [first, ...rest] = d.yearly;
  const last = rest[rest.length - 1];
  if (!first || !last || first.avg_flow_mw === null || last.avg_flow_mw === null) return "";
  // Direction is in the words, so print the magnitude without a sign.
  const words = (v: number) => `${fmtMw(Math.abs(v), false)} ${v >= 0 ? "southbound" : "northbound"}`;
  const a = southPct(first);
  const b = southPct(last);
  return (
    `Average flow went from ${words(first.avg_flow_mw)} in ${first.year} to ${words(last.avg_flow_mw)} in ${last.year}; ` +
    `southbound days ${b < a ? "fell" : "rose"} from ${a}% to ${b}%.`
  );
}

export function FlowSection() {
  const state = useApi("flow-trend", () => getFlowTrend());
  return (
    <ChartCard
      title="How has Moses South flow changed?"
      description={<SectionTakeaway state={state}>{takeaway}</SectionTakeaway>}
      caption={caption(state.data?.period)}
    >
      <SectionBody state={state} height="h-[26rem]">
        {(d) => (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <DailyFlowChart data={d} />
            <div className="space-y-6 px-2">
              <YearlyBars years={d.yearly} />
              <DirectionShare years={d.yearly} />
            </div>
          </div>
        )}
      </SectionBody>
    </ChartCard>
  );
}

function DailyFlowChart({ data }: { data: FlowTrendResponse }) {
  const rows = data.daily;
  const ticks = useMemo(() => rows.map((r) => r.date).filter((x) => /-(01|07)-01$/.test(x)), [rows]);
  return (
    <div className="min-w-0">
      <ul className="flex flex-wrap gap-x-5 gap-y-1 px-3 pb-2 text-sm text-text">
        <li className="inline-flex items-center gap-2">
          <LineSwatch color={CHART.text} />
          30-day rolling average
        </li>
        <li className="inline-flex items-center gap-2 text-text-muted">
          <LineSwatch color={CHART.muted} />
          Daily average
        </li>
      </ul>
      <div className="h-[24rem] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 36, left: 24 }}>
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis
              dataKey="date"
              ticks={ticks}
              interval={0}
              tickFormatter={(x: string) => fmtYearMonth(x.slice(0, 7))}
              tick={axisTick}
              stroke={CHART.axis}
              label={{ value: "Date", position: "bottom", offset: 14, ...axisLabel }}
            />
            <YAxis
              tickFormatter={(v: number) => `${v < 0 ? "−" : ""}${Math.abs(v).toLocaleString("en-US")}`}
              tick={axisTick}
              stroke={CHART.axis}
              width={64}
              label={{ value: "Flow (MW)", angle: -90, position: "insideLeft", offset: -10, dy: 40, ...axisLabel }}
            />
            <ReferenceLine
              y={0}
              stroke={CHART.text}
              strokeWidth={1.5}
              label={<ZeroLabel />}
            />
            <Tooltip content={<FlowTip />} />
            <Line dataKey="flow_mw" stroke={CHART.muted} strokeOpacity={0.45} strokeWidth={1} dot={false} isAnimationActive={false} />
            <Line dataKey="rolling_30d" stroke={CHART.text} strokeWidth={2.5} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p data-helper className="px-3 text-sm text-text-muted">
        Positive = power flowing south out of the North Country; negative = flowing north. Moses South carries all of
        that flow, not only Smart Path Connect.
      </p>
    </div>
  );
}

function ZeroLabel({ viewBox }: { viewBox?: { x?: number; y?: number; width?: number } }) {
  const x = (viewBox?.x ?? 0) + (viewBox?.width ?? 0) - 6;
  const y = viewBox?.y ?? 0;
  return (
    <g fontSize={13} fontWeight={600} textAnchor="end">
      <text x={x} y={y - 6} fill={SOUTH}>
        southbound ↑
      </text>
      <text x={x} y={y + 16} fill={NORTH}>
        northbound ↓
      </text>
    </g>
  );
}

function FlowTip({ active, payload }: { active?: boolean; payload?: readonly { payload?: unknown }[] }) {
  const row = payload?.[0]?.payload as FlowTrendResponse["daily"][number] | undefined;
  if (!active || !row) return null;
  return (
    <TooltipBox>
      <p className="font-semibold text-text">{fmtDate(row.date)}</p>
      <dl className="mt-1 grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 tabular-nums">
        <dt className="text-text-muted">Daily</dt>
        <dd className="text-right font-medium">{row.flow_mw === null ? "–" : fmtMw(row.flow_mw)}</dd>
        <dt className="text-text-muted">30-day</dt>
        <dd className="text-right font-medium">{row.rolling_30d === null ? "–" : fmtMw(row.rolling_30d)}</dd>
      </dl>
    </TooltipBox>
  );
}

function YearlyBars({ years }: { years: FlowYear[] }) {
  return (
    <figure>
      <figcaption className="font-medium text-text">Yearly average flow</figcaption>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={years} margin={{ top: 22, right: 8, bottom: 4, left: 8 }}>
            <XAxis dataKey="year" tick={axisTick} stroke={CHART.axis} tickLine={false} />
            <YAxis hide domain={["dataMin - 200", "dataMax + 200"]} />
            <ReferenceLine y={0} stroke={CHART.text} strokeWidth={1.5} />
            <Bar dataKey="avg_flow_mw" isAnimationActive={false} radius={4}>
              {years.map((y) => (
                <Cell key={y.year} fill={(y.avg_flow_mw ?? 0) >= 0 ? SOUTH : NORTH} />
              ))}
              <LabelList
                dataKey="avg_flow_mw"
                position="top"
                formatter={(v: unknown) => (typeof v === "number" ? fmtMw(v) : "")}
                style={{ fill: CHART.text, fontSize: 13, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-sm text-text-muted">
        <span className="font-medium" style={{ color: SOUTH }}>■</span> net southbound ·{" "}
        <span className="font-medium" style={{ color: NORTH }}>■</span> net northbound
      </p>
    </figure>
  );
}

function DirectionShare({ years }: { years: FlowYear[] }) {
  return (
    <figure>
      <figcaption className="font-medium text-text">Days with net southbound flow</figcaption>
      <ul className="mt-2 space-y-2">
        {years.map((y) => {
          const south = southPct(y);
          return (
            <li key={y.year} className="grid grid-cols-[3rem_1fr_3.5rem] items-center gap-2 text-sm">
              <span className="font-medium text-text tabular-nums">{y.year}</span>
              <span className="flex h-5 overflow-hidden rounded" role="img" aria-label={`${south}% southbound, ${100 - south}% northbound`}>
                <span style={{ width: `${south}%`, background: SOUTH }} />
                <span style={{ width: `${100 - south}%`, background: NORTH, opacity: 0.85 }} />
              </span>
              <span className="text-right font-mono font-medium tabular-nums">{south}%</span>
            </li>
          );
        })}
      </ul>
      <p data-helper className="mt-2 text-sm text-text-muted">Blue share = southbound days; orange = northbound.</p>
    </figure>
  );
}
