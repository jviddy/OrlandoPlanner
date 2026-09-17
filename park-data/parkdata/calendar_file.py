"""Build data/calendar.csv — one row per date, categorised by the seasonal /
calendar factors that drive opening hours and crowd levels.

This file holds NO predictions. It is the shared feature table you join your
historic crowd data (and the hours projections) against. Every column is either
deterministic (day of week, season, proximity to holidays) or comes from an
editable config:

  config/windows.yaml          season tags, event windows, festival + overlay seasons
  config/school_calendars.yaml  approximate US / UK / Brazil school-break rules
  config/day_overrides.csv      sparse manual corrections, one field per row

See FACTORS.md for what each column means and how to update it.
"""
from __future__ import annotations

import calendar as _cal
import csv
import datetime as dt

import holidays

from . import config
from .calendar_model import DAY_CLASS, anchors, in_window, nearest_anchor, season_tag
from .util import daterange

COLUMNS = [
    # identity / cyclical
    "date", "dow", "dow_num", "day_class", "is_weekend",
    "week_of_year", "month", "month_name", "day_of_month", "day_of_year",
    "quarter", "year",
    # season
    "season_tag",
    # proximity to "special" days
    "us_holiday", "us_holiday_kind", "is_holiday",
    "eve_of_holiday", "day_after_holiday", "long_weekend", "bridge_day",
    "holiday_anchor", "holiday_offset",
    "days_to_next_us_holiday", "next_us_holiday",
    "days_since_prev_us_holiday", "prev_us_holiday",
    # seasonal overlays / events (park-agnostic)
    "overlays", "event_windows", "epcot_festival",
    # school vacations (APPROXIMATE — see school_calendars.yaml)
    "us_school_break", "us_regions_off", "presidents_week",
    "uk_school_holiday", "brazil_school_holiday",
    # meta
    "special_note", "override_note", "source", "generated_at",
]

_SCAN = 120  # days each way when measuring distance to the nearest US holiday
             # (largest gap in the federal calendar, Washington's Birthday -> Memorial, is ~105)


def _holiday_index(y0: int, y1: int):
    us = holidays.UnitedStates(years=range(y0 - 1, y1 + 2), observed=True)
    # for distance scans, ignore the "(observed)" shadow days — point at the real ones
    real = {d: n for d, n in us.items() if not n.endswith("(observed)")}
    return us, real


def _nearest(real: dict, d: dt.date, direction: int) -> tuple[object, str]:
    for off in range(1, _SCAN + 1):
        probe = d + dt.timedelta(days=direction * off)
        if probe in real:
            return off, real[probe]
    return "", ""   # nothing within the scan window (shouldn't happen for federal)


def _long_weekend(us, d: dt.date) -> bool:
    wd = d.weekday()
    # Mon-holiday weekends (Sat/Sun/Mon)
    if wd in (5, 6, 0):
        monday = d + dt.timedelta(days={5: 2, 6: 1, 0: 0}[wd])
        if monday in us and us.get(monday, "").split(" (")[0] not in ("",):
            return True
    # Thanksgiving 4-day (Thu-Sun)
    if wd in (3, 4, 5, 6):
        thu = d - dt.timedelta(days={3: 0, 4: 1, 5: 2, 6: 3}[wd])
        if "Thanksgiving" in us.get(thu, ""):
            return True
    # Fri-before a Mon holiday is often taken too
    if wd == 4 and (d + dt.timedelta(days=3)) in us:
        return True
    return False


def _bridge_day(us, d: dt.date) -> bool:
    wd = d.weekday()
    if wd > 4 or d in us:
        return False
    if wd == 4 and (d - dt.timedelta(days=1)) in us:   # Fri after a Thu holiday
        return True
    if wd == 0 and (d + dt.timedelta(days=1)) in us:   # Mon before a Tue holiday
        return True
    return False


def _school(market: str, d: dt.date, sc: dict) -> tuple[str, list[str]]:
    """(label, regions) for a source market on a date. explicit dates win."""
    explicit = [e for e in sc.get("explicit", [])
                if e.get("region") == market
                and dt.date.fromisoformat(e["start"]) <= d <= dt.date.fromisoformat(e["end"])]
    rules = [r for r in sc.get(market, {}).get("rules", []) if in_window(d, r)]
    # A confirmed district replaces rules for that district, not other regions.
    defaults = sc.get(market, {}).get("regions", [])
    covered = {region for e in explicit for region in e.get("regions", defaults)}
    labels, regions = [], []
    for entry in explicit:
        labels.append(entry.get("label", "BREAK"))
        regions.extend(entry.get("regions", defaults))
    for rule in rules:
        remaining = [r for r in rule.get("regions", defaults) if r not in covered]
        if remaining:
            labels.append(rule["label"])
            regions.extend(remaining)
    return ",".join(dict.fromkeys(labels)), list(dict.fromkeys(regions))


def _row(d: dt.date, us, real, W, sc) -> dict:
    wd = d.weekday()
    ha, ho = nearest_anchor(d)
    name = us.get(d, "")
    kind = "observed" if name.endswith("(observed)") else ("federal" if name else "")

    nxt_off, nxt_name = _nearest(real, d, +1)
    prv_off, prv_name = _nearest(real, d, -1)

    ev = sorted(s["tag"] for s in W.get("event_windows", []) if in_window(d, s))
    ov = sorted(s["tag"] for s in W.get("overlays", []) if in_window(d, s))
    fest = next((s["tag"] for s in W.get("festivals", []) if in_window(d, s)), "")

    us_lbl, us_regions = _school("us", d, sc)
    uk_lbl, _ = _school("uk", d, sc)
    br_lbl, _ = _school("brazil", d, sc)
    pres_week = in_window(d, {"anchor": "PRESIDENTS", "from": 0, "to": 4})

    note_bits: list[str] = []
    if name:
        note_bits.append(name)
    if _long_weekend(us, d) and not name:
        note_bits.append("long weekend")
    if season_tag(d) != "REGULAR":
        note_bits.append(season_tag(d).replace("_", " ").lower())
    for tag in ov:
        note_bits.append(tag.replace("_", " ").lower())
    if fest:
        note_bits.append(f"EPCOT {fest.replace('_', ' ').title()}")
    if us_lbl:
        note_bits.append(f"US school {us_lbl.lower()}")
    if uk_lbl:
        note_bits.append(f"UK {uk_lbl.replace('_', ' ').lower()}")
    if br_lbl:
        note_bits.append(f"Brazil {br_lbl.lower()}")

    return {
        "date": d.isoformat(),
        "dow": d.strftime("%a"),
        "dow_num": wd,
        "day_class": DAY_CLASS[wd],
        "is_weekend": int(wd >= 5),
        "week_of_year": d.isocalendar().week,
        "month": d.month,
        "month_name": _cal.month_abbr[d.month],
        "day_of_month": d.day,
        "day_of_year": d.timetuple().tm_yday,
        "quarter": (d.month - 1) // 3 + 1,
        "year": d.year,
        "season_tag": season_tag(d),
        "us_holiday": name,
        "us_holiday_kind": kind,
        "is_holiday": int(bool(name)),
        "eve_of_holiday": int((d + dt.timedelta(days=1)) in us),
        "day_after_holiday": int((d - dt.timedelta(days=1)) in us),
        "long_weekend": int(_long_weekend(us, d)),
        "bridge_day": int(_bridge_day(us, d)),
        "holiday_anchor": ha or "",
        "holiday_offset": "" if ho is None else ho,
        "days_to_next_us_holiday": nxt_off,
        "next_us_holiday": nxt_name,
        "days_since_prev_us_holiday": prv_off,
        "prev_us_holiday": prv_name,
        "overlays": ",".join(ov),
        "event_windows": ",".join(ev),
        "epcot_festival": fest,
        "us_school_break": us_lbl,
        "us_regions_off": ",".join(us_regions) if us_lbl else "",
        "presidents_week": int(pres_week),
        "uk_school_holiday": uk_lbl,
        "brazil_school_holiday": br_lbl,
        "special_note": "; ".join(dict.fromkeys(note_bits)),
        "override_note": "",
        "source": "rules",
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
    }


def _load_overrides() -> dict[str, list[tuple[str, str, str]]]:
    path = config.CONFIG_DIR / "day_overrides.csv"
    out: dict[str, list[tuple[str, str, str]]] = {}
    if not path.exists():
        return out
    for line in path.read_text().splitlines():
        if not line.strip() or line.lstrip().startswith("#") or line.startswith("date,"):
            continue
        parts = next(csv.reader([line]))
        if len(parts) < 3:
            continue
        date, field, value = parts[0], parts[1], parts[2]
        note = parts[5] if len(parts) > 5 else ""
        out.setdefault(date, []).append((field, value, note))
    return out


def build(_conn=None) -> str:
    s = config.load()
    W = config.windows()
    sc = config.school_calendars()

    # A fixed start (config/resorts.yaml → calendar_start), not `today`, so past
    # years stay in the file to join historic crowd data against. The categoriser
    # is year-agnostic, so back years cost nothing but rows.
    start = dt.date.fromisoformat(s.calendar_start)
    end = dt.date.fromisoformat(s.calendar_end)
    us, real = _holiday_index(start.year, end.year)
    overrides = _load_overrides()

    rows = []
    for d in daterange(start, end):
        row = _row(d, us, real, W, sc)
        for field, value, note in overrides.get(row["date"], []):
            if field in row:
                row[field] = value
            row["override_note"] = "; ".join(x for x in [row["override_note"], note] if x)
            row["source"] = "rules+override"
        rows.append(row)

    config.ensure_dirs()
    out = config.DATA_DIR / "calendar.csv"
    with out.open("w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=COLUMNS)
        w.writeheader()
        w.writerows(rows)
    print(f"  calendar: {len(rows)} days -> data/calendar.csv "
          f"({start} .. {end}), {len(overrides)} override date(s)")
    return str(out)
