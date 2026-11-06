"""Cached data store: every CSV in ./data is read exactly once per process.

Use `get_store()` everywhere; never call pd.read_csv from a request handler.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import pandas as pd

# backend/app/data.py -> parents[2] is the repo root, regardless of the cwd.
REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = Path(os.environ.get("NYISO_DATA_DIR", REPO_ROOT / "data"))

SOURCE = "NYISO real-time zonal LBMP & Moses South interface flow, Jan 2023 – Dec 2025"

# Geographic order A -> K. Use this whenever iterating zones.
ZONE_COLUMNS: list[str] = [
    "A_west",
    "B_genesee",
    "C_central",
    "D_north",
    "E_mohawk_valley",
    "F_capital",
    "G_hudson_valley",
    "H_millwood",
    "I_dunwoodie",
    "J_new_york_city",
    "K_long_island",
]

FILES = {
    "monthly": "Congestion_monthly_by_zone_2023_2025.csv",
    "daily": "Congestion_Daily_by_zone_2023_2025.csv",
    "hourly_by_month": "Congestion_Hourly_by_Month_2023_2025.csv",
    "raw": "Congestion_Raw_2023_2025.csv",
    "flow_daily": "Mosesouth_flow_2023_2025_dailyavg.csv",
    "flow_raw": "Mosesouth_flow_2023_2025_raw.csv",
    "zones": "zones_reference.csv",
}


@dataclass(frozen=True)
class DataStore:
    monthly: pd.DataFrame
    daily: pd.DataFrame
    hourly_by_month: pd.DataFrame
    raw: pd.DataFrame
    flow_daily: pd.DataFrame
    flow_raw: pd.DataFrame
    zones: pd.DataFrame

    def row_counts(self) -> dict[str, int]:
        return {name: int(len(getattr(self, name))) for name in FILES}


def _read(name: str) -> pd.DataFrame:
    return pd.read_csv(DATA_DIR / FILES[name])


def _to_bool(series: pd.Series) -> pd.Series:
    if series.dtype == bool:
        return series
    return series.astype(str).str.strip().str.lower().map({"true": True, "false": False})


def _load_zones() -> pd.DataFrame:
    zones = _read("zones")
    zones["label"] = zones["zone_letter"] + " · " + zones["zone_name"]
    return zones.sort_values("zone_letter").reset_index(drop=True)


def _load_monthly(zones: pd.DataFrame) -> pd.DataFrame:
    monthly = _read("monthly")
    month_start = pd.to_datetime(dict(year=monthly["year"], month=monthly["month"], day=1))
    monthly["month_start"] = month_start
    # Weight for averaging monthly averages: hours in the month.
    monthly["hours"] = month_start.dt.days_in_month * 24

    zone_meta = zones[["column_name", "zone_letter", "zone_name", "label", "region"]].rename(
        columns={"column_name": "zone"}
    )
    merged = monthly.merge(zone_meta, on="zone", how="left", validate="many_to_one")
    unmatched = merged.loc[merged["zone_letter"].isna(), "zone"].unique()
    if len(unmatched):
        raise ValueError(f"Monthly file has zones not in zones_reference.csv: {list(unmatched)}")
    return merged.sort_values(["year", "month", "zone_letter"]).reset_index(drop=True)


def _load_daily() -> pd.DataFrame:
    daily = _read("daily")
    daily["date"] = pd.to_datetime(daily["date"], format="%Y-%m-%d")
    daily["is_weekend"] = _to_bool(daily["is_weekend"])
    return daily


def _load_raw() -> pd.DataFrame:
    raw = _read("raw")
    raw["hour_timestamp"] = pd.to_datetime(raw["hour_timestamp"], format="%Y-%m-%d %H:%M")
    return raw


def _load_flow_daily() -> pd.DataFrame:
    flow = _read("flow_daily")
    flow["date"] = pd.to_datetime(flow["date"], format="%Y-%m-%d")
    flow["is_weekend"] = _to_bool(flow["is_weekend"])
    return flow


def _load_flow_raw() -> pd.DataFrame:
    flow = _read("flow_raw")
    flow["formatted_timestamp"] = pd.to_datetime(flow["formatted_timestamp"], format="%Y-%m-%dT%H:%M")
    flow["date"] = pd.to_datetime(flow["date"], format="%Y-%m-%d")
    return flow


@lru_cache(maxsize=1)
def get_store() -> DataStore:
    """Load all 7 CSVs once; subsequent calls return the same object."""
    zones = _load_zones()
    return DataStore(
        monthly=_load_monthly(zones),
        daily=_load_daily(),
        hourly_by_month=_read("hourly_by_month"),
        raw=_load_raw(),
        flow_daily=_load_flow_daily(),
        flow_raw=_load_flow_raw(),
        zones=zones,
    )
