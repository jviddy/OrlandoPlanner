# Provisional crowd calendar

The planner route `/crowds` shows dates from 2022-01-01 through
2029-01-31 inclusive, aligned by month/day across eight year columns. Blank
cells represent non-leap days or dates outside that range.

The alignment selector also supports Sunday-start comparison weeks: week 1
starts at the first Sunday of each year. Week 0 holds earlier January dates.
These are not ISO weeks. Month filters preserve alignment and blank dates from
other months instead of shifting them into another weekday's row.

The Zoom selector provides daily detail, a month-by-year comparison table,
and a whole-year daily heatmap. In the heatmap, years run across the top and
each horizontal sliver is one calendar date, with month boundaries down the
side. The full year fits within the viewport; selecting a sliver opens that
date in the detailed view.

Two planning views cover the current date through the final available
prediction. The compact view gives each month one row and repeats
Sunday–Saturday across six aligned week blocks. Its detailed companion gives
each Sunday-start week one row and shows the rating, category, evening-event
markers and leading factors for every day. Selecting any planning cell opens
the existing complete day detail. On mobile, the compact strips become stacked
seven-column month calendars and detailed weeks become stacked day cards, so
ratings, event markers and leading factors remain readable.

Planning overlays can independently show UK school breaks (▰), EPCOT festival
windows (◆), evening event markers/guesses (☾), and typical weather. Symbols
preserve the crowd background colour; detailed weeks and selected-day details
expand their labels. EPCOT and evening overlays follow the selected resort/park.
School breaks and festival windows remain approximate recurring rules.
Weather uses Orlando International Airport 1991–2020 monthly normals from the
[Florida Climate Center](https://climatecenter.fsu.edu/products-services/data/1991-2020-normals/orlando),
stored in `app/utils/orlandoClimate.ts`: average high/low converted to Celsius,
monthly precipitation converted to millimetres. These repeat by month across
years and are neither daily forecasts nor inputs to crowd scores.

Summaries use the unweighted mean of matching daily 1–5 ratings, displayed to
one decimal place; shading rounds the unrounded mean to the nearest level.
Quiet counts include levels 1–2 and busy counts include 4–5. Search and month
filters apply, and missing months have no score (especially February–December
2029). Selecting a month opens daily detail with that year/month search applied.
These summaries describe provisional estimates rather than observed trends.

## Evening event markers and guesses

`evening_calendar.py` joins imported MNSSHP, Christmas Party, Jollywood Nights,
HHN and Rock the Universe markers. These retain source provenance without
treating the source's “official” label as independent verification.
For dates beyond the imported coverage, it replays the latest completed year
from 2024 onwards on each date's nearest matching weekday (±3 days from its
calendar anniversary). Currently the reference year is 2025. Earlier records
contain daily season expansions and are not used to generate guesses.

Guesses are low-confidence, not announcements. They do not model cancellations,
holiday exceptions, operating hours, event times, prices or crowd effects.
Empty dates do not prove absence of events. Confirmed schedules should replace
guesses before making booking decisions. After Hours and SeaWorld evening
events lack daily markers in this import and are not guessed by this exporter.
The older `events.py` hours pipeline is separate and requires its missing
populated schedule database before it can supply richer event projections.

Rebuild the categorised CSV and web payload from the repository root:

```sh
cd park-data
.venv/bin/python -m parkdata.crowd_calendar
```

Output: `public/data/crowd-calendar.json`. The categorised CSV retains its
longer horizon through January 2029. Rebuild this web export after changing
calendar rules or importing source comparisons; the existing weekly hours
pipeline does not yet run this new export automatically.

## Meaning of a rating

1 low, 2 light, 3 moderate, 4 busy, 5 high expected queue pressure. These are
hand-set calendar assumptions, not fitted forecasts, measured attendance or
minutes of waiting. Past dates use the same retrospective method. All ratings
have low confidence. Coefficients live in `config/crowd_rules.yaml`.

Start at 2; add weekday adjustment plus the strongest positive season,
school or holiday signal, retaining any negative quiet-season adjustment.
Round half up and clamp to 1–5. This reduces double counting correlated
signals. The detail panel exposes every component. School regions are listed
but not attendance-weighted. Weather and events have no score adjustment yet.

All configured resorts and parks can be selected, but currently inherit the
same Orlando baseline. This is deliberately not a claim of park-specific
calibration or operating status. Individual ride estimates are not available.
Imported park predictions are shown separately on their original 1–10 scale;
they are not observations, training targets or inputs to the new score.
Epic pre-opening source rows are excluded from comparisons.

Category identifiers such as `CHRISTMAS_PEAK-SAT` group comparable days.
Titles describe the main season and exact weekday. The full factor list
preserves additional holidays, school breaks, festivals and event windows.
Dates within a category can have different ratings because these extra
factors differ.

## Next modelling work

### Trip window finder

Planning views offer 1–30-night stays with up to three ordered preferences.
Available factors are visible until three are selected. Selected factors move
to the top in priority order with inline must-have and reorder controls; once
three are selected, only those rows remain until one is removed. Cooler months
have a published monthly mean below Orlando's 73°F (22.8°C) annual mean.
Arrival and departure days are included. Scores are compared in strict priority
order, with earliest arrival breaking ties. School/temperature scores are the
fraction of matching days. Crowd scores give levels 1–2 full credit, level 3
two-thirds, level 4 one-third, and level 5 zero. Event/festival scores require
at least one matching date. Must-have preferences require a full score.
These percentages describe preference fit, not forecast confidence.
The full crowd calendar offers the best three non-overlapping stays with
single-range calendar highlighting.
Matching uses all parks and separate arrival/departure bounds, independently
of display filters. Monthly climate normals and approximate event/school rules
retain their existing limitations. Incomplete windows are excluded.

The dedicated `/when-to-go` route is the streamlined trip-date experience for
mobile and desktop. It opens the finder immediately, omits the calendar-lab
view and filter controls, and displays all three suggestions together on a
compact 31-day month-strip calendar. Its choices consolidate all EPCOT festival
windows and Disney's MNSSHP, Very Merry Christmas Party and Jollywood Nights.
Halloween Horror Nights remains separate; Rock the Universe and the
high-temperature preference are omitted.

Collect observed queue measurements and operational coverage before fitting
park/ride effects. Replace approximate school rules with dated, sourced
regional calendars; collect actual event nights, openings/closures, capacity,
pricing/pass restrictions and weather with explicit observed/forecast/seasonal
status. Far-future weather requires seasonal assumptions, not daily forecasts.
Validate against held-out years before presenting confidence or accuracy claims.

The first version fixes holiday-season precedence for July 4 and Labor Day,
and preserves overlapping school regions. Explicit regional entries replace
rules only for their covered regions. The old FACTORS.md first-match school
description predates this change.
