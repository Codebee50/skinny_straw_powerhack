"use client";

import { useMemo } from "react";
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
import { getEvent } from "@/lib/api-intermediate";
import type { EventResponse } from "@/lib/types-intermediate";
import { ZONES, type ZoneColumn } from "@/lib/zones";
import { CHART, axisLabel, axisTick } from "../minimum/chartTheme";
import { fmtUsd, fmtUsdTick } from "../minimum/format";
import { ChartCard, Skeleton } from "../minimum/ui";
import {
  LineSwatch,
  OTHER_ZONE,
  SectionBody,
  SectionTakeaway,
  TooltipBox,
  caption,
  fmtDate,
  hourRange,
  labelOf,
  seriesFor,
  useApi,
} from "./shared";

type Row = Record<string, string | number | null>;

/** "Long Island hit −$666.43/MWh at 12–1 pm on Sun 5 Feb; Capital −$459.87 at 12–1 am …" */
function takeaway(data: EventResponse, top: ZoneColumn[]): string {
  const mins = top
    .map((z) => ({ z, m: data.zone_min[z] }))
    .filter((x): x is { z: ZoneColumn; m: NonNullable<typeof x.m> } => !!x.m && x.m.value !== null)
    .sort((a, b) => a.m.value! - b.m.value!);
  if (!mins.length) return "";
  const sameDay = new Set(mins.map((x) => x.m.timestamp.slice(0, 10))).size === 1;
  const describe = ({ z, m }: (typeof mins)[number], full: boolean) => {
    const day = sameDay ? "" : ` on ${fmtDate(m.timestamp, false)}`;
    const hour = hourRange(Number(m.timestamp.slice(11, 13)));
    const name = labelOf(z).split(" · ")[1];
    return full ? `${name} hit ${fmtUsd(m.value!)}/MWh at ${hour}${day}` : `${name} ${fmtUsd(m.value!)} at ${hour}${day}`;
  };
  const [first, ...rest] = mins;
  const prefix = sameDay ? `On ${fmtDate(first.m.timestamp, false)}, ` : "";
  return `${prefix}${describe(first, true)}${rest.length ? `; ${rest.map((x) => describe(x, false)).join(", ")}` : ""}.`;
}

export function EventSection({ topZones }: { topZones: ZoneColumn[] | null }) {
  const state = useApi("event", () => getEvent());
  const data = state.data;
  return (
    <ChartCard
      title="Spotlight: early February 2023"
      description={<SectionTakeaway state={state}>{(d) => (topZones ? takeaway(d, topZones) : "")}</SectionTakeaway>}
      caption={caption(data?.period)}
    >
      <SectionBody state={state} height="h-[26rem]">
        {(d) => (topZones ? <EventChart data={d} top={topZones} /> : <Skeleton className="h-[26rem] w-full" />)}
      </SectionBody>
    </ChartCard>
  );
}

function EventChart({ data, top }: { data: EventResponse; top: ZoneColumn[] }) {
  const rows: Row[] = useMemo(() => data.rows.map((r) => ({ t: r.timestamp, ...r.values })), [data]);
  const ticks = rows.map((r) => String(r.t)).filter((t) => t.endsWith(" 00:00"));
  // Draw faint zones first so the emphasized ones sit on top.
  const others = ZONES.map((z) => z.column).filter((z) => !top.includes(z));

  return (
    <div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 px-3 pb-2 text-sm text-text">
        {top.map((z) => (
          <li key={z} className="inline-flex items-center gap-2">
            <LineSwatch {...seriesFor(z)} />
            {labelOf(z)}
          </li>
        ))}
        <li className="inline-flex items-center gap-2 text-text-muted">
          <LineSwatch color={OTHER_ZONE.color} />
          Other 8 zones
        </li>
      </ul>
      <div className="h-[26rem] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 16, right: 24, bottom: 36, left: 24 }}>
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis
              dataKey="t"
              ticks={ticks}
              interval={0}
              tickFormatter={(t: string) => fmtDate(t, false)}
              tick={axisTick}
              stroke={CHART.axis}
              label={{ value: "Day (hourly values, local time)", position: "bottom", offset: 14, ...axisLabel }}
            />
            <YAxis
              tickFormatter={fmtUsdTick}
              tick={axisTick}
              stroke={CHART.axis}
              width={64}
              label={{
                value: "Hourly congestion cost ($/MWh)",
                angle: -90,
                position: "insideLeft",
                offset: -12,
                dy: 100,
                ...axisLabel,
              }}
            />
            <ReferenceLine y={0} stroke={CHART.text} strokeWidth={1.5} />
            <Tooltip content={<EventTip top={top} />} />
            {others.map((z) => (
              <Line
                key={z}
                dataKey={z}
                stroke={OTHER_ZONE.color}
                strokeOpacity={0.35}
                strokeWidth={1}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            ))}
            {top.map((z) => (
              <Line
                key={z}
                dataKey={z}
                stroke={seriesFor(z).color}
                strokeWidth={2.5}
                strokeDasharray={seriesFor(z).dash}
                dot={false}
                isAnimationActive={false}
              />
            ))}
            {top.map((z) => {
              const m = data.zone_min[z];
              return m && m.value !== null ? (
                <ReferenceDot
                  key={`${z}-min`}
                  x={m.timestamp}
                  y={m.value}
                  r={6}
                  fill={seriesFor(z).color}
                  stroke={CHART.surface}
                  strokeWidth={2}
                />
              ) : null;
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p data-helper className="px-3 text-sm text-text-muted">
        Every hour of the week, all 11 zones. Large dots mark each highlighted zone&apos;s lowest hour.
        {data.missing_hours.length > 0 && ` ${data.missing_hours.length} hour(s) are missing from the source data and left blank.`}
      </p>
    </div>
  );
}

function EventTip({
  active,
  payload,
  label,
  top,
}: {
  active?: boolean;
  payload?: readonly { payload?: unknown }[];
  label?: string | number;
  top: ZoneColumn[];
}) {
  const row = payload?.[0]?.payload as Row | undefined;
  if (!active || !row) return null;
  const t = String(label ?? row.t);
  return (
    <TooltipBox>
      <p className="font-semibold text-text">
        {fmtDate(t, false)}, {hourRange(Number(t.slice(11, 13)))}
      </p>
      <dl className="mt-1 grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 tabular-nums">
        {top.map((z) => {
          const v = row[z];
          return (
            <div key={z} className="contents">
              <dt className="inline-flex items-center gap-2 text-text-muted">
                <LineSwatch {...seriesFor(z)} />
                {labelOf(z)}
              </dt>
              <dd className="text-right font-medium">{typeof v === "number" ? `${fmtUsd(v)}/MWh` : "–"}</dd>
            </div>
          );
        })}
      </dl>
    </TooltipBox>
  );
}
