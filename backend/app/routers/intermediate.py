"""Intermediate level — "When": seasonal / daily / hourly patterns. Mounted at /api/intermediate.

Logic lives in app.analysis.intermediate. Default zones = top 3 heaviest-congestion zones over all
years (reused from the minimum-level ranking); `zones` overrides where supported.
"""

from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query

from app.analysis import intermediate as analysis
from app.data import SOURCE, get_store
from app.schemas.intermediate import (
    EventResponse,
    ExtremeDaysResponse,
    HourlyResponse,
    SeasonalResponse,
    SummaryResponse,
    TimeseriesResponse,
    WeekdayWeekendResponse,
)

router = APIRouter()

YearQuery = Annotated[
    int | None,
    Query(ge=2023, le=2025, description="2023, 2024 or 2025; omit for all three years"),
]
ZoneQuery = Annotated[str, Query(description="Zone column name, e.g. J_new_york_city")]


def _bad_request(fn, *args, **kwargs):
    """Run an analysis function, turning its ValueError into a 422."""
    try:
        return fn(*args, **kwargs)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e


def _top_zones() -> list[str]:
    return analysis.default_top_zones(get_store().monthly)


@router.get("/timeseries", response_model=TimeseriesResponse)
def timeseries(
    granularity: Literal["monthly", "daily"] = "monthly",
    zones: Annotated[str | None, Query(description="Comma-separated column names; default = top 3")] = None,
):
    store = get_store()
    default = _top_zones()
    selected = _bad_request(analysis.parse_zones, zones, default)
    if granularity == "monthly":
        points = analysis.monthly_timeseries(store.monthly, selected)
        period = analysis.period_label(store.monthly)
    else:
        points = analysis.daily_timeseries(store.daily, selected)
        period = analysis.daily_period_label(store.daily)
    return {
        "source": SOURCE,
        "period": period,
        "granularity": granularity,
        "zones": analysis.zone_info(store.zones, selected),
        "default_zones": set(selected) == set(default),
        "points": points,
        "worst_months": analysis.worst_months(store.monthly, selected),
        "data_notes": analysis.data_notes(store.monthly),
    }


@router.get("/seasonal", response_model=SeasonalResponse)
def seasonal(year: YearQuery = None):
    store = get_store()
    monthly = _bad_request(analysis.filter_year, store.monthly, year)
    result = analysis.seasonal_matrix(monthly)
    return {
        "source": SOURCE,
        "period": analysis.period_label(monthly),
        "year": year,
        **result,
        "zones": analysis.zone_info(store.zones, result["zones"]),
        "note": (
            "Winter = Dec–Feb, Spring = Mar–May, Summer = Jun–Aug, Fall = Sep–Nov. "
            + ("With one year selected, Winter is that year's Jan, Feb and Dec." if year else "")
        ).strip(),
        "data_notes": analysis.data_notes(monthly),
    }


@router.get("/hourly", response_model=HourlyResponse)
def hourly(
    zone: ZoneQuery = "J_new_york_city",
    year: YearQuery = None,
    months: Annotated[str, Query(description="Comma-separated months 1–12; default January vs July")] = "1,7",
):
    store = get_store()
    try:
        month_list = [int(m) for m in months.split(",") if m.strip()]
    except ValueError as e:
        raise HTTPException(status_code=422, detail="months must be comma-separated numbers 1–12") from e
    profiles = _bad_request(analysis.hourly_profiles, store.hourly_by_month, zone, month_list, year)
    hourly_df = analysis.filter_year(store.hourly_by_month, year)
    return {
        "source": SOURCE,
        "period": analysis.period_label(hourly_df),
        "zone": analysis.zone_info(store.zones, [zone])[0],
        "year": year,
        "profiles": profiles,
    }


@router.get("/weekday-weekend", response_model=WeekdayWeekendResponse)
def weekday_weekend(year: YearQuery = None):
    store = get_store()
    daily = _bad_request(analysis.filter_year, store.daily, year)
    info = {z["zone"]: z for z in analysis.zone_info(store.zones, list(analysis.ZONE_COLUMNS))}
    rows = [{**info[r["zone"]], **r} for r in analysis.weekday_weekend(daily)]
    return {"source": SOURCE, "period": analysis.daily_period_label(daily), "year": year, "zones": rows}


@router.get("/extreme-days", response_model=ExtremeDaysResponse)
def extreme_days(
    zone: ZoneQuery = "J_new_york_city",
    n: Annotated[int, Query(ge=1, le=50)] = 10,
    year: YearQuery = None,
):
    store = get_store()
    daily = _bad_request(analysis.filter_year, store.daily, year)
    result = _bad_request(analysis.extreme_days, daily, zone, n)
    return {
        "source": SOURCE,
        "period": analysis.daily_period_label(daily),
        "zone": analysis.zone_info(store.zones, [zone])[0],
        "year": year,
        "n": n,
        **result,
    }


@router.get("/event", response_model=EventResponse)
def event(
    start: Annotated[date, Query(description="First day (inclusive), YYYY-MM-DD")] = analysis.DEFAULT_EVENT[0],
    end: Annotated[date, Query(description="Last day (inclusive), YYYY-MM-DD; window ≤ 31 days")] = analysis.DEFAULT_EVENT[1],
):
    store = get_store()
    result = _bad_request(analysis.event_window, store.raw, start, end)
    return {
        "source": SOURCE,
        "period": f"{analysis.day_label(start)} – {analysis.day_label(end)}",
        "zones": analysis.zone_info(store.zones, list(analysis.ZONE_COLUMNS)),
        **result,
    }


@router.get("/summary", response_model=SummaryResponse)
def summary(year: YearQuery = None):
    store = get_store()
    top = _top_zones()
    monthly = _bad_request(analysis.filter_year, store.monthly, year)
    daily = analysis.filter_year(store.daily, year)
    hourly_df = analysis.filter_year(store.hourly_by_month, year)
    result = analysis.summary(monthly, daily, hourly_df, store.zones, top)
    return {
        "source": SOURCE,
        "period": analysis.period_label(monthly),
        "year": year,
        **result,
        "top_zones": analysis.zone_info(store.zones, top),
    }
