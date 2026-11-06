"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { API_URL, ApiError, dataMode, getHealth, type DatasetKey, type HealthResponse } from "@/lib/api";

const DATASETS: { key: DatasetKey; file: string; description: string }[] = [
  { key: "monthly", file: "Congestion_monthly_by_zone_2023_2025.csv", description: "Monthly LBMP and congestion per zone" },
  { key: "daily", file: "Congestion_Daily_by_zone_2023_2025.csv", description: "Daily average congestion, 11 zones" },
  { key: "hourly_by_month", file: "Congestion_Hourly_by_Month_2023_2025.csv", description: "Hour-of-day profile per month" },
  { key: "raw", file: "Congestion_Raw_2023_2025.csv", description: "Hourly congestion, 11 zones" },
  { key: "flow_daily", file: "Mosesouth_flow_2023_2025_dailyavg.csv", description: "Moses South daily average flow" },
  { key: "flow_raw", file: "Mosesouth_flow_2023_2025_raw.csv", description: "Moses South hourly flow" },
  { key: "zones", file: "zones_reference.csv", description: "Zone names, regions, coordinates" },
];

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; data: HealthResponse };

export default function StatusPage() {
  const [state, setState] = useState<State>({ status: "loading" });

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getHealth({ cache: "no-store" })
      .then((data) => !cancelled && setState({ status: "ok", data }))
      .catch(
        (err) =>
          !cancelled &&
          setState({ status: "error", message: err instanceof ApiError ? err.message : String(err) }),
      );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = () => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-4xl font-semibold tracking-tight">API status</h1>
      <p className="mt-3 text-lg text-text-muted">
        Row counts the backend loaded from each CSV in ./data at startup.
      </p>

      <section aria-labelledby="status-heading" className="mt-12">
        <div className="flex items-center justify-between gap-4">
          <h2 id="status-heading" className="text-xl font-semibold tracking-tight">
            Data loaded by the API
          </h2>
          <StatusBadge state={state} />
        </div>

        <div aria-live="polite" className="mt-4 overflow-hidden rounded-xl border border-border bg-surface">
          {state.status === "error" ? (
            <div className="bg-danger-subtle px-5 py-5">
              <p className="font-medium text-danger">Couldn&apos;t load data status</p>
              <p className="mt-1 text-text-muted">{state.message}</p>
              <p className="mt-1 text-sm text-text-subtle">
                Start it with <code className="font-mono">npm run backend</code> from the repo root.
              </p>
              <button
                type="button"
                onClick={retry}
                className="mt-4 h-10 rounded-lg bg-accent px-4 font-medium text-accent-fg transition-transform duration-150 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 active:scale-[0.98]"
              >
                Retry connection
              </button>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border text-sm text-text-subtle">
                  <th scope="col" className="px-5 py-3 font-medium">
                    File
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">
                    Rows
                  </th>
                </tr>
              </thead>
              <tbody>
                {DATASETS.map((d) => (
                  <tr key={d.key} className="border-b border-border last:border-b-0">
                    <td className="px-5 py-3">
                      <div className="break-all font-mono text-sm text-text">{d.file}</div>
                      <div className="text-sm text-text-muted">{d.description}</div>
                    </td>
                    <td className="px-5 py-3 text-right align-top">
                      {state.status === "loading" ? (
                        <span className="ml-auto block h-6 w-16 animate-pulse rounded bg-surface-2" />
                      ) : (
                        <span className="font-mono text-lg font-medium tabular-nums">
                          {state.data.rows_loaded[d.key].toLocaleString("en-US")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="mt-3 text-sm text-text-subtle">
          GET <span className="font-mono">{API_URL}/api/health</span>
        </p>
      </section>
    </div>
  );
}

function StatusBadge({ state }: { state: State }) {
  const mode = useSyncExternalStore(dataMode.subscribe, dataMode.get, dataMode.getServer);
  if (state.status === "loading") return <span className="text-sm text-text-subtle">Checking…</span>;
  if (mode === "fallback")
    return (
      <span className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md bg-warning-subtle px-2.5 py-1 text-sm font-medium text-warning">
        <span aria-hidden className="size-2 rounded-full bg-warning" />
        Offline data (saved snapshot)
      </span>
    );
  if (state.status === "error")
    return (
      <span className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md bg-danger-subtle px-2.5 py-1 text-sm font-medium text-danger">
        <span aria-hidden className="size-2 rounded-full bg-danger" />
        API offline
      </span>
    );
  return (
    <span className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md bg-success-subtle px-2.5 py-1 text-sm font-medium text-success">
      <span aria-hidden className="size-2 rounded-full bg-success" />
      API connected
    </span>
  );
}
