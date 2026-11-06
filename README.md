# NYISO Grid Congestion Dashboard

**Live demo:** https://womanless-gravitate-expensive.ngrok-free.dev

Interactive dashboard analyzing New York electricity grid congestion prices (NYISO, Jan 2023 – Dec 2025).

- **Backend:** FastAPI + pandas (`./backend`, port 8000, all routes under `/api`)
- **Frontend:** Next.js App Router + TypeScript + Tailwind + Recharts (`./frontend`, port 3000)
- **Data:** CSVs in `./data` (loaded once at backend startup)

Domain rules and conventions live in [CLAUDE.md](CLAUDE.md) — read it before adding analysis.

## Running it

Requires Python 3.11+ and Node 20+. All commands run from the repo root.

```bash
npm run setup      # one time: creates .venv, installs Python + frontend deps
```

### Presenting: one command

```bash
npm run demo       # builds the site, starts API + site, prints "Demo ready: http://localhost:3000"
```

Ctrl+C stops both. If the API stops mid-demo, the site keeps working from the offline snapshot and the nav shows "Offline data". See [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) for the 3-minute script and [docs/PRESENTATION_GUIDE.md](docs/PRESENTATION_GUIDE.md) for the full guide.

### Developing: two terminals

```bash
npm run backend    # http://localhost:8000 (API docs at /docs); restarts on backend/app changes
```

```bash
npm run frontend   # http://localhost:3000
```

Run the backend tests:

```bash
npm test
```

Refresh the offline snapshot after adding or changing an endpoint (commit the result):

```bash
npm run export-fallback
```

### Without npm scripts

```bash
# backend (from repo root, with .venv activated). Avoid --reload on Windows; see scripts/backend.mjs
python -m uvicorn app.main:app --app-dir backend --port 8000
python -m pytest backend -q

# frontend
cd frontend && npm run dev
```

The frontend calls the API at `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`).
Set it in `frontend/.env.local` if the backend runs elsewhere.

## Layout

```
backend/
  app/main.py            FastAPI app, CORS, /api/health
  app/data.py            cached data store (get_store), SOURCE, ZONE_COLUMNS
  app/analysis/          pure analysis functions (one module per level)
  app/schemas/           Pydantic response models
  app/routers/           minimum.py, intermediate.py, advanced.py (one per level)
  scripts/export_fallback.py   writes frontend/public/fallback/*.json
  tests/                 pytest
frontend/
  public/fallback/       offline snapshot of every API response (generated, committed)
  src/app/               /minimum (landing; / and /where redirect here), /intermediate (/when redirects), /advanced (/moses-south redirects), /about, /status
  src/components/        Nav, minimum/*, intermediate/*, advanced/* (charts, cards, panels, Leaflet map + SVG fallback)
  src/lib/api.ts         typed fetch helper: live API first, offline snapshot on failure
  src/lib/types.ts       TS mirrors of backend response models
  src/lib/zones.ts       zone metadata + region colors
scripts/                 demo.mjs (npm run demo), backend.mjs (npm run backend), py.mjs
docs/                    DEMO_SCRIPT.md (final 3-min script), QA_PREP.md (judge questions), PRESENTATION_GUIDE.md
data/                    NYISO CSVs
```
