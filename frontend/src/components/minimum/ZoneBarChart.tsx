"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RankedCongestionZone, RankedZone } from "@/lib/types";
import { CHART, axisLabel, axisTick } from "./chartTheme";
import { fmtUsd, fmtUsdTick } from "./format";
import { ChartCard, Segmented } from "./ui";

type Order = "geo" | "value";
const ORDER_OPTIONS = [
  { value: "geo", label: "Order A→K (geography)" },
  { value: "value", label: "Order by value" },
] as const;

const ROW = 36;

/** Round tick step giving roughly 5–8 ticks across a span. */
function niceStep(span: number): number {
  for (const s of [1, 2, 5, 10, 20, 25, 50, 100]) if (span / s <= 8) return s;
  return 200;
}
const RADIUS = 4;

/** Bar with a rounded data end (away from zero) and a value label on top-3 bars. */
function ZoneBar(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: RankedZone;
}) {
  const { x = 0, y = 0, width = 0, height = 0, payload } = props;
  if (!payload) return null;
  const left = Math.min(x, x + width);
  const w = Math.abs(width);
  const right = left + w;
  const negative = payload.value < 0;
  const r = Math.min(RADIUS, w, height / 2);
  const top = y;
  const bottom = y + height;

  // Path with rounded corners only at the data end.
  const d = negative
    ? `M${right},${top} H${left + r} Q${left},${top} ${left},${top + r} V${bottom - r} Q${left},${bottom} ${left + r},${bottom} H${right} Z`
    : `M${left},${top} H${right - r} Q${right},${top} ${right},${top + r} V${bottom - r} Q${right},${bottom} ${right - r},${bottom} H${left} Z`;

  return (
    <g>
      <path d={w > 0 ? d : ""} fill={payload.is_top3 ? CHART.accent : CHART.muted} />
      {payload.is_top3 && (
        <text
          x={negative ? left - 8 : right + 8}
          y={top + height / 2}
          dominantBaseline="central"
          textAnchor={negative ? "end" : "start"}
          fontSize={CHART.fontSize}
          fontWeight={600}
          fill={CHART.text}
          className="tabular-nums"
        >
          {fmtUsd(payload.value)}
        </text>
      )}
    </g>
  );
}

function BarTip({ active, payload }: { active?: boolean; payload?: readonly { payload?: unknown }[] }) {
  const z = payload?.[0]?.payload as (RankedZone & Partial<RankedCongestionZone>) | undefined;
  if (!active || !z) return null;
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-sm shadow-[0_1px_2px_rgb(0_0_0/0.04),0_4px_12px_rgb(0_0_0/0.08)]">
      <p className="font-semibold text-text">{z.label}</p>
      <p className="text-text-muted">{z.region}</p>
      <dl className="mt-2 grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 tabular-nums">
        <dt className="text-text-muted">Average</dt>
        <dd className="text-right font-medium text-text">{fmtUsd(z.value)}/MWh</dd>
        <dt className="text-text-muted">Rank</dt>
        <dd className="text-right font-medium text-text">{z.rank} of 11</dd>
        {z.worst_moment && (
          <>
            <dt className="text-text-muted">Worst 5 min</dt>
            <dd className="text-right font-medium text-text">
              {fmtUsd(z.worst_moment.value)} · {z.worst_moment.month_label}
            </dd>
          </>
        )}
      </dl>
    </div>
  );
}

export function ZoneBarChart({
  title,
  description,
  axisTitle,
  byZone,
  byRank,
  caption,
  note,
}: {
  title: string;
  description: string;
  axisTitle: string;
  byZone: RankedZone[];
  byRank: RankedZone[];
  caption: string;
  note?: string;
}) {
  const [order, setOrder] = useState<Order>("geo");
  const rows = order === "geo" ? byZone : byRank;

  const values = byZone.map((z) => z.value);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  // Headroom past the extreme bars for their value labels, snapped to round ticks through 0.
  const step = niceStep((max - min) * 1.3);
  const domain: [number, number] = [
    min < 0 ? Math.floor((min * 1.3) / step) * step : 0,
    Math.max(step, Math.ceil((max * 1.25) / step) * step),
  ];
  const ticks: number[] = [];
  for (let v = domain[0]; v <= domain[1] + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);

  return (
    <ChartCard
      title={title}
      description={description}
      caption={caption}
      controls={<Segmented label={`${title} order`} size="sm" options={ORDER_OPTIONS} value={order} onChange={setOrder} />}
    >
      <div style={{ height: rows.length * ROW + 72 }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, bottom: 36, left: 8 }} barCategoryGap={6}>
            <CartesianGrid horizontal={false} stroke={CHART.grid} />
            <XAxis
              type="number"
              domain={domain}
              ticks={ticks}
              tickFormatter={fmtUsdTick}
              tick={axisTick}
              stroke={CHART.axis}
              label={{ value: axisTitle, position: "bottom", offset: 12, ...axisLabel }}
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
            <Tooltip content={<BarTip />} cursor={{ fill: CHART.grid, fillOpacity: 0.5 }} />
            <Bar dataKey="value" shape={<ZoneBar />} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 pb-1 text-sm text-text-muted">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="size-3 rounded-sm" style={{ background: CHART.accent }} />
          Top 3 (labeled)
        </span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="size-3 rounded-sm" style={{ background: CHART.muted }} />
          Other zones
        </span>
        {note && <span>{note}</span>}
      </p>
    </ChartCard>
  );
}
