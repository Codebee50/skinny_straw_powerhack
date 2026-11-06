import type { SummaryResponse } from "@/lib/types";
import { describeR, fmtR, fmtUsd } from "./format";
import { Skeleton } from "./ui";

function Stat({ label, value, unit, detail, note }: { label: string; value: string; unit?: string; detail: string; note?: string }) {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-surface p-5">
      <p className="font-medium text-text-muted">{label}</p>
      <p className="mt-3 font-mono text-4xl font-semibold tracking-tight tabular-nums text-text">
        {value}
        {unit && <span className="ml-1 font-sans text-lg font-medium tracking-normal text-text-muted">{unit}</span>}
      </p>
      <p className="mt-1 text-lg font-medium text-text">{detail}</p>
      {note && <p className="mt-auto pt-3 text-sm text-text-subtle">{note}</p>}
    </div>
  );
}

export function StatCards({ summary }: { summary: SummaryResponse }) {
  const price = summary.top3_price[0];
  const cong = summary.top3_congestion[0];
  const jk = summary.correlations.groups.find((g) => g.group === "NYC & Long Island (J–K)");

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Stat label="Most expensive zone" value={fmtUsd(price.value)} unit="/MWh" detail={price.label} note="Hour-weighted average price (LBMP)" />
      <Stat
        label="Heaviest congestion"
        value={fmtUsd(cong.value)}
        unit="/MWh"
        detail={cong.label}
        note="Negative = congestion raised the price"
      />
      <Stat
        label="Price ↔ congestion correlation, NYC & LI"
        value={fmtR(jk?.r ?? null)}
        detail={describeR(jk?.r ?? null)}
        note={`Pearson r over ${jk?.n ?? 0} zone-months, zones J and K`}
      />
    </div>
  );
}

export function StatCardsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-xl border border-border bg-surface p-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-4 h-10 w-36" />
          <Skeleton className="mt-2 h-6 w-32" />
          <Skeleton className="mt-4 h-4 w-48" />
        </div>
      ))}
    </div>
  );
}
