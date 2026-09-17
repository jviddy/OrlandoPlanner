# Orlando Planner — next steps

Status: **working plan to expand and work through**

Last updated: 17 September 2026

Implementation plan: [`PLANNING_FLOW_IMPLEMENTATION_PLAN.md`](./PLANNING_FLOW_IMPLEMENTATION_PLAN.md)

The implementation plan fixes the responsive Overview/Plan direction, safe editing semantics, build
order, test gates, and the boundary before accounts and collaboration. It also adds the Social Share
Studio needed to turn privacy-safe trip images into a marketing loop for Orlando-planning groups.

This turns the current ideas into an ordered roadmap. It is deliberately more specific about
outcomes and decisions than implementation: the first job is to agree how planning should feel,
then build the smallest useful slice, and only then lock the backend around it.

## Priorities

1. Make the trip-planning workflow feel continuous and obvious.
2. Redesign the trip page, including a horizontal day-planning view that adapts properly to mobile.
3. Replace the current one-size-fits-all setup with three clear starting routes.
4. Build a privacy-aware Social Share Studio for readable Facebook-group images and captions.
5. Prove anonymous persistence, then stop before user accounts and collaboration begin.

Priority controls build order, not all discovery. The setup routes and social sharing are part of the
overall workflow, and their data needs affect the backend. Accounts, roles, invitations, and
collaboration are explicitly outside this implementation phase.

## Product journey we are aiming for

1. The user tells us how much help they need.
2. We ask only for information that changes their next step.
3. They reach a useful starting plan quickly — blank, built around bookings, or recommended.
4. They can shape several days in one continuous planning session.
5. They add detail only when ready, without losing the whole-trip view.
6. The app explains conflicts and recommendations, then makes the result easy to share.

At every point, the user should know what is required, what is optional, what has already been saved,
and the most useful next action.

---

## 1. Planning workflow

### Outcome

A user should be able to turn a 14–21 day blank trip into a sensible outline without repeatedly
opening and closing sheets, learning a hidden gesture, or remembering information the app already has.

### Current friction to validate

- Planning is a repeated loop of tap day → find activity → set day → reopen the next day.
- Detailed planning depends on a 400 ms long-press in the grid. The hint can sit below several weeks,
  and the list uses a separate, cryptic arrow instead.
- Every park and activity has equal prominence in the assignment sheet. This will get worse as custom
  activities grow.
- Trip facts are siloed: stays, flights, and tickets are collected, but do not become useful anchors in
  the day-planning experience.
- Templates are a mandatory second screen, apply immediately, and cannot safely be revisited. They do
  not use tickets, stays, flights, or existing bookings.
- The current template pattern cycles raw arrays on longer trips and can create interior travel days.
  This needs fixing when starting-plan generation is redesigned.
- Editing trip details writes to the live trip immediately even though the screen presents a “Done”
  action. The effect of shrinking a date range is not clear enough.
- Day navigation uses a transient array index. Refreshing `/day` loses the selected day, and indexes
  will be fragile once reorder, URLs, or collaborative editing exist.

These are hypotheses from the code audit. We should still walk the real UI on a phone-sized viewport
and distinguish the problems users actually feel from issues that are merely visible in the code.

### Work

#### 1.1 Map and benchmark the current journeys

- [ ] Walk through three representative trips:
  - experienced planner creating a 14-day trip;
  - family with dates, flights, hotel, and a few fixed bookings creating a 17–21 day trip;
  - first-timer who does not yet know when to go or how many days they need.
- [ ] For each screen, record the user's question, the action they expect, the action the UI offers,
  and where they have to remember or re-enter information.
- [ ] Benchmark five tasks: assign five days, jump from day 3 to day 15, add a booking, find and fix a
  warning, and change dates without losing work.
- [ ] Agree what “less clunky” means using observable measures: fewer repeated opens/taps, no hidden
  required gesture, safe backtracking, and an obvious next step.

Deliverable: a one-page journey map and ranked friction list.

#### 1.2 Design a continuous planning mode

Starting hypothesis — to test, not yet a final design:

- Tapping a day selects it and opens an obvious editor; long-press can remain a shortcut but is never
  the only route to details.
- The editor can move to **Previous**, **Next**, or **Next unset day** without closing.
- Saving a day updates the overview immediately and keeps the planning session moving.
- Recent/frequent choices and likely next choices appear before a searchable “All parks & activities”
  catalogue.
- Choosing a second park is an explicit “Add park hopper” action, rather than making every assignment
  begin as a two-selection task.
- Stays, flights, fixed bookings, warnings, and unset progress appear in context.
- Batch actions worth prototyping: fill selected days, copy a day, mark rest days, and apply a starting
  shape only to unset days.

- [ ] Sketch the complete interaction before changing the quick-assign sheet.
- [ ] Decide whether editing is inline, a drawer/sheet, or part of the new Plan view in priority 2.
- [ ] Define close-without-saving, undo, and unfinished-form behaviour.
- [ ] Decide whether trip editing is true autosave with visible status or staged Save/Cancel.
- [ ] Prototype a complete five-day assignment run, not just one polished day.

#### 1.3 Define planning semantics before reorder or backend work

- [ ] Give trips and days stable IDs; route a day by ID or ISO date rather than transient index.
- [ ] Define a **fixed booking** as attached to a calendar date and location.
- [ ] Define a **movable plan** as something that can travel with a day during future reordering.
- [ ] Always retain a booking's real park/location, even when it currently matches the day, so a later
  park change can still produce the correct warning.
- [ ] Decide what happens to out-of-range days and bookings when trip dates shrink.
- [ ] Replace destructive template application with preview plus an explicit scope: fill unset days or
  replace the current shape. Existing bookings must never disappear silently.

### Acceptance criteria

- No essential action relies on long-press or a gesture explained only in help text.
- A blank 14–21 day trip can be outlined in one continuous session without reopening an editor for
  every day.
- Touch, mouse, and keyboard expose the same core actions, and vertical scrolling works when a gesture
  starts on a day.
- Backtracking or dismissing a draft does not silently change the trip.
- Refreshing or linking to a day returns to that same day.
- Existing stays, flights, bookings, and warnings are visible where they affect planning.
- A generated or reapplied starting plan cannot silently erase day details.

---

## 2. Trip page and horizontal day layout

### Outcome

Keep the whole holiday easy to understand while giving every day enough horizontal space for its park,
bookings, accommodation, notes, and warnings.

The current grid is good at showing the overall shape but too compressed for useful detail. A desktop
board with days laid left-to-right is promising, but copying that geometry directly onto a phone would
create awkward two-axis scrolling.

### Recommended direction to prototype first

Keep two complementary levels:

- **Overview:** retain the compact week grid for judging park mix, rest-day spacing, and gaps across the
  whole trip.
- **Plan:** add a richer day-planning workspace.
  - Wide screen: day cards/columns run left-to-right in a horizontal board.
  - Tablet: roughly two day cards are visible at once.
  - Mobile: a sticky horizontal date rail shows the trip left-to-right; one selected day appears in a
    full-width panel below it. Swipe or explicit Previous/Next controls move between days and keep the
    rail in sync.

This preserves the horizontal mental model without squeezing 17 columns onto a phone. The current grid
and list should remain available during testing; nothing is removed until the replacement proves better.

### Alternatives to compare

| Pattern | Strength | Main mobile risk |
| --- | --- | --- |
| Horizontal board with one column per day | Strongest desktop comparison | Two-axis scrolling and slow jumps across a long trip |
| Full-width, scroll-snapping day cards | Same model on every device | Weak whole-trip scan and swipe/variable-height conflicts |
| Date rail + selected-day panel | Fast jumps and room for rich content | Only one detailed day visible at once |
| Rich horizontal rows in a vertical list | Familiar mobile scrolling and good scanning | Less literal left-to-right trip progression |

The prototype should test both meanings of “horizontal”: days as side-by-side columns, and each day as
a wide information row.

### Proposed day-card content

- Day number, date, and park/activity using the existing `DayCircle` colour/glyph system.
- Second park as a clear park-hopper segment.
- Hotel/stay and changeover marker.
- Flight or other travel anchor.
- Timed bookings in time order, then untimed ideas.
- Warning state and note preview.
- Explicit Change day, Add plan, and Details actions.
- Planning progress plus Next unset where useful.

### Work

- [ ] Build low-fidelity versions of the horizontal board, snap cards, date rail + selected panel, and
  rich horizontal rows using fixture data first.
- [ ] Use realistic 17- and 21-day cases with split stays, flights, park hopper, dense bookings,
  warnings, notes, and unset days.
- [ ] Test at 360 px, 390 px, tablet, and desktop widths.
- [ ] Test jumping from day 3 to day 15, comparing rest spacing, assigning five days, adding a booking,
  and finding a warning.
- [ ] Check touch targets, keyboard navigation, focus order, swipe conflicts, sticky regions, and reduced
  motion.
- [ ] Choose the mobile and wide-screen patterns together, then implement them with shared day-card data
  rather than separate feature sets.
- [ ] Reuse `DayCircle`, `useDayCell`, and the trip store; the first prototype should not require a
  backend.

### Acceptance criteria

- A 21-day trip retains a readable whole-trip overview.
- A dense day can show its important information without tiny text or permanent visual clutter.
- Mobile has no required two-axis pan and no gesture collision with page scrolling or sheets.
- It is obvious how to select, edit, and move between days without instructions.
- The same information model powers mobile and desktop even when their layouts differ.

---

## 3. Backend, persistence, users, and roles

### Outcome

Produce a safe, implementation-ready design for server-backed trips, then prove it with one small
vertical slice. Do not begin by building the whole accounts and collaboration system.

The direction in [`BACKEND_PLAN.md`](./BACKEND_PLAN.md) remains sensible: Nuxt server routes on
Cloudflare Pages Functions, Cloudflare D1, Drizzle migrations, opaque database-backed sessions, and
separate global and per-trip roles. It is still a proposal and has decisions/schema gaps that must be
closed before implementation.

### 3.1 Resolve the product and security decisions

- [ ] Choose the canonical ownership model. Do not let `Trip.owner_user_id` and an owner membership row
  become two independently editable sources of truth.
- [ ] Confirm whether a trip owner can revoke a travel agent. Permanent agent access is unusually
  powerful and needs explicit disclosure plus a dispute/admin path if retained.
- [ ] Separate view, edit, invitation, and claim capabilities. A random trip URL should not silently be
  both the public view link and the edit credential.
- [ ] Decide whether anonymous trips may contain sensitive booking details at all.
- [ ] Decide whether claiming an anonymous trip locks link-based editing by default.
- [ ] Decide whether agent accounts require manual approval.
- [ ] Decide whether a public gallery is in scope or unlisted sharing is sufficient.
- [ ] Choose the multi-trip URL/navigation model: for example `/trips` and `/trips/:tripId/...`.
- [ ] Choose the authentication implementation, magic-link email provider, OAuth providers, account
  linking, token expiry, and recovery behaviour.
- [ ] Decide whether previews share a database. Before real client data exists, prefer isolated local
  development and a deliberately non-production preview dataset.
- [ ] Decide whether an existing local trip uploads automatically or only after clear user consent.

Deliverable: short architecture decision records and an operation-level permission matrix for owner,
agent, editor, viewer, anonymous editor, public viewer, and admin.

### 3.2 Complete the data and API contract

- [ ] Expand the schema so it represents everything already in `TripState`: second park, stays, flights,
  ticket counts, park-hopper setting, car hire, custom activities, notes, week start, and item ordering.
- [ ] Add stable IDs and ordering for trips, days, stays, flights, activities, and items.
- [ ] Add sessions, magic-link tokens, invitations, share/edit capabilities, claims, and activity log
  records with appropriate expiry and revocation.
- [ ] Hash claim/invite/session secrets in storage; never store reusable bearer tokens in plaintext.
- [ ] Add optimistic-concurrency revisions and define stale-write, retry, offline, and simultaneous-edit
  behaviour.
- [ ] Define server-side redaction of sensitive fields for every read path.
- [ ] Define constraints, indexes, foreign-key/delete behaviour, soft-delete retention, restore, and
  audit rules.
- [ ] Include the setup mode, seed provenance, and any retained planning-profile version only after the
  setup model in priority 4 is agreed.
- [ ] Define an idempotent and recoverable migration from schema-version-1 localStorage data.

Deliverable: schema, endpoint list, example request/response shapes, token lifecycles, permission tests,
and migration/rollback notes.

### 3.3 Build a foundation spike behind a feature flag

- [ ] Add a local D1 binding, Drizzle configuration, and one committed migration.
- [ ] Add an explicit runtime rule for `/api/**`; the current `/**` rule prerenders every route.
- [ ] Add separate, explicit migration commands for local, preview, and production databases.
- [ ] Prove one health/read-write endpoint in local and Cloudflare preview environments.
- [ ] Add typecheck plus focused schema, migration, validation, and authorization tests to CI.
- [ ] Verify current Cloudflare/D1 behaviour against official documentation when implementation begins.

### 3.4 First safe vertical slice

- [ ] Give the existing trip a stable ID and sync revision through a backwards-compatible
  `afterHydrate` migration.
- [ ] Create, fetch, and update one anonymous trip through a repository/API boundary.
- [ ] Make creation retry-safe and updates conflict-aware.
- [ ] Retain localStorage as a recoverable fallback during the transition; never delete or silently
  overwrite the local trip.
- [ ] Prove the migration with real legacy fixtures before adding accounts.

Only after this works should we add sessions, claims, ordinary owner/editor/viewer invitations, API
redaction, and finally agent-specific privileges.

### Acceptance criteria for the foundation

- Existing local trips survive upgrade and failure without data loss.
- Unauthorized read/edit operations are rejected at the API, not merely hidden in the UI.
- Local, preview, and production migrations are repeatable and environment-safe.
- A failed app deploy cannot leave the database/app combination unusable.
- Permission and redaction behaviour is covered by automated tests before sensitive fields are stored.

---

## 4. Three ways to start a trip

### Outcome

The first screen should ask what situation the user is in, not immediately present the same long form to
everyone. All three paths should converge on the same Plan experience while producing different starting
points.

| Setup route | What we ask first | Result |
| --- | --- | --- |
| **I know what I’m doing** | Name and dates; tickets only if useful | A blank plan, with templates offered as an optional shortcut |
| **I have things booked** | Dates and the fixed facts already known: flights, stays, tickets, dining, tours/events | A plan with those anchors placed and the remaining days clearly unset |
| **I have no idea — help me** | Flexible dates and constraints, party, priorities, pace, and preferences | An explained recommendation, then a generated starting shape after dates are confirmed |

### Shared setup structure

- [ ] Build one branching setup shell with clear progress, Back/Continue, Save and return where relevant,
  and Skip for now.
- [ ] Keep a `TripSetupDraft` separate from the live trip so abandoned steps and switching route do not
  partially mutate an existing plan.
- [ ] Add a review screen before committing or generating the trip. Current template cards apply
  immediately; the new flow should preview the complete result.
- [ ] Store `setupMode` (`self`, `booked`, `guided`) separately from `seedStrategy` (`blank`, `template`,
  `generated`). Choosing how much help is needed is not the same as choosing a template.
- [ ] Land “I know what I’m doing” and “I have things booked” in the Plan view with the first useful day
  selected, rather than adding a mandatory templates screen.

### Route 1 — I know what I’m doing

- Ask for the minimum: trip name and dates.
- Offer tickets and a starting shape as shortcuts, not gates.
- Default to blank and make it fast to start filling days continuously.
- Allow the user to revisit and apply a starting shape only to unset days.

### Route 2 — I have things booked

- Ask which facts are fixed: dates, flights, stays, tickets, dining, tours, events, or other reservations.
- Build the date range and place fixed anchors before generating any suggestions around them.
- Summarise the handoff: “X bookings placed; Y days left to plan.”
- Add explicit fixed/locked semantics before any drag-to-reorder feature.
- Store booking location and future sensitive confirmation fields separately from free-text notes.

### Route 3 — I have no idea, help me

Ask only questions that change a recommendation. Each step should say why it matters and give a concise,
useful tip rather than feeling like a survey. This should be an extention of the date recommendation page/altgorythm that was build

| Question area | What it changes | Helpful feedback to show |
| --- | --- | --- |
| Available dates and term-time limits | Which date windows are possible | Explain hard constraints first; do not recommend impossible windows |
| Adults, children by age band, and accessibility needs | Park mix, pace, height/access planning | Explain why age bands and mobility needs affect the shape of a day |
| Desired trip length | Number of park, rest, travel, and repeat days | Show what becomes realistic at each length rather than only a number slider |
| Must-do parks or experiences | Non-negotiable days and ticket mix | Distinguish priorities from “nice to have” choices |
| Thrill level | Balance of thrill-heavy and family attractions | Explain trade-offs without excluding a whole park too early |
| Preferred pace and rest days | Consecutive park limits and recovery time | Recommend rest spacing and let the user make it busier or gentler |
| Heat tolerance | Season suggestions and midday-break advice | Explain that tolerance changes pacing as well as date choice |
| Crowds, price, weather, or events | Which trade-off the recommendation optimises | Show that there is no single objectively “best” time |
| Tickets already owned or considered | Feasible park allocation and hopper use | Explain what the ticket enables and flag mismatches before generation |

- [ ] First produce a planning brief with reasons and editable assumptions.
- [ ] Confirm exact dates before materialising `TripState.days`.
- [ ] Initially recommend a trip **shape** from user inputs; do not claim exact “best dates” until there
  is a trustworthy crowd/event/price data source.
- [ ] Decide whether questionnaire answers remain only in the setup draft or become a versioned planning
  profile the user can revisit.
- [ ] Prototype one complete happy path for each route before building recommendation logic.

### Acceptance criteria

- A confident user can reach a blank plan after entering only name and dates.
- A booked user never has to re-enter fixed facts after reaching the planner.
- A guided user can begin without exact dates and receives reasons, not unexplained scores.
- Every route can go back, skip optional details, review the result, and change direction without losing
  entered information.
- Generated suggestions never overwrite fixed bookings.

---

## Suggested order for the next few working sessions

### Session 1 — agree the workflow problem

- Run the three walkthroughs and five benchmark tasks.
- Rank the friction and agree the planning semantics: selected day, fixed booking, movable plan, save,
  close, and undo.
- Confirm what “days laid out horizontally” means in practice.

Output: agreed journey map, terms, and success measures.

### Session 2 — compare planning/layout prototypes

- Prototype the continuous editor together with the four layout patterns.
- Test using a realistic 21-day plan on phone, tablet, and desktop.
- Choose the Overview + Plan information architecture and mobile adaptation, or record why another option
  wins.

Output: chosen interaction and responsive layout specification.

### Session 3 — build the first local-only slice

- Implement the chosen Plan shell and continuous five-day assignment flow.
- Add explicit Details and Next unset; keep long-press optional.
- Add stable day routing and focused regression coverage.

Output: a usable slice that can be compared directly with the current workflow.

### Session 4 — make the backend proposal implementation-ready

- Resolve ownership, capabilities, anonymous editing, agent revocation, auth, URL, sync, and environment
  decisions.
- Complete the schema/API/permission contract.
- If the contract is ready, start only the D1/Drizzle foundation spike behind a feature flag.

Output: decision records and either a spike plan or a verified foundation spike.

### Session 5 — prototype the three setup routes

- Sketch all three paths in one setup shell.
- Test the self-directed and booked routes end to end.
- Agree the guided questions, recommendation rules, and data we can honestly support.

Output: setup flow specification and the first implementation slice.

## Regression and release guardrails

- [ ] Add store tests for starting-plan generation, refitting dates, fixed bookings, day identity, and
  migration from existing localStorage shapes.
- [ ] Add one browser smoke journey: setup → preview/generate → sequential assignment → add booking →
  change park/date → reload the same day.
- [ ] Run `npm run typecheck` and `npm run build` for every implementation slice.
- [ ] Keep current user data backwards-compatible via `afterHydrate` whenever persisted state changes.
- [ ] Register every new store/composable explicitly in `nuxt.config.ts` because this checkout path
  prevents reliable auto-import scanning.
- [ ] Keep backend changes behind a feature flag until migration and failure recovery are proven.
- [ ] For Ripple work, commit, push, deploy to the Cloudflare testing site, and include the testing URL
  before marking an issue `ai:ready-for-testing`.

## Later research queue (captured, not lost)

### Crowd/busyness context in date pickers

The original idea is to colour dates by expected busyness: an Orlando-wide average in the initial trip
picker, then park-specific information while planning individual days. Before designing the colour scale:

- [ ] Identify lawful, maintainable crowd, park-hours, event, price, and closure data sources.
- [ ] Decide whether the value is a forecast, historical tendency, live signal, or editorial score.
- [ ] Show confidence/source and “last updated”; never present a weak estimate as fact.
- [ ] Use labels/patterns as well as colour for accessibility.
- [ ] Decide how conflicting park-level signals roll up to an Orlando-wide day score.
- [ ] Test whether these signals genuinely improve date/park decisions or simply make the calendar noisy.

This research supports the guided setup route, but it should not block improvements to the core planning
workflow or the first horizontal-layout prototype.

## Decisions to make together next

1. When you say each day should be laid out horizontally, do you picture days as side-by-side columns,
   or one wide information row per day? response: my thought was for side by side columns but i don't think that will work on mobile. 
2. Should the week grid remain the default Overview, with a separate Plan workspace, or should the new
   view replace it? Response: i think grid view shoudl be the default but list view probably has a more information visiable
3. Which part of the current planning loop feels worst in real use: choosing activities, moving between
   days, seeing enough detail, or the initial setup? Seeing details and moving between days. The inital setup has a much larer system to be built upon it. Being able to se all the days while planning is useful for pacing but a dave view is better for detailed planning. we need find a balance
4. Are bookings truly pinned to calendar dates while park/rest plans can move? This decision affects
   layout, reorder, alerts, setup, and the database.things that are booked shoudl be locked in place
5. For anonymous sharing, should one link be view-only and a separate capability grant edit access? not sure. use best judgement. maybe require sign up to edit a lcoked down plan
6. Can an owner remove their travel agent, or is agent access intentionally persistent until an admin
   resolves it? i think agent created have a persistent admin

Those answers are the first checkpoint before implementation begins.
