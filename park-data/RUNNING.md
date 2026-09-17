# Running park-data

Three scripts. Each one sets up its own virtualenv on first use, so there is
nothing to install by hand. Requires Python 3.11+.

```bash
cd "/Users/jamievidamour/iCloud Drive (Archive)/Documents/Dev/OverthinkThemeParks/park-data"

./scripts/bootstrap.sh      # ONCE — full catalogue + all history + projection (~2 min)
./scripts/weekly.sh         # every week — hours, events, reprojection, drift + accuracy
./scripts/monthly.sh        # every month — refresh the catalogue
```

That's it. After each run, review `data/` and commit.

## What each does

| Script | Runs | Wraps |
|---|---|---|
| `scripts/bootstrap.sh` | once, first | `parkdata migrate` + `parkdata backfill` (catalogue → history back to 2021‑05 → normalise → event models → projection → snapshots) |
| `scripts/weekly.sh` | weekly | `parkdata all-weekly` — pull hours + events for the published horizon, normalise, refit event models, reconcile any newly‑published month against its projection (logs the error), re‑project the tail, write `data/reports/drift-*.md` and `data/reports/accuracy.md` |
| `scripts/monthly.sh` | monthly | `parkdata all-monthly` — refresh resorts / parks / attractions / restaurants / shows, then re‑project so any new park is covered |

Run `bootstrap.sh` before `weekly.sh` — the projector has no history to work
from otherwise. All three are safe to re‑run.

## Output

- `data/parkdata.sqlite` — the store. `sqlite3 data/parkdata.sqlite`. The serving
  table is `projection` (one row per park per date; `status` = `published` |
  `projected`, plus `confidence`, `method`, `n_analogs`, `spread_min`, `events_json`).
- `data/calendar.csv` — one row per date, 2023‑01‑01 → 2029‑01‑31, categorised by
  seasonal / calendar factors for crowd + hours modelling (`parkdata calendar`,
  also in the monthly job). Range knobs `calendar_start` / `calendar_end` in
  `config/resorts.yaml`. Columns and how to edit: **FACTORS.md**.
- `data/snapshots/*.csv` — `parks.csv`, `poi.csv`, `day_facts.csv`, `projections.csv` (diffable).
- `data/reports/*.md` — `drift-YYYY-Www.md` (schedule changes since last run),
  `accuracy.md` (projected‑vs‑actual scoreboard), `backtest.md`.

## Running a single step

The scripts just call the `parkdata` CLI in `.venv`. To drive it directly:

```bash
source .venv/bin/activate     # after the first script run has created it
parkdata --help
parkdata project
parkdata drift
parkdata backtest --eval-days 400 --blackout-days 75
```

Force a fresh venv / dependency reinstall: `PARKDATA_REINSTALL=1 ./scripts/weekly.sh`.

## Config

- `config/resorts.yaml` — resorts + park IDs + short codes; `history_start`,
  `clean_history_start`, `forward_months`, `project_horizon_days`, `request_per_sec`.
- `config/windows.yaml` — holiday / season / event windows for the projector.
- `config/event_prices.csv` — hand‑maintained ticketed‑event prices (not in the API).

Projection tunables (weights, `K`, kernel width) are in `parkdata/project.py`;
move them with `parkdata backtest`, not by hand.

## GitHub Actions

`.github/workflows/parkdata-{backfill,weekly,monthly}.yml` run the same three
scripts on a schedule. After committing `park-data/` and `.github/`:

1. **Settings → Actions → General** → allow workflows, set **Workflow
   permissions** to *Read and write* (the jobs commit `data/` back).
2. Actions tab → **parkdata · history backfill** → *Run workflow* (once).
3. The crons take over: **monthly catalogue** on the 3rd, **weekly hours** every
   Tuesday. Each run commits changed files under `park-data/data/` and posts the
   drift + accuracy reports to the run summary.
