# Orlando Trip Planner

Mobile-first planner for an Orlando theme-park holiday, built to
`design_handoff_orlando_planner/`. Nuxt 4 / Vue 3 / Pinia. All trip data lives in
the browser's `localStorage` — no backend, no account.

Repo: <https://github.com/jviddy/OrlandoPlanner> · Deploy target: **Cloudflare Pages**

For a full technical handover (data model, store internals, architecture gotchas,
what's actually built vs. deferred), see [`SPEC.md`](./SPEC.md). This file is just
a quick-start.

## The flow

```
/new        New-trip gate — name + arrive/depart, plus optional stay / tickets / flights
/templates  Pick a starting point — Blank, First-timer Disney, Best of both worlds
/           Overview — the whole trip as a Monday-first grid of day circles
/day        One day — dining and fixed-time plans, warnings, a note
/edit       Change trip details, or start over
```

The **overview** is the core screen: a countdown chip, four counters
(Disney / Universal / Off-park / Unset), derived alerts (reservation in the wrong
park, over ticket days, dining-window reminder), then either a grid (one card per
calendar week of 7 day circles, week-start configurable in `/edit`) or a list —
toggle at the top. Circle **background = resort** (Disney blue, Universal coral,
SeaWorld teal, off-park yellow, unassigned dashed); **glyph = park**; a park-hopper
day gets a diagonal split circle for its two parks. Tap a circle for the
quick-assign bottom sheet (built-in parks, or your own custom off-park activities);
press and hold to open the day. A share button on the overview exports the trip as
an image (grid, extended-with-items, or plain list) to save or share.

## Develop

```bash
npm install       # .npmrc pins legacy-peer-deps (npm 11 peer-resolver bug)
npm run dev       # http://localhost:3000
```

## Build & deploy

```bash
npm run build     # Nitro cloudflare-pages preset -> ./dist (every route prerendered)
npm run cf:preview
```

Cloudflare Pages, Git integration: build command `npm run build`, output directory
`dist`, `NODE_VERSION=22`, `NPM_CONFIG_LEGACY_PEER_DEPS=true`. See `DEPLOY.md`.

## Layout

```
app/
  assets/css/main.css       design tokens (warm surface ramp, resort colours, type, motion)
  components/
    DayCircle.vue           the one circle — grid, list, sheet, previews, day-view header,
                             share card (20/36/40/42/56/76px; handles park-hopper split +
                             inverted variants)
    WeekGrid.vue, DayList.vue   the two overview views; tap / 400ms long-press model
    CounterRow.vue, AlertCard.vue
    QuickAssignSheet.vue    bottom sheet to set a day (in the layout, over any page)
    ShareSheet.vue, ShareCard.vue   image-export flow (html-to-image, 3 modes)
    DateRangeField.vue      bottom-sheet date-range picker (two-month calendar, or
                             bounded day-circle grid)
    TripDetailsFields.vue   shared by /new and /edit
    ItemForm.vue, DayItemRow.vue, AppIcon.vue
  composables/
    useDates.ts              UTC date helpers + formatting
    useDayCell.ts             per-day rendering data shared by grid/list/share-card
    useViewMode.ts            grid-vs-list preference (own localStorage key, not trip data)
  data/parks.ts             14 parks, 4 resorts, sheet groups
  data/templates.ts         3 starting patterns
  data/glyphs.ts            park glyphs (placeholder) + UI icons (single swap point)
  pages/                    index, new, templates, day, edit
  stores/trip.ts            the whole app state (Trip / Day / DayItem) + derived values
  types/trip.ts             the TripState/Day/DayItem/Stay/Flight types
```

## Not built

Drag-to-reorder days, and the additional alert rules the design handoff scoped but
deferred (5+ park days with no rest day, a park day with no ticket day left, park
hopper required, unused early entry, back-to-back rope drops, a travel day
double-booked with a park). The add/edit flow for day items is intentionally
utilitarian pending its own design.

Share-image export, a Sunday-first week option, and per-stay check-in/out dates
were previously listed here as not built — all three have since shipped.
