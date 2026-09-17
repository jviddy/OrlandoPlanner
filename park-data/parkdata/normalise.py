"""Raw schedule entries -> normalised entries -> day_fact + event_instance.

`to_norm_entries` converts the API's schedule entries into the compact
`{type, open_min, close_min, description}` shape used for hashing, drift and
storage. `build_day` derives the per-day facts from that shape. `run` rebuilds
the whole normalised layer from the newest `schedule_version` per park-day and
then does the passes that need cross-day context (EARLY_CLOSE, Tier-B events).
"""
from __future__ import annotations

import datetime as dt
import json
import statistics
from collections import defaultdict

from . import config
from .calendar_model import event_window_tag
from .events import classify_series
from .util import span_minutes

EARLY_CLOSE_GAP = 90  # minutes earlier than the seasonal norm -> flag

# park key -> inferred series, for resorts that publish no event rows at all
TIER_B_SERIES = {"USF": "HHN", "IOA": "HHN", "SW": "HOWL_O_SCREAM"}


def to_norm_entries(raw_entries: list[dict]) -> list[dict]:
    out = []
    for e in raw_entries:
        try:
            o, c = span_minutes(e["openingTime"], e["closingTime"])
        except (KeyError, ValueError):
            continue
        out.append(
            {
                "type": e.get("type"),
                "open_min": o,
                "close_min": c,
                "description": (e.get("description") or "").strip() or None,
            }
        )
    return out


def build_day(date_iso: str, entries: list[dict], *, clean_start: str) -> dict:
    """Derive day facts from normalised entries."""
    month = int(date_iso[5:7])
    operating = [(e["open_min"], e["close_min"]) for e in entries if e["type"] == "OPERATING"]
    early_entry_min = extended_eve_min = None
    events = []

    for e in entries:
        if e["type"] == "TICKETED_EVENT" and e["description"] == "Early Entry":
            early_entry_min = e["open_min"]
        elif e["type"] == "TICKETED_EVENT" and e["description"] == "Extended Evening":
            extended_eve_min = e["close_min"]
        else:
            series = classify_series(
                e["type"], e["open_min"], e["close_min"], e["description"], month
            )
            if series:
                events.append(
                    {"series": series, "start_min": e["open_min"],
                     "end_min": e["close_min"], "raw_desc": e["description"]}
                )

    reg_open = min((o for o, _ in operating), default=None)
    reg_close = max((c for _, c in operating), default=None)

    flags = []
    if date_iso < f"{clean_start}-01":
        flags.append("COVID_ERA")
    if not operating:
        flags.append("NO_OPERATING")

    return {
        "reg_open_min": reg_open,
        "reg_close_min": reg_close,
        "early_entry_min": early_entry_min,
        "extended_eve_min": extended_eve_min,
        "events": events,
        "has_evening_event": bool(events),
        "event_series": ",".join(sorted({ev["series"] for ev in events})) or None,
        "anomaly_flags": flags,
    }


def run(conn) -> dict:
    s = config.load()
    stats = {"day_facts": 0, "events": 0, "early_close_flagged": 0, "tier_b_inferred": 0}

    rows = conn.execute(
        """
        SELECT sv.park_id, sv.date, sv.entries_json
        FROM schedule_version sv
        JOIN (
            SELECT park_id, date, MAX(last_seen_at) AS mx
            FROM schedule_version GROUP BY park_id, date
        ) last ON last.park_id = sv.park_id AND last.date = sv.date
             AND last.mx = sv.last_seen_at
        """
    ).fetchall()

    conn.execute("DELETE FROM day_fact WHERE source='api'")
    conn.execute("DELETE FROM event_instance WHERE source IN ('api','inferred')")

    facts: dict[tuple[str, str], dict] = {}
    for r in rows:
        entries = json.loads(r["entries_json"])
        nd = build_day(r["date"], entries, clean_start=s.clean_history_start)
        facts[(r["park_id"], r["date"])] = nd
        conn.execute(
            "INSERT INTO day_fact(park_id,date,reg_open_min,reg_close_min,is_operating,"
            "early_entry_min,extended_eve_min,has_evening_event,event_series,anomaly_flags,"
            "source,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?, 'api', datetime('now')) "
            "ON CONFLICT(park_id,date) DO UPDATE SET reg_open_min=excluded.reg_open_min, "
            "reg_close_min=excluded.reg_close_min, is_operating=excluded.is_operating, "
            "early_entry_min=excluded.early_entry_min, extended_eve_min=excluded.extended_eve_min, "
            "has_evening_event=excluded.has_evening_event, event_series=excluded.event_series, "
            "anomaly_flags=excluded.anomaly_flags, source='api', updated_at=datetime('now')",
            (
                r["park_id"], r["date"], nd["reg_open_min"], nd["reg_close_min"],
                int(nd["reg_open_min"] is not None),
                nd["early_entry_min"], nd["extended_eve_min"],
                int(nd["has_evening_event"]), nd["event_series"],
                ",".join(nd["anomaly_flags"]) or None,
            ),
        )
        stats["day_facts"] += 1
        for ev in nd["events"]:
            conn.execute(
                "INSERT INTO event_instance(park_id,date,series,start_min,end_min,reg_close_min,"
                "raw_desc,source) VALUES (?,?,?,?,?,?,?, 'api') "
                "ON CONFLICT(park_id,date,series) DO UPDATE SET start_min=excluded.start_min, "
                "end_min=excluded.end_min, reg_close_min=excluded.reg_close_min, "
                "raw_desc=excluded.raw_desc, source='api'",
                (r["park_id"], r["date"], ev["series"], ev["start_min"], ev["end_min"],
                 nd["reg_close_min"], ev["raw_desc"]),
            )
            stats["events"] += 1

    conn.commit()

    # --- EARLY_CLOSE: seasonal norm by (park, is_weekend, month) ----------
    norm: dict[tuple, list[int]] = defaultdict(list)
    for (park_id, date_iso), nd in facts.items():
        if nd["reg_close_min"] is None or nd["has_evening_event"] or nd["anomaly_flags"]:
            continue
        d = dt.date.fromisoformat(date_iso)
        norm[(park_id, d.weekday() >= 5, d.month)].append(nd["reg_close_min"])
    norm_med = {k: statistics.median(v) for k, v in norm.items() if len(v) >= 3}

    park_key = {p.id: p.key for p in s.all_parks}
    for (park_id, date_iso), nd in facts.items():
        if nd["reg_close_min"] is None:
            continue
        d = dt.date.fromisoformat(date_iso)
        med = norm_med.get((park_id, d.weekday() >= 5, d.month))
        if med is None or nd["reg_close_min"] > med - EARLY_CLOSE_GAP:
            continue
        flags = sorted(set(nd["anomaly_flags"]) | {"EARLY_CLOSE"})
        conn.execute("UPDATE day_fact SET anomaly_flags=? WHERE park_id=? AND date=?",
                     (",".join(flags), park_id, date_iso))
        stats["early_close_flagged"] += 1

        pk = park_key.get(park_id)
        series = TIER_B_SERIES.get(pk)
        if series and not nd["has_evening_event"] and event_window_tag(pk, d) != "NONE":
            conn.execute(
                "INSERT INTO event_instance(park_id,date,series,start_min,end_min,reg_close_min,"
                "raw_desc,source) VALUES (?,?,?,?,?,?,?, 'inferred') "
                "ON CONFLICT(park_id,date,series) DO UPDATE SET source='inferred', "
                "reg_close_min=excluded.reg_close_min",
                (park_id, date_iso, series, nd["reg_close_min"],
                 nd["reg_close_min"] + 300, nd["reg_close_min"], "inferred:early-close"),
            )
            stats["tier_b_inferred"] += 1

    conn.commit()
    print(f"  normalise: {stats}")
    return stats
