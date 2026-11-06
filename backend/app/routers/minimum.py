"""Minimum level — "Where": which zones pay the most and see the heaviest congestion.

Mounted at /api/minimum. Uses only the monthly file. Logic lives in app.analysis.minimum.
"""

from typing import Annotated

import pandas as pd
from fastapi import APIRouter, Query

from app.analysis import minimum as analysis
from app.data import SOURCE, get_store
from app.schemas.minimum import (
    CongestionRankingResponse,
    LbmpRankingResponse,
    ScatterResponse,
    SummaryResponse,
)

router = APIRouter()

YearQuery = Annotated[
    int | None,
    Query(ge=2023, le=2025, description="2023, 2024 or 2025; omit for all three years"),
]


def _period(year: int | None) -> tuple[pd.DataFrame, dict]:
    df = analysis.filter_period(get_store().monthly, year)
    return df, {"source": SOURCE, "period": analysis.period_label(df), "year": year}


@router.get("/scatter", response_model=ScatterResponse)
def scatter(year: YearQuery = None):
    df, meta = _period(year)
    return {
        **meta,
        "points": analysis.scatter_points(df),
        "correlations": analysis.correlations(df),
        "fit": analysis.linear_fit(df),
    }


@router.get("/ranking/lbmp", response_model=LbmpRankingResponse)
def ranking_lbmp(year: YearQuery = None):
    df, meta = _period(year)
    return {**meta, **analysis.lbmp_ranking(df)}


@router.get("/ranking/congestion", response_model=CongestionRankingResponse)
def ranking_congestion(year: YearQuery = None):
    df, meta = _period(year)
    return {**meta, **analysis.congestion_ranking(df)}


@router.get("/summary", response_model=SummaryResponse)
def summary(year: YearQuery = None):
    df, meta = _period(year)
    return {**meta, **analysis.summary(df)}
