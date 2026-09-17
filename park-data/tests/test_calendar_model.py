"""The calendar model is the load-bearing piece — it decides which historical
days a future date is compared against. These tests pin the alignment logic."""
import datetime as dt

from parkdata import calendar_model as cm


def test_floating_anchors_2026():
    a = cm.anchors(2026)
    assert a["THANKSGIVING"] == dt.date(2026, 11, 26)   # 4th Thu
    assert a["MEMORIAL"] == dt.date(2026, 5, 25)        # last Mon
    assert a["LABOR"] == dt.date(2026, 9, 7)            # 1st Mon
    assert a["MLK"] == dt.date(2026, 1, 19)             # 3rd Mon


def test_day_class_buckets():
    # a Fri and a Sat are their own classes; Mon-Thu collapse
    assert cm.descriptor("MK", dt.date(2026, 6, 15))["day_class"] == "WEEKDAY"
    assert cm.descriptor("MK", dt.date(2026, 6, 19))["day_class"] == "FRI"
    assert cm.descriptor("MK", dt.date(2026, 6, 20))["day_class"] == "SAT"


def test_holiday_offset_travels_across_years():
    # 23 Dec is 2 days before Christmas in any year, regardless of weekday
    for year in (2024, 2025, 2026):
        d = dt.date(year, 12, 23)
        desc = cm.descriptor("MK", d)
        assert desc["hol_anchor"] == "CHRISTMAS"
        assert desc["hol_offset"] == -2


def test_christmas_peak_season_tag():
    assert cm.season_tag(dt.date(2026, 12, 27)) == "CHRISTMAS_PEAK"
    assert cm.season_tag(dt.date(2026, 12, 31)) == "NYE"
    assert cm.season_tag(dt.date(2026, 9, 15)) == "FALL_OFFPEAK"


def test_event_window_is_park_scoped():
    d = dt.date(2026, 9, 20)
    assert cm.event_window_tag("MK", d) == "WDW_HALLOWEEN"
    assert cm.event_window_tag("EP", d) == "NONE"       # EPCOT has no Halloween party


def test_event_window_bounds_resolve():
    lo, hi = cm.event_window_bounds("MK", "WDW_HALLOWEEN", 2027)
    assert lo == dt.date(2027, 8, 8)
    assert hi == dt.date(2027, 10, 31)


def test_new_year_wrap_window():
    # UOR_HOLIDAY runs 11-15 .. 01-04 — a date in early January is inside it
    assert cm.event_window_tag("USF", dt.date(2027, 1, 2)) == "UOR_HOLIDAY"
