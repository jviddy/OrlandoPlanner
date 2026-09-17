"""Backtest the hours projector against already-known history.

For each recently-known park-day, re-derive a projection using only history that
would have been available `blackout_days` earlier, then compare to the actual
published hours. Prints a table and writes data/reports/backtest.md.

    parkdata backtest --eval-days 400 --blackout-days 75
"""
from __future__ import annotations

import datetime as dt
import statistics

from . import config, store
from .calendar_model import descriptor
from .project import K, SCORE_FLOOR, score
from .util import iqr, round_to, weighted_median


def _history(conn, park_id, before_iso, clean_start):
    rows = conn.execute(
        "SELECT date, reg_open_min, reg_close_min, anomaly_flags FROM day_fact "
        "WHERE park_id=? AND source='api' AND is_operating=1 AND date >= ? AND date < ? "
        "ORDER BY date",
        (park_id, f"{clean_start}-01", before_iso),
    ).fetchall()
    out = []
    for r in rows:
        flags = set((r["anomaly_flags"] or "").split(","))
        if flags & {"COVID_ERA", "EARLY_CLOSE", "NO_OPERATING"}:
            continue
        out.append({"date": r["date"], "open": r["reg_open_min"], "close": r["reg_close_min"]})
    return out


def run(conn, eval_days: int = 400, blackout_days: int = 75) -> str:
    s = config.load()
    park_name = {p.id: p.name for p in []}  # filled below
    park_name = {r["id"]: r["name"] for r in conn.execute("SELECT id,name FROM park")}
    horizon_start = (dt.date.today() - dt.timedelta(days=eval_days)).isoformat()

    results: list[dict] = []
    for p in s.all_parks:
        if p.water_park:
            continue
        actuals = conn.execute(
            "SELECT date, reg_open_min, reg_close_min FROM day_fact "
            "WHERE park_id=? AND source='api' AND is_operating=1 AND date >= ? "
            "AND (anomaly_flags IS NULL OR anomaly_flags NOT LIKE '%EARLY_CLOSE%') "
            "ORDER BY date",
            (p.id, horizon_start),
        ).fetchall()
        if not actuals:
            continue

        hist_cache: dict[str, list] = {}
        for a in actuals:
            target = dt.date.fromisoformat(a["date"])
            cutoff = (target - dt.timedelta(days=blackout_days)).isoformat()
            hist = hist_cache.get(cutoff)
            if hist is None:
                hist = _history(conn, p.id, cutoff, s.clean_history_start)
                for h in hist:
                    h["desc"] = descriptor(p.key, dt.date.fromisoformat(h["date"]))
                hist_cache[cutoff] = hist
            if len(hist) < 30:
                continue

            t = descriptor(p.key, target)
            scored = sorted(
                ((score(h["desc"], t), h) for h in hist if score(h["desc"], t) >= SCORE_FLOOR),
                key=lambda x: -x[0],
            )[:K]
            if len(scored) < 3:
                continue
            ws = [w for w, _ in scored]
            pc = round_to(weighted_median([h["close"] for _, h in scored], ws))
            po = round_to(weighted_median([h["open"] for _, h in scored], ws))
            results.append(
                {
                    "park": p.key,
                    "close_err": abs(pc - a["reg_close_min"]),
                    "open_err": abs(po - a["reg_open_min"]),
                }
            )

    return _render(results, park_name, eval_days, blackout_days)


def _render(results, park_name, eval_days, blackout_days) -> str:
    lines = [
        f"# Hours projection backtest — {dt.date.today():%Y-%m-%d}",
        "",
        f"Eval window: last {eval_days} days · blackout: {blackout_days} days "
        f"(history truncated to what was knowable that far ahead).",
        "",
        "| Park | n | close ±30 | close ±60 | mean close err | mean open err |",
        "|---|--:|--:|--:|--:|--:|",
    ]

    def row(name, subset):
        if not subset:
            return
        ce = [r["close_err"] for r in subset]
        oe = [r["open_err"] for r in subset]
        lines.append(
            f"| {name} | {len(subset)} | "
            f"{sum(e<=30 for e in ce)/len(ce):.0%} | {sum(e<=60 for e in ce)/len(ce):.0%} | "
            f"{statistics.mean(ce):.0f} min | {statistics.mean(oe):.0f} min |"
        )

    row("All", results)
    by_park: dict[str, list] = {}
    for r in results:
        by_park.setdefault(r["park"], []).append(r)
    for k, subset in sorted(by_park.items()):
        row(k, subset)

    out = "\n".join(lines) + "\n"
    config.REPORT_DIR.mkdir(parents=True, exist_ok=True)
    (config.REPORT_DIR / "backtest.md").write_text(out)
    print(out)
    return out
