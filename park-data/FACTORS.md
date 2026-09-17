# Calendar factors

`data/calendar.csv` — one row per date from `calendar_start` to `calendar_end`
(`config/resorts.yaml`, currently **2023‑01‑01 … 2029‑01‑31**). It holds **no
predictions**. It is the shared feature table you join historic crowd data and
the hours projections against, so `calendar_start` is kept fixed in the past —
the categoriser is year‑agnostic, so back years cost only rows. Rebuild any
time:

```bash
parkdata calendar
```

It is also rebuilt inside `parkdata all-monthly` and `parkdata backfill`, which
just refreshes the categories and extends the far end.

## Where the values come from

| Input | Feeds |
|---|---|
| pure date maths | day of week, week/month/quarter, day-of-year |
| `holidays` library (US federal) | `us_holiday*`, `long_weekend`, `bridge_day`, `*_us_holiday` distances |
| `parkdata/calendar_model.py` (`anchors`, `season_tag`, `nearest_anchor`) | `season_tag`, `holiday_anchor`, `holiday_offset` |
| `config/windows.yaml` → `seasons` | `season_tag` |
| `config/windows.yaml` → `event_windows` | `event_windows` (union of tags, park filter ignored here) |
| `config/windows.yaml` → `overlays` | `overlays` (`HALLOWEEN_SEASON`, `HOLIDAY_SEASON`) |
| `config/windows.yaml` → `festivals` | `epcot_festival` |
| `config/school_calendars.yaml` | `us_school_break`, `us_regions_off`, `presidents_week`, `uk_school_holiday`, `brazil_school_holiday` |
| `config/day_overrides.csv` | any column, per date; sets `override_note`, `source = rules+override` |

## Columns

### Identity / cyclical — deterministic, never edited

| Column | Values | Notes |
|---|---|---|
| `date` | `YYYY-MM-DD` | primary key |
| `dow` / `dow_num` | `Mon`…`Sun` / `0`…`6` | 0 = Monday |
| `day_class` | `WEEKDAY` `FRI` `SAT` `SUN` | same buckets the hours model uses — parks operate these four distinctly |
| `is_weekend` | `0` / `1` | Sat/Sun |
| `week_of_year` | `1`–`53` | ISO week |
| `month` `month_name` `day_of_month` `day_of_year` `quarter` `year` | | |

### Season

| Column | Values | Notes |
|---|---|---|
| `season_tag` | `CHRISTMAS_PEAK`, `NYE`, `THANKSGIVING_WK`, `JERSEY_WEEK`, `PRESIDENTS_WK`, `JAN_LULL`, `EASTER_WK`, `SPRING_SHOULDER`, `SUMMER_PEAK`, `LATE_SUMMER`, `FALL_OFFPEAK`, `MLK_WKND`, `MEMORIAL_WKND`, `LABOR_WKND`, `JULY4_WK`, `REGULAR` | first matching window in `windows.yaml → seasons` wins; edit the windows there |

### Proximity to "special" days

| Column | Values | Notes |
|---|---|---|
| `us_holiday` | e.g. `Thanksgiving Day`, `Independence Day (observed)`, `` | US federal holidays incl. observed shifts |
| `us_holiday_kind` | `federal` / `observed` / `` | `observed` = the day off when the real date is a weekend |
| `is_holiday` | `0` / `1` | |
| `eve_of_holiday` / `day_after_holiday` | `0` / `1` | next / previous day is a federal holiday |
| `long_weekend` | `0` / `1` | Sat/Sun/Mon of a Monday holiday, the Thu–Sun of Thanksgiving, or the Fri before a Monday holiday |
| `bridge_day` | `0` / `1` | a lone workday between a holiday and a weekend (Fri after a Thu holiday, Mon before a Tue holiday) |
| `holiday_anchor` | `THANKSGIVING`, `CHRISTMAS`, `EASTER`, `JULY4`, `MLK`, `PRESIDENTS`, `MEMORIAL`, `LABOR`, `COLUMBUS`, `HALLOWEEN`, `NEW_YEAR`, `GOOD_FRIDAY`, `` | nearest anchor within ±10 days |
| `holiday_offset` | signed int, `` | days from that anchor (`-2` = two days before) — this is how "the Saturday before Christmas" stays comparable across years |
| `days_to_next_us_holiday` / `next_us_holiday` | int / name | forward distance to the next federal holiday (blank only if none within 120 days) |
| `days_since_prev_us_holiday` / `prev_us_holiday` | int / name | backward distance |

### Seasonal overlays / events (park‑agnostic)

| Column | Values | Notes |
|---|---|---|
| `overlays` | `HALLOWEEN_SEASON`, `HOLIDAY_SEASON` (comma list) | broad theme‑park decorating/entertainment seasons; `windows.yaml → overlays` |
| `event_windows` | e.g. `WDW_HALLOWEEN,UOR_HHN,SEA_HOS` | union of every event window active that day, **park filter ignored** — the per‑park scoping still lives in `windows.yaml → event_windows` and is applied by the hours model |
| `epcot_festival` | `ARTS`, `FLOWER_AND_GARDEN`, `FOOD_AND_WINE`, `HOLIDAYS`, `` | approximate; `windows.yaml → festivals` |

### School vacations — APPROXIMATE, rule‑based

Driven entirely by `config/school_calendars.yaml`. These are first‑cut rules, not
real calendars — see below for replacing them.

| Column | Values | Notes |
|---|---|---|
| `us_school_break` | `WINTER`, `SPRING`, `SUMMER`, `THANKSGIVING`, `PRESIDENTS`, `` | |
| `us_regions_off` | subset of `NE,SOUTH,MIDWEST,WEST,FL` | which regions the matched rule applies to (`PRESIDENTS` → `NE` only) |
| `presidents_week` | `0` / `1` | the Northeast "ski week" (week of the 3rd Monday of Feb) |
| `uk_school_holiday` | `FEB_HALF_TERM`, `EASTER`, `MAY_HALF_TERM`, `SUMMER`, `OCT_HALF_TERM`, `CHRISTMAS`, `` | England pattern; Scotland/NI not modelled |
| `brazil_school_holiday` | `SUMMER`, `WINTER`, `CARNIVAL`, `` | the windows that actually move Orlando numbers |

### Meta

| Column | Notes |
|---|---|
| `special_note` | generated human summary of the salient flags |
| `override_note` | text from `day_overrides.csv` rows that touched this date |
| `source` | `rules` or `rules+override` |
| `generated_at` | UTC timestamp of the build |

## Correcting a single day

Add rows to `config/day_overrides.csv` — long format, one field per row:

```csv
date,field,value,checked_on,source,note
2027-01-08,event_windows,"WDW_MARATHON",2026-09-08,rundisney.com,"Marathon Weekend Jan 6–10 2027"
2027-01-09,event_windows,"WDW_MARATHON",2026-09-08,rundisney.com,
2027-11-06,season_tag,JERSEY_WEEK,2026-09-08,njea.org,"NJEA convention 2027-11-04/05"
```

Rebuild (`parkdata calendar`). The override value replaces the generated one,
`note` is appended to `override_note`, and `source` becomes `rules+override`.
Use it for anything the rules can't know: confirmed runDisney weekends, announced
festival dates, big conventions / cheer competitions, storm closures, new‑ride
opening dates, or real school‑break dates for one specific year.

## Replacing the school‑calendar rules with real dates

`config/school_calendars.yaml` has a `rules:` block per market (approximate) and
an `explicit:` list (real, per‑year, wins over rules). As you gather calendars,
append explicit entries:

```yaml
explicit:
  - { region: us, label: SPRING, start: "2027-03-15", end: "2027-03-19", regions: [FL], note: "Orange County FL 2026-27" }
  - { region: uk, label: FEB_HALF_TERM, start: "2027-02-15", end: "2027-02-19", note: "England, most LAs" }
  - { region: brazil, label: WINTER, start: "2027-07-05", end: "2027-07-25", note: "São Paulo state" }
```

`region` must be `us` / `uk` / `brazil`. An explicit entry whose `[start, end]`
contains the date overrides the rules for that market on that date.

### Where to get the facts

- **US** — no free national dataset (13k+ districts). Options: NCES district
  calendar files (patchy, lagged); hand‑collect a basket of ~12 feeder districts
  (Orange County FL, NYC, Chicago/CPS, Gwinnett GA, Fairfax VA, Katy TX, plus
  NJ/MA/PA/OH) from each district's published PDF; or treat TouringPlans /
  Unofficial Guide as the paid proxy. The rules already capture winter, the
  Easter‑centred spring mass, Presidents' week (NE) and summer.
- **UK** — `gov.uk` term‑date guidance + individual council sites. England is
  predictable (the rules); Scotland starts summer ~late June and has a different
  October week.
- **Brazil** — state *Secretaria de Educação* calendars. The crowd‑relevant
  windows are stable: summer férias mid‑Dec→~1 Feb, Carnival week (Easter−49),
  July winter férias.

## Adding a new factor / column

1. Add the column name to `COLUMNS` in `parkdata/calendar_file.py` (position = CSV order).
2. Compute it in `_row(...)`. Deterministic date maths inline; anything with
   editable dates → a new block in `config/windows.yaml` or
   `config/school_calendars.yaml` read via `config.windows()` /
   `config.school_calendars()` and matched with `calendar_model.in_window`.
3. If it should be human‑correctable, it already is — `day_overrides.csv` can set
   any column by name.
4. `parkdata calendar` to rebuild; `git diff data/calendar.csv` to sanity‑check.

## Known approximations

- **School breaks** — rule‑based; expect the edges to be off by a few days and
  regional spring breaks to be blurred until you add `explicit:` dates.
- **EPCOT festivals** — start/end shift 1–2 weeks year to year.
- **Event windows** are broad season bounds, not the actual party‑night lists —
  those come from the hours model's `event_series_model` (published + projected).
- **runDisney / conventions / cheer & dance / Jersey Week** — not generated;
  add via `day_overrides.csv` as you confirm dates.
- Only **US federal** holidays are detected. State holidays, religious
  observances and international holidays are not (add via overrides or a new
  factor if they prove to matter).
