"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getTimeseries } from "@/lib/api-intermediate";
import type { Granularity, TimeseriesResponse } from "@/lib/types-intermediate";
import type { ZoneColumn } from "@/lib/zones";
import { CHART, axisLabel, axisTick } from "../minimum/chartTheme";
import { fmtUsd, fmtUsdTick } from "../minimum/format";
import { ChartCard, Segmented } from "../minimum/ui";
import {
  LineSwatch,
  SectionBody,
  SectionTakeaway,
  TooltipBox,
  caption,
  fmtDate,
  fmtYearMonth,
  seriesFor,
  useApi,
} from "./shared";

const GRANULARITY = [
  { value: "monthly", label: "Monthly" },
  { value: "daily", label: "Daily" },
] as const;

const WINTER = new Set([12, 1, 2]);

type Row = Record<string, string | number | null>;

function takeaway(data: TimeseriesResponse): string {
  const worst = data.zones
    .map((z) => ({ z, w: data.worst_months[z.zone]?.[0] }))
    .filter((x): x is { z: (typeof data.zones)[number]; w: NonNullable<typeof x.w> } => !!x.w)
    .sort((a, b) => a.w.value - b.w.value);
  if (!worst.length) return "No monthly data for these zones.";
  const top = worst[0];
  const allWinter = worst.every((x) => WINTER.has(x.w.month));
  const others = worst
    .slice(1)
    .map((x) => `${x.z.label} in ${x.w.month_label}`)
    .join(", ");
  return (
    `Worst month: ${top.z.label} in ${top.w.month_label} (${fmtUsd(top.w.value)}/MWh)` +
    (others ? `; ${others}` : "") +
    (allWinter ? ". Every zone's worst month was in winter." : ".")
  );
}

/** Clip the y-axis to the bulk of the data so a handful of extreme days don't flatten the trend. */
function dailyDomain(rows: Row[], zones: ZoneColumn[]): [number, number] {
  const values = rows
    .flatMap((r) => zones.map((z) => r[z]))
    .filter((v): v is number => typeof v === "number")
    .sort((a, b) => a - b);
  const q = (p: number) => values[Math.floor(p * (values.length - 1))];
  return [Math.floor(q(0.01) / 20) * 20, Math.ceil(Math.max(q(0.995), 5) / 20) * 20];
}

const ticksBetween = ([lo, hi]: [number, number], step: number) =>
  Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => lo + i * step);

export function TrendSection() {
  const [granularity, setGranularity] = useState<Granularity>("monthly");
  const state = useApi(`timeseries:${granularity}`, () => getTimeseries(granularity));
  const data = state.data;

  return (
    <ChartCard
      title="How has congestion changed over 3 years?"
      description={<SectionTakeaway state={state}>{takeaway}</SectionTakeaway>}
      caption={caption(data?.period)}
      controls={
        <Segmented label="Granularity" size="sm" options={GRANULARITY} value={granularity} onChange={setGranularity} />
      }
    >
      <SectionBody state={state} height="h-[26rem]" onReset={() => setGranularity("monthly")} resetLabel="Show monthly view">
        {(d) => <TrendChart data={d} />}
      </SectionBody>
    </ChartCard>
  );
}

function TrendChart({ data }: { data: TimeseriesResponse }) {
  const zones = data.zones.map((z) => z.zone);
  const daily = data.granularity === "daily";
  // Only data notes about zones that are actually plotted.
  const notes = data.data_notes.filter((n) => data.zones.some((z) => n.includes(z.label)));

  const rows: Row[] = useMemo(
    () =>
      data.points.map((p) => {
        const row: Row = { x: p.x };
        for (const z of zones) {
          row[z] = p.values[z] ?? null;
          if (p.rolling_30d) row[`${z}__roll`] = p.rolling_30d[z] ?? null;
        }
        return row;
      }),
    [data, zones],
  );

  const ticks = useMemo(
    () =>
      rows
        .map((r) => String(r.x))
        .filter((x) => (daily ? /-(01|07)-01$/.test(x) : /-(01|07)$/.test(x))),
    [rows, daily],
  );

  const domain = daily ? dailyDomain(rows, zones) : (["auto", "auto"] as const);

  // Worst months: each zone's top 3 as rings, its single worst labelled.
  const worst = zones.flatMap((z) => (data.worst_months[z] ?? []).map((w, i) => ({ zone: z, w, rank: i })));
  const worstMonths = [...new Set(worst.filter((x) => x.rank === 0).map((x) => `${x.w.year}-${String(x.w.month).padStart(2, "0")}`))];

  return (
    <div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 px-3 pb-2 text-sm text-text">
        {data.zones.map((z) => (
          <li key={z.zone} className="inline-flex items-center gap-2">
            <LineSwatch {...seriesFor(z.zone)} />
            {z.label}
          </li>
        ))}
        <li className="inline-flex items-center gap-2 text-text-muted">
          {daily ? (
            <span aria-hidden className="inline-block h-3 w-4 rounded-sm" style={{ background: CHART.accentSubtle }} />
          ) : (
            <span aria-hidden className="inline-block size-3 rounded-full border-2 border-text" />
          )}
          {daily ? "Each zone's worst month" : "Worst months"}
        </li>
      </ul>
      <div className="h-[26rem] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 16, right: 24, bottom: 36, left: 24 }}>
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis
              dataKey="x"
              ticks={ticks}
              interval={0}
              tickFormatter={(x: string) => (daily ? fmtYearMonth(x.slice(0, 7)) : fmtYearMonth(x))}
              tick={axisTick}
              stroke={CHART.axis}
              label={{ value: daily ? "Date" : "Month", position: "bottom", offset: 14, ...axisLabel }}
            />
            <YAxis
              domain={domain}
              ticks={daily ? ticksBetween(domain as [number, number], 20) : undefined}
              allowDataOverflow={daily}
              tickFormatter={fmtUsdTick}
              tick={axisTick}
              stroke={CHART.axis}
              width={60}
              label={{
                value: "Avg congestion cost ($/MWh)",
                angle: -90,
                position: "insideLeft",
                offset: -12,
                dy: 100,
                ...axisLabel,
              }}
            />
            <ReferenceLine y={0} stroke={CHART.text} strokeWidth={1.5} />
            {daily &&
              worstMonths.map((ym) => {
                const [y, m] = ym.split("-").map(Number);
                const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
                return (
                  <ReferenceArea
                    key={ym}
                    x1={`${ym}-01`}
                    x2={`${ym}-${String(last).padStart(2, "0")}`}
                    fill={CHART.accentSubtle}
                    fillOpacity={0.9}
                    label={{ value: fmtYearMonth(ym), position: "insideTop", fill: CHART.text, fontSize: 13 }}
                  />
                );
              })}
            <Tooltip content={<TrendTip zones={data.zones.map((z) => ({ zone: z.zone, label: z.label }))} daily={daily} />} />
            {zones.map((z) => {
              const s = seriesFor(z);
              return daily ? (
                [
                  <Line
                    key={`${z}-raw`}
                    dataKey={z}
                    stroke="none"
                    dot={{ r: 1.4, fill: s.color, fillOpacity: 0.22, stroke: "none" }}
                    activeDot={false}
                    legendType="none"
                    isAnimationActive={false}
                  />,
                  <Line
                    key={`${z}-roll`}
                    dataKey={`${z}__roll`}
                    stroke={s.color}
                    strokeWidth={2.5}
                    strokeDasharray={s.dash}
                    dot={false}
                    isAnimationActive={false}
                  />,
                ]
              ) : (
                <Line
                  key={z}
                  dataKey={z}
                  stroke={s.color}
                  strokeWidth={2.5}
                  strokeDasharray={s.dash}
                  dot={false}
                  isAnimationActive={false}
                />
              );
            })}
            {!daily &&
              worst.map(({ zone, w, rank }) => (
                <ReferenceDot
                  key={`${zone}-${w.year}-${w.month}`}
                  x={`${w.year}-${String(w.month).padStart(2, "0")}`}
                  y={w.value}
                  r={rank === 0 ? 6 : 4.5}
                  fill={CHART.surface}
                  stroke={seriesFor(zone).color}
                  strokeWidth={2.5}
                  label={
                    rank === 0
                      ? {
                          value: `${w.month_label} ${fmtUsd(w.value)}`,
                          position: "right",
                          offset: 10,
                          fill: CHART.text,
                          fontSize: 13,
                          fontWeight: 600,
                        }
                      : undefined
                  }
                />
              ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p data-helper className="px-3 text-sm text-text-muted">
        {daily
          ? "Lines: 30-day rolling average. Faint dots: each day. A few extreme days fall below the axis; see “The 10 worst days”."
          : "One point per month. Rings mark each zone's 3 worst months; the worst is labelled. Below $0 = congestion raised the price."}
      </p>
      {notes.length > 0 && <p className="px-3 pt-1 text-sm text-text-subtle">Data note: {notes.join(" ")}</p>}
    </div>
  );
}

function TrendTip({
  active,
  payload,
  label,
  zones,
  daily,
}: {
  active?: boolean;
  payload?: readonly { payload?: unknown }[];
  label?: string | number;
  zones: { zone: ZoneColumn; label: string }[];
  daily: boolean;
}) {
  const row = payload?.[0]?.payload as Row | undefined;
  if (!active || !row) return null;
  const x = String(label ?? row.x);
  return (
    <TooltipBox>
      <p className="font-semibold text-text">{daily ? fmtDate(x) : fmtYearMonth(x)}</p>
      <dl className="mt-1 grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 tabular-nums">
        {zones.map(({ zone, label: name }) => {
          const v = row[zone];
          const roll = row[`${zone}__roll`];
          return (
            <div key={zone} className="contents">
              <dt className="inline-flex items-center gap-2 text-text-muted">
                <LineSwatch {...seriesFor(zone)} />
                {name}
              </dt>
              <dd className="text-right font-medium text-text">
                {typeof v === "number" ? fmtUsd(v) : "–"}
                {daily && typeof roll === "number" && (
                  <span className="ml-2 font-normal text-text-muted">30-day {fmtUsd(roll)}</span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </TooltipBox>
  );
}
