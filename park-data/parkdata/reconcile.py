"""Replace projections with published hours, and log how far off they were.

Run this *before* `project` in the weekly job: it finds serving rows still marked
`projected` for which the API has since published real hours, appends the
projected-vs-actual delta to `accuracy_log`, and leaves the row for `project` to
overwrite as `published`. `scoreboard` aggregates the log into a Markdown table
to surface on the site as the honest accuracy statement.
"""
from __future__ import annotations

import datetime as dt
import json

from . import config, store
from .util import iqr


def run(conn) -> dict:
    run_id = store.new_run(conn, "reconcile")
    stats = {"resolved": 0}

    rows = conn.execute(
        """
        SELECT p.park_id, p.date, p.open_min AS proj_open, p.close_min AS proj_close,
               p.confidence, p.method, p.model_version, p.events_json AS proj_events,
               d.reg_open_min AS act_open, d.reg_close_min AS act_close, d.event_series
        FROM projection p
        JOIN day_fact d ON d.park_id = p.park_id AND d.date = p.date
        WHERE p.status = 'projected' AND d.source = 'api' AND d.is_operating = 1
        """
    ).fetchall()

    for r in rows:
        already = conn.execute(
            "SELECT 1 FROM accuracy_log WHERE park_id=? AND date=? AND model_version=?",
            (r["park_id"], r["date"], r["model_version"]),
        ).fetchone()
        if already:
            continue
        conn.execute(
            "INSERT INTO accuracy_log(park_id,date,proj_open,proj_close,act_open,act_close,"
            "proj_confidence,proj_method,model_version,proj_events,act_events,resolved_at) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?,datetime('now'))",
            (r["park_id"], r["date"], r["proj_open"], r["proj_close"],
             r["act_open"], r["act_close"], r["confidence"], r["method"],
             r["model_version"], r["proj_events"], r["event_series"]),
        )
        stats["resolved"] += 1

    conn.commit()
    store.finish_run(conn, run_id, True, stats)
    print(f"  reconcile: {stats}")
    return stats


def scoreboard(conn) -> str:
    park_name = {r["id"]: r["name"] for r in conn.execute("SELECT id, name FROM park")}
    rows = conn.execute("SELECT * FROM accuracy_log").fetchall()

    lines = [f"# Projection accuracy — {dt.date.today():%Y-%m-%d}", ""]
    if not rows:
        lines.append("No projections have been reconciled against published hours yet.")
        out = "\n".join(lines) + "\n"
        _write(out)
        return out

    lines += [
        "How close projected opening hours were to the hours the API later "
        "published. Close-time error is what matters most for planning.",
        "",
        "| Scope | n | close ±30min | close ±60min | mean close err | mean open err |",
        "|---|--:|--:|--:|--:|--:|",
    ]

    def bucket(name: str, subset: list) -> None:
        if not subset:
            return
        cerr = [abs(x["proj_close"] - x["act_close"]) for x in subset]
        oerr = [abs(x["proj_open"] - x["act_open"]) for x in subset]
        w30 = sum(1 for e in cerr if e <= 30) / len(cerr)
        w60 = sum(1 for e in cerr if e <= 60) / len(cerr)
        lines.append(
            f"| {name} | {len(subset)} | {w30:.0%} | {w60:.0%} | "
            f"{sum(cerr)/len(cerr):.0f} min | {sum(oerr)/len(oerr):.0f} min |"
        )

    bucket("All", rows)
    for conf in ("high", "medium", "low"):
        bucket(f"confidence = {conf}", [r for r in rows if r["proj_confidence"] == conf])
    by_park: dict[str, list] = {}
    for r in rows:
        by_park.setdefault(r["park_id"], []).append(r)
    for pid, subset in sorted(by_park.items(), key=lambda kv: park_name.get(kv[0], kv[0])):
        bucket(park_name.get(pid, pid), subset)

    out = "\n".join(lines) + "\n"
    _write(out)
    return out


def _write(text: str) -> None:
    config.REPORT_DIR.mkdir(parents=True, exist_ok=True)
    (config.REPORT_DIR / "accuracy.md").write_text(text)
    print(f"  accuracy scoreboard -> data/reports/accuracy.md")
