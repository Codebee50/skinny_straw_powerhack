"""Export every implemented API response to static JSON so the demo works without the backend.

Usage (from the repo root):  npm run export-fallback
                         or:  python backend/scripts/export_fallback.py

Walks every GET route under /api/<level>/... (from the OpenAPI schema), calls it through the
real FastAPI app (same Pydantic serialization as the live API) with its DEFAULT parameters, for
all years and each single year when the route accepts `year`, plus any EXTRA_VARIANTS, and writes:

    frontend/public/fallback/health.json
    frontend/public/fallback/<level>/<endpoint>[--<param>-<value>...]_<year|all>.json
    frontend/public/fallback/manifest.json   (file list + each route's default query values)

<endpoint> is the route path after the level with "/" replaced by "_". The "--param-value" part
appears only for non-default, non-year params (sorted by name), e.g.
    /api/minimum/ranking/lbmp?year=2024          -> minimum/ranking_lbmp_2024.json
    /api/intermediate/timeseries?granularity=daily -> intermediate/timeseries--granularity-daily_all.json
frontend/src/lib/api.ts resolves failed live requests with the same rule; a request whose
non-default params have no snapshot is reported as "needs live data".
"""

from __future__ import annotations

import json
import re
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_DIR.parent
OUT_DIR = REPO_ROOT / "frontend" / "public" / "fallback"
YEARS = [2023, 2024, 2025]

# Non-default parameter sets worth having offline (each is also exported per year if the route takes one).
EXTRA_VARIANTS: dict[str, list[dict[str, str]]] = {
    "/api/intermediate/timeseries": [{"granularity": "daily"}],
    "/api/advanced/flow/correlation": [{"level": "hourly"}],
    "/api/advanced/map": [{"metric": "lbmp"}],
}

sys.path.insert(0, str(BACKEND_DIR))

import warnings  # noqa: E402

warnings.filterwarnings("ignore", message=".*httpx.*")  # starlette TestClient deprecation notice

from fastapi.testclient import TestClient  # noqa: E402

from app.data import SOURCE  # noqa: E402
from app.main import app  # noqa: E402


def route_specs() -> list[dict[str, Any]]:
    """One spec per GET /api/<level>/<...> route: path, level, endpoint, accepts_year, defaults.

    `defaults` holds each query parameter's default value as a string (params without a default,
    or defaulting to null, are omitted). Read from the OpenAPI schema, so new routes are automatic.
    """
    specs = []
    for path, ops in app.openapi()["paths"].items():
        get = ops.get("get")
        parts = path.strip("/").split("/")  # ["api", level, ...rest]
        if get is None or len(parts) < 3 or parts[0] != "api":
            continue
        if any(p.startswith("{") for p in parts):
            raise SystemExit(f"Path parameters aren't supported by the fallback export: {path}")
        query = [p for p in get.get("parameters", []) if p.get("in") == "query"]
        defaults = {
            p["name"]: _as_str(p["schema"]["default"])
            for p in query
            if p["name"] != "year" and p.get("schema", {}).get("default") is not None
        }
        specs.append(
            {
                "path": path,
                "level": parts[1],
                "endpoint": "/".join(parts[2:]),
                "accepts_year": any(p["name"] == "year" for p in query),
                "defaults": defaults,
            }
        )
    return sorted(specs, key=lambda s: s["path"])


def level_routes() -> list[tuple[str, str, bool]]:
    """(level, endpoint_path, accepts_year) for every GET /api/<level>/<...> route."""
    return [(s["level"], s["endpoint"], s["accepts_year"]) for s in route_specs()]


def _as_str(value: Any) -> str:
    return str(value).lower() if isinstance(value, bool) else str(value)


def _safe(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]", "+", value)


def snapshot_name(level: str, endpoint: str, extras: dict[str, str], year: int | None) -> str:
    """Relative snapshot path. Must match resolveFallback() in frontend/src/lib/api.ts."""
    suffix = "".join(f"--{k}-{_safe(v)}" for k, v in sorted(extras.items()))
    return f"{level}/{endpoint.replace('/', '_')}{suffix}_{year or 'all'}.json"


def write(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def main() -> None:
    if OUT_DIR.exists():
        shutil.rmtree(OUT_DIR)  # generated folder; rebuild from scratch so removed endpoints disappear

    files: list[str] = []
    defaults: dict[str, dict[str, str]] = {}
    with TestClient(app) as client:
        res = client.get("/api/health")
        res.raise_for_status()
        write(OUT_DIR / "health.json", res.json())
        files.append("health.json")

        for spec in route_specs():
            defaults[spec["path"]] = spec["defaults"]
            for extras in [{}, *EXTRA_VARIANTS.get(spec["path"], [])]:
                for year in [None, *YEARS] if spec["accepts_year"] else [None]:
                    params = {**extras, **({"year": year} if year else {})}
                    res = client.get(spec["path"], params=params or None)
                    if res.status_code != 200:
                        raise SystemExit(f"{spec['path']} {params} returned {res.status_code}: {res.text[:200]}")
                    rel = snapshot_name(spec["level"], spec["endpoint"], extras, year)
                    write(OUT_DIR / rel, res.json())
                    files.append(rel)

    write(
        OUT_DIR / "manifest.json",
        {
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "source": SOURCE,
            "defaults": defaults,
            "files": files,
        },
    )
    shown = OUT_DIR.relative_to(REPO_ROOT) if OUT_DIR.is_relative_to(REPO_ROOT) else OUT_DIR
    print(f"Wrote {len(files)} fallback files to {shown}")
    for f in files:
        print(f"  {f}")


if __name__ == "__main__":
    main()
