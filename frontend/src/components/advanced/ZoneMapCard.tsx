"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { getZoneMap } from "@/lib/api-advanced";
import type { MapMetric, MapResponse } from "@/lib/types-advanced";
import { fmtUsd } from "../minimum/format";
import { ChartCard, Segmented, Skeleton } from "../minimum/ui";
import { SectionBody, SectionTakeaway, YEAR_OPTIONS, caption, toYear, useApi, type YearOption } from "../intermediate/shared";

import { MapErrorBoundary } from "./MapErrorBoundary";
import { LOWERED, NEUTRAL, PRICE, RAISED, makeScale, metricLabel } from "./mapScale";
import { SvgZoneMap } from "./SvgZoneMap";

// Leaflet needs `window`: load it only in the browser.
const LeafletZoneMap = dynamic(() => import("./LeafletZoneMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-full min-h-80 w-full" />,
});

type View = "street" | "simple";
const VIEW_OPTIONS = [
  { value: "street", label: "Street map" },
  { value: "simple", label: "Simple map" },
] as const;
const METRIC_OPTIONS = [
  { value: "congestion", label: "Congestion" },
  { value: "lbmp", label: "Price (LBMP)" },
] as const;

function takeaway(d: MapResponse): string {
  const zones = d.zones.filter((z) => z.value !== null);
  if (!zones.length) return "No data for this period.";
  const sorted = [...zones].sort((a, b) => a.value! - b.value!);
  if (d.metric === "lbmp") {
    const [lo, hi] = [sorted[0], sorted[sorted.length - 1]];
    return `Highest average price: ${hi.label} (${fmtUsd(hi.value!)}/MWh). Lowest: ${lo.label} (${fmtUsd(lo.value!)}/MWh).`;
  }
  const worst = sorted[0];
  const lowered = sorted.filter((z) => z.value! > 0);
  return (
    `Congestion raised prices most in ${worst.label} (${fmtUsd(worst.value!)}/MWh)` +
    (lowered.length
      ? `, and lowered them in ${lowered.map((z) => `${z.label} (+${fmtUsd(z.value!)})`).join(", ")}.`
      : ".")
  );
}

/**
 * Map of the 11 zones at their representative cities. Self-contained (fetches /api/advanced/map),
 * so it can also sit on other pages. Pass `year` to follow an outside year filter; otherwise it
 * shows its own year selector.
 */
export function ZoneMapCard({
  year: controlledYear,
  title = "Where is congestion worst?",
  height = 460,
}: {
  year?: YearOption;
  title?: string;
  height?: number;
}) {
  const [ownYear, setOwnYear] = useState<YearOption>("all");
  const year = controlledYear ?? ownYear;
  const [metric, setMetric] = useState<MapMetric>("congestion");
  const [view, setView] = useState<View>("street");
  const [tilesFailed, setTilesFailed] = useState(false);
  const state = useApi(`map:${year}:${metric}`, () => getZoneMap(toYear(year), metric));

  return (
    <ChartCard
      title={title}
      description={<SectionTakeaway state={state}>{takeaway}</SectionTakeaway>}
      caption={caption(state.data?.period)}
      controls={
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="Metric" size="sm" options={METRIC_OPTIONS} value={metric} onChange={setMetric} />
          {controlledYear === undefined && (
            <Segmented label="Year" size="sm" options={YEAR_OPTIONS} value={ownYear} onChange={setOwnYear} />
          )}
          <Segmented label="Map style" size="sm" options={VIEW_OPTIONS} value={view} onChange={setView} />
        </div>
      }
    >
      <SectionBody
        state={state}
        height="h-96"
        onReset={() => {
          setMetric("congestion");
          setOwnYear("all");
        }}
      >
        {(d) => (
          <div className="px-2">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
              <div className="zone-map min-w-0" style={{ height }}>
                {view === "simple" ? (
                  <SvgZoneMap data={d} height={height} />
                ) : (
                  <MapErrorBoundary fallback={<SvgZoneMap data={d} height={height} />}>
                    <LeafletZoneMap data={d} height={height} onTilesFailed={() => setTilesFailed(true)} />
                  </MapErrorBoundary>
                )}
              </div>
              <ZoneList data={d} />
            </div>
            <Legend data={d} />
            <p className="pt-2 text-sm text-text-muted">
              Markers show a representative city, not the zone boundary.{" "}
              <span data-helper>{view === "simple" ? "Hover a circle for details." : "Click a circle for details."}</span>
              {view === "street" && tilesFailed && (
                <span className="font-medium text-text">
                  {" "}
                  Street-map tiles couldn&apos;t load (no internet?), so the circles sit on a plain background. Their
                  positions and colors are unaffected.
                </span>
              )}
            </p>
            {d.data_notes.length > 0 && <p className="pt-1 text-sm text-text-subtle">Data note: {d.data_notes.join(" ")}</p>}
          </div>
        )}
      </SectionBody>
    </ChartCard>
  );
}

function ZoneList({ data }: { data: MapResponse }) {
  const scale = makeScale(data);
  const rows = [...data.zones].sort((a, b) =>
    data.metric === "lbmp" ? (b.value ?? 0) - (a.value ?? 0) : (a.value ?? 0) - (b.value ?? 0),
  );
  return (
    <table className="w-full self-start text-left text-sm">
      <caption className="pb-1 text-left font-medium text-text-muted">
        {metricLabel(data.metric)}, $/MWh
      </caption>
      <tbody>
        {rows.map((z) => (
          <tr key={z.zone} className="border-b border-border last:border-b-0">
            <th scope="row" className="py-1.5 pr-2 font-normal text-text">
              <span className="inline-flex items-center gap-2">
                <span aria-hidden className="size-3 shrink-0 rounded-full ring-1 ring-black/30" style={{ background: scale.style(z.value).fill }} />
                {z.label}
              </span>
            </th>
            <td className="py-1.5 text-right font-mono font-medium tabular-nums">{z.value === null ? "–" : fmtUsd(z.value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Legend({ data }: { data: MapResponse }) {
  const scale = makeScale(data);
  if (data.metric === "lbmp") {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-text-muted">
        <span>Cheaper ({fmtUsd(scale.lo)})</span>
        <Swatches colors={PRICE} />
        <span>More expensive ({fmtUsd(scale.hi)})</span>
        <span className="text-text-subtle">· Bigger circle = higher price</span>
      </div>
    );
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-text-muted">
      <span>Congestion raised the price ({fmtUsd(-scale.maxAbs)})</span>
      <Swatches colors={[...[...RAISED].reverse(), NEUTRAL, ...LOWERED]} />
      <span>lowered it (+{fmtUsd(scale.maxAbs)})</span>
      <span className="text-text-subtle">· Negative = congestion raised the price · Bigger circle = bigger effect</span>
    </div>
  );
}

function Swatches({ colors }: { colors: string[] }) {
  return (
    <span className="flex overflow-hidden rounded" aria-hidden>
      {colors.map((c, i) => (
        <span key={i} className="h-4 w-5" style={{ background: c }} />
      ))}
    </span>
  );
}
