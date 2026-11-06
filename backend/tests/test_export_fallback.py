import importlib.util
import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "export_fallback.py"


def _load_script():
    spec = importlib.util.spec_from_file_location("export_fallback", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_level_routes_found():
    routes = _load_script().level_routes()
    for endpoint in ("scatter", "ranking/lbmp", "ranking/congestion", "summary"):
        assert ("minimum", endpoint, True) in routes
    for endpoint in ("seasonal", "hourly", "weekday-weekend", "extreme-days", "summary"):
        assert ("intermediate", endpoint, True) in routes
    assert ("intermediate", "timeseries", False) in routes
    assert ("intermediate", "event", False) in routes


def test_route_defaults_read_from_openapi():
    specs = {s["path"]: s["defaults"] for s in _load_script().route_specs()}
    assert specs["/api/intermediate/hourly"] == {"zone": "J_new_york_city", "months": "1,7"}
    assert specs["/api/intermediate/extreme-days"] == {"zone": "J_new_york_city", "n": "10"}
    assert specs["/api/intermediate/timeseries"] == {"granularity": "monthly"}  # zones defaults to null
    assert specs["/api/intermediate/event"] == {"start": "2023-02-01", "end": "2023-02-07"}
    assert specs["/api/minimum/scatter"] == {}
    assert specs["/api/advanced/flow/correlation"] == {
        "zones": "D_north,F_capital,J_new_york_city",
        "level": "daily",
    }
    assert specs["/api/advanced/map"] == {"metric": "congestion"}


def test_snapshot_name():
    m = _load_script()
    assert m.snapshot_name("minimum", "ranking/lbmp", {}, 2024) == "minimum/ranking_lbmp_2024.json"
    assert (
        m.snapshot_name("intermediate", "timeseries", {"granularity": "daily"}, None)
        == "intermediate/timeseries--granularity-daily_all.json"
    )
    assert m.snapshot_name("x", "y", {"zones": "A_west,B_genesee"}, None) == "x/y--zones-A_west+B_genesee_all.json"


def test_export_writes_every_file_matching_live_api(tmp_path, monkeypatch):
    module = _load_script()
    monkeypatch.setattr(module, "OUT_DIR", tmp_path)
    module.main()

    manifest = json.loads((tmp_path / "manifest.json").read_text(encoding="utf-8"))
    assert "health.json" in manifest["files"]
    expected = 1 + sum(
        (1 + len(module.EXTRA_VARIANTS.get(s["path"], []))) * (4 if s["accepts_year"] else 1)
        for s in module.route_specs()
    )
    assert len(manifest["files"]) == expected
    assert manifest["defaults"]["/api/intermediate/hourly"]["zone"] == "J_new_york_city"
    for endpoint in ("scatter", "ranking_lbmp", "ranking_congestion", "summary"):
        for period in ("all", "2023", "2024", "2025"):
            assert f"minimum/{endpoint}_{period}.json" in manifest["files"]

    # Naming must match resolveFallback() in frontend/src/lib/api.ts; content must match the API.
    with TestClient(app) as client:
        for path, params, file in [
            ("/api/minimum/scatter", None, "minimum/scatter_all.json"),
            ("/api/minimum/ranking/lbmp", {"year": 2024}, "minimum/ranking_lbmp_2024.json"),
            ("/api/minimum/summary", {"year": 2025}, "minimum/summary_2025.json"),
            ("/api/intermediate/hourly", {"year": 2024}, "intermediate/hourly_2024.json"),
            ("/api/intermediate/timeseries", {"granularity": "daily"}, "intermediate/timeseries--granularity-daily_all.json"),
            ("/api/intermediate/event", None, "intermediate/event_all.json"),
            ("/api/advanced/flow/trend", None, "advanced/flow_trend_all.json"),
            ("/api/advanced/flow/correlation", {"level": "hourly"}, "advanced/flow_correlation--level-hourly_all.json"),
            ("/api/advanced/map", {"year": 2024, "metric": "lbmp"}, "advanced/map--metric-lbmp_2024.json"),
            ("/api/health", None, "health.json"),
        ]:
            saved = json.loads((tmp_path / file).read_text(encoding="utf-8"))
            assert saved == client.get(path, params=params).json()
