"""Deterministic analog-day projection of opening hours.

For each future date with no published hours, score historical days for the same
park by descriptor similarity, take the top-K, and aggregate (weighted median,
rounded to 30 min). Ticketed events are overlaid from the per-series model and
pull the regular close back to the learned value on event nights.

No randomness, no training. Tunables are all in WEIGHTS / the module constants
and should be moved by the backtest (parkdata.backtest), not by hand.
"""
from __future__ import annotations

import datetime as dt
import json
import math
import statistics
from functools import lru_cache

from . import config, events, store
from .calendar_model import DAY_CLASS, circular_yday_dist, descriptor
from .util import daterange, iqr, round_to, today, weighted_median

MODEL_VERSION = "hours-analog-1"

WEIGHTS = {
    "day_class": 3.0,
    "season": 2.5,
    "holiday": 3.0,
    "season_tag": 1.5,
    "event_window": 1.2,
    "school_break": 0.6,
    "recency": 1.0,
}
SIGMA_YDAY = 12          # days; width of the seasonal proximity kernel
RECENCY = {0: 1.0, 1: 1.0, 2: 0.6, 3: 0.35}
K = 7
SCORE_FLOOR = 3.0
HIGH_SPREAD = 30         # minutes
MED_SPREAD = 60


def score(h: dict, t: dict) -> float:
    w = WEIGHTS
    s = 0.0
    if h["day_class"] == t["day_class"]:
        s += w["day_class"]
    elif h["is_weekend"] == t["is_weekend"]:
        s += w["day_class"] * 0.4

    s += w["season"] * math.exp(
        -(circular_yday_dist(h["yday"], t["yday"]) ** 2) / (2 * SIGMA_YDAY ** 2)
    )
    if t["hol_anchor"] and h["hol_anchor"] == t["hol_anchor"]:
        s += w["holiday"] * math.exp(-abs((h["hol_offset"] or 0) - (t["hol_offset"] or 0)) / 2)
    if h["season_tag"] == t["season_tag"]:
        s += w["season_tag"]
    if h["event_window"] == t["event_window"] and t["event_window"] != "NONE":
        s += w["event_window"]
    if h["school_break"] == t["school_break"] and t["school_break"] != "NONE":
        s += w["school_break"]

    s += w["recency"] * RECENCY.get(t["year"] - h["year"], 0.15)
    return s


def _confidence(t: dict, top: list, spread: int, hist_years: int) -> str:
    if hist_years < 1:
        return "low"
    hol_ok = not t["hol_anchor"] or any(
        c["desc"]["hol_anchor"] == t["hol_anchor"] for c in top
    )
    if len(top) >= 5 and spread <= HIGH_SPREAD and hol_ok and hist_years >= 2:
        return "high"
    if len(top) >= 3 and spread <= MED_SPREAD:
        return "medium"
    return "low"


def _load_history(conn, park_id: str, clean_start: str) -> list[dict]:
    rows = conn.execute(
        "SELECT date, reg_open_min, reg_close_min, anomaly_flags "
        "FROM day_fact WHERE park_id=? AND source='api' AND is_operating=1 "
        "AND date >= ? ORDER BY date",
        (park_id, f"{clean_start}-01"),
    ).fetchall()
    out = []
    for r in rows:
        flags = set((r["anomaly_flags"] or "").split(","))
        if flags & {"COVID_ERA", "EARLY_CLOSE", "NO_OPERATING"}:
            continue
        out.append(
            {"date": r["date"], "open": r["reg_open_min"], "close": r["reg_close_min"]}
        )
    return out


def project_park(conn, park_id: str, park_key: str, horizon_end: dt.date,
                 clean_start: str, water_park: bool, young: bool) -> dict:
    hist = _load_history(conn, park_id, clean_start)
    stats = {"published": 0, "projected": 0, "fallback": 0, "skipped": 0}
    if len(hist) < 30 and not young:
        stats["skipped"] = 1
        return stats

    for h in hist:
        h["desc"] = descriptor(park_key, dt.date.fromisoformat(h["date"]))
    hist_years = len({h["date"][:4] for h in hist})

    # published rows first — copy them into the serving table verbatim
    pub = {
        r["date"]: r
        for r in conn.execute(
            "SELECT date, reg_open_min, reg_close_min FROM day_fact "
            "WHERE park_id=? AND source='api' AND is_operating=1 AND date >= ?",
            (park_id, today().isoformat()),
        )
    }
    ev_pub = _published_events(conn, park_id)

    # event projections by year, computed once
    ev_by_year: dict[int, dict[str, list]] = {}

    start = today()
    for d in daterange(start, horizon_end):
        di = d.isoformat()
        if di in pub:
            _upsert(conn, park_id, di, pub[di]["reg_open_min"], pub[di]["reg_close_min"],
                    "published", "api", "high", 0, 0, ev_pub.get(di, []), ["published"])
            stats["published"] += 1
            continue

        if water_park and d > _last_published_date(pub, start):
            # seasonal + weather driven; don't pretend to know past the horizon
            continue

        t = descriptor(park_key, d)
        scored = [(score(h["desc"], t), h) for h in hist]
        scored = [x for x in scored if x[0] >= SCORE_FLOOR]
        scored.sort(key=lambda x: -x[0])
        top = [{"w": w, "open": h["open"], "close": h["close"], "desc": h["desc"]}
               for w, h in scored[:K]]

        if len(top) < 3:
            fb = _fallback(conn, park_id, park_key, d, hist, young)
            if not fb:
                stats["skipped"] += 1
                continue
            open_min, close_min, method, conf, spread, n = fb
        else:
            ws = [c["w"] for c in top]
            open_min = round_to(weighted_median([c["open"] for c in top], ws))
            close_min = round_to(weighted_median([c["close"] for c in top], ws))
            spread = int(iqr([c["close"] for c in top]))
            conf = _confidence(t, top, spread, hist_years)
            method, n = "analog-knn", len(top)

        notes = [t["season_tag"]]
        if t["event_window"] != "NONE":
            notes.append(t["event_window"])

        # overlay ticketed events
        ev_rows = ev_by_year.setdefault(
            d.year, _index_events(events.project_series(conn, park_id, d.year))
        )
        day_events = ev_rows.get(di, [])
        if day_events:
            pulls = [e["reg_close_min"] for e in day_events if e.get("reg_close_min")]
            if pulls:
                close_min = round_to(min(pulls))
                notes.append(f"{day_events[0]['series']} night")

        _upsert(conn, park_id, di, open_min, close_min, "projected", method, conf,
                n, spread, day_events, notes)
        stats["projected"] += 1
        if method != "analog-knn":
            stats["fallback"] += 1

    conn.commit()
    return stats


# --------------------------------------------------------------- helpers ---

def _published_events(conn, park_id: str) -> dict[str, list]:
    out: dict[str, list] = {}
    for r in conn.execute(
        "SELECT date, series, start_min, end_min FROM event_instance "
        "WHERE park_id=? AND source='api'", (park_id,)
    ):
        out.setdefault(r["date"], []).append(
            {"series": r["series"], "start": r["start_min"], "end": r["end_min"],
             "status": "published", "confidence": "high"}
        )
    return out


def _index_events(rows: list[dict]) -> dict[str, list]:
    out: dict[str, list] = {}
    for r in rows:
        out.setdefault(r["date"], []).append(
            {"series": r["series"], "start": r["start_min"], "end": r["end_min"],
             "reg_close_min": r["reg_close_min"], "status": "projected",
             "confidence": r["confidence"], "price": r["price"],
             "price_confidence": r["price_confidence"]}
        )
    return out


def _last_published_date(pub: dict, start: dt.date) -> dt.date:
    return max((dt.date.fromisoformat(d) for d in pub), default=start)


def _fallback(conn, park_id, park_key, d, hist, young):
    """Sibling-scaled (young parks) or same-month median. Returns tuple or None."""
    month_hist = [h for h in hist if h["date"][5:7] == f"{d.month:02d}"]
    weekend = d.weekday() >= 5
    same = [h for h in month_hist
            if (dt.date.fromisoformat(h["date"]).weekday() >= 5) == weekend]
    if len(same) >= 3:
        return (round_to(statistics.median([h["open"] for h in same])),
                round_to(statistics.median([h["close"] for h in same])),
                "monthly-fallback", "low",
                int(iqr([h["close"] for h in same])), len(same))

    if young:
        sib = _sibling_projection(conn, park_key, d)
        if sib:
            return (*sib, "sibling-scaled", "low", 0, 0)
    return None


SIBLINGS = {"EPU": ["IOA", "USF"], "PEPPA": ["LEGO"]}


def _sibling_projection(conn, park_key, d):
    for sk in SIBLINGS.get(park_key, []):
        p = config.load().park(sk)
        if not p:
            continue
        row = conn.execute(
            "SELECT open_min, close_min FROM projection WHERE park_id=? AND date=?",
            (p.id, d.isoformat()),
        ).fetchone()
        if row:
            return row["open_min"], row["close_min"]
    return None


def _upsert(conn, park_id, date, open_min, close_min, status, method, conf,
            n, spread, day_events, notes):
    conn.execute(
        "INSERT INTO projection(park_id,date,open_min,close_min,status,method,confidence,"
        "n_analogs,spread_min,events_json,notes_json,model_version,generated_at) "
        "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,datetime('now')) "
        "ON CONFLICT(park_id,date) DO UPDATE SET open_min=excluded.open_min, "
        "close_min=excluded.close_min, status=excluded.status, method=excluded.method, "
        "confidence=excluded.confidence, n_analogs=excluded.n_analogs, "
        "spread_min=excluded.spread_min, events_json=excluded.events_json, "
        "notes_json=excluded.notes_json, model_version=excluded.model_version, "
        "generated_at=datetime('now')",
        (park_id, date, open_min, close_min, status, method, conf, n, spread,
         json.dumps(day_events), json.dumps(notes), MODEL_VERSION),
    )


def run(conn) -> dict:
    s = config.load()
    run_id = store.new_run(conn, "project")
    horizon_end = today() + dt.timedelta(days=s.project_horizon_days)
    totals = {"published": 0, "projected": 0, "fallback": 0, "skipped": 0}

    # young parks last, so siblings are already projected
    parks = sorted(s.all_parks, key=lambda p: p.young)
    for p in parks:
        st = project_park(conn, p.id, p.key, horizon_end, s.clean_history_start,
                          p.water_park, p.young)
        for k in totals:
            totals[k] += st.get(k, 0)
        print(f"    {p.key:5} {st}")

    store.finish_run(conn, run_id, True, totals)
    print(f"  project: {totals}")
    return totals
