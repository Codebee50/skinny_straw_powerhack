"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getHourly } from "@/lib/api-intermediate";
import type { HourlyResponse } from "@/lib/types-intermediate";
import type { ZoneColumn } from "@/lib/zones";
import { CHART, axisLabel, axisTick } from "../minimum/chartTheme";
import { fmtUsd, fmtUsdTick } from "../minimum/format";
import { ChartCard, Segmented } from "../minimum/ui";
import {
  LineSwatch,
  PAIR,
  SectionBody,
  SectionTakeaway,
  TooltipBox,
  YEAR_OPTIONS,
  ZoneSelect,
  caption,
  fmtClock,
  hourRange,
  toYear,
  useApi,
  type YearOption,
} from "./shared";

const DEFAULT_ZONE: ZoneColumn = "J_new_york_city";
const TICKS = [0, 3, 6, 9, 12, 15, 18, 21];

function takeaway(data: HourlyResponse): string {
  const [jan, jul] = data.profiles;
  if (!jan || !jul) return "";
  const when = data.year ? `in ${data.year}` : "across 2023–2025";
  return (
    `${data.zone.label} ${when}: July peaks at ${jul.peak.label} (${fmtUsd(jul.peak.value ?? 0)}/MWh), ` +
    `January at ${jan.peak.label} (${fmtUsd(jan.peak.value ?? 0)}/MWh).`
  );
}

export function HourlySection() {
  const [zone, setZone] = useState<ZoneColumn>(DEFAULT_ZONE);
  const [year, setYear] = useState<YearOption>("all");
  const state = useApi(`hourly:${zone}:${year}`, () => getHourly(zone, toYear(year)));
  const data = state.data;

  return (
    <ChartCard
      title="What time of day does congestion hit?"
      description={<SectionTakeaway state={state}>{takeaway}</SectionTakeaway>}
      caption={caption(data?.period)}
      controls={
        <div className="flex flex-wrap items-center gap-3">
          <ZoneSelect value={zone} onChange={setZone} />
          <Segmented label="Year" size="sm" options={YEAR_OPTIONS} value={year} onChange={setYear} />
        </div>
      }
    >
      <SectionBody
        state={state}
        height="h-[24rem]"
        onReset={() => setZone(DEFAULT_ZONE)}
        resetLabel="Show New York City"
      >
        {(d) => <HourlyChart data={d} />}
      </SectionBody>
    </ChartCard>
  );
}

function HourlyChart({ data }: { data: HourlyResponse }) {
  const [jan, jul] = data.profiles;
  const rows = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    jan: jan?.points[h]?.value ?? null,
    jul: jul?.points[h]?.value ?? null,
  }));
  const series = [
    { key: "jan", profile: jan, ...PAIR.a },
    { key: "jul", profile: jul, ...PAIR.b },
  ];
  // Put the two peak labels on opposite sides when the peaks are close, so they don't collide.
  const close = jan && jul && Math.abs(jan.peak.hour - jul.peak.hour) <= 3;

  return (
    <div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 px-3 pb-2 text-sm text-text">
        {series.map((s) => (
          <li key={s.key} className="inline-flex items-center gap-2">
            <LineSwatch color={s.color} dash={s.dash} />
            {s.profile?.month_name}
          </li>
        ))}
      </ul>
      <div className="h-[24rem] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 28, right: 24, bottom: 36, left: 24 }}>
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis
              type="number"
              dataKey="hour"
              domain={[0, 23]}
              ticks={TICKS}
              tickFormatter={fmtClock}
              tick={axisTick}
              stroke={CHART.axis}
              label={{ value: "Time of day (local, hour beginning)", position: "bottom", offset: 14, ...axisLabel }}
            />
            <YAxis
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
            <Tooltip content={<HourTip names={[jan?.month_name ?? "", jul?.month_name ?? ""]} />} />
            {series.map((s) => (
              <Line
                key={s.key}
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={2.5}
                strokeDasharray={s.dash}
                dot={{ r: 3, fill: s.color, stroke: CHART.surface, strokeWidth: 1 }}
                isAnimationActive={false}
              />
            ))}
            {series.map(
              (s, i) =>
                s.profile &&
                s.profile.peak.value !== null && (
                  <ReferenceDot
                    key={`${s.key}-peak`}
                    x={s.profile.peak.hour}
                    y={s.profile.peak.value}
                    r={7}
                    fill={s.color}
                    stroke={CHART.surface}
                    strokeWidth={2}
                    label={{
                      value: `${s.profile.month_name.slice(0, 3)} peak ${s.profile.peak.label}`,
                      position: close ? (i === 0 ? "left" : "right") : "bottom",
                      offset: 12,
                      fill: CHART.text,
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  />
                ),
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p data-helper className="px-3 text-sm text-text-muted">
        Average congestion for each hour of the day in January and July
        {data.year ? ` ${data.year}` : ", averaged over 2023–2025 (weighted by days)"}. Large dots mark each month&apos;s
        peak, its most negative hour.
      </p>
    </div>
  );
}

function HourTip({
  active,
  payload,
  label,
  names,
}: {
  active?: boolean;
  payload?: readonly { payload?: unknown }[];
  label?: string | number;
  names: [string, string];
}) {
  const row = payload?.[0]?.payload as { hour: number; jan: number | null; jul: number | null } | undefined;
  if (!active || !row) return null;
  return (
    <TooltipBox>
      <p className="font-semibold text-text">{hourRange(Number(label ?? row.hour))}</p>
      <dl className="mt-1 grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 tabular-nums">
        {(["jan", "jul"] as const).map((k, i) => (
          <div key={k} className="contents">
            <dt className="inline-flex items-center gap-2 text-text-muted">
              <LineSwatch {...(i === 0 ? PAIR.a : PAIR.b)} />
              {names[i]}
            </dt>
            <dd className="text-right font-medium text-text">{row[k] === null ? "–" : `${fmtUsd(row[k]!)}/MWh`}</dd>
          </div>
        ))}
      </dl>
    </TooltipBox>
  );
}
