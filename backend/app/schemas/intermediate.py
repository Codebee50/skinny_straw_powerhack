"""Response models for /api/intermediate."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.minimum import ZoneInfo


class Meta(BaseModel):
    source: str
    period: str = Field(description='e.g. "Jan 2023 – Dec 2025"')


# ---- timeseries ----


class TimeseriesPoint(BaseModel):
    x: str = Field(description='"2023-01" (monthly) or "2023-01-31" (daily)')
    values: dict[str, float | None] = Field(description="zone column name -> congestion, $/MWh")
    rolling_30d: dict[str, float | None] | None = Field(
        description="Daily only: trailing 30-day mean per zone (null until 30 days are available)"
    )


class WorstMonth(BaseModel):
    year: int
    month: int
    month_label: str
    value: float


class TimeseriesResponse(Meta):
    granularity: Literal["monthly", "daily"]
    zones: list[ZoneInfo]
    default_zones: bool = Field(description="True when zones is the default top 3 (heaviest congestion, all years)")
    points: list[TimeseriesPoint]
    worst_months: dict[str, list[WorstMonth]] = Field(description="Per zone, the 3 most negative months")
    data_notes: list[str]


# ---- seasonal ----


class SeasonRow(BaseModel):
    season: str
    hours: int = Field(description="Hours in the months that make up this season in the period")
    values: dict[str, float | None]


class SeasonalResponse(Meta):
    year: int | None
    seasons: list[str]
    zones: list[ZoneInfo]
    matrix: list[list[float | None]] = Field(description="rows = seasons (Winter→Fall), columns = zones (A→K)")
    rows: list[SeasonRow]
    note: str
    data_notes: list[str]


# ---- hourly ----


class HourPoint(BaseModel):
    hour: int = Field(description="Hour beginning, local time (17 = 5–6 pm)")
    label: str
    value: float | None


class Peak(BaseModel):
    hour: int
    label: str
    value: float | None


class MonthProfile(BaseModel):
    month: int
    month_name: str
    years: list[int] = Field(description="Years averaged (day-weighted) into this profile")
    points: list[HourPoint]
    peak: Peak = Field(description="Most negative hour (congestion raised the price most)")


class HourlyResponse(Meta):
    zone: ZoneInfo
    year: int | None
    profiles: list[MonthProfile]


# ---- weekday / weekend ----


class WeekdayWeekendRow(ZoneInfo):
    weekday: float
    weekend: float
    difference: float = Field(description="weekday − weekend; negative = weekdays more congested")
    weekday_days: int
    weekend_days: int


class WeekdayWeekendResponse(Meta):
    year: int | None
    zones: list[WeekdayWeekendRow]


# ---- extreme days ----


class ExtremeDay(BaseModel):
    date: str
    day_of_week: str
    is_weekend: bool
    year: int
    month: int
    season: str
    value: float
    other_zones: dict[str, float | None]


class CommonPatterns(BaseModel):
    by_season: dict[str, int]
    by_year: dict[str, int]
    weekday: int
    weekend: int


class ExtremeDaysResponse(Meta):
    zone: ZoneInfo
    year: int | None
    n: int
    days: list[ExtremeDay]
    common_patterns: CommonPatterns


# ---- event ----


class EventRow(BaseModel):
    timestamp: str = Field(description='"YYYY-MM-DD HH:MM", hour beginning, local time')
    values: dict[str, float | None]


class ZoneMin(BaseModel):
    value: float | None
    timestamp: str


class EventResponse(Meta):
    start: str
    end: str
    zones: list[ZoneInfo]
    rows: list[EventRow]
    zone_min: dict[str, ZoneMin]
    missing_hours: list[str] = Field(description="Hours absent from the raw file (not filled)")
    dst_skipped_hours: list[str] = Field(description="Spring-forward hours that don't exist in local time")


# ---- summary ----


class SummaryResponse(Meta):
    year: int | None
    top_zones: list[ZoneInfo]
    findings: list[str]
    cannot_conclude: list[str]
    data_notes: list[str]
