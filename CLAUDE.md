# NYISO Grid Congestion Dashboard

Interactive web dashboard analyzing New York electricity grid congestion prices from NYISO data (2023–2025).
Backend: FastAPI + pandas (Python 3.11+). Frontend: Next.js (App Router) + TypeScript + Tailwind + Recharts.

## Domain rules (must follow)
- NYISO sets a price per zone (LBMP, $/MWh). LBMP = energy + losses − congestion.
- SIGN CONVENTION: in these files a NEGATIVE congestion cost means congestion RAISED the price in that zone (heavier congestion = more negative). POSITIVE means congestion LOWERED the price (power trapped, e.g. zone D North). Zero = no effect. Never flip this.
- "Heaviest congestion" = most negative avg_congestion_cost.
- 11 zones A–K. Column names: A_west, B_genesee, C_central, D_north, E_mohawk_valley, F_capital, G_hudson_valley, H_millwood, I_dunwoodie, J_new_york_city, K_long_island. Regions: A–F Upstate (A–E are the west/north generating side), G–I Lower Hudson Valley, J New York City, K Long Island. Always order zones A→K when ordering geographically.
- Display labels: "A · West", "B · Genesee", ... "J · New York City", "K · Long Island".
- Units: prices and congestion in $/MWh. Moses South flow column is named avg_flow_mwh but is in MW. Positive flow = southbound out of the North Country, negative = northbound.
- Hours are "hour beginning" in local time (hour 17 = 5–6 pm).
- When averaging monthly averages across months, WEIGHT BY HOURS IN THE MONTH (days_in_month × 24). Never take a plain mean of monthly averages.
- Monthly min_/max_ columns are single 5-minute extremes, not averages.
- The raw congestion file is missing 28 hours; the raw flow file is missing 8 hours. Don't fill them.
- Zone D North is exactly 0 for all of December 2025 in the monthly file; treat as a possible data gap and flag it, don't interpret it.
- Data cannot show: which transmission line caused congestion; total dollars paid (no usage data); causation (correlation only). Moses South carries ALL southbound North Country flow, not only Smart Path Connect.

## Data files (in ./data)
- Congestion_monthly_by_zone_2023_2025.csv — long format, 396 rows: year, month, season (Winter=Dec–Feb, Spring=Mar–May, Summer=Jun–Aug, Fall=Sep–Nov), zone, avg_lbmp, min_lbmp, max_lbmp, avg_congestion_cost, min_congestion_cost, max_congestion_cost. ONLY file with LBMP.
- Congestion_Daily_by_zone_2023_2025.csv — wide, 1,096 rows: date, day_of_week, is_weekend, then 11 zone columns (daily avg congestion).
- Congestion_Hourly_by_Month_2023_2025.csv — wide, 864 rows: year, month, hour (0–23), 11 zone columns (avg congestion for that hour of day in that month).
- Congestion_Raw_2023_2025.csv — wide, 26,276 rows: hour_timestamp (YYYY-MM-DD HH:MM), 11 zone columns (hourly congestion).
- Mosesouth_flow_2023_2025_dailyavg.csv — 1,096 rows: date, day_of_week, is_weekend, Interface Name, avg_flow_mwh.
- Mosesouth_flow_2023_2025_raw.csv — 26,296 rows: formatted_timestamp (YYYY-MM-DDTHH:MM), date, year, month, day, hour, Interface Name, avg_flow_mwh.
- zones_reference.csv — 11 rows: zone_letter, zone_name, nyiso_code, column_name, region, representative_city, latitude, longitude.

## Project conventions
- Backend in ./backend, frontend in ./frontend.
- All API routes under /api. Backend runs on port 8000, frontend on 3000.
- CORS (`backend/app/main.py`): any `http://localhost`/`127.0.0.1` port, plus exact public origins in `PUBLIC_ORIGINS` (currently the ngrok demo URL) and any in the `CORS_ORIGINS` env var (comma-separated). Tested in `backend/tests/test_cors.py`.
- Load all CSVs ONCE at startup into a cached data store; never re-read files per request.
- Every API response that feeds a chart includes a "source" string: "NYISO real-time zonal LBMP & Moses South interface flow, Jan 2023 – Dec 2025".
- Round money values to 2 decimals in API responses.
- Each level (minimum, intermediate, advanced) lives in its own router file and its own frontend route, so later levels never break earlier ones.
- Write pytest tests for every analysis function.

## Where things live
- `backend/app/data.py` — cached data store (`get_store()`), `SOURCE` string, `ZONE_COLUMNS` (A→K order).
- `backend/app/routers/{minimum,intermediate,advanced}.py` — one router per level, mounted at `/api/minimum`, `/api/intermediate`, `/api/advanced`.
- `backend/tests/` — pytest suite (run from repo root: `npm test`).
- `backend/app/analysis/minimum.py` — pure analysis functions; `backend/app/schemas/minimum.py` — Pydantic response models.
- `frontend/src/lib/api.ts` — typed fetch helper (`NEXT_PUBLIC_API_URL`, default `http://localhost:8000`).
- `frontend/src/lib/types.ts` — TS mirrors of the backend response models (keep in sync with `backend/app/schemas/`).
- `frontend/src/lib/zones.ts` — zone metadata + region colors.
- `frontend/src/app/{minimum,intermediate,advanced}/` — one route per level (Minimum, Intermediate, Advanced). `/` and `/where` redirect to `/minimum`, `/when` to `/intermediate`, `/moses-south` to `/advanced` (next.config.ts); `/status` shows API row counts.
- `frontend/src/components/<level>/` — components for each level (e.g. `components/minimum/`). Chart colors live in `components/minimum/chartTheme.ts`.

## Commands (from repo root)
- `npm run setup` — create `.venv`, install Python deps, install frontend deps.
- `npm run backend` — FastAPI on :8000, auto-restarts on `backend/app` changes (scripts/backend.mjs). Don't switch back to `uvicorn --reload`: on Windows its reload Ctrl+C kills the npm.cmd wrapper.
- `npm run frontend` — Next.js dev on :3000.
- `npm test` — backend pytest suite.
- `npm run demo` — one command for presenting: production build + API + site (scripts/demo.mjs). `npm run demo:dev` uses the dev server; `-- --web-port 3001` changes the site port.
- `npm run export-fallback` — rewrites the offline snapshot in `frontend/public/fallback/`. **Re-run it (and commit the files) whenever an endpoint is added or its output changes.**

## Offline fallback
- `frontend/src/lib/api.ts` `apiGet()` tries the live API first (3 s timeout). On a network error, timeout or 5xx it loads the matching snapshot and the nav shows "Offline data". A 4xx is never replaced by a snapshot.
- Naming rule (shared by `snapshot_name()` in `backend/scripts/export_fallback.py` and `resolveFallback()` in api.ts): `/api/<level>/<a>/<b>?year=Y&k=v` → `/fallback/<level>/<a>_<b>[--k-v...]_<Y|all>.json`. The `--k-v` part lists only non-`year` params that differ from the route's default, sorted by name; `/api/health` → `/fallback/health.json`.
- The export discovers routes from the OpenAPI schema (path parameters aren't supported) and exports each at its **default** params, per year when it takes `year`, plus `EXTRA_VARIANTS` (currently intermediate `timeseries?granularity=daily`, advanced `flow/correlation?level=hourly` and `map?metric=lbmp`). Default values are compared as exact strings, so a frontend that sends `zones` must use the backend's default order (`D_north,F_capital,J_new_york_city`) or omit it to hit the snapshot. `manifest.json` records each route's defaults and the file list.
- Offline, a request with non-default params that has no snapshot throws `NeedsLiveDataError`; Intermediate sections show "This selection needs live data" with a reset-to-default button. To make another selection work offline, add it to `EXTRA_VARIANTS` and re-export.

## Intermediate level ("When")
- Logic: `backend/app/analysis/intermediate.py`; models: `backend/app/schemas/intermediate.py`; router: `/api/intermediate/*` (timeseries, seasonal, hourly, weekday-weekend, extreme-days, event, summary).
- Default zones = top 3 heaviest-congestion zones over all years, from `minimum.congestion_ranking` (K, J, F); returned A→K.
- Seasonal: hour-weighted; with one `year`, "Winter" = that calendar year's Jan, Feb and Dec.
- Hourly with no `year`: each month's profile averages the three years, weighted by days in month.
- Event: window is start 00:00 → end 23:00 inclusive, ≤ 31 days; reports `missing_hours` (real gaps, not filled) separately from `dst_skipped_hours` (spring-forward hours that don't exist).
- Weekday/weekend and extreme days use the daily file (plain mean of days).
- Frontend: `/intermediate` (`/when` redirects there). Components in `frontend/src/components/intermediate/` (one file per section; `shared.tsx` has `useApi`, `SectionBody`, `SectionTakeaway`, zone series colors). Types in `src/lib/types-intermediate.ts`, fetchers in `src/lib/api-intermediate.ts`. It reuses `components/minimum/{ui,format,chartTheme,Panels}` read-only. Don't edit Minimum files for Intermediate work.
- Fixed series identity on this page: K blue solid, J orange dashed, F aqua dotted; other zones faint gray.

## Advanced level ("Moses South")
- Logic: `backend/app/analysis/advanced.py`; models: `backend/app/schemas/advanced.py`; router: `/api/advanced/*` (flow/trend, flow/correlation, map, summary). Reuses `minimum.weighted_mean_by_zone`/`filter_period`/`data_notes` and `intermediate.parse_zones`/`zone_info` read-only.
- Flow is reported as `flow_mw` (the source column `avg_flow_mwh` is MW), rounded to 0.1 MW. Positive = southbound.
- Correlation: `daily` = inner join on date (1,096 rows); `hourly` = inner join on timestamp after normalising both formats (26,271 matched; 25 flow and 5 congestion hours dropped, never filled). r uses every matched row; hourly `points` are a seeded random sample of ≤ 3,000 (seed 42).
- Spearman is computed as Pearson on average ranks (no scipy dependency; don't call `Series.corr(method="spearman")`, which needs scipy).
- Fit: congestion = slope × flow + intercept; `slope_per_100mw` is the readable form. Negative r ⇒ more southbound flow goes with congestion raising that zone's price more.
- Strength words on this level: |r| < 0.2 very weak, < 0.4 weak, < 0.6 moderate, else strong (different thresholds from the Minimum page).
- D · North is exactly 0 in the daily and raw files for all of Dec 2025 too (and 0 on 665 of 1,096 days overall); correlations include those rows and responses carry the data note when D is requested.
- Frontend: `/advanced` (`/moses-south` redirects). Components in `frontend/src/components/advanced/`; types `src/lib/types-advanced.ts`, fetchers `src/lib/api-advanced.ts`. Reuses `components/intermediate/shared.tsx` and `components/minimum/*` read-only.
- Map (`ZoneMapCard`): Leaflet via `next/dynamic({ ssr: false })` (`LeafletZoneMap.tsx` imports leaflet CSS + `zone-map.css`, scoped under `.zone-map`). Don't use a CSS module for Leaflet overrides: the Tailwind turbopack loader rejects `:global(...)`. OSM tiles; if ≥3 tiles fail the card says so and circles stay on a plain background. `MapErrorBoundary` falls back to `SvgZoneMap` (lat/long projection, no deps); users can also pick "Simple map". Color: diverging (congestion) / sequential blue (LBMP), scale in `mapScale.ts`; radius ∝ √|value|.
- `ZoneMapCard` is self-contained and also sits at the top of the Minimum page (`year` prop follows Minimum's year filter). That's the only Minimum-page change; Minimum data logic is untouched.
- Hourly correlation renders 3 × 3,000 SVG dots; it's noticeably slower to draw than daily (dev mode especially). Keep the demo on Daily.

## Presentation polish
- `/about` (`components/AboutContent.tsx`): question, data, method, stack, how AI was used, and every level's `cannot_conclude` list fetched live from the three summary endpoints (works offline via snapshots).
- Presentation mode: nav toggle (`lib/presentation.ts`) sets `<html data-present="on">`, remembered in localStorage. CSS in `globals.css` raises the root font to 20px and Recharts text to 16px, and hides `[data-helper]` elements. Tag explanatory chart footnotes with `data-helper`; never tag sources, legends, data notes or caveats.
- Talk track: `docs/DEMO_SCRIPT.md` (final, 3 min) and `docs/QA_PREP.md`. If numbers change, re-check them against the API.

