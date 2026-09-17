"""Write diffable CSV snapshots of the key tables under data/snapshots/.

The SQLite file is committed too, but these text dumps are what makes a weekly
commit reviewable in a diff.
"""
from __future__ import annotations

import csv

from . import config
from .util import min_to_hhmm

TABLES = {
    "parks.csv": (
        "SELECT r.key AS resort, p.key, p.name, p.entity_type, p.timezone, "
        "p.lat, p.lng, p.water_park, p.active FROM park p "
        "LEFT JOIN resort r ON r.id = p.resort_id ORDER BY r.key, p.key"
    ),
    "poi.csv": (
        "SELECT r.key AS resort, pk.key AS park, poi.entity_type, poi.name, "
        "poi.attraction_type, poi.active FROM poi "
        "LEFT JOIN park pk ON pk.id = poi.park_id "
        "LEFT JOIN resort r ON r.id = poi.resort_id "
        "ORDER BY r.key, pk.key, poi.entity_type, poi.name"
    ),
    "day_facts.csv": (
        "SELECT pk.key AS park, d.date, d.reg_open_min, d.reg_close_min, "
        "d.event_series, d.anomaly_flags FROM day_fact d "
        "JOIN park pk ON pk.id = d.park_id "
        "WHERE d.date >= date('now','-120 days') ORDER BY pk.key, d.date"
    ),
}


def write_all(conn) -> None:
    config.SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
    for fname, sql in TABLES.items():
        rows = conn.execute(sql).fetchall()
        _dump(config.SNAPSHOT_DIR / fname, rows)

    # projections: horizon, with times rendered HH:MM for readability
    rows = conn.execute(
        "SELECT pk.key AS park, p.date, p.status, p.method, p.confidence, "
        "p.open_min, p.close_min, p.n_analogs, p.spread_min, p.events_json, p.notes_json "
        "FROM projection p JOIN park pk ON pk.id = p.park_id "
        "ORDER BY pk.key, p.date"
    ).fetchall()
    path = config.SNAPSHOT_DIR / "projections.csv"
    with path.open("w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["park", "date", "status", "method", "confidence", "open",
                    "close", "n_analogs", "spread_min", "events", "notes"])
        for r in rows:
            w.writerow([
                r["park"], r["date"], r["status"], r["method"], r["confidence"],
                min_to_hhmm(r["open_min"]), min_to_hhmm(r["close_min"]),
                r["n_analogs"], r["spread_min"], r["events_json"], r["notes_json"],
            ])
    print(f"  snapshots -> data/snapshots/ ({len(rows)} projection rows)")


def _dump(path, rows) -> None:
    with path.open("w", newline="") as fh:
        w = csv.writer(fh)
        if not rows:
            return
        w.writerow(rows[0].keys())
        for r in rows:
            w.writerow(list(r))
