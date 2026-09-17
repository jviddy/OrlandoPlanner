#!/usr/bin/env bash
#
# MONTHLY update. Refreshes the static catalogue (resorts, parks, attractions,
# restaurants, shows) and re-projects so any new park is covered.
#
#   ./scripts/monthly.sh

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

"$PARKDATA" all-monthly

echo
echo "Done. Review park-data/data/ and commit."
