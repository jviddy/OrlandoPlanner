"""Small pure helpers: time-of-day maths, medians, hashing, month ranges."""
from __future__ import annotations

import datetime as dt
import gzip
import hashlib
import json
from typing import Iterable, Sequence

# ---------------------------------------------------------------- time of day ---

def hhmm_to_min(iso: str) -> int:
    """Minutes since local midnight from an ISO datetime string.

    The API returns local wall-clock time with an offset, so we can read the
    clock directly. Times after midnight (e.g. a 01:00 close) come back as a
    small number; callers add 1440 when close <= open.
    """
    t = dt.datetime.fromisoformat(iso)
    return t.hour * 60 + t.minute


def span_minutes(open_iso: str, close_iso: str) -> tuple[int, int]:
    o = hhmm_to_min(open_iso)
    c = hhmm_to_min(close_iso)
    if c <= o:
        c += 1440
    return o, c


def min_to_hhmm(m: int | None) -> str | None:
    if m is None:
        return None
    m %= 1440
    return f"{m // 60:02d}:{m % 60:02d}"


def round_to(m: float, step: int = 30) -> int:
    return int(round(m / step) * step)


# ------------------------------------------------------------------- stats ---

def weighted_median(values: Sequence[float], weights: Sequence[float]) -> float:
    if not values:
        raise ValueError("weighted_median of empty sequence")
    order = sorted(range(len(values)), key=lambda i: values[i])
    total = sum(weights)
    cum = 0.0
    for i in order:
        cum += weights[i]
        if cum >= total / 2:
            return values[i]
    return values[order[-1]]


def iqr(values: Sequence[float]) -> float:
    if len(values) < 2:
        return 0.0
    s = sorted(values)
    def pct(p: float) -> float:
        k = p * (len(s) - 1)
        lo = int(k)
        hi = min(lo + 1, len(s) - 1)
        return s[lo] + (s[hi] - s[lo]) * (k - lo)
    return pct(0.75) - pct(0.25)


# ---------------------------------------------------------------- calendar ---

def nth_weekday(year: int, month: int, weekday: int, n: int) -> dt.date:
    """`n`-th `weekday` (Mon=0) of `month`. n=1 is the first."""
    d = dt.date(year, month, 1)
    shift = (weekday - d.weekday()) % 7
    return d + dt.timedelta(days=shift + 7 * (n - 1))


def last_weekday(year: int, month: int, weekday: int) -> dt.date:
    if month == 12:
        nxt = dt.date(year + 1, 1, 1)
    else:
        nxt = dt.date(year, month + 1, 1)
    d = nxt - dt.timedelta(days=1)
    return d - dt.timedelta(days=(d.weekday() - weekday) % 7)


def months_between(start: str, end: str) -> list[tuple[int, int]]:
    """Inclusive list of (year, month) from 'YYYY-MM' start to end."""
    sy, sm = (int(x) for x in start.split("-"))
    ey, em = (int(x) for x in end.split("-"))
    out = []
    y, m = sy, sm
    while (y, m) <= (ey, em):
        out.append((y, m))
        m += 1
        if m == 13:
            y, m = y + 1, 1
    return out


def daterange(start: dt.date, end: dt.date) -> Iterable[dt.date]:
    d = start
    while d <= end:
        yield d
        d += dt.timedelta(days=1)


def circular_yday_dist(a: int, b: int) -> int:
    return min(abs(a - b), 365 - abs(a - b))


# ------------------------------------------------------------------ misc ---

def gz(obj) -> bytes:
    return gzip.compress(json.dumps(obj, separators=(",", ":"), sort_keys=True).encode())


def ungz(blob: bytes):
    return json.loads(gzip.decompress(blob))


def sha1(*parts: object) -> str:
    h = hashlib.sha1()
    for p in parts:
        h.update(repr(p).encode())
    return h.hexdigest()


def today() -> dt.date:
    return dt.date.today()
