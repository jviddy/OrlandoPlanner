"""Week-to-week schedule change detection.

`schedule_version` keeps one row per distinct day-content (keyed by a hash). When
ingest sees a day whose hash differs from the newest version already stored, it
calls `diff_days` and records `drift_event` rows. `report` renders the changes
for a run as Markdown for review.
"""
from __future__ import annotations

import datetime as dt

from . import config
from .util import min_to_hhmm


def day_hash_input(entries: list[dict]) -> list:
    return sorted(
        (e["type"], e["open_min"], e["close_min"], e.get("description"))
        for e in entries
    )


def _events(entries: list[dict]) -> set[tuple]:
    return {
        (e["type"], e["open_min"], e["close_min"], e.get("description"))
        for e in entries
        if e["type"] != "OPERATING"
    }


def _operating(entries: list[dict]) -> tuple[int | None, int | None]:
    ops = [(e["open_min"], e["close_min"]) for e in entries if e["type"] == "OPERATING"]
    if not ops:
        return None, None
    return min(o for o, _ in ops), max(c for _, c in ops)


def diff_days(prev: list[dict], new: list[dict]) -> list[tuple[str, str]]:
    """Return (kind, human detail) pairs describing prev -> new."""
    out: list[tuple[str, str]] = []
    po, pc = _operating(prev)
    no, nc = _operating(new)
    if po != no:
        out.append(("open_changed", f"{min_to_hhmm(po)} -> {min_to_hhmm(no)}"))
    if pc != nc:
        out.append(("close_changed", f"{min_to_hhmm(pc)} -> {min_to_hhmm(nc)}"))

    pe, ne = _events(prev), _events(new)
    for t, o, c, d in sorted(ne - pe):
        out.append(("event_added", f"{t} {d or ''} {min_to_hhmm(o)}-{min_to_hhmm(c)}".strip()))
    for t, o, c, d in sorted(pe - ne):
        out.append(("event_removed", f"{t} {d or ''} {min_to_hhmm(o)}-{min_to_hhmm(c)}".strip()))
    return out


def record(conn, run_id: str, park_id: str, date: str, prev_hash: str,
           new_hash: str, diffs: list[tuple[str, str]]) -> None:
    for kind, detail in diffs:
        conn.execute(
            "INSERT INTO drift_event(run_id,park_id,date,kind,detail,prev_hash,new_hash,detected_at) "
            "VALUES (?,?,?,?,?,?,?,datetime('now'))",
            (run_id, park_id, date, kind, detail, prev_hash, new_hash),
        )


def report(conn, run_id: str | None = None) -> str:
    """Markdown report of drift for a run (default: the most recent)."""
    if run_id is None:
        row = conn.execute(
            "SELECT run_id FROM drift_event ORDER BY id DESC LIMIT 1"
        ).fetchone()
        run_id = row["run_id"] if row else None

    park_name = {r["id"]: r["name"] for r in conn.execute("SELECT id, name FROM park")}
    rows = conn.execute(
        "SELECT park_id, date, kind, detail FROM drift_event WHERE run_id=? ORDER BY park_id, date",
        (run_id,),
    ).fetchall() if run_id else []

    week = dt.date.today().isocalendar()
    lines = [f"# Schedule drift — {dt.date.today():%Y-%m-%d} (week {week.week})", ""]
    if not rows:
        lines.append("No published schedule changes since the last run.")
    else:
        lines.append(f"{len(rows)} change(s) across "
                     f"{len({r['park_id'] for r in rows})} park(s).\n")
        cur = None
        for r in rows:
            if r["park_id"] != cur:
                cur = r["park_id"]
                lines.append(f"\n## {park_name.get(cur, cur)}\n")
            lines.append(f"- **{r['date']}** · {r['kind']}: {r['detail']}")
    out = "\n".join(lines) + "\n"

    config.REPORT_DIR.mkdir(parents=True, exist_ok=True)
    fname = config.REPORT_DIR / f"drift-{dt.date.today():%G-W%V}.md"
    fname.write_text(out)
    print(f"  drift report -> {fname.relative_to(config.BASE_DIR)}")
    return out
