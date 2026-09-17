import datetime as dt

import yaml

from parkdata import calendar_file as cf, config
from parkdata.calendar_model import season_tag
from parkdata.crowd_calendar import estimate


def test_holiday_seasons_are_not_hidden():
    assert season_tag(dt.date(2025, 7, 4)) == "JULY4_WK"
    assert season_tag(dt.date(2025, 9, 1)) == "LABOR_WKND"


def test_school_rules_preserve_overlapping_regions():
    sc = {"us": {"regions": ["FL", "NE"], "rules": [
        {"label": "SPRING", "start": "03-01", "end": "03-30", "regions": ["FL"]},
        {"label": "SPRING", "start": "03-10", "end": "03-20", "regions": ["NE"]},
    ]}, "explicit": []}
    assert cf._school("us", dt.date(2026, 3, 15), sc) == ("SPRING", ["FL", "NE"])
    sc["explicit"] = [{"region": "us", "label": "CONFIRMED", "regions": ["FL"],
                       "start": "2026-03-15", "end": "2026-03-15"}]
    assert cf._school("us", dt.date(2026, 3, 15), sc) == ("CONFIRMED,SPRING", ["FL", "NE"])


def test_christmas_does_not_stack_correlated_school_and_holiday_effects():
    rules = yaml.safe_load((config.CONFIG_DIR / "crowd_rules.yaml").read_text())
    row = {"season_tag": "CHRISTMAS_PEAK", "us_school_break": "WINTER",
           "uk_school_holiday": "CHRISTMAS", "brazil_school_holiday": "SUMMER",
           "days_to_next_us_holiday": "7", "days_since_prev_us_holiday": "27",
           "is_holiday": "1", "long_weekend": "0", "dow_num": "5"}
    rating, parts = estimate(row, rules)
    assert rating == 5
    assert parts["combinedCalendar"] == 2.3
