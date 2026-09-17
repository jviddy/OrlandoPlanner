"""MONTHLY job: resorts -> parks -> attractions / restaurants / shows.

One `/destinations` call, then one `/entity/{resort}/children` call per resort
(which returns every POI across all its parks), plus one `/entity/{park}` call
per park for timezone + geo. Rows that stop appearing are marked inactive rather
than deleted, so history is preserved.
"""
from __future__ import annotations

import json

from . import config, store
from .api import Client

POI_TYPES = {"ATTRACTION", "RESTAURANT", "SHOW"}


def run(conn, client: Client | None = None) -> dict:
    s = config.load()
    client = client or Client(conn, s)
    run_id = store.new_run(conn, "static")
    stats = {"resorts": 0, "parks": 0, "poi": 0, "deactivated": 0}

    dests = {d["id"]: d for d in client.destinations().get("destinations", [])}
    seen_parks: set[str] = set()
    seen_poi: set[str] = set()

    for resort in s.resorts:
        d = dests.get(resort.id)
        if not d:
            print(f"  ! {resort.name} ({resort.id}) not in /destinations")
            continue
        conn.execute(
            "INSERT INTO resort(id,key,name,slug,raw_json,last_seen) "
            "VALUES (?,?,?,?,?,datetime('now')) "
            "ON CONFLICT(id) DO UPDATE SET key=excluded.key, name=excluded.name, "
            "slug=excluded.slug, raw_json=excluded.raw_json, last_seen=excluded.last_seen",
            (resort.id, resort.key, d.get("name"), d.get("slug"), json.dumps(d)),
        )
        stats["resorts"] += 1

        configured_parks = {p.id: p for p in resort.parks}
        kids = client.children(resort.id).get("children", [])

        # PARK rows -----------------------------------------------------
        api_parks = [c for c in kids if c.get("entityType") == "PARK"]
        # some resorts also list parks only via the seed; union them
        for pid in configured_parks:
            if pid not in {c["id"] for c in api_parks}:
                api_parks.append({"id": pid, "name": configured_parks[pid].name, "entityType": "PARK"})

        for c in api_parks:
            pid = c["id"]
            seen_parks.add(pid)
            cfg = configured_parks.get(pid)
            detail = client.entity(pid) or {}
            loc = detail.get("location") or c.get("location") or {}
            conn.execute(
                "INSERT INTO park(id,key,resort_id,name,slug,entity_type,timezone,lat,lng,"
                "external_id,water_park,configured,active,first_seen,last_seen,raw_json) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,datetime('now'),datetime('now'),?) "
                "ON CONFLICT(id) DO UPDATE SET key=excluded.key, resort_id=excluded.resort_id, "
                "name=excluded.name, slug=excluded.slug, entity_type=excluded.entity_type, "
                "timezone=excluded.timezone, lat=excluded.lat, lng=excluded.lng, "
                "external_id=excluded.external_id, water_park=excluded.water_park, "
                "configured=excluded.configured, active=1, last_seen=datetime('now'), "
                "raw_json=excluded.raw_json",
                (
                    pid,
                    cfg.key if cfg else _slug_key(c.get("name")),
                    resort.id,
                    detail.get("name") or c.get("name"),
                    detail.get("slug"),
                    "PARK",
                    detail.get("timezone"),
                    loc.get("latitude"),
                    loc.get("longitude"),
                    detail.get("externalId"),
                    int(bool(cfg and cfg.water_park)),
                    int(cfg is not None),
                    json.dumps(detail or c),
                ),
            )
            stats["parks"] += 1

        # POI rows ----------------------------------------------------
        for c in kids:
            if c.get("entityType") not in POI_TYPES:
                continue
            pid = c["id"]
            seen_poi.add(pid)
            loc = c.get("location") or {}
            conn.execute(
                "INSERT INTO poi(id,park_id,resort_id,name,slug,entity_type,attraction_type,"
                "lat,lng,external_id,active,first_seen,last_seen,raw_json) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,1,datetime('now'),datetime('now'),?) "
                "ON CONFLICT(id) DO UPDATE SET park_id=excluded.park_id, name=excluded.name, "
                "slug=excluded.slug, entity_type=excluded.entity_type, "
                "attraction_type=excluded.attraction_type, lat=excluded.lat, lng=excluded.lng, "
                "external_id=excluded.external_id, active=1, last_seen=datetime('now'), "
                "raw_json=excluded.raw_json",
                (
                    pid,
                    c.get("parentId"),
                    resort.id,
                    c.get("name"),
                    c.get("slug"),
                    c.get("entityType"),
                    c.get("attractionType"),
                    loc.get("latitude"),
                    loc.get("longitude"),
                    c.get("externalId"),
                    json.dumps(c),
                ),
            )
            stats["poi"] += 1

    # soft-delete anything not seen this run --------------------------
    if seen_parks:
        cur = conn.execute(
            f"UPDATE park SET active=0 WHERE active=1 AND id NOT IN ({_qs(seen_parks)})",
            tuple(seen_parks),
        )
        stats["deactivated"] += cur.rowcount
    if seen_poi:
        cur = conn.execute(
            f"UPDATE poi SET active=0 WHERE active=1 AND id NOT IN ({_qs(seen_poi)})",
            tuple(seen_poi),
        )
        stats["deactivated"] += cur.rowcount

    conn.commit()
    store.finish_run(conn, run_id, True, stats)
    print(f"  static: {stats}")
    return stats


def _qs(items) -> str:
    return ",".join("?" * len(items))


def _slug_key(name: str | None) -> str:
    return "".join(ch for ch in (name or "park").upper() if ch.isalnum())[:12]
