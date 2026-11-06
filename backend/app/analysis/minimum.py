"""Minimum level — "Where": zone prices vs. congestion, from the monthly file only.

All functions are pure: they take the enriched monthly DataFrame (see app.data._load_monthly:
columns include zone, zone_letter, label, region, year, month, season, hours, avg_lbmp,
avg_congestion_cost, min_congestion_cost, ...) and return plain Python data.

Sign convention (CLAUDE.md): congestion cost < 0 means congestion RAISED the price.
"Heaviest congestion" = most negative. Averages across months are weighted by hours.
"""

from __future__ import annotations

import calendar
from typing import Any

import numpy as np
import pandas as pd

from app.data import ZONE_COLUMNS

# Region groups used for the scatter correlations (differ from the 4 display regions).
CORRELATION_GROUPS: list[tuple[str, list[str]]] = [
    ("Upstate (A–E)", ["A", "B", "C", "D", "E"]),
    ("Capital & Hudson Valley (F–I)", ["F", "G", "H", "I"]),
    ("NYC & Long Island (J–K)", ["J", "K"]),
]

CANNOT_CONCLUDE: list[str] = [
    "Higher congestion in a zone does not tell us which transmission line was the bottleneck.",
    "Congestion and price moving together does not prove congestion caused the higher price; "
    "weather, fuel prices and demand affect both.",
    "Average $/MWh cannot be turned into total dollars paid, because zone electricity usage is not in this data.",
]

ZONE_FIELDS = ["zone", "zone_letter", "label", "region"]


def _money(x: float) -> float:
    return round(float(x), 2)


def _month_label(year: int, month: int) -> str:
    return f"{calendar.month_abbr[month]} {year}"


# ---- period ---------------------------------------------------------------


def filter_period(monthly: pd.DataFrame, year: int | None = None) -> pd.DataFrame:
    """Rows for one calendar year, or all rows when year is None."""
    if year is None:
        return monthly
    out = monthly[monthly["year"] == year]
    if out.empty:
        raise ValueError(f"No monthly data for year {year}")
    return out


def period_label(df: pd.DataFrame) -> str:
    """'Jan 2023 – Dec 2025' style label for the months present in df."""
    ym = df["year"] * 100 + df["month"]
    first, last = int(ym.min()), int(ym.max())
    return f"{_month_label(first // 100, first % 100)} – {_month_label(last // 100, last % 100)}"


# ---- weighted averages & rankings ----------------------------------------


def weighted_mean_by_zone(df: pd.DataFrame, column: str) -> pd.Series:
    """Hour-weighted mean of a monthly-average column per zone, indexed A→K.

    Weight = hours in the month (days_in_month × 24). Never a plain mean of monthly averages.
    """
    weighted = (df[column] * df["hours"]).groupby(df["zone"]).sum()
    hours = df.groupby("zone")["hours"].sum()
    result = weighted / hours
    return result.reindex([z for z in ZONE_COLUMNS if z in result.index])


def _zone_meta(df: pd.DataFrame) -> pd.DataFrame:
    return df[ZONE_FIELDS].drop_duplicates("zone").set_index("zone")


def _ranking(df: pd.DataFrame, column: str, ascending: bool) -> list[dict[str, Any]]:
    """One record per zone in A→K order with value, rank and is_top3."""
    values = weighted_mean_by_zone(df, column)
    order = values.sort_values(ascending=ascending, kind="stable").index
    rank = {zone: i + 1 for i, zone in enumerate(order)}
    meta = _zone_meta(df)
    return [
        {
            "zone": zone,
            **meta.loc[zone].to_dict(),
            "value": _money(values[zone]),
            "rank": rank[zone],
            "is_top3": rank[zone] <= 3,
        }
        for zone in values.index
    ]


def _by_rank(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(records, key=lambda r: r["rank"])


def lbmp_ranking(df: pd.DataFrame) -> dict[str, list[dict[str, Any]]]:
    """Hour-weighted avg LBMP per zone. rank 1 = highest price."""
    records = _ranking(df, "avg_lbmp", ascending=False)
    return {"by_zone": records, "by_rank": _by_rank(records)}


def worst_moments(df: pd.DataFrame) -> dict[str, dict[str, Any]]:
    """Per zone, the single most negative 5-minute congestion value and the month it occurred.

    Ties go to the earliest month.
    """
    ordered = df.sort_values(["zone", "min_congestion_cost", "year", "month"], kind="stable")
    first = ordered.groupby("zone", sort=False).head(1).set_index("zone")
    return {
        zone: {
            "value": _money(row["min_congestion_cost"]),
            "year": int(row["year"]),
            "month": int(row["month"]),
            "month_label": _month_label(int(row["year"]), int(row["month"])),
        }
        for zone, row in first.iterrows()
    }


def congestion_ranking(df: pd.DataFrame) -> dict[str, list[dict[str, Any]]]:
    """Hour-weighted avg congestion per zone. rank 1 = MOST NEGATIVE (heaviest congestion)."""
    records = _ranking(df, "avg_congestion_cost", ascending=True)
    worst = worst_moments(df)
    for r in records:
        r["worst_moment"] = worst[r["zone"]]
    return {"by_zone": records, "by_rank": _by_rank(records)}


# ---- scatter --------------------------------------------------------------


def scatter_points(df: pd.DataFrame) -> list[dict[str, Any]]:
    """One point per zone-month, ordered by time then A→K."""
    ordered = df.sort_values(["year", "month", "zone_letter"])
    return [
        {
            "zone": r.zone,
            "zone_letter": r.zone_letter,
            "label": r.label,
            "region": r.region,
            "year": int(r.year),
            "month": int(r.month),
            "season": r.season,
            "avg_lbmp": _money(r.avg_lbmp),
            "avg_congestion_cost": _money(r.avg_congestion_cost),
        }
        for r in ordered.itertuples(index=False)
    ]


def pearson(x: pd.Series, y: pd.Series) -> float | None:
    """Pearson r, or None when undefined (fewer than 2 points or zero variance)."""
    if len(x) < 2 or x.std() == 0 or y.std() == 0:
        return None
    return float(np.corrcoef(x, y)[0, 1])


def correlations(df: pd.DataFrame) -> dict[str, Any]:
    """Pearson r between avg_lbmp and avg_congestion_cost over zone-months: overall and per group."""
    groups = []
    for name, letters in CORRELATION_GROUPS:
        sub = df[df["zone_letter"].isin(letters)]
        r = pearson(sub["avg_lbmp"], sub["avg_congestion_cost"])
        groups.append({"group": name, "zone_letters": letters, "r": _round_r(r), "n": int(len(sub))})
    overall = pearson(df["avg_lbmp"], df["avg_congestion_cost"])
    return {"overall": {"r": _round_r(overall), "n": int(len(df))}, "groups": groups}


def _round_r(r: float | None) -> float | None:
    return None if r is None else round(r, 3)


def linear_fit(df: pd.DataFrame) -> dict[str, Any]:
    """Least-squares trend line: avg_lbmp = slope × avg_congestion_cost + intercept."""
    x, y = df["avg_congestion_cost"], df["avg_lbmp"]
    if len(df) < 2 or x.std() == 0:
        return {"x": "avg_congestion_cost", "y": "avg_lbmp", "slope": None, "intercept": None}
    slope, intercept = np.polyfit(x, y, 1)
    return {
        "x": "avg_congestion_cost",
        "y": "avg_lbmp",
        "slope": round(float(slope), 4),
        "intercept": _money(intercept),
    }


# ---- data notes -----------------------------------------------------------


def data_notes(df: pd.DataFrame) -> list[str]:
    """Flag zone-months whose congestion avg, min and max are all exactly 0 (possible data gap)."""
    zero = df[
        (df["avg_congestion_cost"] == 0) & (df["min_congestion_cost"] == 0) & (df["max_congestion_cost"] == 0)
    ].sort_values(["year", "month", "zone_letter"])
    return [
        f"{r.label}: congestion is exactly 0 for all of {calendar.month_name[r.month]} {r.year} "
        "(average, minimum and maximum). This may be a data gap, so that month is not interpreted."
        for r in zero.itertuples(index=False)
    ]


# ---- findings -------------------------------------------------------------


def _strength(r: float) -> str:
    a = abs(r)
    if a < 0.1:
        return "essentially no"
    if a < 0.3:
        return "a weak"
    if a < 0.5:
        return "a moderate"
    return "a strong"


def _join(items: list[str]) -> str:
    if len(items) <= 1:
        return "".join(items)
    return ", ".join(items[:-1]) + " and " + items[-1]


def _usd(x: float) -> str:
    return f"${abs(x):,.2f}/MWh"


def findings(df: pd.DataFrame) -> list[str]:
    """Plain-English sentences generated from computed values (no hard-coded conclusions)."""
    price = lbmp_ranking(df)["by_rank"]
    cong = congestion_ranking(df)["by_rank"]
    corr = correlations(df)
    out: list[str] = []

    p1, p2, p3 = price[:3]
    cheapest = price[-1]
    out.append(
        f"{p1['label']} had the highest average price at {_usd(p1['value'])}, followed by "
        f"{p2['label']} ({_usd(p2['value'])}) and {p3['label']} ({_usd(p3['value'])})."
    )
    out.append(
        f"{p1['label']}'s average price was {_usd(p1['value'] - cheapest['value'])} above the cheapest zone, "
        f"{cheapest['label']} ({_usd(cheapest['value'])})."
    )

    c1 = cong[0]
    if c1["value"] < 0:
        others = [f"{c['label']} ({_usd(c['value'])})" for c in cong[1:3] if c["value"] < 0]
        sentence = f"{c1['label']} had the heaviest congestion: on average it added {_usd(c1['value'])} to the price"
        out.append(sentence + (f", ahead of {_join(others)}." if others else "."))

    lowered = [c for c in sorted(cong, key=lambda c: c["zone"]) if c["value"] > 0]
    if lowered:
        parts = [f"{c['label']} (by {_usd(c['value'])})" for c in lowered]
        out.append(
            f"Congestion lowered the average price in {_join(parts)}, "
            "consistent with power being trapped on the generating side of transmission limits."
        )

    top_price = {p["zone"] for p in price[:3]}
    overlap = [c["label"] for c in cong[:3] if c["zone"] in top_price]
    if overlap:
        count = "All 3" if len(overlap) == 3 else f"{len(overlap)} of the 3"
        out.append(f"{count} highest-price zones are also among the 3 most congested: {_join(overlap)}.")

    r = corr["overall"]["r"]
    if r is not None:
        direction = (
            "heavier congestion tends to come with higher prices"
            if r < 0
            else "heavier congestion tends to come with lower prices"
        )
        if abs(r) < 0.1:
            out.append(f"Across all zone-months there is essentially no link between congestion and price (r = {r:.2f}).")
        else:
            out.append(f"Across all zone-months, {direction}: {_strength(r)} correlation (r = {r:.2f}).")

    groups = [g for g in corr["groups"] if g["r"] is not None]
    if len(groups) >= 2:
        strongest = max(groups, key=lambda g: abs(g["r"]))
        weakest = min(groups, key=lambda g: abs(g["r"]))
        out.append(
            f"The link is strongest in {strongest['group']} (r = {strongest['r']:.2f}) "
            f"and weakest in {weakest['group']} (r = {weakest['r']:.2f})."
        )

    worst = min(cong, key=lambda c: c["worst_moment"]["value"])
    wm = worst["worst_moment"]
    if wm["value"] < 0:
        out.append(
            f"The most extreme single 5-minute congestion value was -{_usd(wm['value'])} "
            f"in {worst['label']} ({wm['month_label']}), far beyond its monthly average."
        )
    return out


def summary(df: pd.DataFrame) -> dict[str, Any]:
    return {
        "top3_price": lbmp_ranking(df)["by_rank"][:3],
        "top3_congestion": congestion_ranking(df)["by_rank"][:3],
        "correlations": correlations(df),
        "findings": findings(df),
        "cannot_conclude": list(CANNOT_CONCLUDE),
        "data_notes": data_notes(df),
    }
