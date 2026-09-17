"""WEEKLY job (and the historical BACKFILL): operating hours + events.

One `/entity/{resort}/schedule/{year}/{month}` call per resort per month returns
every park in that resort. Each day is normalised, hashed, and stored as a
`schedule_version`; when a day's hash changes from the newest stored version a
`drift_event` is recorded.

Modes:
  backfill  history_start .. current month   (run once)
  weekly    current month .. +forward_months (the recurring job)
"""
from __future__ import annotations

import datetime as dt
from collections import defaultdict

from . import config, drift, store
from .api import Client
from .normalise import to_norm_entries
from .util import months_between, sha1


def _month_span(mode: str, s: config.Settings) -> list[tuple[int, int]]:
    today = dt.date.today()
    if mode == "backfill":
        end = f"{today:%Y-%m}"
        return months_between(s.history_start, end)
    # weekly: current month + forward_months
    months = []
    y, m = today.year, today.month
    for _ in range(s.forward_months + 1):
        months.append((y, m))
        m += 1
        if m == 13:
            y, m = y + 1, 1
    return months


def run(conn, client: Client | None = None, *, mode: str = "weekly") -> dict:
    s = config.load()
    client = client or Client(conn, s)
    run_id = store.new_run(conn, f"schedule-{mode}")
    stats = {"months": 0, "days": 0, "new_versions": 0, "drift_events": 0, "empty": 0}

    park_ids = {p.id for p in s.all_parks}

    for resort in s.resorts:
        for (y, m) in _month_span(mode, s):
            payload = client.schedule_month(resort.id, y, m)
            stats["months"] += 1
            source_month = f"{y:04d}-{m:02d}"

            park_blocks = payload.get("parks") or []
            if not park_blocks and payload.get("schedule"):
                park_blocks = [{"id": resort.id, "schedule": payload["schedule"]}]

            for block in park_blocks:
                pid = block.get("id")
                sched = block.get("schedule") or []
                if not sched:
                    stats["empty"] += 1
                    continue

                by_date: dict[str, list] = defaultdict(list)
                for e in sched:
                    by_date[e["date"]].append(e)

                for date_iso, raw_entries in by_date.items():
                    entries = to_norm_entries(raw_entries)
                    reg_open = min((e["open_min"] for e in entries if e["type"] == "OPERATING"),
                                   default=None)
                    reg_close = max((e["close_min"] for e in entries if e["type"] == "OPERATING"),
                                    default=None)
                    dhash = sha1(drift.day_hash_input(entries))
                    stats["days"] += 1

                    newest = conn.execute(
                        "SELECT day_hash, entries_json FROM schedule_version "
                        "WHERE park_id=? AND date=? ORDER BY last_seen_at DESC LIMIT 1",
                        (pid, date_iso),
                    ).fetchone()

                    if newest and newest["day_hash"] == dhash:
                        conn.execute(
                            "UPDATE schedule_version SET last_seen_at=datetime('now'), last_seen_run=? "
                            "WHERE park_id=? AND date=? AND day_hash=?",
                            (run_id, pid, date_iso, dhash),
                        )
                        continue

                    # new / changed version
                    import json as _json

                    conn.execute(
                        "INSERT INTO schedule_version(park_id,date,day_hash,reg_open_min,"
                        "reg_close_min,entries_json,source_month,first_seen_at,first_seen_run,"
                        "last_seen_at,last_seen_run) VALUES (?,?,?,?,?,?,?,"
                        "datetime('now'),?,datetime('now'),?) "
                        "ON CONFLICT(park_id,date,day_hash) DO UPDATE SET "
                        "last_seen_at=datetime('now'), last_seen_run=excluded.last_seen_run",
                        (pid, date_iso, dhash, reg_open, reg_close,
                         _json.dumps(entries), source_month, run_id, run_id),
                    )
                    stats["new_versions"] += 1

                    if newest and mode == "weekly":
                        diffs = drift.diff_days(_json.loads(newest["entries_json"]), entries)
                        if diffs:
                            drift.record(conn, run_id, pid, date_iso,
                                         newest["day_hash"], dhash, diffs)
                            stats["drift_events"] += len(diffs)
            conn.commit()

    store.finish_run(conn, run_id, True, stats)
    print(f"  schedule/{mode}: {stats}")
    return stats
