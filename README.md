# Orlando Trip Planner

Mobile-first planner for an Orlando theme-park holiday, built to
`design_handoff_orlando_planner/`. Nuxt 4 / Vue 3 / Pinia. All trip data lives in
the browser's `localStorage` — no backend, no account.

Repo: <https://github.com/jviddy/OrlandoPlanner> · Deploy target: **Cloudflare Pages**

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
park, over ticket days, dining-window reminder), then one card per calendar week
of 7 day circles. Circle **background = resort** (Disney blue, Universal coral,
SeaWorld teal, off-park yellow, unassigned dashed); **glyph = park**. Tap a circle
for the quick-assign bottom sheet; press and hold to open the day.

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
    DayCircle.vue           the one circle — grid, sheet, previews, day-view header (20/40/42/56px)
    WeekGrid.vue            weeks as stacked rows; tap / 400ms long-press model
    CounterRow.vue, AlertCard.vue
    QuickAssignSheet.vue    bottom sheet (in the layout, over any page)
    TripDetailsFields.vue   shared by /new and /edit
    ItemForm.vue, DayItemRow.vue, AppIcon.vue
  composables/useDates.ts   UTC date helpers + formatting
  data/parks.ts             14 parks, 4 resorts, sheet groups
  data/templates.ts         3 starting patterns
  data/glyphs.ts            placeholder park glyphs + UI icons (single swap point)
  pages/                    index, new, templates, day, edit
  stores/trip.ts            the whole app state (Trip / Day / DayItem) + derived values
```

## Not built (specified in the handoff, deferred)

Drag-to-reorder days, share-image export, Sunday-first week option, per-stay
check-in/out dates. The add/edit flow for day items is intentionally utilitarian
pending its own design.
