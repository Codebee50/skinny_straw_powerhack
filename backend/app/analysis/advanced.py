"""Advanced level — Moses South interface flow vs. zonal congestion.

Pure functions over the data-store frames. Conventions (CLAUDE.md):
- Flow column `avg_flow_mwh` is in MW. Positive = southbound out of the North Country, negative = northbound.
- Congestion: negative = congestion RAISED the zone's price.
- Moses South carries ALL southbound North Country flow, not only Smart Path Connect.
- Correlation only, never causation. Missing hours are dropped by inner joins, never filled.
"""

from __future__ import annotations

import calendar
from typing import Any

import numpy as np
import pandas as pd

from app.analysis.minimum import data_notes, filter_period, period_label, weighted_mean_by_zone
from app.data import ZONE_COLUMNS

FLOW = "avg_flow_mwh"
ROLLING_DAYS = 30
SAMPLE_MAX = 3000
SAMPLE_SEED = 42
DEFAULT_CORRELATION_ZONES = ["D_north", "F_capital", "J_new_york_city"]
METRIC_COLUMNS = {"congestion": "avg_congestion_cost", "lbmp": "avg_lbmp"}

CANNOT_CONCLUDE: list[str] = [
    "A correlation between Moses South flow and congestion shows they move together, not that one causes the other.",
    "Moses South carries all power flowing south from the North Country, not only Smart Path Connect, so changes "
    "in flow cannot be credited to that project alone.",
    "A change between years cannot be pinned on one cause; weather, fuel prices, demand, outages and new projects "
    "changed at the same time.",
]


def _mw(x: float | None) -> float | None:
    return None if x is None or pd.isna(x) else round(float(x), 1)


def _money(x: float | None) -> float | None:
    return None if x is None or pd.isna(x) else round(float(x), 2)


def _r(x: float | None) -> float | None:
    return None if x is None or pd.isna(x) else round(float(x), 3)


def date_period_label(dates: pd.Series) -> str:
    lo, hi = dates.min(), dates.max()
    return f"{calendar.month_abbr[lo.month]} {lo.year} – {calendar.month_abbr[hi.month]} {hi.year}"


# ---- 1. flow trend -------------------------------------------------------------


def flow_series(flow_daily: pd.DataFrame, window: int = ROLLING_DAYS) -> list[dict[str, Any]]:
    """Daily flow (MW) with a trailing `window`-day rolling mean (null until a full window)."""
    ordered = flow_daily.sort_values("date")
    rolling = ordered[FLOW].rolling(window, min_periods=window).mean()
    return [
        {"date": d.strftime("%Y-%m-%d"), "flow_mw": _mw(v), "rolling_30d": _mw(r)}
        for d, v, r in zip(ordered["date"], ordered[FLOW], rolling)
    ]


def _day(row: pd.Series) -> dict[str, Any]:
    return {"date": row["date"].strftime("%Y-%m-%d"), "flow_mw": _mw(row[FLOW])}


def yearly_flow(flow_daily: pd.DataFrame) -> list[dict[str, Any]]:
    """Per calendar year: average flow, direction split of days, and the min / max day."""
    out = []
    for year, g in flow_daily.groupby(flow_daily["date"].dt.year):
        south, north = int((g[FLOW] > 0).sum()), int((g[FLOW] < 0).sum())
        n = len(g)
        out.append(
            {
                "year": int(year),
                "avg_flow_mw": _mw(g[FLOW].mean()),
                "days": n,
                "southbound_days": south,
                "northbound_days": north,
                "zero_days": n - south - north,
                "share_southbound": round(south / n, 3),
                "share_northbound": round(north / n, 3),
                "min_day": _day(g.loc[g[FLOW].idxmin()]),
                "max_day": _day(g.loc[g[FLOW].idxmax()]),
            }
        )
    return out


def monthly_flow(flow_daily: pd.DataFrame) -> list[dict[str, Any]]:
    """Average of daily flows per calendar month (days are equal length, so this is hour-weighted)."""
    g = flow_daily.groupby([flow_daily["date"].dt.year, flow_daily["date"].dt.month])[FLOW]
    return [
        {"month": f"{y}-{m:02d}", "year": int(y), "avg_flow_mw": _mw(mean), "days": int(n)}
        for (y, m), mean, n in zip(g.mean().index, g.mean(), g.size())
    ]


def flow_trend(flow_daily: pd.DataFrame) -> dict[str, Any]:
    return {
        "daily": flow_series(flow_daily),
        "monthly": monthly_flow(flow_daily),
        "yearly": yearly_flow(flow_daily),
    }


# ---- 2. correlation --------------------------------------------------------------


def to_datetime(series: pd.Series) -> pd.Series:
    """Normalise 'YYYY-MM-DD HH:MM' and 'YYYY-MM-DDTHH:MM' strings (or datetimes) to datetimes."""
    if pd.api.types.is_datetime64_any_dtype(series):
        return series
    return pd.to_datetime(series.astype(str).str.replace("T", " ", regex=False), format="%Y-%m-%d %H:%M")


def join_daily(flow_daily: pd.DataFrame, daily: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, int]]:
    """Inner join daily flow and daily congestion on date."""
    joined = flow_daily[["date", FLOW]].merge(daily[["date", *ZONE_COLUMNS]], on="date", how="inner")
    joined = joined.rename(columns={"date": "time"}).sort_values("time")
    return joined, _join_stats(len(flow_daily), len(daily), len(joined))


def join_hourly(flow_raw: pd.DataFrame, raw: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, int]]:
    """Inner join hourly flow and hourly congestion on timestamp (both normalised to datetimes)."""
    f = pd.DataFrame({"time": to_datetime(flow_raw["formatted_timestamp"]), FLOW: flow_raw[FLOW].to_numpy()})
    c = raw[["hour_timestamp", *ZONE_COLUMNS]].assign(time=to_datetime(raw["hour_timestamp"])).drop(
        columns="hour_timestamp"
    )
    joined = f.merge(c, on="time", how="inner").sort_values("time")
    return joined, _join_stats(len(flow_raw), len(raw), len(joined))


def _join_stats(flow_rows: int, congestion_rows: int, matched: int) -> dict[str, int]:
    return {
        "flow_rows": flow_rows,
        "congestion_rows": congestion_rows,
        "matched": matched,
        "dropped_flow": flow_rows - matched,
        "dropped_congestion": congestion_rows - matched,
    }


def pearson(x: pd.Series, y: pd.Series) -> float | None:
    if len(x) < 3 or x.std() == 0 or y.std() == 0:
        return None
    return float(np.corrcoef(x, y)[0, 1])


def spearman(x: pd.Series, y: pd.Series) -> float | None:
    """Spearman rank correlation = Pearson on average ranks (ties share their mean rank)."""
    return pearson(x.rank(method="average"), y.rank(method="average"))


def linear_fit(x: pd.Series, y: pd.Series) -> dict[str, float | None]:
    """congestion = slope × flow + intercept (slope in $/MWh per MW of flow)."""
    if len(x) < 3 or x.std() == 0:
        return {"slope": None, "slope_per_100mw": None, "intercept": None}
    slope, intercept = np.polyfit(x, y, 1)
    return {"slope": round(float(slope), 6), "slope_per_100mw": _money(slope * 100), "intercept": _money(intercept)}


def strength(r: float | None) -> str:
    if r is None:
        return "not enough data"
    a = abs(r)
    if a < 0.2:
        return "very weak"
    if a < 0.4:
        return "weak"
    if a < 0.6:
        return "moderate"
    return "strong"


def zone_correlation(
    joined: pd.DataFrame,
    zone: str,
    sample_max: int | None = None,
    seed: int = SAMPLE_SEED,
    time_format: str = "%Y-%m-%d",
) -> dict[str, Any]:
    """Pearson + Spearman between flow and one zone's congestion, a fit line, points and per-year r."""
    sub = joined[["time", FLOW, zone]].dropna()
    x, y = sub[FLOW], sub[zone]
    r = pearson(x, y)
    pts = sub if sample_max is None or len(sub) <= sample_max else sub.sample(sample_max, random_state=seed)
    pts = pts.sort_values("time")
    per_year = []
    for year, g in sub.groupby(sub["time"].dt.year):
        ry = pearson(g[FLOW], g[zone])
        per_year.append(
            {"year": int(year), "pearson": _r(ry), "spearman": _r(spearman(g[FLOW], g[zone])), "n": len(g), "strength": strength(ry)}
        )
    return {
        "zone": zone,
        "n": len(sub),
        "pearson": _r(r),
        "spearman": _r(spearman(x, y)),
        "strength": strength(r),
        "fit": linear_fit(x, y),
        "sampled": len(pts) < len(sub),
        "points": [
            {"time": t.strftime(time_format), "flow_mw": _mw(f), "congestion": _money(c)}
            for t, f, c in zip(pts["time"], pts[FLOW], pts[zone])
        ],
        "per_year": per_year,
    }


def correlation(
    flow_daily: pd.DataFrame,
    daily: pd.DataFrame,
    flow_raw: pd.DataFrame,
    raw: pd.DataFrame,
    zones: list[str],
    level: str = "daily",
) -> dict[str, Any]:
    if level == "daily":
        joined, stats = join_daily(flow_daily, daily)
        results = [zone_correlation(joined, z) for z in zones]
    elif level == "hourly":
        joined, stats = join_hourly(flow_raw, raw)
        results = [zone_correlation(joined, z, SAMPLE_MAX, SAMPLE_SEED, "%Y-%m-%d %H:%M") for z in zones]
    else:
        raise ValueError("level must be 'daily' or 'hourly'")
    return {"level": level, "join": stats, "zones": results, "period": date_period_label(joined["time"])}


# ---- 3. map ---------------------------------------------------------------------


def map_values(monthly: pd.DataFrame, zones_ref: pd.DataFrame, year: int | None, metric: str) -> dict[str, Any]:
    """Hour-weighted average of `metric` per zone (reusing the minimum-level function) with coordinates."""
    if metric not in METRIC_COLUMNS:
        raise ValueError("metric must be 'congestion' or 'lbmp'")
    df = filter_period(monthly, year)
    values = weighted_mean_by_zone(df, METRIC_COLUMNS[metric])
    ref = zones_ref.sort_values("zone_letter")
    entries = [
        {
            "zone": r.column_name,
            "zone_letter": r.zone_letter,
            "label": r.label,
            "region": r.region,
            "representative_city": r.representative_city,
            "latitude": float(r.latitude),
            "longitude": float(r.longitude),
            "value": _money(values.get(r.column_name)),
        }
        for r in ref.itertuples(index=False)
    ]
    present = [e["value"] for e in entries if e["value"] is not None]
    return {
        "metric": metric,
        "column": METRIC_COLUMNS[metric],
        "zones": entries,
        "min": min(present) if present else None,
        "max": max(present) if present else None,
        "period": period_label(df),
        "data_notes": data_notes(df),
    }


# ---- 4. summary -----------------------------------------------------------------


def _flow_words(mw: float) -> str:
    if mw > 0:
        return f"{mw:,.1f} MW southbound"
    if mw < 0:
        return f"{abs(mw):,.1f} MW northbound"
    return "0 MW (balanced)"


def _direction_sentence(label: str, r: float, s: str) -> str:
    sign = "negative" if r < 0 else "positive"
    base = f"Daily flow vs {label} congestion: {s} {sign} correlation (r = {r:.2f})."
    if s == "very weak":
        return base + " The two barely move together."
    # congestion < 0 = raised price. r < 0: more southbound flow ~ more negative congestion ~ price pushed up more.
    effect = "raised" if r < 0 else "lowered"
    return base + f" Days with more southbound flow tend to be days when congestion {effect} that zone's price more."


def findings(
    flow_daily: pd.DataFrame,
    daily: pd.DataFrame,
    flow_raw: pd.DataFrame,
    raw: pd.DataFrame,
    zones_ref: pd.DataFrame,
    zones: list[str] = DEFAULT_CORRELATION_ZONES,
) -> list[str]:
    labels = zones_ref.set_index("column_name")["label"].to_dict()
    yearly = yearly_flow(flow_daily)
    out: list[str] = []

    # Yearly flow change
    parts = [f"{_flow_words(y['avg_flow_mw'])} in {y['year']}" for y in yearly]
    first, last = yearly[0], yearly[-1]
    change = last["avg_flow_mw"] - first["avg_flow_mw"]
    out.append(
        f"Average Moses South flow went from {parts[0]} to " + ", then ".join(parts[1:]) + "."
        if len(parts) > 1
        else f"Average Moses South flow was {parts[0]}."
    )
    if len(yearly) > 1:
        flipped = (first["avg_flow_mw"] > 0) != (last["avg_flow_mw"] > 0)
        out.append(
            f"That is a change of {change:+,.1f} MW between {first['year']} and {last['year']}"
            + (", and the yearly average flipped direction." if flipped else ".")
        )

    # Direction shift
    shares = ", ".join(f"{y['share_southbound']:.0%} in {y['year']}" for y in yearly)
    out.append(f"Share of days with net southbound flow: {shares}.")

    # Extreme days
    lo = min(yearly, key=lambda y: y["min_day"]["flow_mw"])["min_day"]
    hi = max(yearly, key=lambda y: y["max_day"]["flow_mw"])["max_day"]
    out.append(
        f"The most southbound day was {hi['date']} ({_flow_words(hi['flow_mw'])}); "
        f"the most northbound was {lo['date']} ({_flow_words(lo['flow_mw'])})."
    )

    # Correlation per zone (daily), plus how hourly compares
    daily_corr = correlation(flow_daily, daily, flow_raw, raw, zones, "daily")["zones"]
    for c in daily_corr:
        if c["pearson"] is not None:
            out.append(_direction_sentence(labels[c["zone"]], c["pearson"], c["strength"]))
    hourly_corr = correlation(flow_daily, daily, flow_raw, raw, zones, "hourly")["zones"]
    hourly_parts = [f"{labels[c['zone']]} r = {c['pearson']:.2f}" for c in hourly_corr if c["pearson"] is not None]
    if hourly_parts:
        weaker = all(
            abs(h["pearson"]) < abs(d["pearson"])
            for h, d in zip(hourly_corr, daily_corr)
            if h["pearson"] is not None and d["pearson"] is not None
        )
        out.append(
            ("Hour by hour the links are weaker: " if weaker else "Hour by hour: ") + "; ".join(hourly_parts) + "."
        )
    return out


def summary(
    flow_daily: pd.DataFrame,
    daily: pd.DataFrame,
    flow_raw: pd.DataFrame,
    raw: pd.DataFrame,
    monthly: pd.DataFrame,
    zones_ref: pd.DataFrame,
) -> dict[str, Any]:
    corr = correlation(flow_daily, daily, flow_raw, raw, DEFAULT_CORRELATION_ZONES, "daily")["zones"]
    return {
        "yearly_flow": yearly_flow(flow_daily),
        "correlations": [
            {"zone": c["zone"], "pearson": c["pearson"], "spearman": c["spearman"], "strength": c["strength"], "n": c["n"]}
            for c in corr
        ],
        "findings": findings(flow_daily, daily, flow_raw, raw, zones_ref),
        "cannot_conclude": list(CANNOT_CONCLUDE),
        "data_notes": notes_for_zones(monthly, zones_ref, DEFAULT_CORRELATION_ZONES),
    }


def notes_for_zones(monthly: pd.DataFrame, zones_ref: pd.DataFrame, zones: list[str]) -> list[str]:
    """Minimum-level data notes (e.g. the D · North Dec 2025 all-zero month) that mention one of `zones`."""
    labels = zones_ref.set_index("column_name")["label"]
    wanted = [labels[z] for z in zones if z in labels.index]
    return [n for n in data_notes(monthly) if any(n.startswith(f"{label}:") for label in wanted)]
