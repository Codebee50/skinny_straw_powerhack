"""Intermediate level — "When": how congestion varies over time, season, hour and day type.

Pure functions: each takes the relevant DataFrame(s) from the data store and returns plain data.
Sign convention (CLAUDE.md): negative congestion = congestion RAISED the price; "heaviest" /
"worst" = most negative. Averages across months are weighted by hours in the month.
"""

from __future__ import annotations

import calendar
from collections import Counter
from datetime import date, datetime, time
from typing import Any

import pandas as pd

from app.analysis.minimum import congestion_ranking, data_notes, period_label, weighted_mean_by_zone
from app.data import ZONE_COLUMNS

SEASONS: list[str] = ["Winter", "Spring", "Summer", "Fall"]
MONTH_TO_SEASON: dict[int, str] = {
    12: "Winter", 1: "Winter", 2: "Winter",
    3: "Spring", 4: "Spring", 5: "Spring",
    6: "Summer", 7: "Summer", 8: "Summer",
    9: "Fall", 10: "Fall", 11: "Fall",
}
ROLLING_DAYS = 30
MAX_EVENT_DAYS = 31
DEFAULT_EVENT = (date(2023, 2, 1), date(2023, 2, 7))
LOCAL_TZ = "America/New_York"

CANNOT_CONCLUDE: list[str] = [
    "Seeing congestion peak in a season or hour does not tell us why; weather, demand, outages and fuel prices "
    "all change at the same time.",
    "Daily and monthly averages hide 5-minute spikes; the worst moments are much more extreme than these averages.",
]


def _money(x: float | None) -> float | None:
    if x is None or pd.isna(x):
        return None
    return round(float(x), 2)


def _month_label(year: int, month: int) -> str:
    return f"{calendar.month_abbr[month]} {year}"


def day_label(d: date) -> str:
    return f"{d.day} {calendar.month_abbr[d.month]} {d.year}"


def _usd(x: float) -> str:
    sign = "−" if x < 0 else ""
    return f"{sign}${abs(x):,.2f}/MWh"


# ---- zones ----------------------------------------------------------------


def default_top_zones(monthly: pd.DataFrame) -> list[str]:
    """Top 3 most-negative congestion zones over ALL years (reuses the minimum-level ranking)."""
    return [r["zone"] for r in congestion_ranking(monthly)["by_rank"][:3]]


def parse_zones(raw: str | None, default: list[str]) -> list[str]:
    """Comma-separated column names -> validated list in A→K order. None/empty -> default (also A→K)."""
    if raw is None or not raw.strip():
        requested = list(default)
    else:
        requested = [z.strip() for z in raw.split(",") if z.strip()]
    unknown = [z for z in requested if z not in ZONE_COLUMNS]
    if unknown:
        raise ValueError(f"Unknown zone(s): {', '.join(unknown)}. Use column names like J_new_york_city.")
    return [z for z in ZONE_COLUMNS if z in set(requested)]


def validate_zone(zone: str) -> str:
    if zone not in ZONE_COLUMNS:
        raise ValueError(f"Unknown zone: {zone}. Use a column name like J_new_york_city.")
    return zone


def zone_info(zones_ref: pd.DataFrame, zones: list[str]) -> list[dict[str, str]]:
    ref = zones_ref.set_index("column_name")
    return [
        {
            "zone": z,
            "zone_letter": ref.loc[z, "zone_letter"],
            "label": ref.loc[z, "label"],
            "region": ref.loc[z, "region"],
        }
        for z in zones
    ]


def filter_year(df: pd.DataFrame, year: int | None, column: str = "date") -> pd.DataFrame:
    """Rows for one calendar year (by a datetime column, or a 'year' column)."""
    if year is None:
        return df
    years = df["year"] if "year" in df.columns else df[column].dt.year
    out = df[years == year]
    if out.empty:
        raise ValueError(f"No data for year {year}")
    return out


def daily_period_label(df: pd.DataFrame, column: str = "date") -> str:
    lo, hi = df[column].min(), df[column].max()
    return f"{_month_label(lo.year, lo.month)} – {_month_label(hi.year, hi.month)}"


# ---- 1. timeseries ----------------------------------------------------------


def monthly_timeseries(monthly: pd.DataFrame, zones: list[str]) -> list[dict[str, Any]]:
    """One point per month: x = 'YYYY-MM', values = {zone: avg_congestion_cost}."""
    wide = (
        monthly[monthly["zone"].isin(zones)]
        .pivot_table(index=["year", "month"], columns="zone", values="avg_congestion_cost")
        .sort_index()
    )
    return [
        {"x": f"{y}-{m:02d}", "values": {z: _money(row[z]) for z in zones}, "rolling_30d": None}
        for (y, m), row in wide.iterrows()
    ]


def daily_timeseries(daily: pd.DataFrame, zones: list[str], window: int = ROLLING_DAYS) -> list[dict[str, Any]]:
    """One point per date, plus a trailing `window`-day rolling mean per zone (null until a full window)."""
    ordered = daily.sort_values("date")
    rolling = ordered[zones].rolling(window, min_periods=window).mean()
    return [
        {
            "x": d.strftime("%Y-%m-%d"),
            "values": {z: _money(ordered.at[i, z]) for z in zones},
            "rolling_30d": {z: _money(rolling.at[i, z]) for z in zones},
        }
        for i, d in zip(ordered.index, ordered["date"])
    ]


def worst_months(monthly: pd.DataFrame, zones: list[str], n: int = 3) -> dict[str, list[dict[str, Any]]]:
    """Per zone, the n most negative monthly averages (heaviest congestion), worst first."""
    out = {}
    for z in zones:
        rows = monthly[monthly["zone"] == z].sort_values(["avg_congestion_cost", "year", "month"]).head(n)
        out[z] = [
            {
                "year": int(r.year),
                "month": int(r.month),
                "month_label": _month_label(int(r.year), int(r.month)),
                "value": _money(r.avg_congestion_cost),
            }
            for r in rows.itertuples(index=False)
        ]
    return out


# ---- 2. seasonal ------------------------------------------------------------


def seasonal_matrix(monthly: pd.DataFrame) -> dict[str, Any]:
    """Hour-weighted avg congestion per season × zone (all zones, A→K, seasons Winter→Fall).

    With a single calendar year selected, "Winter" is that year's Jan, Feb and Dec.
    """
    zones = [z for z in ZONE_COLUMNS if z in set(monthly["zone"])]
    rows = []
    for season in SEASONS:
        sub = monthly[monthly["season"] == season]
        values = weighted_mean_by_zone(sub, "avg_congestion_cost") if not sub.empty else pd.Series(dtype=float)
        rows.append(
            {
                "season": season,
                "hours": int(sub.drop_duplicates(["year", "month"])["hours"].sum()),
                "values": {z: _money(values.get(z)) for z in zones},
            }
        )
    return {
        "seasons": SEASONS,
        "zones": zones,
        "matrix": [[r["values"][z] for z in zones] for r in rows],
        "rows": rows,
    }


def region_season_means(monthly: pd.DataFrame) -> dict[str, dict[str, float]]:
    """Hour-weighted avg congestion per region per season (all zone-months in the region pooled)."""
    out: dict[str, dict[str, float]] = {}
    for region, reg in monthly.groupby("region", sort=False):
        out[region] = {}
        for season in SEASONS:
            sub = reg[reg["season"] == season]
            if not sub.empty:
                out[region][season] = float((sub["avg_congestion_cost"] * sub["hours"]).sum() / sub["hours"].sum())
    return out


# ---- 3. hourly --------------------------------------------------------------


def hour_label(hour: int) -> str:
    """Hour-beginning label: 17 -> '5–6 pm', 11 -> '11 am–12 pm', 23 -> '11 pm–12 am', 0 -> '12–1 am'."""

    def fmt(h: int) -> tuple[str, str]:
        h %= 24
        return str(h % 12 or 12), "am" if h < 12 else "pm"

    (a, ma), (b, mb) = fmt(hour), fmt(hour + 1)
    return f"{a}–{b} {ma}" if ma == mb else f"{a} {ma}–{b} {mb}"


def hourly_profiles(hourly: pd.DataFrame, zone: str, months: list[int], year: int | None) -> list[dict[str, Any]]:
    """24-hour profile of `zone` for each month.

    With a year: that year's month. Without: the month across all years, weighted by days in each
    month (each value averages that hour over the month's days, so days ∝ hours).
    """
    validate_zone(zone)
    out = []
    for month in months:
        if not 1 <= month <= 12:
            raise ValueError(f"Month must be 1–12, got {month}")
        sub = hourly[hourly["month"] == month]
        if year is not None:
            sub = sub[sub["year"] == year]
        if sub.empty:
            raise ValueError(f"No hourly data for month {month}" + (f" of {year}" if year else ""))
        weights = sub["year"].map(lambda y: calendar.monthrange(int(y), month)[1])
        profile = (sub[zone] * weights).groupby(sub["hour"]).sum() / weights.groupby(sub["hour"]).sum()
        profile = profile.reindex(range(24))
        peak_hour = int(profile.idxmin())
        out.append(
            {
                "month": month,
                "month_name": calendar.month_name[month],
                "years": sorted(int(y) for y in sub["year"].unique()),
                "points": [{"hour": h, "label": hour_label(h), "value": _money(profile[h])} for h in range(24)],
                "peak": {"hour": peak_hour, "label": hour_label(peak_hour), "value": _money(profile[peak_hour])},
            }
        )
    return out


# ---- 4. weekday vs weekend --------------------------------------------------


def weekday_weekend(daily: pd.DataFrame) -> list[dict[str, Any]]:
    """Mean daily congestion on weekdays vs weekends per zone (A→K). difference = weekday − weekend
    (negative: weekdays more congested)."""
    out = []
    weekend = daily["is_weekend"]
    for z in ZONE_COLUMNS:
        wd, we = daily.loc[~weekend, z].mean(), daily.loc[weekend, z].mean()
        out.append(
            {
                "zone": z,
                "weekday": _money(wd),
                "weekend": _money(we),
                "difference": _money(wd - we),
                "weekday_days": int((~weekend).sum()),
                "weekend_days": int(weekend.sum()),
            }
        )
    return out


# ---- 5. extreme days --------------------------------------------------------


def extreme_days(daily: pd.DataFrame, zone: str, n: int = 10) -> dict[str, Any]:
    """The n most negative days for `zone`, with every other zone's same-day value and shared patterns."""
    validate_zone(zone)
    worst = daily.sort_values([zone, "date"]).head(n)
    days = []
    for r in worst.itertuples(index=False):
        d = r.date
        days.append(
            {
                "date": d.strftime("%Y-%m-%d"),
                "day_of_week": r.day_of_week,
                "is_weekend": bool(r.is_weekend),
                "year": d.year,
                "month": d.month,
                "season": MONTH_TO_SEASON[d.month],
                "value": _money(getattr(r, zone)),
                "other_zones": {z: _money(getattr(r, z)) for z in ZONE_COLUMNS if z != zone},
            }
        )
    seasons = Counter(d["season"] for d in days)
    years = Counter(d["year"] for d in days)
    weekend = sum(d["is_weekend"] for d in days)
    return {
        "days": days,
        "common_patterns": {
            "by_season": {s: seasons.get(s, 0) for s in SEASONS},
            "by_year": {str(y): years[y] for y in sorted(years)},
            "weekday": len(days) - weekend,
            "weekend": weekend,
        },
    }


# ---- 6. event window --------------------------------------------------------


def event_window(raw: pd.DataFrame, start: date, end: date) -> dict[str, Any]:
    """Hourly congestion for all zones from start 00:00 through end 23:00 (inclusive), plus per-zone
    minimum and when it happened. Missing hours are reported, never filled."""
    if end < start:
        raise ValueError("end must be on or after start")
    if (end - start).days + 1 > MAX_EVENT_DAYS:
        raise ValueError(f"Window is limited to {MAX_EVENT_DAYS} days")
    lo, hi = datetime.combine(start, time(0)), datetime.combine(end, time(23))
    window = raw[(raw["hour_timestamp"] >= lo) & (raw["hour_timestamp"] <= hi)].sort_values("hour_timestamp")
    if window.empty:
        raise ValueError(f"No hourly data between {start} and {end}")

    rows = [
        {"timestamp": ts.strftime("%Y-%m-%d %H:%M"), "values": {z: _money(v) for z, v in zip(ZONE_COLUMNS, vals)}}
        for ts, *vals in window[["hour_timestamp", *ZONE_COLUMNS]].itertuples(index=False)
    ]
    minimum = {}
    for z in ZONE_COLUMNS:
        i = window[z].idxmin()
        minimum[z] = {"value": _money(window.at[i, z]), "timestamp": window.at[i, "hour_timestamp"].strftime("%Y-%m-%d %H:%M")}

    expected = pd.date_range(max(lo, raw["hour_timestamp"].min()), min(hi, raw["hour_timestamp"].max()), freq="h")
    absent = pd.Series(expected.difference(pd.DatetimeIndex(window["hour_timestamp"])))
    # Hours that don't exist locally (spring-forward) aren't data gaps.
    nonexistent = absent.dt.tz_localize(LOCAL_TZ, nonexistent="NaT", ambiguous="NaT").isna() & absent.notna()
    fmt = "%Y-%m-%d %H:%M"
    return {
        "start": start.isoformat(),
        "end": end.isoformat(),
        "rows": rows,
        "zone_min": minimum,
        "missing_hours": [t.strftime(fmt) for t in absent[~nonexistent]],
        "dst_skipped_hours": [t.strftime(fmt) for t in absent[nonexistent]],
    }


# ---- 7. summary -------------------------------------------------------------


def _region_phrase(region: str, means: dict[str, float]) -> str:
    worst = min(means, key=means.get)
    if means[worst] >= 0:
        return f"{region}: congestion lowered prices on average in every season."
    best = max(means, key=means.get)
    return (
        f"{region}: congestion is heaviest in {worst} ({_usd(means[worst])} on average) "
        f"and lightest in {best} ({_usd(means[best])})."
    )


def findings(
    monthly: pd.DataFrame,
    daily: pd.DataFrame,
    hourly: pd.DataFrame,
    zones_ref: pd.DataFrame,
    top_zones: list[str],
) -> list[str]:
    """Plain-English sentences generated from computed values (all inputs already filtered to the period)."""
    labels = zones_ref.set_index("column_name")["label"].to_dict()
    out: list[str] = []

    # Season per region (geographic order of first zone)
    region_order = list(dict.fromkeys(zones_ref.sort_values("zone_letter")["region"]))
    seasons = region_season_means(monthly)
    out.extend(_region_phrase(r, seasons[r]) for r in region_order if r in seasons)

    # NYC hour-of-day: July vs January
    years = sorted(int(y) for y in hourly["year"].unique())
    year = years[0] if len(years) == 1 else None
    jan, jul = hourly_profiles(hourly, "J_new_york_city", [1, 7], year)
    out.append(
        f"In New York City, congestion peaks at {jul['peak']['label']} in July ({_usd(jul['peak']['value'])}) "
        f"and at {jan['peak']['label']} in January ({_usd(jan['peak']['value'])})."
    )

    # Weekday vs weekend
    ww = weekday_weekend(daily)
    heavier = [r for r in ww if r["difference"] is not None and r["difference"] < 0]
    if heavier:
        gap = min(heavier, key=lambda r: r["difference"])
        out.append(
            f"Weekdays are more congested than weekends in {len(heavier)} of {len(ww)} zones. "
            f"The biggest gap is {labels[gap['zone']]}: {_usd(gap['weekday'])} on weekdays vs "
            f"{_usd(gap['weekend'])} on weekends."
        )
    else:
        out.append("Weekends are at least as congested as weekdays in every zone.")

    # What NYC's worst days share
    ex = extreme_days(daily, "J_new_york_city", 10)
    pat = ex["common_patterns"]
    n = len(ex["days"])
    top_season = max(pat["by_season"], key=pat["by_season"].get)
    first = ex["days"][0]
    out.append(
        f"Of New York City's {n} worst days, {pat['by_season'][top_season]} were in {top_season} and "
        f"{pat['weekday']} fell on weekdays. The worst was {first['date']} ({first['day_of_week']}) at "
        f"{_usd(first['value'])}."
    )

    # Worst month for each top zone
    wm = worst_months(monthly, top_zones, 1)
    parts = [f"{labels[z]} in {wm[z][0]['month_label']} ({_usd(wm[z][0]['value'])})" for z in top_zones if wm[z]]
    if parts:
        out.append("Worst single months: " + "; ".join(parts) + ".")
    return out


def summary(
    monthly: pd.DataFrame,
    daily: pd.DataFrame,
    hourly: pd.DataFrame,
    zones_ref: pd.DataFrame,
    top_zones: list[str],
) -> dict[str, Any]:
    return {
        "top_zones": top_zones,
        "findings": findings(monthly, daily, hourly, zones_ref, top_zones),
        "cannot_conclude": list(CANNOT_CONCLUDE),
        "data_notes": data_notes(monthly),
    }

