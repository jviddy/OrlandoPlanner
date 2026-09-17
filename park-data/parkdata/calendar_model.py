"""Alignment-invariant date descriptors.

The projector never matches on calendar date. Instead every date (past or
future) is reduced to a descriptor whose fields travel with the calendar:
day-class, circular day-of-year, the nearest holiday anchor + signed offset,
a season tag and (per park) an event-window tag. Two dates a year apart that
"mean the same thing" (the Saturday before Christmas, the second Friday of
Food & Wine) get near-identical descriptors even though the dates differ.
"""
from __future__ import annotations

import datetime as dt
import functools

from dateutil.easter import easter

from . import config
from .util import circular_yday_dist, last_weekday, nth_weekday

# Mon..Sun -> class. Parks price/operate these four buckets distinctly.
DAY_CLASS = {0: "WEEKDAY", 1: "WEEKDAY", 2: "WEEKDAY", 3: "WEEKDAY", 4: "FRI", 5: "SAT", 6: "SUN"}


@functools.lru_cache(maxsize=32)
def anchors(year: int) -> dict[str, dt.date]:
    """Named calendar anchors for a year. Floating US holidays computed here."""
    e = easter(year)
    return {
        "NEW_YEAR": dt.date(year, 1, 1),
        "MLK": nth_weekday(year, 1, 0, 3),          # 3rd Mon Jan
        "PRESIDENTS": nth_weekday(year, 2, 0, 3),   # 3rd Mon Feb
        "EASTER": e,
        "GOOD_FRIDAY": e - dt.timedelta(days=2),
        "MEMORIAL": last_weekday(year, 5, 0),       # last Mon May
        "JULY4": dt.date(year, 7, 4),
        "LABOR": nth_weekday(year, 9, 0, 1),        # 1st Mon Sep
        "COLUMBUS": nth_weekday(year, 10, 0, 2),    # 2nd Mon Oct
        "HALLOWEEN": dt.date(year, 10, 31),
        "THANKSGIVING": nth_weekday(year, 11, 3, 4),  # 4th Thu Nov
        "CHRISTMAS": dt.date(year, 12, 25),
    }


def _mmdd_in(d: dt.date, start: str, end: str) -> bool:
    """Is d within an MM-DD window? A window that wraps the new year is allowed."""
    key = (d.month, d.day)
    s = tuple(int(x) for x in start.split("-"))
    e = tuple(int(x) for x in end.split("-"))
    return s <= key <= e if s <= e else (key >= s or key <= e)


def _anchor_window(d: dt.date, spec: dict) -> bool:
    a = anchors(d.year).get(spec["anchor"])
    if a is None:
        return False
    off = (d - a).days
    if spec["from"] <= off <= spec["to"]:
        return True
    # also test the neighbouring year's anchor for windows near Jan 1 / Dec 31
    for yr in (d.year - 1, d.year + 1):
        a2 = anchors(yr).get(spec["anchor"])
        if a2 and spec["from"] <= (d - a2).days <= spec["to"]:
            return True
    return False


def _match(d: dt.date, spec: dict) -> bool:
    if "anchor" in spec:
        return _anchor_window(d, spec)
    return _mmdd_in(d, spec["start"], spec["end"])


def in_window(d: dt.date, spec: dict) -> bool:
    """Public: is `d` inside a window spec — either {start, end} as MM-DD
    (may wrap the new year) or {anchor, from, to} in days relative to a named
    anchor. Used by the categorised-calendar builder."""
    return _match(d, spec)


def nearest_anchor(d: dt.date, max_days: int = 10) -> tuple[str | None, int | None]:
    best_name, best_off = None, None
    for yr in (d.year - 1, d.year, d.year + 1):
        for name, ad in anchors(yr).items():
            off = (d - ad).days
            if abs(off) <= max_days and (best_off is None or abs(off) < abs(best_off)):
                best_name, best_off = name, off
    return best_name, best_off


def season_tag(d: dt.date) -> str:
    for spec in config.windows()["seasons"]:
        if _match(d, spec):
            return spec["tag"]
    return "REGULAR"


def school_break_tag(d: dt.date) -> str:
    for spec in config.windows().get("school_breaks", []):
        if _match(d, spec):
            return spec["tag"]
    return "NONE"


def event_window_tag(park_key: str | None, d: dt.date) -> str:
    if not park_key:
        return "NONE"
    for spec in config.windows()["event_windows"]:
        if park_key in spec.get("parks", []) and _match(d, spec):
            return spec["tag"]
    return "NONE"


def descriptor(park_key: str | None, d: dt.date) -> dict:
    ha, ho = nearest_anchor(d)
    return {
        "park_key": park_key,
        "date": d.isoformat(),
        "dow": d.weekday(),
        "day_class": DAY_CLASS[d.weekday()],
        "is_weekend": d.weekday() >= 5,
        "yday": d.timetuple().tm_yday,
        "year": d.year,
        "season_tag": season_tag(d),
        "school_break": school_break_tag(d),
        "hol_anchor": ha,
        "hol_offset": ho,
        "event_window": event_window_tag(park_key, d),
    }


def event_window_bounds(park_key: str, tag: str, year: int) -> tuple[dt.date, dt.date] | None:
    """Concrete (start, end) dates for an event window in a given year."""
    for spec in config.windows()["event_windows"]:
        if spec["tag"] != tag:
            continue
        if "anchor" in spec:
            a = anchors(year)[spec["anchor"]]
            return a + dt.timedelta(days=spec["from"]), a + dt.timedelta(days=spec["to"])
        sm, sd = (int(x) for x in spec["start"].split("-"))
        em, ed = (int(x) for x in spec["end"].split("-"))
        start = dt.date(year, sm, sd)
        end_year = year if (em, ed) >= (sm, sd) else year + 1
        return start, dt.date(end_year, em, ed)
    return None


# re-exported for the scorer
__all__ = [
    "DAY_CLASS", "anchors", "descriptor", "season_tag", "event_window_tag",
    "event_window_bounds", "nearest_anchor", "circular_yday_dist",
]
