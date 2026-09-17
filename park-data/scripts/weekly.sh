#!/usr/bin/env bash
#
# WEEKLY update. Pulls opening hours + ticketed events for the published
# horizon, normalises them, refits the event models, reconciles any newly
# published months against their projections, re-projects the tail, and writes
# the drift + accuracy reports.
#
#   ./scripts/weekly.sh

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

"$PARKDATA" all-weekly

latest_drift="$(ls -1 data/reports/drift-*.md 2>/dev/null | tail -1 || true)"
echo
echo "Done."
[ -n "$latest_drift" ] && echo "Drift:    $latest_drift"
echo "Accuracy: data/reports/accuracy.md"
echo "Review park-data/data/ and commit."
