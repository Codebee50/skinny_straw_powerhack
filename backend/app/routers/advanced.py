"""Advanced level — Moses South interface flow vs. congestion. Mounted at /api/advanced.

Logic lives in app.analysis.advanced. Correlation only: nothing here shows causation, and Moses South
carries all southbound North Country flow, not only Smart Path Connect.
"""

from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query

from app.analysis import advanced as analysis
from app.analysis.intermediate import parse_zones, zone_info
from app.data import SOURCE, get_store
from app.schemas.advanced import AdvancedSummaryResponse, CorrelationResponse, FlowTrendResponse, MapResponse

router = APIRouter()

YearQuery = Annotated[
    int | None,
    Query(ge=2023, le=2025, description="2023, 2024 or 2025; omit for all three years"),
]


def _bad_request(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e


@router.get("/flow/trend", response_model=FlowTrendResponse)
def flow_trend():
    store = get_store()
    flow = store.flow_daily
    return {
        "source": SOURCE,
        "period": analysis.date_period_label(flow["date"]),
        "interface": str(flow["Interface Name"].iloc[0]),
        **analysis.flow_trend(flow),
    }


@router.get("/flow/correlation", response_model=CorrelationResponse)
def flow_correlation(
    zones: Annotated[
        str, Query(description="Comma-separated zone column names")
    ] = ",".join(analysis.DEFAULT_CORRELATION_ZONES),
    level: Literal["daily", "hourly"] = "daily",
):
    store = get_store()
    selected = _bad_request(parse_zones, zones, analysis.DEFAULT_CORRELATION_ZONES)
    result = analysis.correlation(store.flow_daily, store.daily, store.flow_raw, store.raw, selected, level)
    info = {z["zone"]: z for z in zone_info(store.zones, selected)}
    return {
        "source": SOURCE,
        "period": result["period"],
        "level": level,
        "join": result["join"],
        "zones": [{**info[c["zone"]], **c} for c in result["zones"]],
        "reading": (
            "Flow is MW (positive = southbound). Congestion is $/MWh (negative = congestion raised the price). "
            "A negative r means more southbound flow goes with congestion raising that zone's price more."
        ),
        "data_notes": analysis.notes_for_zones(store.monthly, store.zones, selected),
    }


@router.get("/map", response_model=MapResponse)
def zone_map(year: YearQuery = None, metric: Literal["congestion", "lbmp"] = "congestion"):
    store = get_store()
    result = _bad_request(analysis.map_values, store.monthly, store.zones, year, metric)
    return {"source": SOURCE, "year": year, **result}


@router.get("/summary", response_model=AdvancedSummaryResponse)
def summary():
    store = get_store()
    result = analysis.summary(store.flow_daily, store.daily, store.flow_raw, store.raw, store.monthly, store.zones)
    labels = store.zones.set_index("column_name")["label"].to_dict()
    return {
        "source": SOURCE,
        "period": analysis.date_period_label(store.flow_daily["date"]),
        **result,
        "correlations": [{**c, "label": labels[c["zone"]]} for c in result["correlations"]],
    }
