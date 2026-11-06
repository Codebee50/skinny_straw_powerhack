import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.analysis import minimum as a
from app.data import SOURCE, ZONE_COLUMNS, get_store
from app.main import app

TOL = 0.005  # 2-decimal tolerance


@pytest.fixture(scope="module")
def monthly() -> pd.DataFrame:
    return get_store().monthly


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def _top3(records):
    return [(r["zone"], r["value"]) for r in records[:3]]


# ---- required numbers (all years) ----------------------------------------


def test_lbmp_top3_all_years(monthly):
    top = _top3(a.lbmp_ranking(monthly)["by_rank"])
    assert [z for z, _ in top] == ["K_long_island", "J_new_york_city", "F_capital"]
    for (_, got), want in zip(top, [51.60, 47.05, 45.20]):
        assert got == pytest.approx(want, abs=TOL)


def test_congestion_top3_all_years(monthly):
    top = _top3(a.congestion_ranking(monthly)["by_rank"])
    assert [z for z, _ in top] == ["K_long_island", "J_new_york_city", "F_capital"]
    for (_, got), want in zip(top, [-10.44, -6.13, -5.18]):
        assert got == pytest.approx(want, abs=TOL)


def test_upstate_generating_zones_positive(monthly):
    values = {r["zone"]: r["value"] for r in a.congestion_ranking(monthly)["by_zone"]}
    assert values["D_north"] == pytest.approx(0.85, abs=TOL)
    assert values["A_west"] == pytest.approx(0.78, abs=TOL)
    assert values["D_north"] > 0 and values["A_west"] > 0


def test_scatter_correlations(monthly):
    corr = a.correlations(monthly)
    groups = {g["group"]: g for g in corr["groups"]}
    assert corr["overall"]["r"] == pytest.approx(-0.45, abs=TOL)
    assert corr["overall"]["n"] == 396
    assert groups["NYC & Long Island (J–K)"]["r"] == pytest.approx(-0.62, abs=TOL)
    assert groups["Upstate (A–E)"]["r"] == pytest.approx(0.01, abs=TOL)
    assert groups["Upstate (A–E)"]["n"] == 5 * 36
    assert groups["Capital & Hudson Valley (F–I)"]["n"] == 4 * 36


@pytest.mark.parametrize(
    "year, expected",
    [
        (2023, ["K_long_island", "F_capital", "J_new_york_city"]),
        (2024, ["K_long_island", "J_new_york_city", "H_millwood"]),
        (2025, ["K_long_island", "J_new_york_city", "I_dunwoodie"]),
    ],
)
def test_congestion_top3_per_year(monthly, year, expected):
    df = a.filter_period(monthly, year)
    assert [r["zone"] for r in a.congestion_ranking(df)["by_rank"][:3]] == expected


def test_weighting_differs_from_plain_mean(monthly):
    weighted = a.weighted_mean_by_zone(monthly, "avg_congestion_cost").round(2)
    plain = monthly.groupby("zone")["avg_congestion_cost"].mean().reindex(weighted.index).round(2)
    differs = weighted[weighted != plain]
    assert len(differs) >= 1, "weighted and plain means are identical for every zone"
    # e.g. K_long_island: weighted -10.44 vs plain -10.51
    assert weighted["K_long_island"] == pytest.approx(-10.44, abs=TOL)
    assert plain["K_long_island"] != weighted["K_long_island"]
    # and the ranking uses the weighted value
    ranked = {r["zone"]: r["value"] for r in a.congestion_ranking(monthly)["by_zone"]}
    assert ranked["K_long_island"] == weighted["K_long_island"]


# ---- unit tests for each function ----------------------------------------


def _toy() -> pd.DataFrame:
    """Two zones over Jan (744 h) and Feb 2023 (672 h)."""
    rows = []
    for zone, letter, region, jan, feb in [
        ("A_west", "A", "Upstate", 10.0, 20.0),
        ("K_long_island", "K", "Long Island", -30.0, -2.0),
    ]:
        for month, hours, v in [(1, 744, jan), (2, 672, feb)]:
            rows.append(
                dict(
                    zone=zone, zone_letter=letter, label=f"{letter} · x", region=region,
                    year=2023, month=month, season="Winter", hours=hours,
                    avg_lbmp=50 - v, avg_congestion_cost=v, min_congestion_cost=v - 100 * month,
                    max_congestion_cost=v + 5,
                )
            )
    return pd.DataFrame(rows)


def test_weighted_mean_by_zone_toy():
    w = a.weighted_mean_by_zone(_toy(), "avg_congestion_cost")
    assert list(w.index) == ["A_west", "K_long_island"]  # A→K order
    assert w["A_west"] == pytest.approx((10 * 744 + 20 * 672) / (744 + 672))
    assert w["A_west"] != pytest.approx(15.0)  # not the plain mean


def test_filter_period_and_label(monthly):
    assert a.period_label(monthly) == "Jan 2023 – Dec 2025"
    df = a.filter_period(monthly, 2024)
    assert len(df) == 12 * 11
    assert a.period_label(df) == "Jan 2024 – Dec 2024"
    assert a.filter_period(monthly, None) is monthly
    with pytest.raises(ValueError):
        a.filter_period(monthly, 2030)


def test_lbmp_ranking_shape(monthly):
    res = a.lbmp_ranking(monthly)
    assert [r["zone"] for r in res["by_zone"]] == ZONE_COLUMNS
    assert [r["rank"] for r in res["by_rank"]] == list(range(1, 12))
    assert sum(r["is_top3"] for r in res["by_zone"]) == 3
    assert res["by_zone"][9]["label"] == "J · New York City"


def test_congestion_rank1_is_most_negative():
    res = a.congestion_ranking(_toy())
    assert res["by_rank"][0]["zone"] == "K_long_island"
    assert res["by_rank"][0]["value"] < res["by_rank"][1]["value"]


def test_worst_moments():
    worst = a.worst_moments(_toy())
    # min_congestion_cost = v - 100*month -> Feb is lower for both zones
    assert worst["A_west"] == {"value": -180.0, "year": 2023, "month": 2, "month_label": "Feb 2023"}
    assert worst["K_long_island"]["value"] == -202.0


def test_worst_moment_real_data(monthly):
    k = next(r for r in a.congestion_ranking(monthly)["by_zone"] if r["zone"] == "K_long_island")
    assert k["worst_moment"]["value"] == pytest.approx(monthly.loc[monthly.zone == "K_long_island", "min_congestion_cost"].min())


def test_scatter_points(monthly):
    pts = a.scatter_points(monthly)
    assert len(pts) == 396
    assert pts[0]["zone"] == "A_west" and (pts[0]["year"], pts[0]["month"]) == (2023, 1)
    assert set(pts[0]) == {
        "zone", "zone_letter", "label", "region", "year", "month", "season", "avg_lbmp", "avg_congestion_cost"
    }


def test_pearson_edge_cases():
    assert a.pearson(pd.Series([1.0]), pd.Series([2.0])) is None
    assert a.pearson(pd.Series([1.0, 1.0]), pd.Series([2.0, 3.0])) is None
    assert a.pearson(pd.Series([1.0, 2.0, 3.0]), pd.Series([2.0, 4.0, 6.0])) == pytest.approx(1.0)


def test_linear_fit_toy():
    df = pd.DataFrame({"avg_congestion_cost": [0.0, -1.0, -2.0], "avg_lbmp": [40.0, 42.0, 44.0]})
    fit = a.linear_fit(df)
    assert fit["slope"] == pytest.approx(-2.0)
    assert fit["intercept"] == pytest.approx(40.0)


def test_linear_fit_real_data_slope_negative(monthly):
    # heavier (more negative) congestion goes with higher price -> negative slope
    assert a.linear_fit(monthly)["slope"] < 0


def test_data_notes(monthly):
    notes = a.data_notes(monthly)
    assert len(notes) == 1 and "D · North" in notes[0] and "December 2025" in notes[0]
    assert a.data_notes(a.filter_period(monthly, 2025)) == notes
    assert a.data_notes(a.filter_period(monthly, 2024)) == []


def test_findings_generated_from_values(monthly):
    text = " ".join(a.findings(monthly))
    assert "K · Long Island had the highest average price at $51.60/MWh" in text
    assert "added $10.44/MWh" in text
    assert "D · North" in text and "A · West" in text  # congestion lowered price there
    assert "r = -0.45" in text
    # year filter changes the sentences
    text_2024 = " ".join(a.findings(a.filter_period(monthly, 2024)))
    assert text_2024 != text and "H · Millwood" in text_2024


# ---- endpoints -----------------------------------------------------------


@pytest.mark.parametrize("path", ["/scatter", "/ranking/lbmp", "/ranking/congestion", "/summary"])
def test_endpoints_include_source_and_period(client, path):
    body = client.get(f"/api/minimum{path}").json()
    assert body["source"] == SOURCE
    assert body["period"] == "Jan 2023 – Dec 2025"
    assert body["year"] is None
    body_2024 = client.get(f"/api/minimum{path}", params={"year": 2024}).json()
    assert body_2024["period"] == "Jan 2024 – Dec 2024"


def test_invalid_year_rejected(client):
    assert client.get("/api/minimum/summary", params={"year": 2022}).status_code == 422


def test_summary_endpoint(client):
    body = client.get("/api/minimum/summary").json()
    assert [z["zone"] for z in body["top3_price"]] == ["K_long_island", "J_new_york_city", "F_capital"]
    assert [z["zone"] for z in body["top3_congestion"]] == ["K_long_island", "J_new_york_city", "F_capital"]
    assert body["cannot_conclude"] == a.CANNOT_CONCLUDE
    assert len(body["data_notes"]) == 1
    assert client.get("/api/minimum/summary", params={"year": 2023}).json()["data_notes"] == []


def test_congestion_endpoint_has_worst_moment(client):
    body = client.get("/api/minimum/ranking/congestion", params={"year": 2025}).json()
    assert len(body["by_zone"]) == 11
    assert all("worst_moment" in r for r in body["by_rank"])
