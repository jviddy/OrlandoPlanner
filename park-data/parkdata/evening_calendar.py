"""Source markers and low-confidence weekday-preserving event-night guesses.

These are comparison aids, not published schedules. Do not infer attendance,
party times or early closures from them.
"""
import csv
import calendar
import datetime as dt
from collections import defaultdict

from . import config

SERIES = {
    "mk_halloween": ("MNSSHP", "MK"),
    "mk_christmas": ("Mickey's Very Merry Christmas Party", "MK"),
    "hw_jollywood": ("Jollywood Nights", "HS"),
    "usf_hhn": ("Halloween Horror Nights", "USF"),
    "usf_rock_universe": ("Rock the Universe", "USF"),
}


def shift_weekday(date, year):
    """Nearest same weekday to the calendar anniversary (at most 3 days)."""
    anniversary = dt.date(year, date.month, min(date.day, calendar.monthrange(year, date.month)[1]))
    return anniversary + dt.timedelta(days=(date.weekday() - anniversary.weekday() + 3) % 7 - 3)


def build(end):
    out = defaultdict(list)
    path = config.DATA_DIR / "parkcrowds" / "events.csv"
    coverage = config.DATA_DIR / "parkcrowds" / "park_days.csv"
    if not path.exists() or not coverage.exists():
        return out
    with coverage.open() as f:
        cutoff = max(r["date"] for r in csv.DictReader(f))
    grouped = defaultdict(dict)
    with path.open() as f:
        for row in csv.DictReader(f):
            if row["event_id"] not in SERIES:
                continue
            label, park = SERIES[row["event_id"]]
            event = {"name": label, "fullName": row["name"], "park": park,
                     "status": "Imported marker", "sourceUrl": row["source_url"],
                     "note": f'Source label: {row["source"]}; not independently verified. Older markers may represent season windows.'}
            out[row["date"]].append(event)
            # Require a completed year, and discard the older daily-season
            # expansions. Never feed our own guessed nights back into history.
            year = int(row["date"][:4])
            if year >= 2024 and f"{year}-12-31" <= cutoff:
                grouped[row["event_id"]].setdefault(year, {})[row["date"]] = event
    for event_id, seasons in grouped.items():
        base_year = max(seasons)
        base = seasons[base_year]
        for year in range(int(cutoff[:4]), int(end[:4]) + 1):
            if year <= base_year:
                continue
            seen = set()
            for iso, event in sorted(base.items()):
                date = shift_weekday(dt.date.fromisoformat(iso), year).isoformat()
                if date in seen or not cutoff < date <= end:
                    continue
                seen.add(date)
                out[date].append({**event, "status": "Educated guess", "confidence": "low",
                                  "referenceDate": iso,
                                  "note": f'Replays the {base_year} source pattern on the nearest matching weekday (±3 days). Not an announced date; no holiday, cancellation or operating-hours adjustment.'})
    return out
