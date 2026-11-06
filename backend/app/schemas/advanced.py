"""Response models for /api/advanced (Moses South flow vs. congestion)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.minimum import ZoneInfo


class Meta(BaseModel):
    source: str
    period: str


# ---- flow trend ----


class FlowDay(BaseModel):
    date: str
    flow_mw: float | None = Field(description="Daily average flow, MW. Positive = southbound, negative = northbound")
    rolling_30d: float | None = Field(description="Trailing 30-day mean, MW (null until 30 days exist)")


class FlowMonth(BaseModel):
    month: str = Field(description='"2023-01"')
    year: int
    avg_flow_mw: float | None
    days: int


class DayValue(BaseModel):
    date: str
    flow_mw: float | None


class FlowYear(BaseModel):
    year: int
    avg_flow_mw: float | None
    days: int
    southbound_days: int
    northbound_days: int
    zero_days: int
    share_southbound: float
    share_northbound: float
    min_day: DayValue = Field(description="Most northbound (lowest) day")
    max_day: DayValue = Field(description="Most southbound (highest) day")


class FlowTrendResponse(Meta):
    interface: str
    unit: str = "MW"
    sign_convention: str = "Positive = southbound out of the North Country; negative = northbound"
    daily: list[FlowDay]
    monthly: list[FlowMonth]
    yearly: list[FlowYear]


# ---- correlation ----


class JoinStats(BaseModel):
    flow_rows: int
    congestion_rows: int
    matched: int
    dropped_flow: int = Field(description="Flow rows with no matching congestion row")
    dropped_congestion: int = Field(description="Congestion rows with no matching flow row")


class Fit(BaseModel):
    slope: float | None = Field(description="$/MWh of congestion per MW of flow")
    slope_per_100mw: float | None = Field(description="$/MWh of congestion per 100 MW of flow")
    intercept: float | None = Field(description="$/MWh at zero flow")


class FlowPoint(BaseModel):
    time: str
    flow_mw: float | None
    congestion: float | None


class YearCorrelation(BaseModel):
    year: int
    pearson: float | None
    spearman: float | None
    n: int
    strength: str


class ZoneCorrelation(ZoneInfo):
    n: int
    pearson: float | None
    spearman: float | None
    strength: str = Field(description='|r| < 0.2 "very weak", < 0.4 "weak", < 0.6 "moderate", else "strong"')
    fit: Fit = Field(description="congestion = slope × flow + intercept")
    sampled: bool = Field(description="True when points are a random sample (hourly: max 3,000, fixed seed)")
    points: list[FlowPoint]
    per_year: list[YearCorrelation]


class CorrelationResponse(Meta):
    level: Literal["daily", "hourly"]
    join: JoinStats
    zones: list[ZoneCorrelation]
    reading: str
    data_notes: list[str]


# ---- map ----


class MapZone(ZoneInfo):
    representative_city: str
    latitude: float
    longitude: float
    value: float | None = Field(description="Hour-weighted average over the period, $/MWh")


class MapResponse(Meta):
    year: int | None
    metric: Literal["congestion", "lbmp"]
    column: str
    unit: str = "$/MWh"
    zones: list[MapZone]
    min: float | None
    max: float | None
    data_notes: list[str]


# ---- summary ----


class CorrelationSummary(BaseModel):
    zone: str
    label: str
    pearson: float | None
    spearman: float | None
    strength: str
    n: int


class AdvancedSummaryResponse(Meta):
    yearly_flow: list[FlowYear]
    correlations: list[CorrelationSummary]
    findings: list[str]
    cannot_conclude: list[str]
    data_notes: list[str]
