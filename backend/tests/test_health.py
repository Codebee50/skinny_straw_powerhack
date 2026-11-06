import pytest
from fastapi.testclient import TestClient

from app.data import ZONE_COLUMNS, get_store
from app.main import app

EXPECTED_ROWS = {
    "monthly": 396,
    "daily": 1096,
    "hourly_by_month": 864,
    "raw": 26276,
    "flow_daily": 1096,
    "flow_raw": 26296,
    "zones": 11,
}


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_health_row_counts(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["rows_loaded"] == EXPECTED_ROWS


def test_store_is_cached():
    assert get_store() is get_store()


def test_monthly_enrichment():
    m = get_store().monthly
    # hours = days_in_month * 24 (Feb 2024 is a leap month)
    feb24 = m[(m["year"] == 2024) & (m["month"] == 2)]["hours"].unique()
    assert list(feb24) == [29 * 24]
    jan23 = m[(m["year"] == 2023) & (m["month"] == 1)]["hours"].unique()
    assert list(jan23) == [31 * 24]
    assert m["zone_letter"].notna().all()
    assert set(m["label"]) >= {"A · West", "J · New York City", "K · Long Island"}
    nyc = m[m["zone"] == "J_new_york_city"].iloc[0]
    assert nyc["region"] == "New York City"


def test_wide_files_have_all_zones():
    s = get_store()
    for df in (s.daily, s.hourly_by_month, s.raw):
        assert all(col in df.columns for col in ZONE_COLUMNS)


def test_dates_parsed():
    s = get_store()
    assert str(s.daily["date"].dtype).startswith("datetime64")
    assert str(s.raw["hour_timestamp"].dtype).startswith("datetime64")
    assert str(s.flow_raw["formatted_timestamp"].dtype).startswith("datetime64")
    assert s.daily["is_weekend"].dtype == bool
