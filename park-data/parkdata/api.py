"""ThemeParks.wiki v1 client: client-side throttle, retry, ETag revalidation.

The public API allows 300 requests / 60s per IP and asks callers to honour
Cache-Control / ETag. We stay well under the ceiling (`request_per_sec`), send
`If-None-Match` from a persisted cache, and treat a 304 as "unchanged".
"""
from __future__ import annotations

import time
from dataclasses import dataclass

import requests

from . import config
from .util import gz, ungz

USER_AGENT = "overthink-parkdata/0.1 (+https://github.com/; contact jamie@vidamour.com)"


@dataclass
class Response:
    path: str
    status: int
    data: dict | None
    from_cache: bool


class Client:
    def __init__(self, conn, settings: config.Settings | None = None):
        self.conn = conn
        self.s = settings or config.load()
        self.session = requests.Session()
        self.session.headers["User-Agent"] = USER_AGENT
        self._min_interval = 1.0 / max(self.s.request_per_sec, 0.1)
        self._last = 0.0

    # -- low level ---------------------------------------------------------

    def _throttle(self) -> None:
        wait = self._min_interval - (time.monotonic() - self._last)
        if wait > 0:
            time.sleep(wait)
        self._last = time.monotonic()

    def _cache_get(self, url: str):
        row = self.conn.execute(
            "SELECT etag, body_gz FROM http_cache WHERE url = ?", (url,)
        ).fetchone()
        return (row["etag"], ungz(row["body_gz"])) if row else (None, None)

    def _cache_put(self, url: str, etag: str | None, data: dict) -> None:
        if not etag:
            return
        self.conn.execute(
            "INSERT INTO http_cache(url, etag, body_gz, fetched_at) VALUES (?,?,?,datetime('now')) "
            "ON CONFLICT(url) DO UPDATE SET etag=excluded.etag, body_gz=excluded.body_gz, "
            "fetched_at=excluded.fetched_at",
            (url, etag, gz(data)),
        )

    def get(self, path: str, *, revalidate: bool = True, tries: int = 5) -> Response:
        url = f"{config.API_BASE}{path}"
        etag, cached = self._cache_get(url)
        headers = {"If-None-Match": etag} if (revalidate and etag) else {}

        for attempt in range(1, tries + 1):
            self._throttle()
            try:
                r = self.session.get(url, headers=headers, timeout=30)
            except requests.RequestException as exc:
                if attempt == tries:
                    raise
                time.sleep(min(2 ** attempt, 30))
                continue

            if r.status_code == 304 and cached is not None:
                return Response(path, 304, cached, from_cache=True)

            if r.status_code == 429 or r.status_code >= 500:
                retry_after = float(r.headers.get("Retry-After", min(2 ** attempt, 30)))
                if attempt == tries:
                    r.raise_for_status()
                time.sleep(retry_after)
                continue

            if r.status_code == 404:
                return Response(path, 404, None, from_cache=False)

            r.raise_for_status()
            data = r.json()
            self._cache_put(url, r.headers.get("ETag"), data)
            if self.s.dump_raw:
                _dump_raw(path, data)
            return Response(path, 200, data, from_cache=False)

        raise RuntimeError(f"unreachable: {url}")

    # -- endpoints ------------------------------------------------------------

    def destinations(self) -> dict:
        return self.get("/destinations").data or {"destinations": []}

    def entity(self, eid: str) -> dict | None:
        return self.get(f"/entity/{eid}").data

    def children(self, eid: str) -> dict:
        return self.get(f"/entity/{eid}/children").data or {"children": []}

    def schedule_month(self, eid: str, year: int, month: int) -> dict:
        """A whole calendar month for an entity. At destination level the
        response carries a `parks[]` array with one schedule per park."""
        resp = self.get(f"/entity/{eid}/schedule/{year}/{month:02d}")
        return resp.data or {"schedule": [], "parks": []}


def _dump_raw(path: str, data: dict) -> None:
    import json

    config.RAW_DIR.mkdir(parents=True, exist_ok=True)
    safe = path.strip("/").replace("/", "_")
    (config.RAW_DIR / f"{safe}.json").write_text(json.dumps(data, indent=1))
