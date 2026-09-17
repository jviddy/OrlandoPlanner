"""Export a transparent provisional crowd baseline. No network or target fitting.

Run from park-data: .venv/bin/python -m parkdata.crowd_calendar
"""
import csv
import datetime as dt
import json
import math
from pathlib import Path

import yaml

from . import calendar_file, config, evening_calendar

START, END = "2022-01-01", "2029-01-31"


def title(value):
    if "," in value:
        return ", ".join(title(part) for part in value.split(","))
    names = {"NYE": "New Year peak", "JAN_LULL": "January lull",
             "EARLY_DEC": "Early December", "MLK": "Martin Luther King Jr. Day",
             "MLK_WKND": "MLK weekend", "JULY4_WK": "July 4 week",
             "WDW": "Disney", "UOR": "Universal", "SEA": "SeaWorld",
             "HHN": "Halloween Horror Nights", "HOS": "Howl-O-Scream",
             "WK": "week", "WKND": "weekend", "AFTERHOURS": "After Hours"}
    if value in names:
        return names[value]
    if not value.isupper() and "_" not in value:
        return value  # Preserve names and apostrophes supplied by the source.
    return " ".join(names.get(word, word.capitalize()) for word in value.split("_"))


def estimate(row, rules):
    season = rules["seasons"].get(row["season_tag"], 0)
    schools = min(rules["school_cap"], sum(
        rules[key] for field, key in (("us_school_break", "us_school"),
                                      ("uk_school_holiday", "uk_school"),
                                      ("brazil_school_holiday", "brazil_school")) if row[field]))
    near = min(int(row["days_to_next_us_holiday"] or 999),
               int(row["days_since_prev_us_holiday"] or 999)) <= 3
    holiday = rules["holiday_day"] if row["is_holiday"] == "1" else (
        rules["holiday_near"] if near or row["long_weekend"] == "1" else 0)
    # Negative quiet-season adjustment is retained; overlapping positive
    # holiday, school and season effects contribute only their maximum.
    calendar_effect = min(0, season) + max(0, season, schools, holiday)
    weekday = rules["weekday"][int(row["dow_num"]) ]
    raw = rules["baseline"] + calendar_effect + weekday
    return max(1, min(5, math.floor(raw + 0.5))), {
        "base": rules["baseline"], "season": season, "school": round(schools, 2),
        "holiday": holiday, "combinedCalendar": round(calendar_effect, 2),
        "weekday": weekday, "raw": round(raw, 2),
    }


def build():
    calendar_file.build()
    rules = yaml.safe_load((config.CONFIG_DIR / "crowd_rules.yaml").read_text())
    comparisons = {}
    path = config.DATA_DIR / "parkcrowds" / "park_days.csv"
    if path.exists():
        with path.open() as f:
            for row in csv.DictReader(f):
                if row["pre_opening"].lower() == "true":
                    continue
                value = row["crowd_level_average_effective"]
                if value:
                    comparisons.setdefault(row["date"], {})[row["park_key"]] = float(value)
    days = []
    evening_events = evening_calendar.build(END)
    with (config.DATA_DIR / "calendar.csv").open() as f:
        for row in csv.DictReader(f):
            if not START <= row["date"] <= END:
                continue
            rating, breakdown = estimate(row, rules)
            factors = []
            for field, label in (("season_tag", "Season"), ("dow", "Day"),
                                 ("us_holiday", "US holiday"), ("us_school_break", "US schools"),
                                 ("uk_school_holiday", "UK schools"), ("brazil_school_holiday", "Brazil schools"),
                                 ("event_windows", "Event season"), ("epcot_festival", "EPCOT festival"),
                                 ("overlays", "Overlay")):
                if row[field]:
                    factors.append(f"{label}: {title(row[field])}")
            for field in ("long_weekend", "bridge_day"):
                if row[field] == "1":
                    factors.append(title(field))
            if row["holiday_anchor"]:
                factors.append(f'{title(row["holiday_anchor"])} {int(row["holiday_offset"]):+d} days')
            days.append({"date": row["date"], "rating": rating,
                         "category": f'{row["season_tag"]}-{row["dow"].upper()}',
                         "title": f'{title(row["season_tag"])} · {row["dow"]}',
                         "factors": factors, "regions": row["us_regions_off"],
                         "breakdown": breakdown, "sourceComparison": comparisons.get(row["date"], {}),
                         "eveningEvents": evening_events.get(row["date"], [])})
    payload = {"version": rules["version"], "start": START, "end": END,
               "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
               "resorts": [{"key": r.key, "name": r.name, "parks": [
                   {"key": p.key, "name": p.name, "waterPark": p.water_park} for p in r.parks
               ]} for r in config.load().resorts], "days": days}
    out = Path(__file__).resolve().parents[2] / "public" / "data" / "crowd-calendar.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, separators=(",", ":")) + "\n")
    print(f"Crowd calendar: {len(days)} days → {out}")
    return payload


if __name__ == "__main__":
    build()
