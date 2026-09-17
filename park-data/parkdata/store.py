"""SQLite store: schema + connection helpers.

One committed file, `data/parkdata.sqlite`. Text snapshots and Markdown reports
under data/ are the human-readable / diffable layer; this file is the queryable
working set and the append-only history the drift + accuracy checks rely on.
"""
from __future__ import annotations

import sqlite3
import uuid

from . import config

SCHEMA = """
-- HTTP revalidation cache (ETag -> body) --------------------------------------
CREATE TABLE IF NOT EXISTS http_cache (
    url        TEXT PRIMARY KEY,
    etag       TEXT,
    body_gz    BLOB,
    fetched_at TEXT
);

-- Static catalogue (refreshed monthly) --------------------------------------
CREATE TABLE IF NOT EXISTS resort (
    id         TEXT PRIMARY KEY,
    key        TEXT UNIQUE,
    name       TEXT,
    slug       TEXT,
    raw_json   TEXT,
    last_seen  TEXT
);

CREATE TABLE IF NOT EXISTS park (
    id           TEXT PRIMARY KEY,
    key          TEXT,
    resort_id    TEXT REFERENCES resort(id),
    name         TEXT,
    slug         TEXT,
    entity_type  TEXT,
    timezone     TEXT,
    lat          REAL,
    lng          REAL,
    external_id  TEXT,
    water_park   INTEGER DEFAULT 0,
    configured   INTEGER DEFAULT 0,   -- present in resorts.yaml
    active       INTEGER DEFAULT 1,   -- still returned by the API
    first_seen   TEXT,
    last_seen    TEXT,
    raw_json     TEXT
);

CREATE TABLE IF NOT EXISTS poi (
    id              TEXT PRIMARY KEY,
    park_id         TEXT REFERENCES park(id),
    resort_id       TEXT REFERENCES resort(id),
    name            TEXT,
    slug            TEXT,
    entity_type     TEXT,             -- ATTRACTION | RESTAURANT | SHOW
    attraction_type TEXT,             -- RIDE, etc. (attractions only)
    lat             REAL,
    lng             REAL,
    external_id     TEXT,
    active          INTEGER DEFAULT 1,
    first_seen      TEXT,
    last_seen       TEXT,
    raw_json        TEXT
);
CREATE INDEX IF NOT EXISTS poi_park ON poi(park_id, entity_type);

-- Schedule version history (append-only; one row per distinct day content) ---
CREATE TABLE IF NOT EXISTS schedule_version (
    park_id        TEXT,
    date           TEXT,
    day_hash       TEXT,
    reg_open_min   INTEGER,
    reg_close_min  INTEGER,
    entries_json   TEXT,             -- normalised entry list for the day
    source_month   TEXT,             -- 'YYYY-MM' pull it came from
    first_seen_at  TEXT,
    first_seen_run TEXT,
    last_seen_at   TEXT,
    last_seen_run  TEXT,
    PRIMARY KEY (park_id, date, day_hash)
);
CREATE INDEX IF NOT EXISTS schedule_version_pd ON schedule_version(park_id, date, last_seen_at);

-- Normalised, one row per park-day (published OR projected) -----------------
CREATE TABLE IF NOT EXISTS day_fact (
    park_id          TEXT,
    date             TEXT,
    reg_open_min     INTEGER,
    reg_close_min    INTEGER,
    is_operating     INTEGER,
    early_entry_min  INTEGER,
    extended_eve_min INTEGER,
    has_evening_event INTEGER DEFAULT 0,
    event_series     TEXT,
    anomaly_flags    TEXT,           -- comma list: COVID_ERA, EARLY_CLOSE, MISSING...
    source           TEXT,           -- 'api'
    updated_at       TEXT,
    PRIMARY KEY (park_id, date)
);

-- One row per (park, date, series) extracted ticketed event ----------------
CREATE TABLE IF NOT EXISTS event_instance (
    park_id       TEXT,
    date          TEXT,
    series        TEXT,              -- HALLOWEEN_PARTY | CHRISTMAS_PARTY | AFTER_HOURS | ...
    start_min     INTEGER,
    end_min       INTEGER,
    reg_close_min INTEGER,           -- regular close on that day
    raw_desc      TEXT,
    source        TEXT,              -- 'api' | 'inferred'
    PRIMARY KEY (park_id, date, series)
);

-- Per-series forward model, refit each weekly run -------------------------
CREATE TABLE IF NOT EXISTS event_series_model (
    park_id        TEXT,
    series         TEXT,
    seasons_json   TEXT,             -- per-year {year, first, last, nights, dows, count}
    window_tag     TEXT,
    med_start_min  INTEGER,
    med_end_min    INTEGER,
    med_regclose   INTEGER,
    med_nights     INTEGER,
    years_seen     INTEGER,
    years_consistent INTEGER,
    updated_at     TEXT,
    PRIMARY KEY (park_id, series)
);

-- Serving table: hours for every park-day in the horizon ------------------
CREATE TABLE IF NOT EXISTS projection (
    park_id       TEXT,
    date          TEXT,
    open_min      INTEGER,
    close_min     INTEGER,
    status        TEXT,              -- 'published' | 'projected'
    method        TEXT,              -- 'api' | 'analog-knn' | 'sibling-scaled' | 'monthly-fallback'
    confidence    TEXT,              -- 'high' | 'medium' | 'low'
    n_analogs     INTEGER,
    spread_min    INTEGER,
    events_json   TEXT,              -- [{series,start,end,status,confidence,price,price_confidence}]
    notes_json    TEXT,
    model_version TEXT,
    generated_at  TEXT,
    PRIMARY KEY (park_id, date)
);

-- Projected-vs-actual, appended by reconcile as months publish -----------
CREATE TABLE IF NOT EXISTS accuracy_log (
    park_id       TEXT,
    date          TEXT,
    proj_open     INTEGER,
    proj_close    INTEGER,
    act_open      INTEGER,
    act_close     INTEGER,
    proj_confidence TEXT,
    proj_method   TEXT,
    model_version TEXT,
    proj_events   TEXT,
    act_events    TEXT,
    resolved_at   TEXT,
    PRIMARY KEY (park_id, date, model_version)
);

-- Week-to-week schedule changes -----------------------------------------
CREATE TABLE IF NOT EXISTS drift_event (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id      TEXT,
    park_id     TEXT,
    date        TEXT,
    kind        TEXT,               -- open_changed | close_changed | event_added | event_removed | new_day | day_removed
    detail      TEXT,
    prev_hash   TEXT,
    new_hash    TEXT,
    detected_at TEXT
);
CREATE INDEX IF NOT EXISTS drift_event_run ON drift_event(run_id);

-- One row per job invocation -------------------------------------------
CREATE TABLE IF NOT EXISTS run_log (
    run_id      TEXT PRIMARY KEY,
    job         TEXT,
    started_at  TEXT,
    finished_at TEXT,
    ok          INTEGER,
    stats_json  TEXT
);
"""


def connect(path=None) -> sqlite3.Connection:
    config.ensure_dirs()
    conn = sqlite3.connect(path or config.DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    # FKs are documentation only: the API can parent a POI to an entity we don't
    # track as a park (sub-lands, CityWalk, resort-level venues) and we still
    # want the row. Referential tidiness is enforced by the ingest logic.
    conn.execute("PRAGMA busy_timeout=10000")
    return conn


def migrate(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA)
    conn.commit()


def new_run(conn: sqlite3.Connection, job: str) -> str:
    run_id = f"{job}-{uuid.uuid4().hex[:12]}"
    conn.execute(
        "INSERT INTO run_log(run_id, job, started_at, ok) VALUES (?,?,datetime('now'),0)",
        (run_id, job),
    )
    conn.commit()
    return run_id


def finish_run(conn: sqlite3.Connection, run_id: str, ok: bool, stats: dict) -> None:
    import json

    conn.execute(
        "UPDATE run_log SET finished_at=datetime('now'), ok=?, stats_json=? WHERE run_id=?",
        (int(ok), json.dumps(stats, default=str), run_id),
    )
    conn.commit()
