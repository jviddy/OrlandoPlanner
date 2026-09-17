"""Import the public ParkCrowds calendar as source predictions, never observations.

Standalone: python -m parkdata.parkcrowds --dates 2025-01-08,2025-03-05
The calendar API returns whole years; selection happens locally after caching.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import random
import sqlite3
import time
from datetime import date, datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from urllib.robotparser import RobotFileParser
from zoneinfo import ZoneInfo

BASE = 'https://parkcrowds.com'
ROOT = Path(__file__).resolve().parents[1] / 'data' / 'parkcrowds'
PARKS = {'WDW': {'mk': 'MK', 'epcot': 'EP', 'ak': 'AK', 'hw': 'HS'},
         'UOR': {'usf': 'USF', 'ioa': 'IOA', 'epu': 'EPU'}}
AGENT = 'OverthinkParkData/1.0 (calendar research; cached sequential requests)'


def dump(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n')
    temporary.replace(path)


class Client:
    def __init__(self, cache, delay=3, refresh=False, offline=False):
        self.cache, self.delay = Path(cache), delay
        self.refresh, self.offline = refresh, offline
        self.last = 0.0
        self.requests = 0
        self.robots = None

    def request(self, url):
        for attempt in range(3):
            time.sleep(max(0, self.last + self.delay + random.uniform(0, 1) - time.monotonic()))
            try:
                self.requests += 1
                with urlopen(Request(url, headers={'User-Agent': AGENT}), timeout=60) as response:
                    return response.read().decode('utf-8')
            except HTTPError as exc:
                if exc.code not in (429, 500, 502, 503, 504) or attempt == 2:
                    raise
                retry = exc.headers.get('Retry-After')
                wait = 5 * 2 ** attempt
                if retry:
                    try:
                        wait = max(wait, float(retry))
                    except ValueError:
                        wait = max(wait, (parsedate_to_datetime(retry) - datetime.now(timezone.utc)).total_seconds())
                time.sleep(wait)
            except (URLError, TimeoutError):
                if attempt == 2:
                    raise
                time.sleep(5 * 2 ** attempt)
            finally:
                self.last = time.monotonic()
        raise RuntimeError('Request failed')

    def year(self, year):
        path = self.cache / f'{year}.json'
        if path.exists() and not self.refresh:
            result = json.loads(path.read_text())
            validate(result['payload'], year)
            return result
        if self.offline:
            raise ValueError(f'No cached response for {year}')
        url = f'{BASE}/api/predictions/year-calendar/{year}'
        if self.robots is None:
            self.robots = RobotFileParser()
            self.robots.parse(self.request(BASE + '/robots.txt').splitlines())
            self.delay = max(self.delay, self.robots.crawl_delay(AGENT) or 0)
        if not self.robots.can_fetch(AGENT, url):
            raise ValueError(f'robots.txt disallows {url}')
        body = self.request(url)
        payload = json.loads(body)  # HTML/dashboard fallback must fail here.
        validate(payload, year)
        result = {'source_url': url, 'fetched_at': datetime.now(timezone.utc).isoformat(),
                  'response_sha256': hashlib.sha256(body.encode()).hexdigest(), 'payload': payload}
        dump(path, result)
        return result


def validate(payload, year):
    if not isinstance(payload, dict) or payload.get('year') != year:
        raise ValueError(f'Unexpected calendar response for {year}')
    if not isinstance(payload.get('days'), list) or not payload['days']:
        raise ValueError('Missing calendar days')
    if not isinstance(payload.get('events'), list):
        raise ValueError('Missing event catalogue')
    seen = set()
    for day in payload['days']:
        d = date.fromisoformat(day['date'])
        if d.year != year or d in seen or not isinstance(day.get('parks'), list):
            raise ValueError(f'Invalid/duplicate calendar day: {d}')
        seen.add(d)
        ids = set()
        for park in day['parks']:
            if park['parkId'] in ids:
                raise ValueError(f'Duplicate park on {d}')
            ids.add(park['parkId'])
            for field in ('crowdLevelTen', 'crowdLevelTenAverage', 'averageWait', 'headlinerPeakWait'):
                value = park.get(field)
                if value is not None and (isinstance(value, bool) or not isinstance(value, (float, int))
                                          or not math.isfinite(value) or value < 0):
                    raise ValueError(f'Invalid {field} on {d}')
                if field.startswith('crowd') and value is not None and not 1 <= value <= 10:
                    raise ValueError(f'Crowd level outside 1–10 on {d}')


def mean(values):
    values = [v for v in values if v is not None]
    # Match JavaScript Math.round, not Python's ties-to-even round.
    return math.floor(sum(values) / len(values) + .5) if values else None


def displayed(level, wait):
    """Source UI applies a wait-based floor even with average scoring selected."""
    floor = next((level for threshold, level in ((75, 9), (55, 7), (40, 5), (25, 3))
                  if wait is not None and wait >= threshold), 1)
    return max(level, floor) if level is not None else None


def avg_level(park):
    return park.get('crowdLevelTenAverage') if park.get('crowdLevelTenAverage') is not None else park.get('crowdLevelTen')


def relevant(event, resort):
    return event.get('parkId') in PARKS[resort] or event.get('parkId') == {'WDW': 'all', 'UOR': 'uor_all'}[resort]


def extract(envelope, selected, resort):
    payload = envelope['payload']
    provenance = {k: envelope[k] for k in ('source_url', 'fetched_at', 'response_sha256')}
    provenance.update(resort=resort, crowd_status='prediction', eligible_observed_training_target=False,
                      weather_status='unspecified_by_source', events_last_reviewed=payload.get('eventsLastReviewed'),
                      magic_hours_last_reviewed=payload.get('magicHoursLastReviewed'))
    output = {key: [] for key in ('resort_days', 'park_days', 'events', 'warnings')}
    catalogue = {e['id']: e for e in payload['events']}
    for day in payload['days']:
        if day['date'] not in selected:
            continue
        common = {**provenance, 'date': day['date']}
        parks = [p for p in day['parks'] if p['parkId'] in PARKS[resort]]
        level = mean([avg_level(p) for p in parks])
        peak = mean([p.get('headlinerPeakWait') for p in parks])
        output['resort_days'].append({**common, 'crowd_level_average': level,
            'crowd_level_displayed': displayed(level, peak),
            'crowd_level_headliner': mean([p.get('crowdLevelTen') for p in parks]),
            'average_wait_minutes': mean([p.get('averageWait') for p in parks]),
            'headliner_peak_minutes': peak, 'park_count': len(parks),
            'aggregation': 'source_ui_rounded_unweighted_mean',
            'early_entry_host_source_id': day.get('earlyEntryParkId') if resort == 'WDW' else None,
            'extended_evening_host_source_id': day.get('extendedEveningParkId') if resort == 'WDW' else None,
            'season_label': day.get('seasonLabel'), 'weather': day.get('weather'),
            'raw_event_ids': day.get('eventIds')})
        for event_id in day.get('eventIds', []):
            event = catalogue.get(event_id)
            if event is None:
                raise ValueError(f'Unknown event {event_id}')
            if relevant(event, resort):
                output['events'].append({**common, 'event_id': event_id,
                    'marker_status': 'source_calendar_marker', **event})
        for park in parks:
            pid = park['parkId']
            event_scope = {'WDW': 'all', 'UOR': 'uor_all'}[resort]
            special_events = '; '.join(dict.fromkeys(
                catalogue[event_id]['name']
                for event_id in day.get('eventIds', [])
                if catalogue[event_id].get('parkId') in (pid, event_scope)
            ))
            row = {**common, 'park_key': PARKS[resort][pid], 'source_park_id': pid,
                   'special_events': special_events,
                   'crowd_level_average': park.get('crowdLevelTenAverage'),
                   'crowd_level_average_effective': avg_level(park),
                   'crowd_level_headliner': park.get('crowdLevelTen'),
                   'crowd_level_breakdown_displayed': displayed(avg_level(park), park.get('averageWait')),
                   'average_wait_minutes': park.get('averageWait'),
                   'headliner_peak_minutes': park.get('headlinerPeakWait'),
                   'open_local': park.get('typicalOpenLocal'), 'close_local': park.get('typicalCloseLocal'),
                   'hours_source': park.get('hoursSource'), 'timezone': 'America/New_York',
                   'early_entry_start_local': park.get('earlyEntryStartLocal'),
                   'extended_evening_end_local': park.get('extendedEveningEndLocal'),
                   'early_entry_calendar_marker': day.get('earlyEntryParkId') == pid if resort == 'WDW' else None,
                   'extended_evening_calendar_marker': day.get('extendedEveningParkId') == pid if resort == 'WDW' else None,
                   'weather': park.get('weather'), 'confidence': park.get('confidence'),
                   'bucket_sample_count': park.get('bucketSampleCount'),
                   'pre_opening': pid == 'epu' and day['date'] < '2025-05-22',
                   'raw_park': park}
            output['park_days'].append(row)
            warning = park.get('earlyClose') or {}
            if warning.get('isEarlyClose'):
                output['warnings'].append({**common, 'park_key': row['park_key'],
                    'warning_status': 'source_flag_not_independently_verified', **warning})
    return output


def flat(row):
    result = {}
    for key, value in row.items():
        if key == 'weather' and isinstance(value, dict):
            result.update({f'weather_{k}': v for k, v in value.items()})
        else:
            result[key] = json.dumps(value, ensure_ascii=False, sort_keys=True) if isinstance(value, (dict, list)) else value
    return result


def save(output, folder, selected, resort, requests):
    folder.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(folder / 'parkcrowds.sqlite') as conn:
        for kind, rows in output.items():
            conn.execute(f'CREATE TABLE IF NOT EXISTS {kind} (resort TEXT, date TEXT, identity TEXT, data_json TEXT, PRIMARY KEY(resort,date,identity))')
            # Replace only selected resort/dates; reruns cannot duplicate events.
            conn.executemany(f'DELETE FROM {kind} WHERE resort=? AND date=?', [(resort, d) for d in selected])
            for row in rows:
                identity = row.get('park_key', row.get('event_id', resort))
                conn.execute(f'INSERT INTO {kind} VALUES (?,?,?,?)', (resort, row['date'], identity, json.dumps(row)))
        for kind in output:
            rows = [flat(json.loads(r[0])) for r in conn.execute(f'SELECT data_json FROM {kind} ORDER BY resort,date,identity')]
            columns = list(dict.fromkeys(k for r in rows for k in r)) or ['resort', 'date']
            with (folder / f'{kind}.csv').open('w', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=columns)
                writer.writeheader()
                writer.writerows(rows)
    report = {'resort': resort, 'selected_dates': sorted(selected), 'network_requests': requests,
              'rows_this_run': {k: len(v) for k, v in output.items()},
              'missing_park_dates': {key: sorted(selected - {r['date'] for r in output['park_days'] if r['park_key'] == key})
                                     for key in PARKS[resort].values()},
              'missing_fields': {field: sum(r.get(field) is None for r in output['park_days']) for field in
                                 ('crowd_level_average', 'average_wait_minutes', 'headliner_peak_minutes', 'open_local', 'close_local', 'hours_source', 'weather')},
              'limitations': ['Crowds are model predictions, not observed historical training targets.',
                  'Official hours/event labels are source claims, not independently verified.',
                  'Calendar host markers can disagree with per-park extra-hours times; both are preserved.',
                  'Event markers do not independently confirm attendance or a ticketed event occurrence.',
                  'Weather provenance is unspecified by this response.',
                  'Pre-opening Epic Universe predictions are flagged; exclude from modelling.']}
    dump(folder / 'report.json', report)
    return report


def configure(parser):
    parser.add_argument('--resort', choices=list(PARKS), default='WDW')
    parser.add_argument('--start', type=date.fromisoformat)
    parser.add_argument('--end', type=date.fromisoformat)
    parser.add_argument('--dates', help='Comma-separated dates for a small sample; replaces start/end')
    parser.add_argument('--output', type=Path, default=ROOT)
    parser.add_argument('--cache', type=Path, default=ROOT / 'cache')
    parser.add_argument('--delay', type=float, default=3)
    parser.add_argument('--refresh', action='store_true')
    parser.add_argument('--offline', action='store_true')
    parser.set_defaults(func=run)


def run(args):
    if not math.isfinite(args.delay) or args.delay < 1:
        raise ValueError('--delay must be at least 1 second')
    if args.offline and args.refresh:
        raise ValueError('--offline and --refresh cannot be combined')
    yesterday = datetime.now(ZoneInfo('America/New_York')).date() - timedelta(days=1)
    if args.dates:
        if args.start or args.end:
            raise ValueError('Use --dates or --start/--end, not both')
        dates = {date.fromisoformat(d.strip()) for d in args.dates.split(',')}
    else:
        if args.start is None:
            raise ValueError('Supply --dates or --start; no bulk fetch is performed by default')
        end = args.end or yesterday
        if args.start > end:
            raise ValueError('--start must not be after --end')
        dates = {args.start + timedelta(days=i) for i in range((end - args.start).days + 1)}
    if max(dates) > yesterday:
        raise ValueError('Historical imports end at the last complete Orlando day')
    selected = {d.isoformat() for d in dates}
    client = Client(args.cache, args.delay, args.refresh, args.offline)
    output = {k: [] for k in ('resort_days', 'park_days', 'events', 'warnings')}
    for year in sorted({d.year for d in dates}):
        envelope = client.year(year)
        result = extract(envelope, selected, args.resort)
        for kind, rows in result.items():
            output[kind].extend(rows)
    report = save(output, args.output, selected, args.resort, client.requests)
    print(json.dumps(report, indent=2))
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    configure(parser)
    args = parser.parse_args()
    try:
        run(args)
    except (ValueError, OSError, KeyError) as exc:
        parser.exit(1, f'ParkCrowds import failed: {exc}\n')


if __name__ == '__main__':
    main()
