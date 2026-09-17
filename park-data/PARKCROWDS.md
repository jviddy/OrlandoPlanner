# ParkCrowds calendar importer

Run from `park-data/` (Python 3.11+, no additional dependencies):

```bash
python3 -m parkdata.parkcrowds --dates 2025-01-08,2025-01-13,2025-03-05,2025-08-15,2025-10-31
```

Also available as `parkdata import-parkcrowds` in an installed environment.
The public calendar API returns one complete year containing all parks. Only
selected dates/resorts are written to the database and CSVs. No daily attraction
requests are needed. Defaults: WDW, one request at a time, 3–4 seconds between
requests, maximum three attempts for transient failures, respect Retry-After and
robots.txt. HTTP errors and HTML fallbacks fail explicitly. The annual response
is cached; reruns and Universal imports reuse it. `--offline` prohibits fetching;
`--refresh` deliberately replaces cached responses.

After reviewing the sample, the historical backfill commands are:

```bash
python3 -m parkdata.parkcrowds --resort WDW --start 2023-01-01
python3 -m parkdata.parkcrowds --resort UOR --start 2023-01-01
```

The omitted end date means yesterday in America/New_York. `--end YYYY-MM-DD`
sets an explicit boundary. The backfill through 2026-09-07 has been completed for WDW and UOR.
`--output` and `--cache` set storage directories; `--delay` sets the minimum
pause in seconds (default 3, minimum 1).

Outputs in `data/parkcrowds/`: `parkcrowds.sqlite`, `resort_days.csv`,
`park_days.csv`, `events.csv`, `warnings.csv`, and `report.json`. Database rows
are source-specific JSON records keyed by resort/date/park or event. CSVs flatten
weather into columns and preserve raw park JSON, including all original field
names. Reruns replace selected dates and preserve other dates/resorts. CSVs show
all stored rows; the report describes the latest run, including missing dates
and fields. Existing day facts and projections are not modified.

`park_days.csv` includes `special_events`: full event names separated by
semicolons, matched to that park's daily markers. Resort-wide events such as
Marathon Weekend appear for every park in that resort. The field is blank when
the source lists no applicable event marker; it does not prove no event occurred.

## Meaning and limitations

- **Crowd values are predictions, including for past dates.** The separate
  park-date response for Magic Kingdom on 2025-08-15 explicitly explains a
  weekday baseline, seasonal multiplier, calibration and weather adjustment.
  All crowd rows have `crowd_status=prediction` and
  `eligible_observed_training_target=false`. These may be comparison baselines,
  but are not observed training targets or historical forecast snapshots.
- Both raw crowd scales are saved. Resort scores and wait values reproduce the
  frontend's rounded, unweighted park means. The frontend additionally applies
  a wait-based floor to displayed scores, even in average mode. Resort selected
  day display uses headliner wait; park breakdown display uses average wait.
  Separate `*_displayed` fields preserve this distinction. The formulas were
  inspected in `/assets/index-DgBJaKn_.js`; future frontend changes may require
  updating them. No browser screenshot comparison was performed.
- `hours_source` preserves `official`/`empirical` labels as source claims.
  `typicalOpenLocal`/`typicalCloseLocal` are API field names even when labelled
  official. Clock strings are local; midnight is retained as `00:00`, not used
  to infer an operating duration. Missing values remain blank.
- The source's calendar early-entry/extended-evening host markers can disagree
  with individual park extra-hours times. Both are retained. Generic early-close
  warnings are source classifications, not verified event occurrences.
- Weather units are encoded in the source column names (Fahrenheit, inches,
  mph). The annual response does not label weather as observed or estimated.
- Event rows come from explicit daily event IDs, not expansion of season ranges.
  Full catalogue metadata, date bounds, source labels and notes are preserved.
  Cross-year markers may reference catalogue bounds for the later season;
  preserve them as supplied rather than treating those bounds as verified.
- Universal supports USF, IOA and EPU. Epic predictions before its public opening
  date, 2025-05-22, are flagged `pre_opening=true`; the source includes these even
  before opening. Resort UI means retain them to match the website. Exclude
  them from modelling. Water parks are not provided by this calendar.
- Raw responses contain source URL, fetch time and SHA-256. The committed test
  fixture is a five-day subset of a fetched response; its hash refers to the
  original full response. Terms-page HTML returned a dashboard fallback during
  inspection; no claim of verified licensing or independently verified source
  facts is made.

Tests: `python3 -m unittest discover -s tests -p 'test_parkcrowds.py' -v`.

## Sample verification (2026-09-08)

Live importer: two requests (robots plus annual JSON), five selected WDW days,
20 park-day rows, five event markers and 15 source warning rows. No missing
selected park dates or requested core fields. Cached rerun: zero network requests,
still 20 park-day rows. The integrated CLI also passed in a temporary environment
with the project dependencies installed.

A separate public park-date request for MK on 2025-08-15 matched the annual
response's seven checked fields: both wait metrics, both crowd scales, opening,
closing, and early-close object. It reports 18-minute average wait, 35-minute
headliner peak, 08:00–18:00 hours, and a Halloween Party warning. Its `basis`
explicitly describes a weekday baseline and model adjustments. Extraction is
verified against source data and frontend code, not independently against actual
historical park operations. This initial sample was followed by the backfill recorded below.


## Backfill completed (2026-09-08)

Imported 2023-01-01 through 2026-09-07 inclusive: 1,346 dates per resort.
WDW has 5,384 park-day rows; Universal Orlando has 4,038, for 9,422 unique
park-day rows overall. No duplicate keys or missing requested park dates/core
fields were found. Special-event names are included in the park-day export.

The run made four network requests (robots plus the three uncached annual
responses); 2025 was already cached. Universal reused all four cached years
without network requests. Both run reports are saved in
`data/parkcrowds/backfill_report.json`.

The source supplies 872 Epic Universe rows before public opening; these remain
flagged `pre_opening=true`. Crowds remain labelled predictions throughout.

## 2022 extension completed (2026-09-12)

The public annual endpoint returned all 365 dates, including 2022-01-01.
Added 1,460 WDW and 1,095 Universal Orlando park-day records, with special
 events, weather and hours. Total stored park-day records: 11,977, covering
2022-01-01 through 2026-09-07. All pre-existing database records were compared
and preserved exactly. No requested dates or core fields were missing.

One annual response was downloaded with curl after the Python HTTP client
encountered a DNS failure; both imports used that validated cached response.
Reports: `data/parkcrowds/backfill_2022_report.json`. All 365 Epic Universe
records for 2022 are pre-opening model predictions and remain flagged.
