"use client";

import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getWeekdayWeekend } from "@/lib/api-intermediate";
import type { WeekdayWeekendResponse, WeekdayWeekendRow } from "@/lib/types-intermediate";
import { CHART, axisLabel, axisTick } from "../minimum/chartTheme";
import { fmtUsd, fmtUsdTick } from "../minimum/format";
import { ChartCard } from "../minimum/ui";
import { PAIR, SectionBody, SectionTakeaway, TooltipBox, caption, useApi } from "./shared";

const WEEKEND_COLOR = PAIR.b.color;
const WEEKDAY_COLOR = PAIR.a.color;

function takeaway(data: WeekdayWeekendResponse): string {
  const heavier = data.zones.filter((z) => z.difference < 0);
  if (!heavier.length) return "Weekends are at least as congested as weekdays in every zone.";
  const gap = [...heavier].sort((a, b) => a.difference - b.difference)[0];
  return (
    `Weekdays are more congested in ${heavier.length} of ${data.zones.length} zones. ` +
    `Biggest gap: ${gap.label}, ${fmtUsd(gap.weekday)} on weekdays vs ${fmtUsd(gap.weekend)} on weekends.`
  );
}

export function WeekdayWeekendSection() {
  const state = useApi("weekday-weekend", () => getWeekdayWeekend(null));
  const data = state.data;
  return (
    <ChartCard
      title="Are weekdays worse than weekends?"
      description={<SectionTakeaway state={state}>{takeaway}</SectionTakeaway>}
      caption={caption(data?.period)}
    >
      <SectionBody state={state} height="h-[34rem]">
        {(d) => <Bars data={d} />}
      </SectionBody>
    </ChartCard>
  );
}

function Bars({ data }: { data: WeekdayWeekendResponse }) {
  const values = data.zones.flatMap((z) => [z.weekday, z.weekend]);
  const lo = Math.floor(Math.min(0, ...values) / 2) * 2;
  const hi = Math.ceil(Math.max(0, ...values) / 2) * 2;
  const ticks = Array.from({ length: (hi - lo) / 2 + 1 }, (_, i) => lo + i * 2);
  return (
    <div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 px-3 pb-2 text-sm text-text">
        <li className="inline-flex items-center gap-2">
          <span aria-hidden className="size-3 rounded-sm" style={{ background: WEEKDAY_COLOR }} />
          Weekday (Mon–Fri, {data.zones[0]?.weekday_days} days)
        </li>
        <li className="inline-flex items-center gap-2">
          <span
            aria-hidden
            className="size-3 rounded-sm"
            style={{
              background: `repeating-linear-gradient(135deg, ${WEEKEND_COLOR} 0 3px, ${WEEKEND_COLOR}99 3px 5px)`,
            }}
          />
          Weekend (Sat–Sun, {data.zones[0]?.weekend_days} days)
        </li>
      </ul>
      <div className="h-[30rem] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data.zones}
            layout="vertical"
            margin={{ top: 4, right: 24, bottom: 36, left: 8 }}
            barCategoryGap={8}
            barGap={2}
          >
            <defs>
              <pattern id="weekend-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="6" height="6" fill={WEEKEND_COLOR} />
                <line x1="0" y1="0" x2="0" y2="6" stroke={CHART.surface} strokeWidth="1.5" strokeOpacity="0.55" />
              </pattern>
            </defs>
            <CartesianGrid horizontal={false} stroke={CHART.grid} />
            <XAxis
              type="number"
              domain={[lo, hi]}
              ticks={ticks}
              tickFormatter={fmtUsdTick}
              tick={axisTick}
              stroke={CHART.axis}
              label={{ value: "Average daily congestion cost ($/MWh)", position: "bottom", offset: 14, ...axisLabel }}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={150}
              tick={{ ...axisTick, fill: CHART.text }}
              tickLine={false}
              stroke={CHART.axis}
              interval={0}
            />
            <ReferenceLine x={0} stroke={CHART.text} strokeWidth={1.5} />
            <Tooltip content={<WwTip />} cursor={{ fill: CHART.grid, fillOpacity: 0.5 }} />
            <Bar dataKey="weekday" name="Weekday" fill={WEEKDAY_COLOR} isAnimationActive={false} />
            <Bar dataKey="weekend" name="Weekend" fill="url(#weekend-hatch)" isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p data-helper className="px-3 text-sm text-text-muted">
        Bars left of $0: congestion raised the price. Mean of daily averages, all three years.
      </p>
    </div>
  );
}

function WwTip({ active, payload }: { active?: boolean; payload?: readonly { payload?: unknown }[] }) {
  const z = payload?.[0]?.payload as WeekdayWeekendRow | undefined;
  if (!active || !z) return null;
  return (
    <TooltipBox>
      <p className="font-semibold text-text">{z.label}</p>
      <dl className="mt-1 grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 tabular-nums">
        <dt className="text-text-muted">Weekday</dt>
        <dd className="text-right font-medium">{fmtUsd(z.weekday)}/MWh</dd>
        <dt className="text-text-muted">Weekend</dt>
        <dd className="text-right font-medium">{fmtUsd(z.weekend)}/MWh</dd>
        <dt className="text-text-muted">Difference</dt>
        <dd className="text-right font-medium">{fmtUsd(z.difference)}/MWh</dd>
      </dl>
    </TooltipBox>
  );
}
