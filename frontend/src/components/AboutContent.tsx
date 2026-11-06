"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { DATA_SOURCE, apiGet } from "@/lib/api";
import { getAdvancedSummary } from "@/lib/api-advanced";
import { getIntermediateSummary } from "@/lib/api-intermediate";
import type { SummaryResponse } from "@/lib/types";
import { SectionBody, useApi, type ApiState } from "./intermediate/shared";
import { InfoIcon } from "./minimum/ui";

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-t border-border pt-8">
      <h2 id={id} className="text-2xl font-semibold tracking-tight">
        {title}
      </h2>
      <div className="mt-4 max-w-[70ch] space-y-3 text-lg leading-relaxed text-text-muted">{children}</div>
    </section>
  );
}

const STACK = [
  { part: "Data & analysis", tools: "Python, FastAPI, pandas, NumPy, Pydantic; pytest for every analysis function" },
  { part: "Website", tools: "Next.js (App Router), TypeScript, Tailwind CSS" },
  { part: "Charts", tools: "Recharts" },
  { part: "Map", tools: "Leaflet with OpenStreetMap tiles, plus a built-in SVG fallback map" },
  { part: "Resilience", tools: "Offline snapshot of every default view, used automatically if the API stops" },
];

export function AboutContent() {
  // The "cannot conclude" lists come from each level's summary endpoint, so they always match the app.
  const minimum = useApi("about:minimum", () => apiGet<SummaryResponse>("/api/minimum/summary"));
  const intermediate = useApi("about:intermediate", () => getIntermediateSummary());
  const advanced = useApi("about:advanced", () => getAdvancedSummary());

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <p className="text-sm font-medium tracking-wide text-text-subtle uppercase">About this project</p>
        <h1 className="mt-2 text-4xl leading-tight font-semibold tracking-tight text-balance">
          Where and when does grid congestion raise electricity prices in New York?
        </h1>
        <p className="mt-4 text-lg text-text-muted">
          New York makes much of its power upstate and in the North Country but uses much of it downstate. When the
          transmission lines between them fill up, that is <strong className="text-text">congestion</strong>, and it
          changes the wholesale price in each zone. This dashboard measures where that happens, when, and how it moves
          with power flowing south through the Moses South interface.
        </p>
      </header>

      <Section id="data" title="Data">
        <p>
          <span className="font-medium text-text">Source:</span> {DATA_SOURCE}.
        </p>
        <p>
          All 11 NYISO pricing zones, A (West) to K (Long Island). Monthly, daily and hourly congestion and price
          (LBMP, $/MWh), and Moses South interface flow (MW). The monthly file alone has 396 zone-months.
        </p>
        <p>
          Known gaps are reported, never filled: 28 missing hours in the hourly congestion file, 8 in the hourly flow
          file (3 of each are daylight-saving clock changes), and D · North showing exactly $0 for all of December 2025,
          which we flag as a likely data gap.
        </p>
      </Section>

      <Section id="method" title="Method">
        <p>
          <span className="font-medium text-text">Sign convention.</span> NYISO&apos;s price is energy + losses −
          congestion, so a <strong className="text-text">negative</strong> congestion number means congestion{" "}
          <strong className="text-text">raised</strong> the price; positive means it lowered it (power stuck behind a
          constraint, as in D · North). &ldquo;Heaviest congestion&rdquo; = most negative.
        </p>
        <p>
          <span className="font-medium text-text">Hour-weighted averages.</span> When we average monthly averages over
          a year or three, each month counts in proportion to its hours (days × 24). A plain average would let
          February count as much as January.
        </p>
        <p>
          <span className="font-medium text-text">Correlation, not causation.</span> Correlations (Pearson, and
          Spearman on the Moses South page) show how closely two things move together. They never show that one
          causes the other.
        </p>
        <p>
          <span className="font-medium text-text">Generated findings.</span> Every finding sentence in the app is
          built from the computed numbers; none is typed by hand, so they change when you change the year.
        </p>
      </Section>

      <Section id="stack" title="Tech stack">
        <table className="w-full text-left text-base">
          <tbody>
            {STACK.map((s) => (
              <tr key={s.part} className="border-b border-border last:border-b-0">
                <th scope="row" className="w-48 py-2 pr-4 align-top font-medium text-text">
                  {s.part}
                </th>
                <td className="py-2 text-text-muted">{s.tools}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section id="ai" title="How we used AI">
        <p>
          AI assisted with understanding the electricity-market domain, scaffolding the project, and generating code.
        </p>
        <p>
          The team verified every number against hand-checked expected values with automated tests: the backend test
          suite checks the published figures (for example Long Island&apos;s −$10.44/MWh average congestion, the
          −0.45 overall correlation and the yearly Moses South flows) before anything is shown.
        </p>
      </Section>

      <Section id="limits" title="What this data cannot tell us">
        <div className="space-y-6">
          <LimitsGroup title="Where (Minimum)" href="/minimum" state={minimum} />
          <LimitsGroup title="When (Intermediate)" href="/intermediate" state={intermediate} />
          <LimitsGroup title="Moses South (Advanced)" href="/advanced" state={advanced} />
        </div>
      </Section>
    </div>
  );
}

function LimitsGroup({
  title,
  href,
  state,
}: {
  title: string;
  href: string;
  state: ApiState<{ cannot_conclude: string[] }>;
}) {
  return (
    <div className="rounded-xl border-2 border-dashed border-border-strong bg-surface-2 p-5">
      <h3 className="flex items-center gap-2 text-lg font-semibold text-text">
        <InfoIcon className="size-5 text-text-muted" />
        <Link href={href} className="hover:underline">
          {title}
        </Link>
      </h3>
      <SectionBody state={state} height="h-24">
        {(d) => (
          <ul className="mt-3 space-y-2">
            {d.cannot_conclude.map((t) => (
              <li key={t} className="flex gap-3 text-base leading-relaxed text-text-muted">
                <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-text-subtle" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionBody>
    </div>
  );
}
