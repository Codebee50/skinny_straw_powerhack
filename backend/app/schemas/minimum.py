"""Response models for /api/minimum."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ZoneInfo(BaseModel):
    zone: str = Field(description="Column name, e.g. J_new_york_city")
    zone_letter: str
    label: str = Field(description='Display label, e.g. "J · New York City"')
    region: str


class Period(BaseModel):
    source: str
    period: str = Field(description='e.g. "Jan 2023 – Dec 2025"')
    year: int | None = Field(description="Selected year, or null for all years")


# ---- scatter ----


class ScatterPoint(ZoneInfo):
    year: int
    month: int
    season: str
    avg_lbmp: float
    avg_congestion_cost: float


class OverallCorrelation(BaseModel):
    r: float | None = Field(description="Pearson r between avg_lbmp and avg_congestion_cost")
    n: int


class GroupCorrelation(BaseModel):
    group: str
    zone_letters: list[str]
    r: float | None
    n: int


class Correlations(BaseModel):
    overall: OverallCorrelation
    groups: list[GroupCorrelation]


class LinearFit(BaseModel):
    x: str
    y: str
    slope: float | None
    intercept: float | None


class ScatterResponse(Period):
    points: list[ScatterPoint]
    correlations: Correlations
    fit: LinearFit = Field(description="avg_lbmp = slope × avg_congestion_cost + intercept")


# ---- rankings ----


class RankedZone(ZoneInfo):
    value: float = Field(description="Hour-weighted average, $/MWh")
    rank: int
    is_top3: bool


class WorstMoment(BaseModel):
    value: float = Field(description="Most negative single 5-minute congestion value, $/MWh")
    year: int
    month: int
    month_label: str


class RankedCongestionZone(RankedZone):
    worst_moment: WorstMoment


class LbmpRankingResponse(Period):
    metric: str = "avg_lbmp"
    unit: str = "$/MWh"
    rank_order: str = "1 = highest price"
    by_zone: list[RankedZone] = Field(description="Geographic order A→K")
    by_rank: list[RankedZone] = Field(description="Sorted by rank")


class CongestionRankingResponse(Period):
    metric: str = "avg_congestion_cost"
    unit: str = "$/MWh"
    rank_order: str = "1 = most negative (heaviest congestion; congestion raised the price most)"
    by_zone: list[RankedCongestionZone] = Field(description="Geographic order A→K")
    by_rank: list[RankedCongestionZone] = Field(description="Sorted by rank")


# ---- summary ----


class SummaryResponse(Period):
    top3_price: list[RankedZone]
    top3_congestion: list[RankedCongestionZone]
    correlations: Correlations
    findings: list[str]
    cannot_conclude: list[str]
    data_notes: list[str]
