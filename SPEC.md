# Orlando Trip Planner — Technical Spec & Handover

This document is for a developer (human or AI agent) picking up this codebase with no prior
context. It describes what is **actually built today**, as verified against the code — not what
was originally designed or what's planned. Where the design handoff or README have drifted from
reality, that's called out explicitly.

Read order for a new agent: this file first, then skim `README.md` (quick-start commands) and
`DEPLOY.md` (deploy mechanics) if you need them. `BACKEND_PLAN.md` is a forward-looking proposal,
not current state — see [Backend plan](#backend-plan-not-built) below.

---

## 1. Product snapshot

A mobile-first web app for planning a 1–3 week Orlando theme-park holiday (Disney, Universal,
SeaWorld, off-park days). Primary audience: European visitors on 2–3 week trips who need the
whole trip readable as a single grid without endless scrolling.

Core loop: create a trip (name + dates) → pick a starting template or start blank → see the whole
trip as a grid of day circles → tap a day to assign a park, long-press to open it and add dining /
fixed-time plans → the app surfaces warnings (wrong-park bookings, over-ticket days, dining
booking window) as you go → optionally export a shareable image for e.g. a Facebook planning
group.

**There is currently no backend, no accounts, and no server-side data.** One trip lives entirely
in one browser's `localStorage`. Anyone who opens the app on that browser sees (and can edit) that
one trip. This is the single most important fact about the current architecture — see
[§5 Architecture](#5-architecture--key-constraints).

## 2. Tech stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Framework | Nuxt 4 (Vue 3, `<script setup>` everywhere) | `nuxt.config.ts` |
| State | Pinia + `pinia-plugin-persistedstate` | one store, persisted to `localStorage` |
| Language | TypeScript, `strict: true` | `tsconfig.json` extends Nuxt's generated config |
| Styling | Plain scoped CSS + CSS custom properties (design tokens) | `app/assets/css/main.css`; **no Tailwind, no CSS framework** |
| Image export | `html-to-image` | renders an off-screen component to a PNG blob |
| Deploy target | Cloudflare Pages, Nitro `cloudflare-pages` preset | every route prerendered; see §11 |
| Package manager | npm 11 (`packageManager` pinned in `package.json`) | `.npmrc` forces `legacy-peer-deps=true` — **required**, see §7 |
| Node | 22 (`.nvmrc`, CI, Cloudflare env var) | |

No test runner, no linter, no CI check beyond "does it build" (`.github/workflows/build.yml` runs
`npm ci && npm run build` on push/PR to `main`). `npm run typecheck` (`nuxt typecheck` / `vue-tsc`)
exists as a script but is not wired into CI. There is currently no automated way to catch a
regression other than `npm run typecheck` and manual testing in a browser.

## 3. Repository layout

```
app/
  assets/css/main.css        design tokens + reset + shared classes (.screen, .scroll, .cta, .field, .input…)
  components/
    DayCircle.vue             the one circle primitive — grid/sheet/day-view/share-card all reuse it
    WeekGrid.vue               overview grid: weeks as rows, tap-vs-long-press touch model
    DayList.vue                overview list view (alt to WeekGrid, same tap/open pattern)
    QuickAssignSheet.vue       bottom sheet to set a day's park(s) — lives in the layout, over any page
    ShareSheet.vue / ShareCard.vue   image-export flow (3 modes) via html-to-image
    TripDetailsFields.vue      shared name/dates/stay/tickets/flights form (used by /new and /edit)
    DateRangeField.vue         bottom-sheet date-range picker (two-month calendar, or bounded day-circle grid)
    CounterRow.vue, AlertCard.vue    overview header counters + derived alert cards
    ItemForm.vue, DayItemRow.vue     day-view dining/fixed-time item add/edit/display
    AppIcon.vue                 renders one path from data/glyphs.ts as a 24×24 stroke SVG
  composables/
    useDates.ts                 UTC-safe date parsing/formatting (parseISO/toISO/addDays/diffDays/todayUTC + labels)
    useDayCell.ts                per-day rendering data shared by grid/list/share-card (park short label, item dots, hotel label)
    useViewMode.ts               grid-vs-list preference, own localStorage key (NOT in the trip store)
  data/
    parks.ts                     14 parks, 4 resorts (wdw/uor/sea/off), resort colour map, sheet groups
    templates.ts                 3 starting templates (blank / disney / both) as day-type patterns
    glyphs.ts                    SVG path strings: park glyphs + UI icons, single swap point for real icons later
  layouts/default.vue           app shell wrapper; mounts <QuickAssignSheet /> globally
  pages/
    new.vue                      trip gate: name + dates (+ optional stay/tickets/flights)
    templates.vue                 pick a starting pattern
    index.vue                     the overview (grid or list)
    day.vue                       one expanded day
    edit.vue                      edit trip details, week-start setting, reset
  stores/trip.ts                 the entire app state + all derived values + all mutations
  types/trip.ts                  TripState / Day / DayItem / Stay / Flight / TicketDays types
design_handoff_orlando_planner/  original high-fidelity design reference (HTML prototype + screenshots) — see §12
BACKEND_PLAN.md                  proposal for multi-user/accounts/sharing — NOT built, see §13
DEPLOY.md                        Cloudflare Pages deploy instructions
README.md                        quick-start; some of its "not built" claims are now stale, see §9
CLAUDE.md                        Ripple (AI todo-tracker) process instructions for this repo — process, not architecture
```

## 4. Data model

`app/types/trip.ts` is the source of truth. Everything hangs off one `TripState`:

```ts
TripState {
  version: number              // persistence schema version, see §5 migrations
  created: boolean              // true once a template has been picked (trip left the gate)
  name: string
  startDate: string             // ISO yyyy-mm-dd
  endDate: string
  weekStart: 'sunday' | 'monday' | 'tripDay1'
  hotels: Stay[]                 // 0–4 stays; Stay = { name, startDate?, endDate? }
  ticketDays: { disney: number, universal: number }
  parkHopper: boolean
  flights: Flight[]              // 0–6; Flight = { route, date, departTime, arriveTime }
  carHire: string
  days: Day[]
  customActivities: CustomActivity[]   // user-defined off-park options (id/resort:'off'/name/short/glyph)

  // transient UI state — NOT persisted (see §5):
  selectedDay: number | null
  sheetOpen: boolean
  justSet: number | null
}

Day {
  date: string                   // ISO
  parkId: string | null          // null = unassigned; looked up in PARKS or customActivities
  secondParkId: string | null    // set only for a park-hopper day (diagonal split circle)
  note: string
  items: DayItem[]
}

DayItem {
  id: string
  title: string
  time: string                   // 'HH:MM' 24h, or '' = "no time yet"
  kind: 'dining' | 'fixed'
  state: 'booked' | 'idea'
  parkId?: string | null         // set ONLY when it differs from the day's park — drives the "wrong park" alert
}
```

Park/resort catalogue lives separately in `app/data/parks.ts`, not in trip state — `Day.parkId` /
`DayItem.parkId` are just string ids resolved against `PARK_BY_ID` (built-ins) or
`customActivities` (user-added, always `resort: 'off'`) via `resolvePark()`.

## 5. Architecture & key constraints

**Everything is client-only.** `nuxt.config.ts` prerenders every route
(`routeRules: { '/**': { prerender: true } }`) for the Cloudflare deploy, but every page's real
content is wrapped in `<ClientOnly>` with a loading-shell fallback, because trip data only exists
in `localStorage` — there's nothing meaningful to render at prerender/SSR time. **Don't try to
make pages SSR-aware of trip data**; the `ClientOnly` + `onMounted` guard pattern (see every page
in `app/pages/`) is intentional, not a bug.

**One store, one trip.** `useTripStore` (`app/stores/trip.ts`) is the entire app model — getters
for every derived value (counters, alerts, calendar weeks, wrong-park items, dining window),
actions for every mutation. There is no per-trip ID, no multi-trip support, no way to have two
trips open at once. Page-level guards (`onMounted` → `navigateTo`) route you to `/new` if
`!store.hasTrip`, or away from `/new`/`/templates` back to `/` if a trip already exists.

**Persistence via `pinia-plugin-persistedstate`**, `localStorage`, explicit `pick` list (see
`stores/trip.ts:84-99`) — deliberately excludes `selectedDay`/`sheetOpen`/`justSet` (transient UI
state that shouldn't survive a reload). `afterHydrate` (`stores/trip.ts:106-127`) is a **schema
migration shim**: it reshapes old persisted data (`hotels` used to be `string[]`, `flights` has
gone through two prior shapes) so existing users' localStorage doesn't break or lose data across
deploys. **Any future breaking change to `TripState`'s shape needs a corresponding `afterHydrate`
case**, or existing installed trips will crash on load.

**A build-time gotcha you will hit if you touch `nuxt.config.ts`:** this repo's checkout path
contains parentheses (`iCloud Drive (Archive)`), which breaks `unimport`'s glob scan of
`composables/`/`stores/` (Nuxt's own component scanner escapes glob metacharacters; unimport does
not). That's why `nuxt.config.ts` has an explicit `imports.presets` list for `useTripStore`,
`useDates`, `useDayCell`, `useViewMode` instead of relying on auto-import. **Any new composable or
store you add needs to be added to that presets list too**, or the app won't build from this path
(it may still build fine on a CI machine with a plain path — don't let that fool you into thinking
the preset list is unnecessary).

**`.npmrc` pins `legacy-peer-deps=true`** — npm 11's peer-resolver crashes
(`Cannot read properties of null (reading 'edgesOut')`) on the Nuxt 4 + Vite dependency graph
without it. Cloudflare's build image respects `.npmrc`; if you ever move off Cloudflare or add a
separate CI install step, carry this flag with it.

**Dates are handled as UTC midnight everywhere** (`useDates.ts`: `parseISO`/`toISO`/`addDays`/
`diffDays`/`todayUTC`) specifically to avoid timezone drift shifting a day by one when the device
clock isn't UTC. Never introduce `new Date('yyyy-mm-dd')` or local-timezone date math elsewhere in
the app — it will disagree with the rest of the codebase near midnight in non-UTC timezones.

## 6. State: `useTripStore` map

**Key getters** (`app/stores/trip.ts`): `datesValid`, `dayCount`/`nights`, `hasTrip`,
`rangeLabel`/`sleepsToGo`, `disneyDays`/`universalDays`/`offParkDays`/`unsetDays`,
`hotelsForDate(iso)` (resolves which stay covers a given night — falls back to "the one named stay
covers everything" when no stay has explicit dates), `counters` (the 4 overview pills, with
over-ticket colour logic baked in), `wrongParkItems`, `diningWindow` (arrival − 60 days, hidden
once passed), `alerts` (combines the above into the overview's alert cards), `weeks` (Monday/
Sunday/trip-day-1-first calendar grouping with padding), `selected` (the day `selectedDay` points
at).

**Key actions**: `updateFields` (patches trip-level fields; re-fits `days` if dates changed and a
trip already exists), `setHotel`/`setHotelDates`/`addHotel`/`removeHotel`,
`setFlight`/`addFlight`/`removeFlight`, `buildDays`/`applyTemplate`/`refitDays` (days are always
**matched and carried over by ISO date** when the range changes — extending or shrinking a trip
never loses a day's assignment), `assignDay`/`clearDay` (park-hopper: `secondParkId` only kept
when a primary `parkId` is set), `addCustomActivity`, `openSheet`/`closeSheet`/`selectDay`/
`stepDay`, `addItem`/`updateItem`/`removeItem`/`sortDayItems` (timed items sort ascending, untimed
after, stable), `resetTrip` (`$reset()`, used by the edit page's "start a fresh trip").

## 7. Routing & page flow

```
/new        Trip gate — name + arrive/depart (required), stay/tickets/flights (optional, collapsible)
/templates  Pick a pattern — Blank / First-timer Disney / Best of both worlds
/           Overview — grid or list view of every day, counters, alerts
/day        One expanded day — dining + fixed-time items, warnings, a note
/edit       Change trip details + week-start setting + reset trip
```

Every page guards itself in `onMounted` (client-only, since it reads the store): `/new` and
`/templates` bounce to `/` if `store.hasTrip`; `/`, `/day`, `/edit` bounce to `/new` (or `/` for
`/day` specifically) if there's no trip / no selected day. There's no router middleware doing
this centrally — it's per-page, so a new page needs its own guard.

`QuickAssignSheet` is mounted once in `layouts/default.vue`, not per-page — it's a global overlay
driven entirely by `store.sheetOpen`/`store.selectedDay`.

**Touch model** (`WeekGrid.vue`, mirrored in `DayList.vue` via explicit buttons instead of
press-timing): `pointerdown` starts a 400ms timer; if it fires, open the day view (long-press);
`pointerup` before it fires opens the quick-assign sheet (tap); `pointerleave`/`pointercancel`
cancel the timer; `contextmenu` is prevented so long-press doesn't raise the OS menu.

## 8. Design system

Full detail lives in `design_handoff_orlando_planner/README.md` (see §12) and is implemented as
CSS custom properties in `app/assets/css/main.css`. The essentials a new agent needs:

- **Colour system**: circle **background = resort** (Disney navy `#0b3d91`, Universal coral
  `#f45d48`, SeaWorld teal `#17a398`, off-park sun `#ffd86b`, unassigned = dashed outline).
  Circle **glyph = specific park**. This is deliberate — per-park colour was tried and makes a
  21-day grid unreadable. Never reintroduce per-park circle colour on the overview.
- **Typography**: display font = Bricolage Grotesque (headlines, trip name, big numbers), UI font
  = Instrument Sans (everything else). Loaded via Google Fonts `<link>` in `nuxt.config.ts`.
- **`DayCircle.vue`** is the one shared circle primitive, reused at multiple sizes across the app:
  20px (template preview), 36px (list view / date-range day-picker), 40px (week grid), 42px
  (quick-assign sheet tiles), 56px (day-view header, `inverted` + `bob` animation), 76px
  (share-card overview mode). It handles the park-hopper diagonal split (`isSplit`), the
  `inverted` white-circle-on-coloured-header day-view variant, and the `flat` (no shadow) variant
  for previews/exports. **Add new circle contexts by using this component, not a new one.**
- **Bottom sheets** (`QuickAssignSheet`, `ShareSheet`, `DateRangeField`) share a pattern: scrim +
  `sheetUp` slide animation, Escape-to-close, `role="dialog"`. `QuickAssignSheet` has a documented
  workaround (`stores/trip.ts` §5 migration aside — see `QuickAssignSheet.vue`'s `onLeave`/
  `instantClose`) for a real bug that shipped and was fixed (commit `042cf39`): a `duration:0`
  CSS-transition override can fail to fire its Vue transition-complete event in some browsers,
  leaving the leaving sheet element stuck full-screen and `pointer-events`-blocking the entire app.
  Fixed by switching to JS-hook transition mode and calling `done()` manually for the
  instant-close-on-navigate case. **If you add another "skip the animation" case anywhere, reuse
  this pattern, don't reach for `duration: 0`.**
- Respect `prefers-reduced-motion` — there's already a global rule in `main.css` collapsing all
  animation/transition durations; don't build motion that bypasses it.

## 9. What's actually built (vs. what docs say)

`README.md`'s "Not built (specified in the handoff, deferred)" list is **stale** — it predates
several shipped features. As of the current `main` branch, verified against the code:

**Built:**
- Trip gate, 3 templates, week-grid overview, list-view overview (toggle, own persisted
  preference), quick-assign sheet, expanded day view with dining/fixed-time items
- Park-hopper days (two parks per day, diagonal split circle)
- User-defined custom off-park activities (name + icon choice, added from the quick-assign sheet)
- Multi-stay accommodation with **per-stay optional date ranges** (`DateRangeField` `variant="days"`
  bounded picker, "already booked" dot for overlap) — README still describes this as a gap
- Multiple flights (up to 6) with per-flight date + separate takeoff/landing times
- Week-start setting (Sunday / Monday / "day 1 of my trip") — README still lists Sunday-first as
  not built
- **Shareable trip image export** (`ShareSheet`/`ShareCard`, 3 modes: overview grid, extended list
  with items, plain list) via `html-to-image` + Web Share API with download fallback — README still
  lists this as not built
- Derived alerts: wrong-park reservation, over-ticket-days (Disney/Universal separately), dining
  booking window (60 days before arrival, self-hiding once passed)
- Edit trip (rebuild days by date-match on date change), reset trip with confirmation

**Not built** (confirmed gap, matches both README and the design handoff):
- Drag-to-reorder days
- The additional alert rules the design handoff scoped but deferred: 5+ consecutive park days with
  no rest day, a park day with no ticket day left, "park hopper required" detection, unused early
  entry, back-to-back rope drops, a travel day double-booked with a park day. Only "wrong-park
  reservation," "over ticket days," and "dining window" are implemented.
- Any account/multi-trip/collaboration feature — see §13.

If you fix this drift, update `README.md`'s "Not built" section — it's the file most likely to be
read first by a human.

## 10. Notable past bugs (context for git history)

Worth knowing before you touch these areas, from recent commits:
- **`042cf39`** "Fix a stuck-sheet bug blocking scroll app-wide" — the transition bug described in
  §8. If clicking anywhere on the app stops working after a sheet interaction, check for a
  leftover `.sheet-root` in the DOM and check whether a `duration:0` CSS override was reintroduced
  somewhere.
- Flight/date shape has changed twice (`{out, back}` strings → `{route, time}` → current
  `{route, date, departTime, arriveTime}`); `hotels` went from `string[]` to `Stay[]`. Both are
  handled by `afterHydrate` (§5) — if you change either shape again, add another migration branch
  rather than assuming fresh data.

## 11. Dev workflow & scripts

```bash
npm install       # .npmrc pins legacy-peer-deps — required, see §5
npm run dev        # http://localhost:3000
npm run typecheck  # nuxt typecheck (vue-tsc) — not run in CI, run it yourself before a PR
npm run build       # Nitro cloudflare-pages preset -> ./dist
npm run cf:preview  # build + wrangler pages dev dist (local Cloudflare-like preview)
npm run deploy      # build + wrangler pages deploy dist --project-name=orlando-planner
```

CI (`.github/workflows/build.yml`) only runs `npm ci && npm run build` on push/PR to `main` and
uploads `dist` as an artifact — it is a build check, not a deploy and not a test gate (there are no
automated tests).

## 12. Deploy

Cloudflare Pages project `orlando-planner`, static-ish output (every route prerendered, tiny
`_worker.js` fallback) — see `DEPLOY.md` for full detail. Two important things a new agent must
know:

1. **The Cloudflare Pages project is *not* connected to the GitHub repo.** Pushing to `main` does
   **not** deploy the live site. `npm run deploy` (wraps `wrangler pages deploy`) is the only way
   testing/production content updates. This is called out in `CLAUDE.md`'s Ripple process section
   — if you're working an `ai:*`-labelled issue, you must run `npm run deploy` and link the
   resulting URL before marking it `ai:ready-for-testing`.
2. `wrangler.toml` carries `compatibility_date`/`nodejs_compat`; if the dashboard's own build
   settings are used instead of `wrangler` from a machine, that flag needs mirroring under
   **Settings → Functions → Compatibility flags**.

## 13. Backend plan (not built)

`BACKEND_PLAN.md` at the repo root is a **detailed proposal**, not a description of anything that
exists — it covers accounts, trip ownership, collaborator roles, sharing/visibility, a claim
mechanism for admin-seeded/anonymous trips, sensitive-field gating, a D1 + Drizzle data model, and
a 4-phase migration path off the current localStorage-only model. Read it if you're being asked to
start on multi-user support, but treat every "Decision:" in it as a recommendation the project
owner can still overrule, not a settled spec. Nothing in `wrangler.toml` currently has a D1
binding; there is no `server/api/*` directory yet.

## 14. Design reference

`design_handoff_orlando_planner/` is the **original** high-fidelity design handoff (an HTML
prototype + design tokens + per-screen specs + reference screenshots) that the current
implementation was built against. It predates several now-shipped features (share export,
week-start option, park-hopper, custom activities, multi-flight, per-stay dates) so **treat it as
historical/foundational, not current** — §9 above is the authoritative "what's built" list. It's
still useful for: the original rationale behind the resort/park colour system, exact token values,
and the icon/glyph convention (`design_handoff_orlando_planner/README.md` → "Assets": all icons are
inline stroke SVGs, 24×24 viewBox, `fill:none`/`stroke:currentColor`, round caps/joins — match this
when adding any new icon to `app/data/glyphs.ts`).

## 15. Suggested orientation path for a new agent

1. Read this file, then skim `app/types/trip.ts` and `app/stores/trip.ts` — that's the entire
   data model and business logic in ~600 lines.
2. Run `npm install && npm run dev`, create a trip, click through gate → templates → overview →
   day view → edit, to see the app before changing it.
3. Look at `DayCircle.vue` and one of its 6 call sites to understand the size/variant system
   before adding any new day-circle usage.
4. If the task touches persistence shape, read `afterHydrate` in `stores/trip.ts` first and plan
   the migration branch alongside the shape change.
5. If the task is backend/accounts work, read `BACKEND_PLAN.md` in full before writing any
   `server/api/*` code — several non-obvious decisions (claim-vs-copy, agent-membership
   revocability, field-level sensitive-data gating) are already thought through there.
