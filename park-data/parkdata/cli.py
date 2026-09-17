"""`parkdata <command>` — the entry point the workflows call.

Composite jobs:
  all-monthly   static catalogue + snapshots
  all-weekly    schedule -> normalise -> fit-events -> reconcile -> project
                -> drift report -> accuracy scoreboard -> snapshots
  backfill      one-off: pull all history, then fit-events + project
"""
from __future__ import annotations

import argparse
import sys

from . import (
    backtest,
    calendar_file,
    config,
    drift,
    events,
    ingest_schedule,
    ingest_static,
    normalise,
    project,
    reconcile,
    snapshots,
    store,
)


def _conn():
    conn = store.connect()
    store.migrate(conn)
    return conn


def cmd_migrate(_):
    _conn()
    print("schema up to date")


def cmd_ingest_static(_):
    conn = _conn()
    ingest_static.run(conn)


def cmd_ingest_schedule(args):
    conn = _conn()
    ingest_schedule.run(conn, mode=args.mode)


def cmd_normalise(_):
    normalise.run(_conn())


def cmd_fit_events(_):
    conn = _conn()
    print(f"  fit-events: {events.fit_models(conn)} series modelled")


def cmd_project(_):
    project.run(_conn())


def cmd_reconcile(_):
    conn = _conn()
    reconcile.run(conn)
    reconcile.scoreboard(conn)


def cmd_drift(_):
    drift.report(_conn())


def cmd_snapshot(_):
    snapshots.write_all(_conn())


def cmd_calendar(_):
    calendar_file.build()


def cmd_backtest(args):
    backtest.run(_conn(), eval_days=args.eval_days, blackout_days=args.blackout_days)


def cmd_backfill(_):
    conn = _conn()
    ingest_static.run(conn)
    ingest_schedule.run(conn, mode="backfill")
    normalise.run(conn)
    events.fit_models(conn)
    project.run(conn)
    calendar_file.build()
    snapshots.write_all(conn)


def cmd_all_monthly(_):
    conn = _conn()
    ingest_static.run(conn)
    # a fresh catalogue can surface new parks -> reproject so the horizon covers them
    project.run(conn)
    calendar_file.build()   # regenerate so the rolling window advances
    snapshots.write_all(conn)


def cmd_all_weekly(_):
    conn = _conn()
    ingest_schedule.run(conn, mode="weekly")
    normalise.run(conn)
    events.fit_models(conn)
    reconcile.run(conn)          # log projected-vs-actual before project overwrites
    project.run(conn)
    drift.report(conn)
    reconcile.scoreboard(conn)
    snapshots.write_all(conn)


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="parkdata")
    sub = p.add_subparsers(dest="cmd", required=True)
    from . import parkcrowds
    parkcrowds.configure(sub.add_parser("import-parkcrowds"))

    sub.add_parser("migrate").set_defaults(func=cmd_migrate)
    sub.add_parser("ingest-static").set_defaults(func=cmd_ingest_static)

    s = sub.add_parser("ingest-schedule")
    s.add_argument("--mode", choices=["weekly", "backfill"], default="weekly")
    s.set_defaults(func=cmd_ingest_schedule)

    sub.add_parser("normalise").set_defaults(func=cmd_normalise)
    sub.add_parser("fit-events").set_defaults(func=cmd_fit_events)
    sub.add_parser("project").set_defaults(func=cmd_project)
    sub.add_parser("reconcile").set_defaults(func=cmd_reconcile)
    sub.add_parser("drift").set_defaults(func=cmd_drift)
    sub.add_parser("snapshot").set_defaults(func=cmd_snapshot)
    sub.add_parser("calendar").set_defaults(func=cmd_calendar)

    b = sub.add_parser("backtest")
    b.add_argument("--eval-days", type=int, default=400)
    b.add_argument("--blackout-days", type=int, default=75)
    b.set_defaults(func=cmd_backtest)

    sub.add_parser("backfill").set_defaults(func=cmd_backfill)
    sub.add_parser("all-monthly").set_defaults(func=cmd_all_monthly)
    sub.add_parser("all-weekly").set_defaults(func=cmd_all_weekly)

    args = p.parse_args(argv)
    config.ensure_dirs()
    args.func(args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
