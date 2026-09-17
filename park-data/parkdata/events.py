"""Ticketed-event classification and the per-series forward model.

WDW labels every hard-ticket night `"Special Ticketed Event"`, so we classify
by signature — month, start time, duration — not by text. Universal / SeaWorld
publish no event rows at all; those are inferred elsewhere from anomalously
early closes (see normalise.infer_tier_b_events) and modelled the same way.
"""
from __future__ import annotations

import datetime as dt
import json
import statistics
from collections import defaultdict

from . import config
from .calendar_model import DAY_CLASS, event_window_bounds
from .util import weighted_median

PERK_DESCRIPTIONS = {"Early Entry", "Extended Evening", "Park Hopping", "Extra Magic Hours"}


def classify_series(etype: str, start_min: int, end_min: int,
                    description: str | None, month: int) -> str | None:
    """Map one *normalised* schedule entry to an event series, or None if it is
    a perk / not an evening hard-ticket.

    `start_min` / `end_min` are minutes since local midnight (end may exceed
    1440 for an after-midnight close). `month` is the calendar month of the day.
    """
    if etype not in ("TICKETED_EVENT", "PRIVATE_EVENT"):
        return None
    desc = (description or "").strip()
    if desc in PERK_DESCRIPTIONS:
        return None

    dur = end_min - start_min

    # explicit names, when a source ever provides them
    low = desc.lower()
    if "horror" in low:
        return "HHN"
    if "howl" in low:
        return "HOWL_O_SCREAM"

    if start_min >= 21 * 60 and dur <= 210:
        return "AFTER_HOURS"
    if 17 * 60 <= start_min <= 19 * 60 + 45 and dur >= 210:
        if month in (8, 9, 10):
            return "HALLOWEEN_PARTY"
        if month in (11, 12):
            return "CHRISTMAS_PARTY"
        return "EVENING_PARTY"
    return "OTHER_TICKETED"


# --------------------------------------------------------------- the model ---

def fit_models(conn) -> int:
    """(Re)build event_series_model from event_instance history."""
    rows = conn.execute(
        "SELECT park_id, date, series, start_min, end_min, reg_close_min "
        "FROM event_instance ORDER BY park_id, series, date"
    ).fetchall()
    by_key: dict[tuple[str, str], list] = defaultdict(list)
    for r in rows:
        by_key[(r["park_id"], r["series"])].append(r)

    park_key = {p.id: p.key for p in config.load().all_parks}
    n = 0
    for (park_id, series), insts in by_key.items():
        per_year: dict[int, list] = defaultdict(list)
        for r in insts:
            per_year[int(r["date"][:4])].append(r)

        seasons = []
        for year, yr_rows in sorted(per_year.items()):
            dates = sorted(dt.date.fromisoformat(r["date"]) for r in yr_rows)
            seasons.append(
                {
                    "year": year,
                    "first": dates[0].isoformat(),
                    "last": dates[-1].isoformat(),
                    "count": len(dates),
                    "dows": sorted({d.weekday() for d in dates}),
                    "offsets": [(d - dates[0]).days for d in dates],
                }
            )
        if not seasons:
            continue

        starts = [r["start_min"] for r in insts]
        ends = [r["end_min"] for r in insts]
        regs = [r["reg_close_min"] for r in insts if r["reg_close_min"] is not None]
        counts = [s["count"] for s in seasons]

        # "consistent" = the per-year night count is within 30% of the median
        med_nights = int(statistics.median(counts))
        consistent = sum(1 for c in counts if med_nights and abs(c - med_nights) / med_nights <= 0.3)

        conn.execute(
            "INSERT INTO event_series_model(park_id,series,seasons_json,window_tag,"
            "med_start_min,med_end_min,med_regclose,med_nights,years_seen,years_consistent,updated_at) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now')) "
            "ON CONFLICT(park_id,series) DO UPDATE SET seasons_json=excluded.seasons_json, "
            "window_tag=excluded.window_tag, med_start_min=excluded.med_start_min, "
            "med_end_min=excluded.med_end_min, med_regclose=excluded.med_regclose, "
            "med_nights=excluded.med_nights, years_seen=excluded.years_seen, "
            "years_consistent=excluded.years_consistent, updated_at=datetime('now')",
            (
                park_id,
                series,
                json.dumps(seasons),
                _window_tag_for(park_key.get(park_id), series),
                int(statistics.median(starts)),
                int(statistics.median(ends)),
                int(statistics.median(regs)) if regs else None,
                med_nights,
                len(seasons),
                consistent,
            ),
        )
        n += 1
    conn.commit()
    return n


_SERIES_WINDOW = {
    "HALLOWEEN_PARTY": "WDW_HALLOWEEN",
    "CHRISTMAS_PARTY": "WDW_HOLIDAY",
    "AFTER_HOURS": "WDW_AFTERHOURS",
    "HHN": "UOR_HHN",
    "HOWL_O_SCREAM": "SEA_HOS",
}


def _window_tag_for(park_key: str | None, series: str) -> str | None:
    return _SERIES_WINDOW.get(series)


def project_series(conn, park_id: str, target_year: int) -> list[dict]:
    """Instantiate every modelled series for a park across a target year.

    Returns rows: {date, series, start_min, end_min, reg_close_min, confidence,
    price, price_confidence}. `reg_close_min` is the value the day's regular
    close should be pulled back to.
    """
    models = conn.execute(
        "SELECT * FROM event_series_model WHERE park_id=?", (park_id,)
    ).fetchall()
    park_key = {p.id: p.key for p in config.load().all_parks}.get(park_id)
    out: list[dict] = []

    for m in models:
        seasons = json.loads(m["seasons_json"])
        if not seasons:
            continue
        win = event_window_bounds(park_key, m["window_tag"], target_year) if m["window_tag"] else None

        # anchor the new season to the median (month, day) of prior first-nights,
        # then clip to the configured event window.
        first_md = _median_month_day([s["first"] for s in seasons])
        try:
            start = dt.date(target_year, *first_md)
        except ValueError:
            start = dt.date(target_year, first_md[0], 28)
        if win:
            start = max(start, win[0])

        # replay the union of (offset, dow) patterns seen historically. With
        # < 2 seasons on file we can't trust the observed span, so fill the whole
        # configured window using the DOW pattern (low confidence, self-corrects
        # once backfill gives the model full seasons).
        win_end = win[1] if win else start + dt.timedelta(days=75)
        nights = _replay_nights(seasons, start, win_end, thin=m["years_seen"] < 2)
        conf = "high" if m["years_consistent"] >= 3 else "medium" if m["years_consistent"] >= 2 else "low"
        price, price_conf = _price_for(park_key, m["series"], target_year)

        for d in nights:
            out.append(
                {
                    "date": d.isoformat(),
                    "series": m["series"],
                    "start_min": m["med_start_min"],
                    "end_min": m["med_end_min"],
                    "reg_close_min": m["med_regclose"],
                    "confidence": conf,
                    "price": price,
                    "price_confidence": price_conf,
                }
            )
    return out


def _median_month_day(iso_dates: list[str]) -> tuple[int, int]:
    ds = [dt.date.fromisoformat(x) for x in iso_dates]
    ydays = sorted(d.timetuple().tm_yday for d in ds)
    mid = ydays[len(ydays) // 2]
    ref = dt.date(2001, 1, 1) + dt.timedelta(days=mid - 1)  # non-leap reference
    return ref.month, ref.day


def _replay_nights(seasons: list[dict], start: dt.date, end: dt.date,
                   thin: bool = False) -> list[dt.date]:
    dows = set()
    max_off = 0
    for s in seasons:
        dows.update(s["dows"])
        max_off = max(max_off, max(s["offsets"], default=0))
    span = (end - start).days if thin else min(max_off, (end - start).days)
    cand = [
        start + dt.timedelta(days=off)
        for off in range(0, span + 1)
        if (start + dt.timedelta(days=off)).weekday() in dows
    ]
    if thin:  # trust the window + DOW pattern, not the (thin) observed count
        return cand
    target_count = int(statistics.median([s["count"] for s in seasons]))
    if len(cand) <= target_count or target_count == 0:
        return cand
    # thin evenly to the historical count, keeping the ends
    step = len(cand) / target_count
    return [cand[int(i * step)] for i in range(target_count)]


def _price_for(park_key: str | None, series: str, year: int) -> tuple[float | None, str]:
    path = config.CONFIG_DIR / "event_prices.csv"
    if not path.exists() or not park_key:
        return None, "low"
    best = None
    for line in path.read_text().splitlines():
        if not line or line.startswith("#") or line.startswith("park_key"):
            continue
        pk, ser, eff, price, yoy = (c.strip() for c in line.split(","))
        if pk == park_key and ser == series:
            if best is None or eff > best[0]:
                best = (eff, float(price), float(yoy))
    if not best:
        return None, "low"
    eff, price, yoy = best
    years_forward = max(0, year - int(eff[:4]))
    return round(price * (1 + yoy / 100) ** years_forward), "low"
