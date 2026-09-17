"""Sanity checks for the categorised calendar builder."""
import csv
import datetime as dt

import pytest

from parkdata import calendar_file as cf
from parkdata import config


@pytest.fixture(scope="module")
def calendar_rows(tmp_path_factory):
    # build into a temp data dir so the test doesn't touch the repo file
    tmp = tmp_path_factory.mktemp("data")
    orig = config.DATA_DIR
    config.DATA_DIR = tmp
    try:
        cf.build()
        with (tmp / "calendar.csv").open() as fh:
            return {r["date"]: r for r in csv.DictReader(fh)}
    finally:
        config.DATA_DIR = orig


def test_spans_calendar_start_to_end(calendar_rows):
    s = config.load()
    assert min(calendar_rows) == s.calendar_start
    assert max(calendar_rows) == s.calendar_end


def test_every_day_present_once(calendar_rows):
    dates = sorted(calendar_rows)
    d0, d1 = dt.date.fromisoformat(dates[0]), dt.date.fromisoformat(dates[-1])
    assert len(calendar_rows) == (d1 - d0).days + 1


def test_thanksgiving_2026(calendar_rows):
    r = calendar_rows["2026-11-26"]
    assert r["us_holiday"] == "Thanksgiving Day"
    assert r["long_weekend"] == "1"
    assert r["holiday_anchor"] == "THANKSGIVING"
    assert "HOLIDAY_SEASON" in r["overlays"]
    # the Friday after is a bridge day
    assert calendar_rows["2026-11-27"]["bridge_day"] == "1"


def test_presidents_week_is_northeast_only(calendar_rows):
    r = calendar_rows["2027-02-15"]  # Washington's Birthday 2027
    assert r["presidents_week"] == "1"
    assert r["us_regions_off"] == "NE"
    assert r["uk_school_holiday"] == "FEB_HALF_TERM"


def test_holiday_distances_always_filled(calendar_rows):
    for r in calendar_rows.values():
        assert r["days_to_next_us_holiday"] != ""
        assert r["days_since_prev_us_holiday"] != ""


def test_day_class_matches_weekday(calendar_rows):
    for iso, r in calendar_rows.items():
        wd = dt.date.fromisoformat(iso).weekday()
        expect = {4: "FRI", 5: "SAT", 6: "SUN"}.get(wd, "WEEKDAY")
        assert r["day_class"] == expect
