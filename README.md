# Orlando Trip Planner

A single-page planner for an Orlando theme-park holiday, built with **Nuxt 4** and
deployed to **Cloudflare Pages**. All trip data lives in the browser's
`localStorage` — there is no backend and no account.

Repo: <https://github.com/jviddy/OrlandoPlanner>

## Features

| Page | What it does |
| --- | --- |
| **Dashboard** | Countdown, at-a-glance stats, day-by-day summary, must-dos you still need to slot in. |
| **Itinerary** | One card per day: assign a park, add rides / shows / meals, set times (list auto-sorts), move items between days, per-day notes. |
| **Attractions** | Curated catalogue of Walt Disney World, Universal, Epic Universe, Volcano Bay and SeaWorld headliners. Filter by park / type / intensity and drop each onto a day. |
| **Budget** | Set a total, add line items by category and day, mark them paid, see per-person and by-category breakdowns. |
| **Packing** | Orlando-tuned starter list (heat, rain, step counts), grouped by category with progress. |
| **Settings** | Trip name / dates / party size, JSON export + import, load a demo trip, reset. |

## Local development

```bash
npm install          # uses .npmrc -> legacy-peer-deps (npm 11 peer-resolver bug)
npm run dev          # http://localhost:3000
```

## Build

```bash
npm run build        # Nitro `cloudflare-pages` preset -> ./dist
npm run cf:preview   # build, then serve ./dist with `wrangler pages dev`
```

## Deploy to Cloudflare Pages

See [`DEPLOY.md`](./DEPLOY.md). Short version:

```bash
npm run deploy       # build + `wrangler pages deploy dist --project-name=orlando-planner`
```

or connect the repo in the Cloudflare dashboard with:

- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Node version:** 22 (`.nvmrc`)

## Tech

- Nuxt 4 / Vue 3, `ssr: true` with every route prerendered (static shell + hydration).
- Pinia + `pinia-plugin-persistedstate` for the single `orlando-trip` store.
- No CSS framework — design tokens + scoped styles in `app/assets/css/main.css`.
- No runtime icon dependency — `AppIcon.vue` holds a small inline SVG set.

## Project layout

```
app/
  assets/css/main.css   design tokens + base styles
  components/           AppNav, AttractionCard, PlannerDayCard, ItineraryRow, …
  composables/          useFormat, useHydrated
  data/                 parks, attractions, packing template (the seed content)
  layouts/default.vue   header + nav + footer shell
  pages/                index, itinerary, attractions, budget, packing, settings
  stores/trip.ts        the whole app state
  types/trip.ts
nuxt.config.ts          nitro.preset = 'cloudflare-pages'
wrangler.toml           project name + pages_build_output_dir
```
