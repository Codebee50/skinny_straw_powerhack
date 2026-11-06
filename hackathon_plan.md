# NY Grid Congestion Explorer: Build Plan

**Stack:** FastAPI + pandas (backend) · Next.js + TypeScript + Tailwind + Recharts + react-leaflet (frontend)
**Rule:** every level is finished and demo-ready before the next one starts. If time runs out at any point, you present the last completed checkpoint.

---

## How to use this plan

1. Work through phases **in order**. Each phase ends with a **✅ Checkpoint**. Don't start the next phase until the checkpoint passes.
2. Each phase has a **Claude Code prompt**. Copy the whole block into Claude Code, run it, then check the result against the checkpoint.
3. After every checkpoint, **commit and tag** in git (e.g. `git tag minimum-done`). If the next phase breaks something, you can roll back in seconds.
4. Phase 0 creates a `CLAUDE.md` file with all the domain rules. Claude Code reads it automatically in every session, so later prompts stay short and consistent.

## Time budget (5-hour hackathon)

| Phase | What | Target time | Demo-ready after? |
|---|---|---|---|
| 0 | Setup and scaffold | 20 min | No |
| 1 | Minimum: backend | 25 min | No |
| 2 | Minimum: frontend | 35 min | **✅ Yes: Demo v1 (Minimum)** |
| 3 | Demo-proofing (fallback data, script v1) | 15 min | ✅ Yes, safer |
| 4 | Intermediate: backend | 25 min | Still v1 |
| 5 | Intermediate: frontend | 35 min | **✅ Yes: Demo v2 (Intermediate)** |
| 6 | Advanced: backend | 20 min | Still v2 |
| 7 | Advanced: frontend + map | 35 min | **✅ Yes: Demo v3 (Advanced)** |
| 8 | Final findings, script, rehearsal | 30 min | ✅ Final |

The hackathon's own checkpoint is a working Minimum chart **1.5 hours after kickoff**. Phases 0–2 hit that.

**Run locally for the demo.** Deployment is optional and only after Phase 8.

## Team split

| Role | Owns |
|---|---|
| Data lead | Runs backend prompts, checks numbers against the expected values in this plan |
| Visualization lead | Runs frontend prompts, polishes charts and labels |
| Analyst | Writes findings and the "what we cannot conclude" text for each level |
| Presenter | Writes and times the 3-minute script, joins whoever is behind |

Backend and frontend phases of the same level can run in parallel once the API shape from Phase 1 exists.

---

## Expected results (use these to check the work)

Computed from the provided data, all 3 years, months weighted by number of hours:

**Top 3 zones by average LBMP (price)**
1. K Long Island: $51.60/MWh
2. J New York City: $47.05/MWh
3. F Capital: $45.20/MWh *(I Dunwoodie is very close at $45.18; mention this)*

**Top 3 zones by heaviest (most negative) average congestion**
1. K Long Island: −$10.44/MWh
2. J New York City: −$6.13/MWh
3. F Capital: −$5.18/MWh

**Least congested:** D North (+0.85) and A West (+0.78) are positive, meaning congestion lowered their price.

**Per year top 3 (both metrics give the same zones):**
- 2023: K, F, J
- 2024: K, J, H
- 2025: K, J, I

**Scatter correlation (avg_lbmp vs avg_congestion_cost, monthly rows)**
- All zones: −0.45
- Upstate A–E: 0.01
- F–I: −0.46
- J–K: −0.62

**Intermediate checks**
- Weekday vs weekend (daily file): NYC −6.67 weekday vs −4.53 weekend; Long Island −10.82 vs −9.10
- Most congested NYC days: 2025-07-01 (−192.6), 2025-07-30 (−170.6), 2024-01-17 (−155.5)

**Advanced checks**
- Moses South average daily flow by year: 2023 ≈ 582 MW, 2024 ≈ 195 MW, 2025 ≈ −188 MW (net northbound in 2025)
- Daily correlation flow vs congestion: D +0.13, F −0.32, J −0.33

If Claude Code's numbers don't match these (to about 2 decimal places), something is wrong: usually the sign, the weighting, or the wrong file.

---

## Phase 0: Setup and scaffold (20 min)

**Goal:** a repo where backend and frontend both run and can talk to each other.

**Before running the prompt:** create an empty folder, open Claude Code in it, and copy all 7 CSV files into a `data/` subfolder.

### Claude Code prompt

```
I'm building a hackathon project: an interactive web dashboard that analyzes New York electricity grid congestion prices from NYISO data (2023–2025). Backend: FastAPI + pandas (Python 3.11+). Frontend: Next.js (App Router) + TypeScript + Tailwind + Recharts. The CSV data files are already in ./data/.

Do the following setup only. Do not build analysis features yet.

1. Create CLAUDE.md at the repo root with this exact domain context so every future session follows it:

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
   - Load all CSVs ONCE at startup into a cached data store; never re-read files per request.
   - Every API response that feeds a chart includes a "source" string: "NYISO real-time zonal LBMP & Moses South interface flow, Jan 2023 – Dec 2025".
   - Round money values to 2 decimals in API responses.
   - Each level (minimum, intermediate, advanced) lives in its own router file and its own frontend route, so later levels never break earlier ones.
   - Write pytest tests for every analysis function.

2. Backend scaffold in ./backend:
   - requirements.txt: fastapi, uvicorn[standard], pandas, numpy, pydantic, pytest, httpx
   - app/main.py with FastAPI app, CORS allowing http://localhost:3000, and GET /api/health returning {"status":"ok","rows_loaded":{...per file row counts...}}
   - app/data.py: loads all 7 CSVs at startup into a singleton (use lru_cache or a module-level store), parses dates, adds an "hours" column to the monthly frame (days_in_month × 24), adds zone_letter/label/region columns to the monthly frame by joining zones_reference.csv. Resolve the data folder path relative to the repo root so it works from any working directory.
   - app/routers/ folder with empty minimum.py, intermediate.py, advanced.py routers included in main.py under /api/minimum, /api/intermediate, /api/advanced.
   - tests/test_health.py checking the row counts: monthly 396, daily 1096, hourly_by_month 864, raw 26276, flow_daily 1096, flow_raw 26296, zones 11.
   - A README section with run commands.

3. Frontend scaffold in ./frontend:
   - create-next-app with TypeScript, Tailwind, App Router, ESLint, src/ directory.
   - Install recharts.
   - src/lib/api.ts: typed fetch helper using NEXT_PUBLIC_API_URL (default http://localhost:8000).
   - src/lib/zones.ts: zone metadata (letter, label, region, color per region) as a typed constant.
   - A layout with a top nav: "Where (Minimum)", "When (Intermediate)", "Moses South (Advanced)" — the last two can be placeholder pages saying "Coming soon".
   - Home page calls /api/health and shows row counts, to prove the connection works.
   - Clean, minimal design: white/neutral background, one accent color, readable at projector size (base font ≥ 16px).

4. Root files: .gitignore (node_modules, .next, __pycache__, .venv), a Makefile or package.json scripts with `backend`, `frontend`, and `test` commands, and initialize git with a first commit.

When done: run the backend tests, start both servers, confirm the home page shows row counts, and give me a short summary of the file structure and the exact commands to run everything. Do not start building analysis features.
```

### ✅ Checkpoint 0
- `pytest` passes in `backend/`
- Home page at http://localhost:3000 shows all 7 row counts
- `git tag phase0-done`

---

## Phase 1: Minimum backend (25 min)

**Goal:** API endpoints that answer every Minimum requirement, with tests that check the numbers.

### Claude Code prompt

```
Read CLAUDE.md first and follow its domain rules exactly (especially the sign convention and hour-weighted averaging).

Build the MINIMUM level analysis in backend/app/routers/minimum.py with logic in backend/app/analysis/minimum.py. Use only Congestion_monthly_by_zone_2023_2025.csv.

Endpoints (all accept optional query param `year` = 2023 | 2024 | 2025; omitted = all three years):

1. GET /api/minimum/scatter
   Returns one point per zone-month: {zone, zone_letter, label, region, year, month, season, avg_lbmp, avg_congestion_cost}.
   Also returns correlation (Pearson) between avg_lbmp and avg_congestion_cost: overall, and per region group: "Upstate (A–E)", "Capital & Hudson Valley (F–I)", "NYC & Long Island (J–K)".
   Also returns a simple linear fit (slope, intercept) overall, for a trend line.

2. GET /api/minimum/ranking/lbmp
   Hour-weighted average avg_lbmp per zone over the selected period. Return all 11 zones with: zone, zone_letter, label, region, value, rank (1 = highest price), is_top3. Also return the list sorted A→K and sorted by value.

3. GET /api/minimum/ranking/congestion
   Hour-weighted average avg_congestion_cost per zone. rank 1 = MOST NEGATIVE (heaviest congestion). Same response shape as above, with is_top3 for the three most negative. Also include, per zone, the single most negative 5-minute value in the period (min of min_congestion_cost) and the month it happened, as "worst_moment".

4. GET /api/minimum/summary
   Returns: top3 price zones, top3 congestion zones, the correlations, a short list of auto-generated plain-English findings built from the numbers (no hard-coded conclusions; generate sentences from computed values), and a fixed "cannot_conclude" list:
   - "Higher congestion in a zone does not tell us which transmission line was the bottleneck."
   - "Congestion and price moving together does not prove congestion caused the higher price; weather, fuel prices and demand affect both."
   - "Average $/MWh cannot be turned into total dollars paid, because zone electricity usage is not in this data."
   Also include a data_notes list containing the Zone D December 2025 all-zero flag if it falls in the selected period.

Every response includes "source" and "period" (e.g. "Jan 2023 – Dec 2025" or "Jan 2024 – Dec 2024").

Use Pydantic response models. Keep calculation functions pure (take a DataFrame, return data) so they're easy to test.

Tests in backend/tests/test_minimum.py must assert (all years, 2-decimal tolerance):
- LBMP top 3 in order: K_long_island 51.60, J_new_york_city 47.05, F_capital 45.20
- Congestion top 3 in order: K_long_island -10.44, J_new_york_city -6.13, F_capital -5.18
- D_north congestion ≈ +0.85 and A_west ≈ +0.78 (positive)
- Overall scatter correlation ≈ -0.45; J–K group ≈ -0.62; A–E group ≈ 0.01
- Per-year congestion top 3: 2023 [K, F, J], 2024 [K, J, H], 2025 [K, J, I]
- A test that a plain unweighted mean would give a different answer than the weighted one for at least one zone (proves weighting is applied).

Run the tests and fix anything failing. Then show me a sample JSON response from each endpoint (truncated) and stop. Do not build any frontend.
```

### ✅ Checkpoint 1
- All tests pass and the numbers match the **Expected results** section above
- http://localhost:8000/docs shows the 4 endpoints
- `git tag minimum-backend`

---

## Phase 2: Minimum frontend → Demo v1 (35 min)

**Goal:** a complete, presentable Minimum page. After this phase you can present.

### Claude Code prompt

```
Read CLAUDE.md first. The backend Minimum endpoints already exist (/api/minimum/scatter, /ranking/lbmp, /ranking/congestion, /summary). Look at backend/app/routers/minimum.py to get the exact response shapes and create matching TypeScript types in frontend/src/lib/types.ts.

Build the "Where (Minimum)" page at frontend/src/app/minimum/page.tsx and make it the default landing page (redirect / to /minimum, keep the health check as a small status dot in the nav).

Page layout, top to bottom, designed to be presented live on a projector:

1. Header: title "Where does grid congestion raise electricity prices in New York?", subtitle with the period and source.
   A year filter (segmented buttons: All, 2023, 2024, 2025) that refetches all data.

2. Key numbers row: 3 stat cards
   - "Most expensive zone" (name + $/MWh)
   - "Heaviest congestion" (name + $/MWh, with a small note "negative = congestion raised the price")
   - "Price ↔ congestion correlation, NYC & LI" (value)

3. Chart 1: Scatter plot (Recharts ScatterChart)
   x = avg congestion cost ($/MWh), y = avg LBMP ($/MWh). One series per region group, 3 distinct colors, legend.
   Overall trend line from slope/intercept.
   Add a shaded background or vertical reference line at x=0 with labels "← congestion raised price" and "congestion lowered price →".
   Tooltip shows zone label, month/year, season, both values.
   Under the chart: correlation per group in a small table.

4. Chart 2 and 3 side by side (stack on narrow screens): horizontal or vertical bar charts
   - Average LBMP by zone
   - Average congestion cost by zone (bars go below zero; top 3 most negative highlighted in the accent color, others grey)
   Each chart has a toggle: "Order A→K (geography)" / "Order by value". Top 3 bars highlighted and labeled with their value.

5. Findings panel: render the findings sentences from /summary.

6. "What this data cannot tell us" panel: render cannot_conclude items, visually distinct (e.g. bordered box with an info icon). Show data_notes if any.

7. Footer on the page: data source and period (required by the judges on every chart/slide).

Requirements:
- Axis labels with units on every chart.
- Loading skeletons and a friendly error state if the API is down.
- Numbers formatted as $X.XX.
- Accessible colors (don't rely on red/green alone).
- No external UI kit needed; Tailwind only. Keep components in src/components/minimum/.

Run `npm run build` and `npm run lint` and fix all errors. Start both servers, open the page and confirm every chart renders for All and for each year. Then give me a summary and stop. Do not start intermediate features.
```

### ✅ Checkpoint 2: **DEMO v1 READY**
- Page loads with all 3 charts, findings, and "cannot conclude" panel
- Year filter works
- Bars and stat cards match the Expected results
- Analyst writes 2–3 sentences of findings in their own words
- `git tag demo-v1-minimum`

**You can present from here.**

---

## Phase 3: Demo-proofing (15 min)

**Goal:** the demo can't fail because a server crashed, and you have a first script.

### Claude Code prompt

```
Read CLAUDE.md first. Make the demo resilient:

1. Add a script backend/scripts/export_fallback.py that calls every existing analysis function (all years and each single year, every endpoint currently implemented) and writes the JSON responses to frontend/public/fallback/<level>/<endpoint>_<year|all>.json.
   Add a Makefile/package script `export-fallback`.

2. In frontend/src/lib/api.ts: if the live API request fails or times out (3s), automatically load the matching fallback JSON instead, and show a small "offline data" badge in the nav. Live data stays the default.

3. Add a single command `make demo` (or `npm run demo` at the root) that starts the backend and frontend together (use concurrently or a simple shell script), so the presenter only runs one command.

4. Write docs/DEMO_SCRIPT.md: a 3-minute presentation script in this order: question → data → live chart walk-through (scatter, then bars) → findings → what we cannot conclude. Pull the numbers from the current API. Keep it to about 400 words with [CLICK] markers for when to change filters. Leave placeholders for team names.

Run the export, stop the backend, confirm the frontend still renders everything from fallback, then restart. Summarize and stop.
```

### ✅ Checkpoint 3
- With the backend stopped, the page still works and shows "offline data"
- `make demo` starts everything
- Presenter has read `DEMO_SCRIPT.md` aloud once
- `git tag demo-v1-safe`

---

## Phase 4: Intermediate backend (25 min)

**Goal:** answer *when* congestion happens. Only new files; Minimum stays untouched.

### Claude Code prompt

```
Read CLAUDE.md first. Build the INTERMEDIATE level in backend/app/routers/intermediate.py with logic in backend/app/analysis/intermediate.py. Do not modify minimum files.

The default "top 3 zones" for this level is the top 3 most-negative congestion zones over all years from the minimum analysis (import and reuse that function, don't duplicate it). Endpoints accept an optional `zones` query param (comma-separated column names) to override.

Endpoints:

1. GET /api/intermediate/timeseries?granularity=monthly|daily&zones=...
   monthly: from the monthly file, one point per month with each zone's avg_congestion_cost (x = "2023-01").
   daily: from the daily file, one point per date, plus a 30-day rolling mean per zone.
   Also return, per zone, the 3 worst months (most negative).

2. GET /api/intermediate/seasonal?year=...
   Hour-weighted avg congestion per season per zone (all 11 zones). Return as a matrix (season × zone) suitable for a grouped bar chart or heatmap. Season order: Winter, Spring, Summer, Fall.

3. GET /api/intermediate/hourly?zone=J_new_york_city&year=2024&months=1,7
   From Congestion_Hourly_by_Month: 24-hour profile for each requested month. Default compares January vs July of the selected year. Return the peak hour (most negative) per month, formatted like "5–6 pm".

4. GET /api/intermediate/weekday-weekend?year=...
   From the daily file using is_weekend: mean congestion for weekday vs weekend per zone, plus difference.

5. GET /api/intermediate/extreme-days?zone=J_new_york_city&n=10
   The n most negative days for that zone from the daily file, each with date, day_of_week, is_weekend, month, season, and the same-day value for all other zones. Also return a "common_patterns" summary computed from those days: count by season, count by year, count weekend vs weekday.

6. GET /api/intermediate/event?start=2023-02-01&end=2023-02-07
   Hourly congestion for all 11 zones from the raw file in that window, plus per-zone min and the timestamp of the min. Default to early Feb 2023.

7. GET /api/intermediate/summary
   Auto-generated plain-English findings from the numbers above (e.g. which season is worst per region, NYC peak hour in July vs January, weekday vs weekend gap, what the worst days have in common), plus cannot_conclude items specific to timing:
   - "Seeing congestion peak in a season or hour does not tell us why; weather, demand, outages and fuel prices all change at the same time."
   - "Daily and monthly averages hide 5-minute spikes; the worst moments are much more extreme than these averages."

All responses include "source" and "period".

Tests in backend/tests/test_intermediate.py:
- weekday vs weekend all years: J_new_york_city weekday ≈ -6.67, weekend ≈ -4.53; K_long_island weekday ≈ -10.82, weekend ≈ -9.10
- extreme days for J (n=3): 2025-07-01 ≈ -192.59, 2025-07-30 ≈ -170.63, 2024-01-17 ≈ -155.52
- hourly endpoint returns 24 points per month with hours 0–23
- seasonal uses hour weighting
- event endpoint returns hourly rows only within the requested window

Run the tests, fix failures, show truncated sample responses and stop. No frontend work.
```

### ✅ Checkpoint 4
- Tests pass, numbers match Expected results
- Minimum page still works unchanged
- `git tag intermediate-backend`

---

## Phase 5: Intermediate frontend → Demo v2 (35 min)

### Claude Code prompt

```
Read CLAUDE.md first. Intermediate backend endpoints exist under /api/intermediate (see backend/app/routers/intermediate.py for shapes; add TypeScript types). Build the "When (Intermediate)" page at frontend/src/app/intermediate/page.tsx with components in src/components/intermediate/. Do not change the Minimum page except to enable the nav link.

Page sections (each a card with a title phrased as a question, chart, and a one-line takeaway computed from the data):

1. "How has congestion changed over 3 years?" — line chart of the top 3 zones. Toggle monthly / daily (daily shows the 30-day rolling mean as the line and raw daily values as faint dots). Zero reference line. Mark the worst months.

2. "Is congestion worse in winter or summer?" — heatmap (season rows × zones A→K columns, diverging color: darker for more negative) OR grouped bars; heatmap preferred. Year filter.

3. "What time of day does congestion hit?" — line chart of the 24-hour profile, January vs July, with zone and year selectors. Highlight and label the peak hour for each month. X axis labeled as clock times.

4. "Weekdays vs weekends" — grouped bars per zone, weekday vs weekend.

5. "The 10 worst days" — zone selector, a table (date, weekday, season, value), plus small badges summarizing common patterns (e.g. "7 of 10 in summer").

6. "Spotlight: early February 2023" — hourly line chart of all zones for the event window, top 3 zones emphasized and others faint. One-sentence caption generated from the min values and timestamps.

7. Findings and "What this cannot tell us" panels from /api/intermediate/summary.

8. Source/period footer.

Make sure the Phase 3 fallback system covers these endpoints: update backend/scripts/export_fallback.py to include all intermediate endpoints with default parameters, run it, and confirm the page works with the backend stopped (non-default selector values may show "needs live data", that's acceptable).

Update docs/DEMO_SCRIPT.md: keep the total at 3 minutes; add one 30-second "when" segment featuring the single most striking intermediate finding.

Run build + lint, fix errors, verify in the browser, summarize and stop.
```

### ✅ Checkpoint 5: **DEMO v2 READY**
- All intermediate charts render; Minimum still works
- Offline fallback works for default views
- Analyst picks the **one** "when" finding to feature in the demo
- `git tag demo-v2-intermediate`

---

## Phase 6: Advanced backend (20 min)

### Claude Code prompt

```
Read CLAUDE.md first. Build the ADVANCED level in backend/app/routers/advanced.py with logic in backend/app/analysis/advanced.py. Do not modify minimum or intermediate files.

Context: Moses South is a NYISO interface in northern NY. NYPA's Smart Path Connect project upgrades lines in this corridor. Positive flow = southbound out of the North Country, negative = northbound. Moses South carries all southbound North Country flow, not only Smart Path Connect. Correlation ≠ causation.

Endpoints:

1. GET /api/advanced/flow/trend
   From Mosesouth_flow_2023_2025_dailyavg.csv: daily series with a 30-day rolling mean; yearly averages; monthly averages; share of days with net southbound (positive) vs northbound (negative) flow per year; yearly min/max days.

2. GET /api/advanced/flow/correlation?zones=D_north,F_capital,J_new_york_city&level=daily|hourly
   daily: inner join daily flow and daily congestion on date.
   hourly: inner join the two raw files on timestamp (normalize "YYYY-MM-DD HH:MM" and "YYYY-MM-DDTHH:MM" to the same datetime). Report how many rows matched and how many were dropped.
   Per zone: Pearson and Spearman correlation, n, linear fit (slope, intercept), and scatter points (for hourly, return a random sample of max 3,000 points with a fixed seed). Also per-year correlation per zone.

3. GET /api/advanced/map?year=...&metric=congestion|lbmp
   One entry per zone from zones_reference.csv with latitude, longitude, label, region and the hour-weighted average value (reuse the minimum analysis function). Include min/max across zones for color scaling.

4. GET /api/advanced/summary
   Auto-generated findings (yearly flow change, direction shift, correlation strength per zone in plain words: |r| < 0.2 "very weak", < 0.4 "weak", < 0.6 "moderate", else "strong"), and cannot_conclude:
   - "A correlation between Moses South flow and congestion shows they move together, not that one causes the other."
   - "Moses South carries all power flowing south from the North Country, not only Smart Path Connect, so changes in flow cannot be credited to that project alone."
   - "A change between years cannot be pinned on one cause; weather, fuel prices, demand, outages and new projects changed at the same time."

All responses include "source" and "period".

Tests in backend/tests/test_advanced.py:
- yearly avg flow ≈ 582 (2023), 195 (2024), -188 (2025), tolerance ±1
- daily Pearson correlation: D_north ≈ 0.13, F_capital ≈ -0.32, J_new_york_city ≈ -0.33 (2-decimal tolerance)
- hourly join matches > 26,000 rows
- map endpoint returns 11 zones with valid coordinates

Run tests, fix failures, update export_fallback.py to include advanced endpoints with defaults, run it, show truncated sample responses and stop.
```

### ✅ Checkpoint 6
- Tests pass, numbers match Expected results
- Analyst notes: flow went from net **southbound** in 2023 to net **northbound** in 2025. That is a striking finding to explain carefully (it's a pattern, not proof of why).
- `git tag advanced-backend`

---

## Phase 7: Advanced frontend + map → Demo v3 (35 min)

### Claude Code prompt

```
Read CLAUDE.md first. Advanced endpoints exist under /api/advanced (see backend/app/routers/advanced.py; add TypeScript types). Build the "Moses South (Advanced)" page at frontend/src/app/advanced/page.tsx with components in src/components/advanced/. Do not change other pages except to enable the nav link.

Install react-leaflet and leaflet (with @types/leaflet). Leaflet must be loaded with next/dynamic and ssr: false to avoid "window is not defined" errors. Import leaflet CSS. Use OpenStreetMap tiles, but if tiles fail to load (no internet at the venue), the circles must still render on a plain background; also add a simple SVG fallback map that projects lat/long to x/y if Leaflet fails entirely.

Page sections:

1. "Where is congestion worst?" — Map of New York, centered around [42.9, -75.5], zoom ~6. One circle per zone at its representative city. Circle color = avg congestion on a diverging scale (negative = warm, positive = cool, 0 = neutral), circle size = absolute value. Label each with the zone letter. Popup/tooltip: zone label, city, value. Year selector and metric toggle (congestion / LBMP). A legend explaining the color and "negative = congestion raised the price". Small note: "Markers show a representative city, not the zone boundary."

2. "How has Moses South flow changed?" — line chart of daily flow (faint) with the 30-day rolling mean (bold), zero line labeled "southbound ↑ / northbound ↓". Beside it: yearly average bars and % of days southbound per year.

3. "Does Moses South flow move with congestion?" — three scatter plots side by side (D, F, J), x = flow (MW), y = congestion ($/MWh), with fit line and r value in the title in plain words (e.g. "J · New York City: r = -0.33, weak"). Toggle daily/hourly. Small table of per-year correlations.

4. Findings and "What this cannot tell us" panels from /api/advanced/summary.

5. Source/period footer.

Also add the map as a small "overview" card at the top of the Minimum page ONLY if it can be done by reusing the same map component without touching Minimum data logic; otherwise skip.

Confirm fallback works for default views with the backend stopped. Update docs/DEMO_SCRIPT.md: still 3 minutes total; open with the map (it explains "where" instantly), and add a 30-second Moses South segment. Run build + lint, fix errors, verify in browser, summarize and stop.
```

### ✅ Checkpoint 7: **DEMO v3 READY**
- Map renders (also with no internet: circles on plain background or SVG fallback)
- Flow trend and 3 scatter plots render
- `git tag demo-v3-advanced`

---

## Phase 8: Final findings, script and rehearsal (30 min)

**Goal:** turn the app into a winning 3-minute story. Mostly human work; Claude Code helps polish.

### Claude Code prompt

```
Read CLAUDE.md and docs/DEMO_SCRIPT.md. Final polish for presentation, no new analysis:

1. Add an "About" page at /about with: the question, data source and period, method (hour-weighted averages, sign convention, correlation not causation), tech stack (FastAPI + pandas, Next.js + TypeScript, Recharts, Leaflet), an "How we used AI" section (AI assisted domain understanding, scaffolding and code generation; the team verified every number against hand-checked expected values with automated tests), and the full "what we cannot conclude" list from all three levels.

2. Add a "Presentation mode" toggle in the nav that increases font sizes and hides filters' helper text, for the projector.

3. Run every backend test, npm run build and lint. Regenerate fallback JSON. List anything that's broken.

4. Rewrite docs/DEMO_SCRIPT.md as the final 3-minute script (~420 words) in this order: question (10s) → data (15s) → map: where (25s) → scatter + rankings: how much (40s) → one "when" finding (30s) → Moses South (30s, only if built) → what we cannot conclude (20s) → why it matters: congestion shows where New York needs transmission, e.g. into NYC/Long Island and out of the North Country (10s). Include [CLICK] cues and exact numbers from the API.

5. Write docs/QA_PREP.md: 10 likely judge questions with short answers, including: "Why is zone D positive?", "Why weight by hours?", "Does this prove Smart Path Connect worked?", "Why did Moses South flow turn negative in 2025?" (answer honestly: the data shows the change but not the cause), "How would this scale?", "What did the AI do vs. what did you do?".

Summarize and stop.
```

### ✅ Final checkpoint
- Run through the script twice with a timer (must be under 3 minutes)
- Every team member can answer "Why is Zone D positive?" and "What does negative congestion mean?"
- Backup screenshots of each page saved in case the laptop dies
- `git tag final`

---

## If you're running out of time

| Time left | What to do |
|---|---|
| Phase 2 not done and < 1 hour left | Stop adding features. Get the scatter + 2 bar charts rendering, write the "cannot conclude" text, present. |
| Mid-Phase 4/5 | Present **Demo v1**. Mention one intermediate finding verbally if you have a number for it from the API. |
| Mid-Phase 6/7 | Present **Demo v2**. Mention the Moses South yearly trend verbally (582 → 195 → −188 MW). |
| 30 min left, whatever state | Stop coding. Commit, `make export-fallback`, rehearse. A smooth demo of less beats a broken demo of more. |

## Demo-day checklist (from the judges' guide)

- [ ] Congestion compared across zones or periods
- [ ] Calculations shown (rankings, correlations)
- [ ] At least one chart, shown **live**
- [ ] Short explanation of what the results suggest
- [ ] "What cannot be concluded" statement
- [ ] Data source and time period on every chart/page
