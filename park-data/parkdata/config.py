"""Paths and configuration, loaded once from config/*.yaml."""
from __future__ import annotations

import functools
from dataclasses import dataclass, field
from pathlib import Path

import yaml

BASE_DIR = Path(__file__).resolve().parent.parent
CONFIG_DIR = BASE_DIR / "config"
DATA_DIR = BASE_DIR / "data"
RAW_DIR = DATA_DIR / "raw"
SNAPSHOT_DIR = DATA_DIR / "snapshots"
REPORT_DIR = DATA_DIR / "reports"
DB_PATH = DATA_DIR / "parkdata.sqlite"

API_BASE = "https://api.themeparks.wiki/v1"


@dataclass(frozen=True)
class Park:
    key: str
    id: str
    name: str
    resort_key: str
    water_park: bool = False
    young: bool = False  # < 1 full season of history; use sibling scaling


@dataclass(frozen=True)
class Resort:
    key: str
    id: str
    name: str
    slug: str
    parks: list[Park] = field(default_factory=list)


@dataclass(frozen=True)
class Settings:
    history_start: str
    clean_history_start: str
    forward_months: int
    project_horizon_days: int
    request_per_sec: float
    dump_raw: bool
    calendar_start: str        # first date the categorised calendar file covers
    calendar_end: str          # last date the categorised calendar file covers
    resorts: list[Resort]

    @property
    def all_parks(self) -> list[Park]:
        return [p for r in self.resorts for p in r.parks]

    def park(self, key_or_id: str) -> Park | None:
        for p in self.all_parks:
            if key_or_id in (p.key, p.id):
                return p
        return None

    def resort(self, key_or_id: str) -> Resort | None:
        for r in self.resorts:
            if key_or_id in (r.key, r.id):
                return r
        return None


@functools.lru_cache(maxsize=1)
def load() -> Settings:
    raw = yaml.safe_load((CONFIG_DIR / "resorts.yaml").read_text())
    resorts: list[Resort] = []
    for r in raw["resorts"]:
        parks = [
            Park(
                key=p["key"],
                id=p["id"],
                name=p["name"],
                resort_key=r["key"],
                water_park=bool(p.get("water_park")),
                young=bool(p.get("young")),
            )
            for p in r.get("parks", [])
        ]
        resorts.append(Resort(key=r["key"], id=r["id"], name=r["name"], slug=r["slug"], parks=parks))
    return Settings(
        history_start=str(raw["history_start"]),
        clean_history_start=str(raw["clean_history_start"]),
        forward_months=int(raw["forward_months"]),
        project_horizon_days=int(raw["project_horizon_days"]),
        request_per_sec=float(raw.get("request_per_sec", 4)),
        dump_raw=bool(raw.get("dump_raw", False)),
        calendar_start=str(raw.get("calendar_start", "2023-01-01")),
        calendar_end=str(raw.get("calendar_end", "2029-01-31")),
        resorts=resorts,
    )


@functools.lru_cache(maxsize=1)
def windows() -> dict:
    return yaml.safe_load((CONFIG_DIR / "windows.yaml").read_text())


@functools.lru_cache(maxsize=1)
def school_calendars() -> dict:
    return yaml.safe_load((CONFIG_DIR / "school_calendars.yaml").read_text())


def ensure_dirs() -> None:
    for d in (DATA_DIR, SNAPSHOT_DIR, REPORT_DIR):
        d.mkdir(parents=True, exist_ok=True)
