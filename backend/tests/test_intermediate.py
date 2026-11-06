from datetime import date

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.analysis import intermediate as a
from app.data import SOURCE, ZONE_COLUMNS, get_store
from app.main import app

TOL = 0.005  # 2-decimal tolerance


@pytest.fixture(scope="module")
def store():
    return get_store()


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


# ---- required checks ---------------------------------------------------------


def test_weekday_weekend_all_years(store):
    rows = {r["zone"]: r for r in a.weekday_weekend(store.daily)}
    assert rows["J_new_york_city"]["weekday"] == pytest.approx(-6.67, abs=TOL)
    assert rows["J_new_york_city"]["weekend"] == pytest.approx(-4.53, abs=TOL)
    assert rows["K_long_island"]["weekday"] == pytest.approx(-10.82, abs=TOL)
    assert rows["K_long_island"]["weekend"] == pytest.approx(-9.10, abs=TOL)
    # difference = weekday − weekend (negative: weekdays more congested)
    assert rows["J_new_york_city"]["difference"] == pytest.approx(-6.67 - -4.53, abs=0.011)
    assert rows["J_new_york_city"]["weekday_days"] + rows["J_new_york_city"]["weekend_days"] == 1096


def test_extreme_days_j_top3(store):
    days = a.extreme_days(store.daily, "J_new_york_city", 3)["days"]
    assert [d["date"] for d in days] == ["2025-07-01", "2025-07-30", "2024-01-17"]
    for d, want in zip(days, [-192.59, -170.63, -155.52]):
        assert d["value"] == pytest.approx(want, abs=TOL)


def test_hourly_returns_24_points_per_month(store):
    profiles = a.hourly_profiles(store.hourly_by_month, "J_new_york_city", [1, 7], 2024)
    assert [p["month"] for p in profiles] == [1, 7]
    for p in profiles:
        assert len(p["points"]) == 24
        assert [pt["hour"] for pt in p["points"]] == list(range(24))
        assert all(pt["value"] is not None for pt in p["points"])


def test_seasonal_uses_hour_weighting(store):
    m = store.monthly
    res = a.seasonal_matrix(m)
    winter = res["rows"][0]
    assert winter["season"] == "Winter"
    sub = m[(m["season"] == "Winter") & (m["zone"] == "K_long_island")]
    weighted = (sub["avg_congestion_cost"] * sub["hours"]).sum() / sub["hours"].sum()
    plain = sub["avg_congestion_cost"].mean()
    assert winter["values"]["K_long_island"] == pytest.approx(weighted, abs=TOL)
    # Winter mixes 28/29- and 31-day months, so weighting must matter for at least one zone.
    differs = [
        z
        for z in ZONE_COLUMNS
        if round(
            (lambda s: (s["avg_congestion_cost"] * s["hours"]).sum() / s["hours"].sum())(
                m[(m["season"] == "Winter") & (m["zone"] == z)]
            ),
            2,
        )
        != round(m[(m["season"] == "Winter") & (m["zone"] == z)]["avg_congestion_cost"].mean(), 2)
    ]
    assert differs, "weighted and plain seasonal means are identical for every zone"
    assert round(plain, 2) != round(weighted, 2) or differs


def test_seasonal_weighting_toy():
    df = pd.DataFrame(
        {
            "zone": ["A_west", "A_west"],
            "season": ["Winter", "Winter"],
            "year": [2023, 2023],
            "month": [1, 2],
            "hours": [744, 672],
            "avg_congestion_cost": [-10.0, -20.0],
        }
    )
    res = a.seasonal_matrix(df)
    want = (-10 * 744 + -20 * 672) / (744 + 672)
    assert res["rows"][0]["values"]["A_west"] == pytest.approx(round(want, 2))
    assert res["rows"][0]["values"]["A_west"] != pytest.approx(-15.0)


def test_event_rows_only_within_window(store):
    res = a.event_window(store.raw, date(2023, 2, 1), date(2023, 2, 7))
    stamps = [r["timestamp"] for r in res["rows"]]
    assert stamps[0] == "2023-02-01 00:00"
    assert stamps[-1] == "2023-02-07 23:00"
    assert all("2023-02-01 00:00" <= s <= "2023-02-07 23:00" for s in stamps)
    assert len(stamps) == 7 * 24  # no gaps in this window
    assert set(res["rows"][0]["values"]) == set(ZONE_COLUMNS)


# ---- unit tests for each function ---------------------------------------------


def test_default_top_zones_reuses_minimum_ranking(store):
    assert a.default_top_zones(store.monthly) == ["K_long_island", "J_new_york_city", "F_capital"]


def test_parse_zones():
    default = ["K_long_island", "F_capital"]  # rank order in, A→K order out
    assert a.parse_zones(None, default) == ["F_capital", "K_long_island"]
    assert a.parse_zones("  ", default) == ["F_capital", "K_long_island"]
    # returned in A→K order, duplicates collapsed
    assert a.parse_zones("K_long_island, A_west,K_long_island", default) == ["A_west", "K_long_island"]
    with pytest.raises(ValueError):
        a.parse_zones("A_west,nowhere", default)


@pytest.mark.parametrize(
    "hour, label",
    [(0, "12–1 am"), (5, "5–6 am"), (11, "11 am–12 pm"), (12, "12–1 pm"), (17, "5–6 pm"), (23, "11 pm–12 am")],
)
def test_hour_label(hour, label):
    assert a.hour_label(hour) == label


def test_hourly_peak_is_most_negative(store):
    jan, jul = a.hourly_profiles(store.hourly_by_month, "J_new_york_city", [1, 7], 2024)
    for p in (jan, jul):
        values = [pt["value"] for pt in p["points"]]
        assert p["peak"]["value"] == min(values)
        assert p["peak"]["label"] == a.hour_label(p["peak"]["hour"])
    assert (jan["peak"]["hour"], jul["peak"]["hour"]) == (20, 19)


def test_hourly_all_years_is_day_weighted(store):
    h = store.hourly_by_month
    (feb,) = a.hourly_profiles(h, "K_long_island", [2], None)
    assert feb["years"] == [2023, 2024, 2025]
    rows = h[(h["month"] == 2) & (h["hour"] == 0)].sort_values("year")
    weights = [28, 29, 28]  # 2024 is a leap year
    want = sum(v * w for v, w in zip(rows["K_long_island"], weights)) / sum(weights)
    assert feb["points"][0]["value"] == pytest.approx(round(want, 2))


def test_hourly_rejects_bad_input(store):
    with pytest.raises(ValueError):
        a.hourly_profiles(store.hourly_by_month, "nowhere", [1], 2024)
    with pytest.raises(ValueError):
        a.hourly_profiles(store.hourly_by_month, "J_new_york_city", [13], 2024)


def test_monthly_timeseries(store):
    pts = a.monthly_timeseries(store.monthly, ["K_long_island", "J_new_york_city"])
    assert len(pts) == 36
    assert pts[0]["x"] == "2023-01" and pts[-1]["x"] == "2025-12"
    assert set(pts[0]["values"]) == {"K_long_island", "J_new_york_city"}
    assert pts[0]["rolling_30d"] is None


def test_daily_timeseries_rolling_mean(store):
    zones = ["J_new_york_city"]
    pts = a.daily_timeseries(store.daily, zones)
    assert len(pts) == 1096 and pts[0]["x"] == "2023-01-01"
    assert pts[28]["rolling_30d"]["J_new_york_city"] is None  # day 29: not a full window yet
    want = store.daily.sort_values("date")["J_new_york_city"].iloc[:30].mean()
    assert pts[29]["rolling_30d"]["J_new_york_city"] == pytest.approx(round(want, 2))


def test_worst_months(store):
    wm = a.worst_months(store.monthly, ["K_long_island"])
    k = wm["K_long_island"]
    assert len(k) == 3
    assert k[0]["value"] <= k[1]["value"] <= k[2]["value"]
    assert k[0]["month_label"] == "Feb 2023" and k[0]["value"] == pytest.approx(-43.24, abs=TOL)


def test_region_season_means_cover_all_regions(store):
    means = a.region_season_means(store.monthly)
    assert set(means) == {"Upstate", "Lower Hudson Valley", "New York City", "Long Island"}
    assert all(set(v) == set(a.SEASONS) for v in means.values())


def test_extreme_days_patterns(store):
    res = a.extreme_days(store.daily, "J_new_york_city", 10)
    pat = res["common_patterns"]
    assert sum(pat["by_season"].values()) == 10
    assert list(pat["by_season"]) == a.SEASONS
    assert sum(pat["by_year"].values()) == 10
    assert pat["weekday"] + pat["weekend"] == 10
    day = res["days"][0]
    assert "J_new_york_city" not in day["other_zones"] and len(day["other_zones"]) == 10
    assert day["season"] == "Summer" and day["month"] == 7


def test_event_reports_dst_and_real_gaps(store):
    dst = a.event_window(store.raw, date(2023, 3, 11), date(2023, 3, 13))
    assert dst["dst_skipped_hours"] == ["2023-03-12 02:00"]
    assert dst["missing_hours"] == []
    gap = a.event_window(store.raw, date(2025, 5, 27), date(2025, 5, 28))
    assert {"2025-05-27 22:00", "2025-05-27 23:00"} <= set(gap["missing_hours"])
    assert gap["dst_skipped_hours"] == []


def test_event_zone_min(store):
    res = a.event_window(store.raw, date(2023, 2, 1), date(2023, 2, 7))
    k = res["zone_min"]["K_long_island"]
    assert k["timestamp"] == "2023-02-05 12:00"
    assert k["value"] == min(r["values"]["K_long_island"] for r in res["rows"])


def test_event_validation(store):
    with pytest.raises(ValueError):
        a.event_window(store.raw, date(2023, 2, 7), date(2023, 2, 1))
    with pytest.raises(ValueError):
        a.event_window(store.raw, date(2023, 1, 1), date(2023, 3, 1))  # > 31 days
    with pytest.raises(ValueError):
        a.event_window(store.raw, date(2030, 1, 1), date(2030, 1, 2))


def test_findings_generated_from_values(store):
    top = a.default_top_zones(store.monthly)
    text = " ".join(a.findings(store.monthly, store.daily, store.hourly_by_month, store.zones, top))
    assert "Long Island: congestion is heaviest in" in text
    assert "In New York City, congestion peaks at" in text
    assert "Weekdays are more congested than weekends" in text
    assert "2025-07-01 (Tuesday)" in text
    assert "K · Long Island in Feb 2023" in text


# ---- endpoints -----------------------------------------------------------------

ENDPOINTS = ["/timeseries", "/seasonal", "/hourly", "/weekday-weekend", "/extreme-days", "/event", "/summary"]


@pytest.mark.parametrize("path", ENDPOINTS)
def test_endpoints_include_source_and_period(client, path):
    res = client.get(f"/api/intermediate{path}")
    assert res.status_code == 200
    body = res.json()
    assert body["source"] == SOURCE
    assert body["period"]


def test_timeseries_endpoint_default_and_override(client):
    body = client.get("/api/intermediate/timeseries").json()
    assert [z["zone"] for z in body["zones"]] == ["F_capital", "J_new_york_city", "K_long_island"]
    assert body["default_zones"] is True
    assert set(body["worst_months"]) == {"F_capital", "J_new_york_city", "K_long_island"}
    custom = client.get("/api/intermediate/timeseries", params={"zones": "A_west", "granularity": "daily"}).json()
    assert [z["zone"] for z in custom["zones"]] == ["A_west"] and custom["default_zones"] is False
    assert custom["points"][-1]["rolling_30d"]["A_west"] is not None


def test_hourly_endpoint_defaults_to_jan_vs_jul(client):
    body = client.get("/api/intermediate/hourly", params={"year": 2024}).json()
    assert body["zone"]["zone"] == "J_new_york_city"
    assert [p["month"] for p in body["profiles"]] == [1, 7]
    assert body["profiles"][1]["peak"]["label"] == "7–8 pm"


def test_event_endpoint_window(client):
    body = client.get("/api/intermediate/event", params={"start": "2023-02-03", "end": "2023-02-03"}).json()
    assert len(body["rows"]) == 24
    assert all(r["timestamp"].startswith("2023-02-03") for r in body["rows"])
    assert body["period"] == "3 Feb 2023 – 3 Feb 2023"


@pytest.mark.parametrize(
    "path, params",
    [
        ("/hourly", {"zone": "nowhere"}),
        ("/hourly", {"months": "1,x"}),
        ("/extreme-days", {"n": 0}),
        ("/event", {"start": "2023-02-07", "end": "2023-02-01"}),
        ("/timeseries", {"zones": "nowhere"}),
        ("/seasonal", {"year": 2022}),
    ],
)
def test_bad_input_returns_422(client, path, params):
    assert client.get(f"/api/intermediate{path}", params=params).status_code == 422


def test_summary_endpoint(client):
    body = client.get("/api/intermediate/summary").json()
    assert [z["zone"] for z in body["top_zones"]] == ["K_long_island", "J_new_york_city", "F_capital"]
    assert body["cannot_conclude"] == a.CANNOT_CONCLUDE
    assert len(body["data_notes"]) == 1  # D North, Dec 2025
    assert client.get("/api/intermediate/summary", params={"year": 2024}).json()["data_notes"] == []
