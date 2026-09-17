import datetime as dt
from parkdata.evening_calendar import shift_weekday


def test_guess_preserves_weekday_near_anniversary():
    start = dt.date(2025, 1, 1)
    for i in range(365):
        source = start + dt.timedelta(days=i)
        for year in (2026, 2027, 2028):
            guess = shift_weekday(source, year)
            assert guess.weekday() == source.weekday()
            assert abs((guess - dt.date(year, source.month, source.day)).days) <= 3


def test_leap_day_can_project_to_non_leap_year():
    source = dt.date(2024, 2, 29)
    assert shift_weekday(source, 2027).weekday() == source.weekday()
