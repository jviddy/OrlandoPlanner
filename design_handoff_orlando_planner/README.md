# Handoff: Orlando Trip Planner — mobile core (trip gate, week overview, day view)

## Overview
Mobile-first planning flow for an Orlando theme-park holiday. Three screens plus one bottom
sheet cover the core loop: create a trip → pick a starting point → see the whole trip as a
grid of days → open one day and add dining and fixed-time plans.

Primary audience is European visitors on 2–3 week trips, so the overview must stay readable
at 21 days without scrolling becoming the whole experience. Secondary goal (not built yet)
is exporting a shareable image for Facebook planning groups.

## About the design files
`Orlando Planner.dc.html` in this bundle is a **design reference created in HTML** — a working
prototype showing intended look and behaviour. It is not production code to copy. The task is
to recreate it in the target codebase (`jviddy/OrlandoPlanner`: Nuxt 4 / Vue 3 / Pinia, tokens
in `app/assets/css/main.css`) using that project's existing patterns.

Open it by serving the folder over HTTP (it loads `support.js` next to it) — e.g.
`npx serve .` then open the file. Opening via `file://` will not work.

## Fidelity
**High fidelity.** Colours, type, spacing, radii, shadows and motion are final-intent. Recreate
pixel-for-pixel using the codebase's own components where they exist.

Two known placeholders:
- **Park glyphs** are simple hand-drawn SVG paths standing in for real park icons. Replace with
  a proper icon set. The system (colour = resort, glyph = park) must survive the swap.
- **Add** buttons in the day view (`Add a meal or an idea`, `Add Lightning Lane, tour or show`)
  are no-ops. The add/edit flow is not designed yet.

---

## Design tokens

Colours below extend the repo's existing `main.css` tokens. Navy, coral, teal, sun and the
neutral text ramp already exist there; the warm surface ramp is new and should be added.

### Existing (from `app/assets/css/main.css`)
| Token | Value |
| --- | --- |
| `--c-navy` | `#0b3d91` |
| `--c-coral` | `#f45d48` |
| `--c-teal` | `#17a398` |
| `--c-sun` | `#ffd23f` |
| `--text` | `#1a2233` |
| `--text-muted` | `#5b6577` |
| `--text-faint` | `#8a93a5` |

### New — warm surface ramp
| Name | Value | Used for |
| --- | --- | --- |
| Canvas (outside phone) | `#e9e2d3` | page background |
| App background | `#fdfaf3` | phone shell |
| Screen paper | `#fffdf8` | gate, templates, overview header, status bar |
| Sand | `#fbf6ea` | overview + day-view scroll areas |
| Card | `#ffffff` | week cards, list rows |
| Warm border | `#efe7d6` | card borders |
| Warm border (header rules) | `#f0e9da` | header/footer dividers |
| Warm hairline (inputs) | `#d7dbe6` / `#e2e5ee` | form fields (unchanged, cool) |
| Dashed empty stroke | `#ddd2ba` | unassigned day circle |
| Empty glyph ink | `#c9bda4` | unassigned day plus icon |
| Hint strip | `#f4ecda` | "tap / press and hold" strip |
| Selected sheet tile | `#fdf3dd` | currently-assigned park in sheet |

### Resort colours — the core system
Circle **background** = resort. Circle **glyph** = park.

| Resort | Background | Glyph ink | Shadow |
| --- | --- | --- | --- |
| Walt Disney World | `#0b3d91` | `#ffffff` | `0 4px 10px rgba(11,61,145,.34)` |
| Universal Orlando | `#f45d48` | `#ffffff` | `0 4px 10px rgba(244,93,72,.34)` |
| SeaWorld Parks | `#17a398` | `#ffffff` | `0 4px 10px rgba(23,163,152,.34)` |
| Off-park (pool / shops / rest / travel) | `#ffd86b` | `#7a5600` | `0 4px 10px rgba(224,169,74,.36)` |
| Unassigned | `rgba(255,255,255,.6)`, `1.5px dashed #ddd2ba` | `#c9bda4` | none |

This differs deliberately from the repo's `app/data/parks.ts`, where every park has its own
colour. Per-park colour makes a 21-day grid unreadable. Keep the per-park `color` field if other
screens use it, but the overview must colour by **resort**.

### Semantic
| Purpose | Values |
| --- | --- |
| Warning surface | bg `#fff1ef`, border `#f7cdc6`, ink `#c1442f`, body ink `#8f3524` |
| Reminder surface | bg `#fff8e2`, border `#f2e2b0`, ink `#a07a10` |
| Booked tag | bg `#e6f5f3`, ink `#0f7d74` |
| Idea tag | bg `#f2f4f9`, ink `#8a93a5` |
| Dining dot | `#e08a1e` |
| Fixed-time dot | `#0b3d91` |
| Countdown chip | bg `#ffd86b`, number `#5d4300`, label `#8a6a00`, shadow `0 3px 10px rgba(224,169,74,.4)` |

### Typography
- **Display** — Bricolage Grotesque, weights 500/600/700/800, `letter-spacing:-.02em`.
  Used for: page headlines, trip name, park name, counters' big numbers, template names.
- **UI** — Instrument Sans, weights 400/600/700. Everything else.
- Google Fonts: `family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700;12..96,800&family=Instrument+Sans:wght@400;500;600;700`
- This replaces the repo's Inter/Poppins pairing.

Scale in use: 30/27/22/21/19/18/17 display · 16/15/14.5/14/13.5/13/12.5/12/11.5/10.5/9.5/9 UI.
Smallest sizes (9–9.5px) appear only inside the week grid, where they are 2–3 character labels.

### Radii
`50%` circles · `22px 22px 0 0` bottom sheet · `20px` week card & template card · `16px` list
rows, CTA, optional-section card · `14px` alert cards, countdown chip, day-view inputs ·
`13px` sheet tiles & sheet buttons · `12px` form inputs, hint strip · `10px` small inputs ·
`999px` pills.

### Shadows
- Phone shell: `0 24px 60px rgba(16,24,40,.22), 0 0 0 9px #12141c, 0 0 0 10px #33384a`
- Week card: `0 2px 8px rgba(120,98,55,.07)`
- Template card: `0 3px 10px rgba(120,98,55,.08)`
- Primary CTA: `0 6px 18px rgba(11,61,145,.22)`

### Motion
| Name | Definition | Applied to |
| --- | --- | --- |
| `sheetUp` | `translateY(100%) → 0`, `.22s cubic-bezier(.2,.8,.3,1)` | bottom sheet |
| `fadeIn` | `opacity 0 → 1`, `.15s`–`.2s ease` | sheet scrim, templates screen |
| `slideIn` | `translateX(24px) + opacity 0 → 0/1`, `.18s ease` | day view enter |
| `pop` | `scale(1) → scale(1.16) rotate(-5deg) → scale(1)`, `.34s cubic-bezier(.34,1.56,.64,1)` | a day circle immediately after assignment |
| `bob` | `translateY(0 → -3px → 0)`, `3.4s ease-in-out infinite` | day-view park glyph |
| Press feedback | `transform:scale(.9)` on day circles, `.94` on sheet tiles and the day-view circle, `.99` on wide buttons | `:active` |

Honour `prefers-reduced-motion` (the repo already has a global rule for this).

---

## Screens

### 1. New trip gate

**Purpose** — capture the two required fields, optionally capture the three things that make
later warnings meaningful.

**Layout** — full-height scroll on `#fffdf8`, `20px` horizontal padding, with a fixed footer
(`12px 20px 26px`, top border `#f0e9da`) holding the primary CTA.

**Header block** (`20px 20px 8px`)
- Eyebrow: `NEW TRIP` — 11px/600 Instrument Sans, `letter-spacing:.14em`, uppercase, `#8a93a5`
- H1: "Let's get the bones in." — 30px/1.1 Bricolage Grotesque 700, `-.02em`, `#1a2233`
- Body: "Name and dates are all we need. The rest sharpens the warnings later." — 14px/1.5, `#5b6577`

**Required fields** (`16px 20px 0`, `14px` gap)
- Trip name — full width text input. Label 12px/600 `#5b6577`, 6px gap. Input `13px 14px`,
  `1.5px solid #d7dbe6`, `12px` radius, 16px text (16px prevents iOS zoom-on-focus).
- Arrive / Depart — two date inputs in a `1fr 1fr` grid, `10px` gap, 15px text.
- Under them: computed line, 13px `#8a93a5`. Reads `"{n} days · {n-1} nights"` when both dates
  are valid, otherwise `"Add both dates to continue"`.

**Optional sections** (`18px 20px 0`) — eyebrow `OPTIONAL — ADD NOW OR LATER`, then three
collapsible cards, `10px` gap. Card: `1.5px solid #efe7d6`, radius 16, bg `#fffdf6`.
Header row is a full-width button, `14px` padding, `12px` gap:
- 32×32 rounded-10 icon tile, 17px stroke-2 icon
- Title 15px/600 `#1a2233`; summary 12.5px `#8a93a5` beneath
- Chevron `▼` / `▲`, 13px `#8a93a5`

| Section | Icon tile | Summary when set | Fields | Footer action |
| --- | --- | --- | --- | --- |
| Where you're staying | bg `#e8effb`, ink `#0b3d91`, bed icon | `Split stay · 2 hotels` if a second hotel exists, else hotel 1 name, else `Not set` | Hotel 1, Hotel 2 (text) | `+ Add another stay` |
| Tickets | bg `#fdece9`, ink `#c1442f`, ticket icon | `{n} Disney · {n} Universal` | Disney days, Universal days (number) | `Park hopper included` |
| Flights | bg `#e6f5f3`, ink `#0f7d74`, plane icon | `Outbound + return set` / `Not set` | Out, Back (text) | `+ Add car hire` |

Expanded body: `0 14px 14px`, `10px` gap. Each field is a row — 96px fixed 12.5px/600 label,
then a flexible input (`9px 11px`, `1.5px solid #e2e5ee`, radius 10, 14px).
Footer action is a 13px/600 `#0b3d91` text button.

Split stay is currently a second hotel field only. Real implementation needs a repeatable list
with per-stay check-in/check-out dates, and the overview should show a hotel-change marker on
the changeover day. That is a design gap to come back to.

**Footer CTA** — full width, `16px` padding, radius 16, 16px/700 white.
Enabled `#0b3d91` with shadow; disabled `#c2c8d6`, no shadow.
Copy: "Next — pick a starting point".
Enabled when: trip name is non-empty after trim, both dates present, and depart ≥ arrive.

---

### 2. Template picker

**Purpose** — avoid the cold start without locking anyone in.

**Layout** — same `#fffdf8` scroll surface. Back button "← Trip details" 13.5px/600 `#5b6577`.
H1 is computed: `"{n} days to fill."` 27px/1.15 Bricolage 700.
Sub: "Start empty, or drop in a shape you can pull apart." 14px/1.5 `#5b6577`.

Then three cards, `12px` gap, `18px 20px 30px` padding. Card = `16px` padding, radius 20,
`1.5px solid #efe7d6`, white, shadow `0 3px 10px rgba(120,98,55,.08)`, `:active scale(.99)`.
- Row 1: name 17px/700 Bricolage `#1a2233` ← → meta 11.5px/600 `#8a93a5`
- Row 2: blurb 13.5px/1.45 `#5b6577`, `5px` below
- Row 3 (`12px` below): up to 11 preview circles, 20px, `4px` gap, 11px glyphs — a literal
  miniature of the pattern the template will lay down.

| id | Name | Meta | Blurb |
| --- | --- | --- | --- |
| `blank` | Blank slate | 0 days set | Every day empty. Build it your way. |
| `disney` | First timer Disney | Disney only | Four parks, a repeat of the big two, and a rest day after every three. |
| `both` | Best of both worlds | Disney + Universal | Split the trip — Universal front half, Disney back half, water park in the middle. |

Patterns (park ids, cycled over trip length):
- `disney`: `travel, mk, ep, pool, hs, ak, shop, mk, ep, rest, hs, ak, pool, mk, travel`
- `both`: `travel, eu, usf, ioa, pool, eu, shop, vb, rest, mk, ep, hs, pool, ak, mk, rest, travel`

Whatever the pattern says, day 1 and the final day are always forced to `travel`.

Selecting a template generates the day array and goes to the overview.

---

### 3. Overview — the main screen

**Purpose** — see the whole trip at once, judge its shape, fix problems.

#### Sticky header (`#fffdf8`, `10px 18px 12px`, bottom border `#f0e9da`)
- Trip name — 21px/1.15 Bricolage 700, single line, ellipsis
- Date range — 12.5px `#8a93a5`, format `3 Apr – 19 Apr 2027`
- Countdown chip, right — `#ffd86b`, radius 14, `7px 12px`, centre-aligned.
  Number 19px/800 Bricolage `#5d4300`; label `SLEEPS TO GO` 9px/700 `.1em` uppercase `#8a6a00`.
- Counter row, `11px` below, horizontal scroll, `6px` gap. Each is a pill (`5px 10px`,
  radius 999, 1px border) with a 7px dot, a 12px/600 label and a 12px/700 value.

| Counter | Pill bg / border / dot | Value | Value ink |
| --- | --- | --- | --- |
| Disney | `#eef3fc` / `#dbe5f7` / `#0b3d91` | `{planned}/{ticketDays}`, or just `{planned}` if no ticket set | `#c1442f` when over, else `#0b3d91` |
| Universal | `#fdefec` / `#f8dcd6` / `#f45d48` | same rule | `#c1442f` when over, else `#5b6577` |
| Off-park | `#fdf3dd` / `#f2e2b0` / `#e0a94a` | count | `#8a6a00` |
| Unset | `#f2f4f9` / `#e5e9f1` / `#cdd3e0` | count | `#5b6577` |

#### Scroll body (`12px 12px 96px` on `#fbf6ea`)

**Alerts**, stacked, `9px` below each. Row: `11px 12px`, radius 13, 1px border, `9px` gap.
16px stroke-2.2 icon, then title 13px/600 `#1a2233` and body 12.5px `#5b6577`, then an
optional right-aligned 12px/700 action in the alert's ink colour.

| Alert | Surface | Copy | Action |
| --- | --- | --- | --- |
| Reservation in the wrong park | warning | title "Reservation in the wrong park"; body `Day {n} · {item} at {itemPark} — but this day is set to {dayPark}.` | `Fix` → opens that day |
| Over ticket days | warning | "More Disney days than ticket days" / `{planned} planned, {n} on your ticket.` | none |
| Dining window | reminder, bell icon | `Dining bookings open in {n} days` / `60 days before arrival — that's {date}.` | none |

The dining alert is **derived**, not hardcoded: window opens `arrival − 60 days`; the alert is
hidden once that date has passed. The 60-day figure should be configurable per resort — Disney
and Universal differ, and Disney's own rules move.

**Week rows.** One card per calendar week, `14px` gap between weeks.
- Above the card: `Week {n}` 12px/700 `.05em` `#5b6577`, and the date range 11.5px `#a3aab8`,
  spread apart, `4px` side padding, `7px` below.
- Card: white, `1px solid #efe7d6`, radius 20, `11px 5px 10px`, shadow
  `0 2px 8px rgba(120,98,55,.07)`, `grid-template-columns:repeat(7,1fr)`, `2px` gap.

Weeks are **calendar-true and Monday-first**: leading blanks pad the first week and trailing
blanks pad the last, both rendered at `opacity:0` so the grid keeps its columns. The current
build has no week-start setting; a Sunday-first option should be added for US users.

Each day cell is a centred column, `3px` gap:
1. Weekday initials — 9.5px/600 `#a3aab8` (`Mo Tu We Th Fr Sa Su`)
2. **Circle** — 40px, `touch-action:none`, resort background, resort shadow, glyph 21px at
   stroke-width 1.7 (2.2 for the empty plus). Date number rides as a badge at `top:-2px;
   right:-3px` — min-width 15px, height 15px, radius 8, white, `1px solid #e2e5ee`,
   9px/700 `#5b6577`.
3. Park short label — 9px/600 `#5b6577`, one line, clipped, centred, fixed 11px height
4. Dot row — up to 3 dots at 4px, `2px` gap; dining `#e08a1e`, fixed-time `#0b3d91`;
   overflow shown as `+{n}` in 8px/700 `#a3aab8`

40px is below the 44px hit-target minimum, but the cell column around it (roughly 50×72px)
is the real touch target — attach the handlers to a wrapper, not just the circle, when
rebuilding.

**Hint strip** at the bottom of the scroll: `10px 12px`, radius 12, `#f4ecda`, info icon,
12px `#5b6577` — "Tap a circle to set the day. Press and hold to open it." This is permanent by
design; long-press is otherwise undiscoverable.

#### Touch model
- `pointerdown` starts a **400ms** timer.
- Timer fires → open the day view (long press).
- `pointerup` before it fires → open the quick-assign sheet (tap).
- `pointerleave` cancels the timer.
- `contextmenu` is prevented on every circle so long-press doesn't raise the OS menu.

On real devices also fire a haptic on the long-press threshold, and consider a subtle scale
tick at ~250ms so the user can feel the press registering before it commits.

#### Not built
Drag to reorder days (reservations stay put, everything else moves with the day) and the
share-image export are both specified but not yet designed.

---

### 4. Quick-assign sheet

Bottom sheet over a `rgba(12,16,26,.42)` scrim; tapping the scrim dismisses.
White, radius `22px 22px 0 0`, `max-height:78%`, `8px 0 26px`.
- Grab handle 38×4, radius 2, `#dfe3ec`, `6px auto 10px`
- Title `Set {d} {Mon}` 18px/700 Bricolage; sub 12.5px `#8a93a5` — "One tap. Long-press the
  circle next time to skip straight into the day."
- Scrolling body, `0 14px`. Four groups, `12px` apart. Group label 10.5px/700 `.1em` uppercase
  `#a3aab8`. Tiles in a `repeat(4,1fr)` grid, `4px` gap.
- Tile: column, `9px 2px`, radius 13, `:active scale(.94)`. 42px circle in resort colours with
  its shadow, 22px glyph, then a 9.5px/600 `#5b6577` label. The currently-assigned park's tile
  gets a `#fdf3dd` background.
- Footer, `6px 20px 0`, `10px` gap: "Clear day" (`#f2f4f9`, `#5b6577`) and "Open day"
  (`#0b3d91`, white), both `13px` padding, radius 13, 14px/600, `flex:1`.

Groups: Walt Disney World (`mk ep hs ak`) · Universal Orlando (`usf ioa eu vb`) ·
SeaWorld Parks (`sw aq`) · Off-park (`pool shop rest travel`).

---

### 5. Expanded day view

**Purpose** — everything about one day, without leaving the mental model of the grid.

**Header** — background is the day's resort colour (`#fffdf8` when nothing is set).
Padding `12px 18px 16px`.
- Row 1: "← Overview" left, "Prev" / "Next" right at 75% opacity. All 13.5px/600 in the
  header ink.
- Row 2 (`14px` below): 56px circle — **inverted** against the coloured header (white circle,
  resort-coloured glyph at 29px; for the yellow off-park header it's `rgba(255,255,255,.8)`
  with `#7a5600` ink). Tapping it reopens the quick-assign sheet. The glyph bobs.
- Beside it: park name 22px/1.1 Bricolage 700 in header ink; below,
  `Day {n} of {total} · {Dow} {d} {Mon}` 13px at 78–80% opacity.

Header ink is `#ffffff` on navy/coral/teal, `#7a5600` on yellow, `#1a2233` on the unset paper.

**Body** (`14px 16px 30px` on `#fbf6ea`)

Warnings first, if any: `11px 12px`, radius 13, `#fff1ef` / `#f7cdc6`, alert-triangle icon,
12.5px/1.4 `#8f3524`.

Then two groups, `16px` apart:

| Group | Hint | Add button |
| --- | --- | --- |
| EATING | Bookings open 60 days out | Add a meal or an idea |
| FIXED TIMES | Won't move if you shuffle days | Add Lightning Lane, tour or show |

Group header: title 12px/700 `.1em` uppercase `#8a93a5` ← → hint 11.5px `#a3aab8`, `8px` below.
Items `8px` apart.

Item row — white, `1px solid #efe7d6`, radius 16, `12px 13px`, `11px` gap:
- 46px fixed time column, 13px/700 centred. `#1a2233` with a time, else an em-dash in `#c3c9d6`
- Title 14.5px/600 `#1a2233`; subtitle 12px `#8a93a5` below, reading `Confirmed`,
  `Not booked yet`, or `⚠ {Park name}` when the item belongs to a different park than the day
- Tag, right: 10px/700 `.04em` uppercase, `3px 7px`, radius 6 — `Booked` (teal) or `Idea` (grey)

Add button — dashed `1.5px #d7dbe6`, radius 16, `12px 13px`, plus icon + 13.5px/600 `#5b6577`.

**Note** — label `NOTE` (same style as group titles), then a textarea: full width, min-height
74px, `12px 13px`, `1px solid #efe7d6`, radius 16, white, 14px/1.45, `resize:none`.
Placeholder "Rope drop plan, backup park, who's tired…".

The "fixed times" split is the important idea: those items are pinned to a date and must not
travel when days are reordered. Model that distinction in data, not just in the UI.

---

## Data model

```
Trip {
  name: string              // required
  startDate: ISO date       // required
  endDate: ISO date         // required, >= startDate
  hotels: string[]          // split stay; needs per-stay dates in the real model
  ticketDays: { disney: number, universal: number }
  flights: { out: string, back: string }
  days: Day[]
}

Day {
  date: ISO date
  parkId: string | null     // null = unassigned
  note: string
  items: Item[]
}

Item {
  title: string
  time: string              // 'HH:MM' or '' for "no time yet"
  kind: 'dining' | 'fixed'
  state: 'booked' | 'idea'
  parkId?: string           // set only when it belongs to a different park than the day
}
```

Park catalogue — id, name, short label (grid), resort key, glyph:

| id | Name | Short | Resort |
| --- | --- | --- | --- |
| `mk` | Magic Kingdom | Magic K. | wdw |
| `ep` | EPCOT | EPCOT | wdw |
| `hs` | Hollywood Studios | Studios | wdw |
| `ak` | Animal Kingdom | Animal K. | wdw |
| `usf` | Universal Studios | Studios | uor |
| `ioa` | Islands of Adventure | Islands | uor |
| `eu` | Epic Universe | Epic | uor |
| `vb` | Volcano Bay | Volcano | uor |
| `sw` | SeaWorld Orlando | SeaWorld | sea |
| `aq` | Aquatica | Aquatica | sea |
| `pool` | Pool / rest day | Pool | off |
| `shop` | Shopping | Shops | off |
| `rest` | Nothing planned | Rest | off |
| `travel` | Travel day | Travel | off |

This maps onto the repo's `app/data/parks.ts` — it already has `mk ep hs ak usf ioa eu volcano
seaworld`. Add `aq`, split `other` into the four off-park types, and add a `resort` → colour
map alongside the existing per-park `color`.

## Derived values

| Value | Rule |
| --- | --- |
| Trip length | `endDate − startDate + 1` days |
| Sleeps to go | `startDate − today`, floored at 0 |
| Resort counts | days whose park's resort matches |
| Unset count | days with `parkId === null` |
| Over-ticket | `resortCount > ticketDays` for that resort |
| Wrong-park reservation | any item with `item.parkId` set and `!== day.parkId` |
| Dining window | `startDate − 60 days`; alert hidden when that date has passed |
| Week grouping | Monday-first calendar weeks, padded at both ends |

## Rules not yet implemented
Only "reservation in the wrong park" was prioritised for v1. These were discussed and should be
designed into the same alert component: 5+ park days with no rest day, park day with no ticket
day left, park hopper required, early entry unused, back-to-back rope drops, travel day
double-booked with a park.

## State
```
screen   : 'gate' | 'templates' | 'overview' | 'day'
sel      : number | null     // selected day index
sheet    : boolean           // quick-assign sheet open
open     : { [sectionKey]: boolean }   // gate disclosures
justSet  : number | null     // day index to play the pop animation on
```
All trip data persists to `localStorage` in the current app (Pinia + persistedstate). Sharing a
trip with collaborators will need a backend; that is out of scope here.

## Assets
No image assets. All icons are inline stroke SVGs on a 24×24 viewBox, `fill:none`,
`stroke:currentColor`, round caps and joins — the same convention as the repo's `AppIcon.vue`,
which already holds several of them (`bag`, `ticket`, `plane`-adjacent, `bell`-adjacent).
The park glyphs (castle, sphere, clapperboard, tree, globe, islands, portal, volcano, fin,
water, sun, moon) are placeholders and live in the `G` object at the top of the prototype's
logic class.

## Files
- `Orlando Planner.dc.html` — the full prototype: all four screens, the sheet, all logic
- `support.js` — the runtime the prototype needs to render. Not part of the design; do not port.
- `screens/` — reference captures of each state:
  | File | State |
  | --- | --- |
  | `1-new-trip-gate.png` | Gate, all optional sections collapsed |
  | `2-new-trip-gate-expanded.png` | Gate with accommodation and tickets open |
  | `3-template-picker.png` | Three starting points with pattern previews |
  | `4-overview-week-grid.png` | 17-day trip from "Best of both worlds" |
  | `5-quick-assign-sheet.png` | Quick-assign sheet over the overview |
  | `6-expanded-day-view.png` | Day view showing a wrong-park reservation warning |

## Suggested build order
1. Resort colour map + park catalogue changes in `app/data/parks.ts`
2. Warm surface tokens + font swap in `app/assets/css/main.css`
3. The day circle as one small component — it appears in the grid, the sheet, the template
   previews and the day-view header, at 20/40/42/56px
4. Week grid from the circle
5. Quick-assign sheet + the tap / long-press model
6. Day view
7. Trip gate + templates
8. Then the two unbuilt pieces: drag-to-reorder and share export
