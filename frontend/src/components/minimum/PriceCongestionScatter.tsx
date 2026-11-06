"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { ScatterPoint, ScatterResponse } from "@/lib/types";
import { CHART, GROUPS, axisLabel, axisTick } from "./chartTheme";
import { describeR, fmtMonth, fmtR, fmtUsd, fmtUsdTick } from "./format";

const STEP = 10;

/** Domain that includes 0 and leaves room right of 0 for the "lowered price" label. */
function xDomain(points: ScatterPoint[]): [number, number] {
  const xs = points.map((p) => p.avg_congestion_cost);
  const lo = Math.floor(Math.min(0, ...xs) / STEP) * STEP;
  const hi = Math.ceil(Math.max(0, ...xs) / STEP) * STEP;
  return [lo, Math.max(hi, Math.ceil((-lo * 0.35) / STEP) * STEP, STEP)];
}

const Y_STEP = 20;

function yDomain(points: ScatterPoint[]): [number, number] {
  const ys = points.map((p) => p.avg_lbmp);
  return [Math.floor(Math.min(...ys) / Y_STEP) * Y_STEP, Math.ceil(Math.max(...ys) / Y_STEP) * Y_STEP];
}

/** Evenly spaced round ticks across a domain. */
function ticks([lo, hi]: [number, number], step: number): number[] {
  const out: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += step) out.push(v);
  return out;
}

function ScatterTip({ active, payload }: { active?: boolean; payload?: readonly { payload?: unknown }[] }) {
  const p = payload?.[0]?.payload as ScatterPoint | undefined;
  if (!active || !p) return null;
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-sm shadow-[0_1px_2px_rgb(0_0_0/0.04),0_4px_12px_rgb(0_0_0/0.08)]">
      <p className="font-semibold text-text">{p.label}</p>
      <p className="text-text-muted">
        {fmtMonth(p.year, p.month)} · {p.season}
      </p>
      <dl className="mt-2 grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 tabular-nums">
        <dt className="text-text-muted">Avg price</dt>
        <dd className="text-right font-medium text-text">{fmtUsd(p.avg_lbmp)}/MWh</dd>
        <dt className="text-text-muted">Avg congestion</dt>
        <dd className="text-right font-medium text-text">{fmtUsd(p.avg_congestion_cost)}/MWh</dd>
      </dl>
    </div>
  );
}

/** Labels either side of the x = 0 reference line. */
function ZeroLabels({ viewBox }: { viewBox?: { x?: number; y?: number } }) {
  const x = viewBox?.x ?? 0;
  const y = (viewBox?.y ?? 0) + 18;
  return (
    <g fontSize={CHART.fontSize} fontWeight={500}>
      <text x={x - 10} y={y} textAnchor="end" fill={CHART.accent}>
        ← congestion raised price
      </text>
      <text x={x + 10} y={y} textAnchor="start" fill={CHART.textMuted}>
        congestion lowered price →
      </text>
    </g>
  );
}

export function PriceCongestionScatter({ data }: { data: ScatterResponse }) {
  const { points, fit } = data;

  const series = useMemo(
    () => GROUPS.map((g) => ({ ...g, points: points.filter((p) => g.letters.includes(p.zone_letter)) })),
    [points],
  );
  const [x0, x1] = useMemo(() => xDomain(points), [points]);
  const [y0, y1] = useMemo(() => yDomain(points), [points]);

  // Trend line over the observed x range only (no extrapolation).
  const xs = points.map((p) => p.avg_congestion_cost);
  const trend =
    fit.slope !== null && fit.intercept !== null
      ? ([Math.min(...xs), Math.max(...xs)].map((x) => ({ x, y: fit.slope! * x + fit.intercept! })) as [
          { x: number; y: number },
          { x: number; y: number },
        ])
      : null;

  return (
    <div>
      <div className="h-[30rem] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 16, bottom: 40, left: 24 }}>
            <CartesianGrid stroke={CHART.grid} strokeDasharray="0" />
            <ReferenceArea x1={x0} x2={0} y1={y0} y2={y1} fill={CHART.accentSubtle} fillOpacity={0.6} ifOverflow="hidden" />
            <XAxis
              type="number"
              dataKey="avg_congestion_cost"
              domain={[x0, x1]}
              allowDataOverflow
              ticks={ticks([x0, x1], x1 - x0 > 80 ? 20 : STEP)}
              tickFormatter={fmtUsdTick}
              tick={axisTick}
              stroke={CHART.axis}
              label={{ value: "Average congestion cost ($/MWh)", position: "bottom", offset: 16, ...axisLabel }}
            />
            <YAxis
              type="number"
              dataKey="avg_lbmp"
              domain={[y0, y1]}
              ticks={ticks([y0, y1], Y_STEP)}
              tickFormatter={fmtUsdTick}
              tick={axisTick}
              stroke={CHART.axis}
              width={56}
              label={{ value: "Average price, LBMP ($/MWh)", angle: -90, position: "insideLeft", offset: -12, dy: 110, ...axisLabel }}
            />
            <ZAxis range={[72, 72]} />
            <ReferenceLine x={0} stroke={CHART.text} strokeWidth={1.5} label={<ZeroLabels />} />
            {trend && (
              <ReferenceLine
                segment={trend}
                stroke={CHART.text}
                strokeWidth={2}
                strokeDasharray="6 4"
                ifOverflow="hidden"
              />
            )}
            <Tooltip content={<ScatterTip />} cursor={{ stroke: CHART.axis, strokeDasharray: "3 3" }} />
            <Legend
              verticalAlign="top"
              align="right"
              height={36}
              iconSize={12}
              itemSorter={null}
              formatter={(value: string) => <span style={{ color: CHART.text, fontSize: CHART.fontSize }}>{value}</span>}
            />
            {series.map((s) => (
              <Scatter
                key={s.name}
                name={s.name}
                data={s.points}
                fill={s.color}
                fillOpacity={0.85}
                stroke={CHART.surface}
                strokeWidth={1}
                shape={s.shape}
                legendType={s.shape}
                isAnimationActive={false}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      {trend && (
        <p className="px-3 text-sm text-text-muted">
          <span aria-hidden className="mr-2 inline-block w-6 border-t-2 border-dashed border-text align-middle" />
          Overall trend: each $1.00 more negative congestion goes with about{" "}
          <span className="font-medium text-text tabular-nums">{fmtUsd(Math.abs(fit.slope!))}/MWh</span>{" "}
          {fit.slope! < 0 ? "higher" : "lower"} price. <span data-helper>One point per zone per month.</span>
        </p>
      )}
      <CorrelationTable data={data} />
    </div>
  );
}

function CorrelationTable({ data }: { data: ScatterResponse }) {
  const { overall, groups } = data.correlations;
  const rows = [
    ...GROUPS.map((g) => {
      const c = groups.find((x) => x.group === g.name);
      return { key: g.name, label: g.name, swatch: g, r: c?.r ?? null, n: c?.n ?? 0 };
    }),
    { key: "all", label: "All zones", swatch: null, r: overall.r, n: overall.n },
  ];
  return (
    <div className="mt-5 overflow-x-auto px-3">
      <table className="w-full min-w-[32rem] text-left">
        <caption className="pb-2 text-left text-sm font-medium text-text-muted">
          Correlation between price and congestion (Pearson r)
        </caption>
        <thead>
          <tr className="border-b border-border text-sm text-text-subtle">
            <th scope="col" className="py-2 pr-4 font-medium">
              Zone group
            </th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">
              r
            </th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">
              Zone-months
            </th>
            <th scope="col" className="py-2 font-medium">
              Reading
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className={`border-b border-border last:border-b-0 ${row.swatch ? "" : "font-medium"}`}>
              <th scope="row" className="py-2 pr-4 font-normal">
                <span className="inline-flex items-center gap-2">
                  {row.swatch ? <Marker shape={row.swatch.shape} color={row.swatch.color} /> : <span className="w-3" />}
                  {row.label}
                </span>
              </th>
              <td className="py-2 pr-4 text-right font-mono tabular-nums">{fmtR(row.r)}</td>
              <td className="py-2 pr-4 text-right tabular-nums text-text-muted">{row.n}</td>
              <td className="py-2 text-text-muted">{describeR(row.r)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Marker({ shape, color }: { shape: "circle" | "square" | "triangle"; color: string }) {
  return (
    <svg viewBox="0 0 12 12" className="size-3 shrink-0" aria-hidden>
      {shape === "circle" && <circle cx="6" cy="6" r="5.5" fill={color} />}
      {shape === "square" && <rect x="1" y="1" width="10" height="10" fill={color} />}
      {shape === "triangle" && <path d="M6 0.5 11.5 11H0.5Z" fill={color} />}
    </svg>
  );
}
