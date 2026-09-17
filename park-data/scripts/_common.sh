# Sourced by the run scripts. Makes sure the virtualenv exists and the package
# is installed, then exposes $PARKDATA (path to the CLI). Not meant to be run
# directly.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

VENV="$ROOT/.venv"
PYTHON="${PYTHON:-python3}"

if [ ! -x "$VENV/bin/parkdata" ] || [ "${PARKDATA_REINSTALL:-0}" = "1" ]; then
  echo "==> preparing virtualenv ($VENV)"
  [ -d "$VENV" ] || "$PYTHON" -m venv "$VENV"
  "$VENV/bin/python" -m pip install --quiet --upgrade pip
  "$VENV/bin/python" -m pip install --quiet -e "$ROOT"
fi

PARKDATA="$VENV/bin/parkdata"
