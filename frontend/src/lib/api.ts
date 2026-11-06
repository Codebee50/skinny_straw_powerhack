import type {
  CongestionRankingResponse,
  LbmpRankingResponse,
  MinimumData,
  ScatterResponse,
  SummaryResponse,
  Year,
} from "./types";

/**
 * Base URL for API calls. Default "" = same origin: the browser calls this website's /api/*, which
 * next.config.ts proxies to the backend (BACKEND_URL, default http://127.0.0.1:8000). That way a
 * single public URL (e.g. ngrok to port 3000) gets live data. Set NEXT_PUBLIC_API_URL to call a
 * backend directly instead (it must then allow this site's origin in CORS).
 */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
const API_LABEL = API_URL || "this site's /api proxy";

export const DATA_SOURCE =
  "NYISO real-time zonal LBMP & Moses South interface flow, Jan 2023 – Dec 2025";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Live requests that take longer than this fall back to the static snapshot. */
export const LIVE_TIMEOUT_MS = 3000;

// ---- Data mode: where the most recent response came from (drives the nav badge) ----

/** live = backend answered; fallback = served from /public/fallback snapshot; down = neither worked. */
export type DataMode = "checking" | "live" | "fallback" | "down";

let currentMode: DataMode = "checking";
const modeListeners = new Set<() => void>();

function setDataMode(mode: DataMode) {
  if (mode === currentMode) return;
  currentMode = mode;
  modeListeners.forEach((listener) => listener());
}

/** Subscribe with React's useSyncExternalStore(dataMode.subscribe, dataMode.get, dataMode.getServer). */
export const dataMode = {
  get: (): DataMode => currentMode,
  getServer: (): DataMode => "checking",
  subscribe(listener: () => void) {
    modeListeners.add(listener);
    return () => {
      modeListeners.delete(listener);
    };
  },
};

// ---- Fetching ----

async function liveGet<T>(path: string, init?: RequestInit): Promise<T> {
  const timeout = AbortSignal.timeout(LIVE_TIMEOUT_MS);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      signal,
      headers: { Accept: "application/json", ...init?.headers },
    });
  } catch {
    const reason = timeout.aborted ? `didn't respond within ${LIVE_TIMEOUT_MS / 1000}s` : "isn't reachable";
    throw new ApiError(`The API (${API_LABEL}) ${reason}. Is the backend running on port 8000?`, null);
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new ApiError(`GET ${path} failed with ${res.status}${detail ? `: ${detail}` : ""}`, res.status);
  }
  return (await res.json()) as T;
}

/** Thrown when the API is unreachable and no snapshot exists for these (non-default) parameters. */
export class NeedsLiveDataError extends ApiError {
  readonly needsLiveData = true;
  constructor(path: string) {
    super(`This view needs live data. The saved offline snapshot only covers the default selection (${path}).`, null);
    this.name = "NeedsLiveDataError";
  }
}

interface FallbackManifest {
  files: string[];
  /** API path -> default query values (as strings), from the backend's OpenAPI schema. */
  defaults: Record<string, Record<string, string>>;
}

let manifestRequest: Promise<FallbackManifest | null> | null = null;

function loadManifest(): Promise<FallbackManifest | null> {
  manifestRequest ??= fetch("/fallback/manifest.json")
    .then((res) => (res.ok ? (res.json() as Promise<FallbackManifest>) : null))
    .catch(() => null)
    .then((m) => {
      if (!m) manifestRequest = null; // retry next time
      return m;
    });
  return manifestRequest;
}

const safe = (v: string) => v.replace(/[^A-Za-z0-9_.-]/g, "+");

/**
 * Snapshot written by `npm run export-fallback` for an API path. Same rule as
 * snapshot_name() in backend/scripts/export_fallback.py:
 *   /api/health                                    -> health.json
 *   /api/minimum/ranking/lbmp?year=2024            -> minimum/ranking_lbmp_2024.json
 *   /api/intermediate/timeseries?granularity=daily -> intermediate/timeseries--granularity-daily_all.json
 * Params equal to the route's default are ignored. Returns "needs-live" when no snapshot matches.
 */
export function resolveFallback(path: string, manifest: FallbackManifest): string | "needs-live" {
  const url = new URL(path, "http://placeholder");
  const parts = url.pathname.replace(/^\/api\//, "").split("/").filter(Boolean);
  if (parts.length === 1) return manifest.files.includes(`${parts[0]}.json`) ? `/fallback/${parts[0]}.json` : "needs-live";
  const [level, ...endpoint] = parts;
  const defaults = manifest.defaults[url.pathname] ?? {};
  const extras = [...url.searchParams]
    .filter(([k, v]) => k !== "year" && defaults[k] !== v)
    .sort(([a], [b]) => a.localeCompare(b));
  const suffix = extras.map(([k, v]) => `--${k}-${safe(v)}`).join("");
  const file = `${level}/${endpoint.join("_")}${suffix}_${url.searchParams.get("year") ?? "all"}.json`;
  return manifest.files.includes(file) ? `/fallback/${file}` : "needs-live";
}

/**
 * Typed GET against the FastAPI backend. `path` starts with "/api/...".
 * Live data is the default; if the backend is unreachable, times out (3s) or errors (5xx),
 * the matching snapshot from /public/fallback is returned instead and the nav shows "Offline data".
 * If the request uses non-default parameters that weren't snapshotted, NeedsLiveDataError is thrown.
 */
export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const data = await liveGet<T>(path, init);
    setDataMode("live");
    return data;
  } catch (err) {
    // A 4xx is a bad request, not an outage: a snapshot wouldn't be the right answer.
    if (err instanceof ApiError && err.status !== null && err.status < 500) throw err;
    if (init?.signal?.aborted) throw err;
    const manifest = await loadManifest();
    if (manifest) {
      const snapshot = resolveFallback(path, manifest);
      if (snapshot === "needs-live") {
        setDataMode("fallback");
        throw new NeedsLiveDataError(path);
      }
      try {
        const res = await fetch(snapshot);
        if (res.ok) {
          const data = (await res.json()) as T;
          setDataMode("fallback");
          return data;
        }
      } catch {
        // fall through to "down"
      }
    }
    setDataMode("down");
    throw err;
  }
}

// ---- Response types -------------------------------------------------------

export type DatasetKey =
  | "monthly"
  | "daily"
  | "hourly_by_month"
  | "raw"
  | "flow_daily"
  | "flow_raw"
  | "zones";

export interface HealthResponse {
  status: "ok";
  rows_loaded: Record<DatasetKey, number>;
}

export const getHealth = (init?: RequestInit) => apiGet<HealthResponse>("/api/health", init);

// ---- Minimum level ----

const withYear = (path: string, year: Year | null) => (year ? `${path}?year=${year}` : path);

/** Fetch all four /api/minimum endpoints for one period in parallel. */
export async function getMinimumData(year: Year | null, init?: RequestInit): Promise<MinimumData> {
  const [scatter, lbmp, congestion, summary] = await Promise.all([
    apiGet<ScatterResponse>(withYear("/api/minimum/scatter", year), init),
    apiGet<LbmpRankingResponse>(withYear("/api/minimum/ranking/lbmp", year), init),
    apiGet<CongestionRankingResponse>(withYear("/api/minimum/ranking/congestion", year), init),
    apiGet<SummaryResponse>(withYear("/api/minimum/summary", year), init),
  ]);
  return { scatter, lbmp, congestion, summary };
}
