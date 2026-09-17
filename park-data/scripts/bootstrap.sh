#!/usr/bin/env bash
#
# ONE-OFF first run. Fetches the full catalogue and all available history, then
# builds the event models and projects hours ~13 months out.
#
#   ./scripts/bootstrap.sh
#
# Takes a few minutes (~300 API requests). Safe to re-run.

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

echo "==> migrate (create data/parkdata.sqlite)"
"$PARKDATA" migrate

echo "==> backfill: catalogue + history + normalise + event models + projection"
"$PARKDATA" backfill

echo "==> drift baseline"
"$PARKDATA" drift || true   # nothing to compare against on the first run

cat <<EOF

Done.
  store        park-data/data/parkdata.sqlite
  projections  park-data/data/snapshots/projections.csv
  reports      park-data/data/reports/

Review data/ and commit when you're happy with it.
From now on just run ./scripts/weekly.sh and ./scripts/monthly.sh.
EOF
