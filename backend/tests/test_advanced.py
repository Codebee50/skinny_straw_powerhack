import math

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.analysis import advanced as a
from app.data import SOURCE, get_store
from app.main import app

TOL = 0.005  # 2-decimal tolerance


@pytest.fixture(scope="module")
def store():
    return get_store()


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


# ---- required checks ------------------------------------------------------------


def test_yearly_average_flow(store):
    yearly = {y["year"]: y["avg_flow_mw"] for y in a.yearly_flow(store.flow_daily)}
    assert yearly[2023] == pytest.approx(582, abs=1)
    assert yearly[2024] == pytest.approx(195, abs=1)
    assert yearly[2025] == pytest.approx(-188, abs=1)


@pytest.mark.parametrize("zone, want", [("D_north", 0.13), ("F_capital", -0.32), ("J_new_york_city", -0.33)])
def test_daily_pearson(store, zone, want):
    joined, _ = a.join_daily(store.flow_daily, store.daily)
    # J's exact r is −0.32504 (rounds to −0.33), just inside the 2-decimal tolerance.
    r = a.pearson(joined[a.FLOW], joined[zone])
    assert r == pytest.approx(want, abs=TOL)


def test_hourly_join_matches_more_than_26000(store):
    joined, stats = a.join_hourly(store.flow_raw, store.raw)
    assert stats["matched"] == len(joined) > 26_000
    assert stats["dropped_flow"] == stats["flow_rows"] - stats["matched"]
    assert stats["dropped_congestion"] == stats["congestion_rows"] - stats["matched"]
    assert joined["time"].is_unique


def test_map_returns_11_zones_with_coordinates(client):
    body = client.get("/api/advanced/map").json()
    assert len(body["zones"]) == 11
    assert [z["zone_letter"] for z in body["zones"]] == list("ABCDEFGHIJK")
    for z in body["zones"]:
        # New York State bounding box
        assert 40.4 <= z["latitude"] <= 45.1
        assert -79.8 <= z["longitude"] <= -71.8
        assert z["value"] is not None


# ---- unit tests for each function ------------------------------------------------


def test_flow_series_rolling_mean(store):
    series = a.flow_series(store.flow_daily)
    assert len(series) == 1096 and series[0]["date"] == "2023-01-01"
    assert series[28]["rolling_30d"] is None
    want = store.flow_daily.sort_values("date")[a.FLOW].iloc[:30].mean()
    assert series[29]["rolling_30d"] == pytest.approx(round(want, 1))


def test_yearly_flow_direction_split(store):
    for y in a.yearly_flow(store.flow_daily):
        assert y["southbound_days"] + y["northbound_days"] + y["zero_days"] == y["days"]
        assert y["min_day"]["flow_mw"] <= y["avg_flow_mw"] <= y["max_day"]["flow_mw"]
    shares = [y["share_southbound"] for y in a.yearly_flow(store.flow_daily)]
    assert shares == sorted(shares, reverse=True)  # southbound share falls every year


def test_monthly_flow(store):
    months = a.monthly_flow(store.flow_daily)
    assert len(months) == 36 and months[0]["month"] == "2023-01" and months[0]["days"] == 31
    jan = store.flow_daily[store.flow_daily["date"].dt.strftime("%Y-%m") == "2023-01"][a.FLOW].mean()
    assert months[0]["avg_flow_mw"] == pytest.approx(round(jan, 1))


def test_to_datetime_normalises_both_formats():
    a_ = a.to_datetime(pd.Series(["2023-02-05 12:00"]))
    b_ = a.to_datetime(pd.Series(["2023-02-05T12:00"]))
    assert a_.iloc[0] == b_.iloc[0] == pd.Timestamp("2023-02-05 12:00")


def test_hourly_join_from_raw_strings(store):
    """Joining works from the original string columns, not only pre-parsed datetimes."""
    flow = store.flow_raw.assign(formatted_timestamp=store.flow_raw["formatted_timestamp"].dt.strftime("%Y-%m-%dT%H:%M"))
    raw = store.raw.assign(hour_timestamp=store.raw["hour_timestamp"].dt.strftime("%Y-%m-%d %H:%M"))
    _, from_strings = a.join_hourly(flow, raw)
    _, from_parsed = a.join_hourly(store.flow_raw, store.raw)
    assert from_strings == from_parsed


def test_spearman_matches_rank_definition():
    x = pd.Series([1, 2, 3, 4, 5])
    assert a.spearman(x, x**3) == pytest.approx(1.0)  # monotonic, not linear
    assert a.spearman(x, -x) == pytest.approx(-1.0)
    assert a.spearman(pd.Series([1, 2, 2, 3]), pd.Series([1, 2, 2, 3])) == pytest.approx(1.0)  # ties


def test_pearson_edge_cases():
    assert a.pearson(pd.Series([1.0, 2.0]), pd.Series([1.0, 2.0])) is None  # too few points
    assert a.pearson(pd.Series([1.0, 1.0, 1.0]), pd.Series([1.0, 2.0, 3.0])) is None  # no variance


def test_linear_fit():
    fit = a.linear_fit(pd.Series([0.0, 100.0, 200.0]), pd.Series([1.0, 0.0, -1.0]))
    assert fit["slope"] == pytest.approx(-0.01)
    assert fit["slope_per_100mw"] == pytest.approx(-1.0)
    assert fit["intercept"] == pytest.approx(1.0)


@pytest.mark.parametrize(
    "r, label", [(0.0, "very weak"), (-0.19, "very weak"), (0.2, "weak"), (-0.39, "weak"), (0.4, "moderate"), (-0.6, "strong"), (None, "not enough data")]
)
def test_strength_thresholds(r, label):
    assert a.strength(r) == label


def test_zone_correlation_daily(store):
    joined, _ = a.join_daily(store.flow_daily, store.daily)
    c = a.zone_correlation(joined, "J_new_york_city")
    assert c["n"] == 1096 and len(c["points"]) == 1096 and c["sampled"] is False
    assert c["strength"] == "weak"
    assert c["fit"]["slope"] < 0  # more southbound flow ~ more negative NYC congestion
    assert [y["year"] for y in c["per_year"]] == [2023, 2024, 2025]
    assert sum(y["n"] for y in c["per_year"]) == c["n"]


def test_hourly_sample_is_capped_and_reproducible(store):
    joined, _ = a.join_hourly(store.flow_raw, store.raw)
    c1 = a.zone_correlation(joined, "F_capital", a.SAMPLE_MAX, a.SAMPLE_SEED, "%Y-%m-%d %H:%M")
    c2 = a.zone_correlation(joined, "F_capital", a.SAMPLE_MAX, a.SAMPLE_SEED, "%Y-%m-%d %H:%M")
    assert len(c1["points"]) == 3000 and c1["sampled"] is True
    assert c1["points"] == c2["points"]
    assert c1["n"] == len(joined)  # correlation uses every matched hour, not just the sample
    assert c1["points"] == sorted(c1["points"], key=lambda p: p["time"])


def test_map_values_reuse_minimum_weighting(store):
    from app.analysis.minimum import weighted_mean_by_zone

    res = a.map_values(store.monthly, store.zones, None, "congestion")
    k = next(z for z in res["zones"] if z["zone"] == "K_long_island")
    assert k["value"] == pytest.approx(-10.44, abs=TOL)
    assert k["value"] == round(weighted_mean_by_zone(store.monthly, "avg_congestion_cost")["K_long_island"], 2)
    assert res["min"] == min(z["value"] for z in res["zones"]) == k["value"]
    lbmp = a.map_values(store.monthly, store.zones, 2024, "lbmp")
    assert lbmp["period"] == "Jan 2024 – Dec 2024" and lbmp["max"] == pytest.approx(42.54, abs=TOL)
    with pytest.raises(ValueError):
        a.map_values(store.monthly, store.zones, None, "flow")


def test_notes_for_zones(store):
    assert len(a.notes_for_zones(store.monthly, store.zones, ["D_north"])) == 1
    assert a.notes_for_zones(store.monthly, store.zones, ["J_new_york_city", "K_long_island"]) == []


def test_findings_generated_from_values(store):
    text = " ".join(a.findings(store.flow_daily, store.daily, store.flow_raw, store.raw, store.zones))
    assert "581.9 MW southbound in 2023" in text
    assert "188.1 MW northbound in 2025" in text
    assert "flipped direction" in text
    assert "88% in 2023" in text and "31% in 2025" in text
    assert "D · North congestion: very weak positive correlation (r = 0.13)" in text
    assert "J · New York City congestion: weak negative correlation" in text
    assert "Hour by hour the links are weaker" in text


# ---- endpoints ------------------------------------------------------------------

ENDPOINTS = ["/flow/trend", "/flow/correlation", "/flow/correlation?level=hourly", "/map", "/summary"]


@pytest.mark.parametrize("path", ENDPOINTS)
def test_endpoints_include_source_and_period(client, path):
    res = client.get(f"/api/advanced{path}")
    assert res.status_code == 200
    body = res.json()
    assert body["source"] == SOURCE
    assert body["period"] == "Jan 2023 – Dec 2025"


def test_flow_trend_endpoint(client):
    body = client.get("/api/advanced/flow/trend").json()
    assert body["interface"] == "MOSES SOUTH" and body["unit"] == "MW"
    assert len(body["daily"]) == 1096 and len(body["monthly"]) == 36 and len(body["yearly"]) == 3


def test_correlation_endpoint_daily_and_hourly(client):
    daily = client.get("/api/advanced/flow/correlation").json()
    assert [z["zone"] for z in daily["zones"]] == ["D_north", "F_capital", "J_new_york_city"]
    assert daily["join"]["matched"] == 1096 and daily["join"]["dropped_flow"] == 0
    assert len(daily["data_notes"]) == 1  # D · North Dec 2025
    hourly = client.get("/api/advanced/flow/correlation", params={"level": "hourly", "zones": "K_long_island"}).json()
    assert hourly["join"]["matched"] > 26_000
    assert hourly["zones"][0]["sampled"] is True and len(hourly["zones"][0]["points"]) == 3000
    assert hourly["data_notes"] == []
    assert all(not math.isnan(p["flow_mw"]) for p in hourly["zones"][0]["points"])


def test_summary_endpoint(client):
    body = client.get("/api/advanced/summary").json()
    assert body["cannot_conclude"] == a.CANNOT_CONCLUDE
    assert [c["zone"] for c in body["correlations"]] == a.DEFAULT_CORRELATION_ZONES
    assert body["correlations"][0]["label"] == "D · North"
    assert len(body["findings"]) >= 6


@pytest.mark.parametrize(
    "path, params",
    [
        ("/flow/correlation", {"zones": "nowhere"}),
        ("/flow/correlation", {"level": "weekly"}),
        ("/map", {"metric": "flow"}),
        ("/map", {"year": 2022}),
    ],
)
def test_bad_input_returns_422(client, path, params):
    assert client.get(f"/api/advanced{path}", params=params).status_code == 422
