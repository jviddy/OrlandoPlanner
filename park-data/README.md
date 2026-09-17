# park-data

Ingest, normalise and forward-project theme-park data for the Orlando resorts,
sourced from the free [ThemeParks.wiki API](https://api.themeparks.wiki/docs/v1).

It is deliberately boring: a handful of Python scripts, a single committed SQLite
file as the store, and diffable CSV/Markdown snapshots for review. No live
queue data is fetched.

## What it does

| Cadence | Command | What it pulls |
|---|---|---|
| Monthly | `parkdata all-monthly` | Every Orlando resort → parks → attractions / restaurants / shows, plus per-park geo + timezone. Mostly static. |
| Weekly  | `parkdata all-weekly`  | Operating hours + ticketed events for the current month and the next few, for every park. Then normalise → fit event models → re-project → reconcile → drift-check. |
| One-off | `parkdata backfill`    | Walk `/schedule/{year}/{month}` back to `history_start` (2021‑05) so the projector has history to work from. |

### The projection model

Opening hours are only published ~8 weeks (Disney/Universal) to ~7 months
(SeaWorld) ahead. Everything past the published horizon, out to
`project_horizon_days` (~13 months), is **projected** by a deterministic
analog-day model — no ML:

1. Every date, past and future, is reduced to an alignment-invariant descriptor
   (day-class, circular day-of-year, holiday anchor + offset, season tag, event
   window) — see `parkdata/calendar_model.py`.
2. For each future date, the most similar *historical* days **for that park** are
   scored and the top-K aggregated (weighted median, rounded to 30 min).
3. Ticketed events are classified into series by season + time-of-day signature
   (WDW labels them all `"Special Ticketed Event"`), modelled per series, and
   instantiated forward; on event nights the regular close is pulled back to the
   learned value. Universal / SeaWorld publish no event rows, so those are
   inferred from anomalously early closes inside a known event window.

Every projected row carries a `confidence` and `status = "projected"`.

### Categorised calendar (`data/calendar.csv`)

`parkdata calendar` (also run by `all-monthly` / `backfill`) writes one row per
date from `calendar_start` to `calendar_end` (2023‑01‑01 … 2029‑01‑31 — the
start is kept in the past so historic crowd data has calendar rows to join
against), categorised by the seasonal / calendar factors that drive opening
hours **and** crowd levels — day class,
season, proximity to holidays, long weekends, event + festival seasons, and
approximate US / UK / Brazil school breaks. It holds **no predictions**; it is
the feature table you join historic crowd data (and the hours projections)
against. Columns, sources and how to correct individual days: **FACTORS.md**.
Editable inputs: `config/windows.yaml`, `config/school_calendars.yaml`,
`config/day_overrides.csv`.

### Reconcile + drift

- **Reconcile** (`parkdata reconcile`) — when the API later publishes a month
  that was projected, the projection row is replaced with the real hours and the
  projected-vs-actual delta is appended to `accuracy_log`. `data/reports/accuracy.md`
  is the honest "how good are the projections" scoreboard to surface on the site.
- **Drift** (`parkdata drift`) — each weekly run versions every published day
  (`schedule_version`, keyed by a content hash). When a day's hours or events
  change from the version seen last week, a `drift_event` is recorded and listed
  in `data/reports/drift-YYYY-Www.md`.

## Layout

```
park-data/
├── scripts/             # bootstrap.sh / weekly.sh / monthly.sh — the way in
├── config/
│   ├── resorts.yaml     # Orlando resorts + park IDs + short codes (seed; refreshed monthly)
│   ├── windows.yaml     # holiday / season / event windows used by the projector
│   └── event_prices.csv # hand-maintained ticketed-event prices (not in the API)
├── parkdata/            # the package (run as `parkdata` or `python -m parkdata.cli`)
├── data/
│   ├── parkdata.sqlite  # committed store
│   ├── calendar.csv     # one row per date, 2023-01-01 → 2029, categorised — see FACTORS.md
│   ├── snapshots/       # diffable CSV of parks / pois / day_facts / projections
│   └── reports/         # drift-*.md, accuracy.md, backtest.md
├── tests/
├── RUNNING.md
├── FACTORS.md           # what every calendar.csv column means + how to update it
└── README.md
```

Workflows live at the repo root in `.github/workflows/parkdata-*.yml` and run the
same three scripts on a schedule.

## Running it

See [RUNNING.md](RUNNING.md). Short version — three self-contained scripts:

```bash
./scripts/bootstrap.sh    # once: full catalogue + all history + projection
./scripts/weekly.sh       # weekly: hours, events, reprojection, drift + accuracy
./scripts/monthly.sh      # monthly: refresh the catalogue
```

Config knobs (`config/resorts.yaml`): `history_start`, `forward_months`,
`project_horizon_days`, `request_per_sec`.

## Notes / limitations

- History starts **May 2021**; 2021 and early 2022 are COVID-distorted and are
  down-weighted to ~zero by the projector (`clean_history_start`).
- **Epic Universe** opened 2025 — under one full season of history; it falls back
  to sibling-park scaling with wide confidence until mid-2026.
- Ticketed-event **prices** are not in the API. `config/event_prices.csv` is a
  small hand-maintained table; projected prices are always `confidence = low`.
- Water parks (Typhoon Lagoon, Blizzard Beach) are seasonal and weather-driven —
  not projected past the published horizon.
