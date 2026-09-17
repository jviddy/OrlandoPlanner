# Orlando Planner — pre-accounts implementation plan

Status: **ready to implement**

Baseline: commit `ec44122`, tagged `checkpoint-pre-planning-redesign-2026-09-17`

This plan turns the product direction in
[`next steps for orlandoPlanner.md`](./next%20steps%20for%20orlandoPlanner.md) into an ordered set of
implementation slices. Its centre of gravity is the planning experience: getting into the app,
seeing the shape of a trip, moving between days, adding detail, and sharing a useful result.

The plan ends after a safe anonymous-persistence foundation. It does **not** implement user accounts,
authentication, invitations, owner/agent/editor/viewer roles, trip claiming, or live collaboration.

## Product decisions for this phase

These decisions remove ambiguity from the first implementation pass:

- Keep the week grid as the default **Overview**. Keep the richer list as an alternate overview.
- Add a separate **Plan** workspace. A day selected in either overview opens the same day in Plan.
- On wide screens, Plan uses horizontally arranged day columns with scroll snapping and a sticky trip
  summary. On mobile, it uses a sticky horizontal date rail and one full-width selected-day panel.
  Tablet shows one or two day cards depending on available width.
- Make every core action visible. Long-press may remain as a shortcut but is never required.
- Day/activity selections save immediately and show an Undo action. Longer forms use explicit
  Save/Cancel. Trip settings and date changes use a draft plus an impact review before Save.
- Booked items are fixed to a calendar date. Park/rest/activity plans are movable payloads associated
  with a day. A later reorder feature will move the plan payload and leave fixed bookings on their real
  dates.
- Existing plans are never silently replaced. Starting shapes preview first and default to filling only
  unset days.
- Sharing produces image files for the user to post. Direct posting to Facebook groups is outside this
  phase; native device sharing, multi-image download, and copyable post text cover the useful path
  without requiring a Facebook integration.

## Target user flow

```text
No trip
  -> Choose how much help is needed
     -> I know what I'm doing -> minimum details -> review -> Plan
     -> I have things booked  -> fixed anchors  -> review -> Plan
     -> Help me plan           -> preferences -> planning brief -> dates -> review -> Plan

Existing trip
  -> Overview (grid by default; list optional)
     -> select any day -> Plan focused on that day
        -> assign/change activity
        -> add detail or booking
        -> Previous / Next / Next unset without closing
        -> return to Overview with the same day still in context
     -> Share -> choose story -> privacy review -> preview -> share/download + copy caption
```

The current `/day` route becomes a compatibility redirect into Plan. Refreshing a Plan URL restores
the selected day from its stable ID rather than from transient Pinia state.

## Data model and interaction semantics

These changes come first because the new UI, setup flow, safe date editing, sharing, and eventual
backend all depend on them.

### Stable identity and schema migration

- Increment the persisted schema version and migrate existing localStorage data in `afterHydrate`.
- Add stable IDs to the trip, each calendar day, stays, flights, activities, and day items. Preserve
  existing item IDs.
- Give each calendar day a movable `plan` payload containing its primary/secondary activity, note, and
  movable ideas. Keep date-fixed bookings separate and keyed by their actual ISO date.
- Add `setupMode` (`self`, `booked`, `guided`) and `seedStrategy` (`blank`, `template`, `generated`) to
  the committed trip. Keep questionnaire answers in a versioned setup draft unless the user chooses to
  retain them as a planning profile.
- Resolve a selected day from the route ID. Store UI selection only as a convenience, never as the
  canonical route state.
- Migrate old dining/fixed items conservatively: existing `fixed` items become date-fixed bookings;
  dining items with a booked state become date-fixed; ideas remain with the movable plan.

### Safe editing rules

- A one-tap assignment commits immediately and creates one reversible history entry.
- Note, booking, meal, stay, flight, and trip-detail forms edit a local draft. Save applies one atomic
  store action; Cancel discards it.
- Changing trip dates first shows days added, retained, and removed, plus affected stays, flights, and
  bookings. Removed content goes into a persisted recovery archive until the user clears it.
- Reapplying a template or generated starting shape always shows a preview and offers:
  `Fill unset days` (default) or `Replace movable plans`. Neither option deletes fixed bookings.
- Custom activities use stable IDs and remain available even when no current day uses them.

### Store boundary

Move persistence-facing operations behind a small repository interface while retaining Pinia for UI
state. Start with a localStorage implementation. The anonymous server-backed spike at the end of this
plan can then add a second implementation without rewriting components.

## Implementation slices

Each slice should be independently reviewable and leave the app usable. Run typecheck and production
build on every slice; add focused tests when persisted data or planning rules change.

### Slice 0 — benchmark the current workflow

Purpose: capture a baseline and stop subjective design debates from replacing observable results.

- Create three fixtures: a blank 14-day trip, a 17-day split-stay trip with flights and bookings, and a
  dense 21-day trip with park hopping, notes, warnings, and unset days.
- Record the current paths for assigning five days, moving from day 3 to day 15, adding a booking,
  fixing a wrong-park warning, changing dates, and exporting a share image.
- Record taps/clicks, editor opens, hidden gestures, data-loss risks, and whether the user can still see
  trip pacing while editing.
- Turn the findings into a short journey map in `docs/planning-flow-baseline.md` and retain the fixtures
  for browser tests and design review.

Exit gate: the baseline identifies the five largest problems and gives each later prototype the same
realistic data to use.

### Slice 1 — stable local model and recovery

Purpose: make later UI changes safe for current users and future persistence.

- Add the schema described above, a pure migration function, and real version-1 fixture tests.
- Add selectors by day ID/date so components stop passing array indexes as identity.
- Add atomic store commands and a one-step undo stack for assignments, clear, copy, and batch fill.
- Add date-change impact calculation and a recovery archive.
- Add the local repository interface without changing visible behaviour.
- Add compatibility handling so old links to `/day` land on the selected or first day in Plan once the
  new route exists.

Exit gate: old persisted trips hydrate without loss; a day URL survives refresh; shrinking and
re-expanding dates can restore removed content; migration and undo tests pass.

### Slice 2 — Overview and Plan workspace shell

Purpose: establish the new information architecture before rebuilding editing controls.

- Add clear `Overview` and `Plan` navigation at the trip level.
- Keep Overview grid-first and retain the grid/list toggle. Replace the long-press hint with visible
  actions and make any day cell or list row open Plan at that day.
- Build one shared `PlanDayCard` view model so mobile and desktop render the same information and rules.
- Wide layout: horizontal day cards/columns, scroll snap, sticky trip summary, keyboard left/right
  navigation, and a jump-to-day control.
- Mobile layout: sticky scrollable date rail, one selected-day panel, Previous/Next controls, and a
  persistent Next unset action. Selecting the rail scrolls the chosen date into view.
- Preserve focus when switching days and respect reduced motion.

Exit gate: on 360 px, 390 px, tablet, and desktop, users can jump from day 3 to day 15, inspect a dense
day, compare pacing, and return to the same selected day without two-axis mobile panning.

### Slice 3 — continuous planning editor

Purpose: let a user outline a 14–21 day holiday in one uninterrupted planning session.

- Replace `QuickAssignSheet` with an editor integrated into Plan: side panel on wide screens and bottom
  sheet/full panel on mobile.
- Put likely choices first: recent activities, activities already used in the trip, ticket-compatible
  choices, and rest/off-park. Keep a searchable grouped catalogue for everything else.
- Treat a second park as an explicit `Add park hopper` action.
- Add Previous, Next, and Next unset inside the editor. After assignment, remain in planning mode and
  optionally advance to the next unset day.
- Add Copy plan, Mark as rest day, Clear movable plan, and multi-select Fill selected days. Every batch
  action shows its scope and supports Undo.
- Show current trip counts, ticket limits, nearby park/rest pattern, and date-fixed anchors beside the
  decision rather than only in global alerts.

Exit gate: a blank 21-day trip can be outlined without reopening an editor for each day; touch, mouse,
and keyboard expose the same actions; scrolling from a day control never traps the page.

### Slice 4 — rich day detail, anchors, and warnings

Purpose: combine pacing and detailed planning without forcing the user into a disconnected page.

- Expand the selected Plan card/panel to show stays and changeovers, flights, fixed bookings, meals,
  movable ideas, note preview, and warnings in time order.
- Use explicit `Change day`, `Add booking`, `Add idea`, and `Edit details` actions.
- Show fixed items with a lock/date treatment and explain that moving the park plan will not move them.
- Make warnings actionable in place: wrong park, activity needs park hopper, travel-day collision,
  ticket-day overuse, and date outside the stay/booking range.
- Keep detailed forms staged. Closing with unsaved changes prompts to keep editing or discard.
- Deprecate the old standalone day UI after feature parity; retain a redirect for old URLs.

Exit gate: the 21-day fixture remains easy to scan, a dense day is readable, moving a plan does not move
bookings, and each warning opens the exact control needed to resolve it.

### Slice 5 — safe trip editing and starting-shape preview

Purpose: remove the remaining destructive and misleading behaviours before rebuilding onboarding.

- Convert `/edit` to a draft with Save and Cancel. Show saving state only when an actual save occurs.
- Add the date-impact review and recovery controls from Slice 1 to the UI.
- Replace direct template application with a full-trip preview, scope choice, and conflict summary.
- Correct long-trip generation so travel days occur only at the boundaries and patterns do not simply
  cycle into implausible consecutive park runs.
- Offer starting shapes from Overview/Plan for unset days, so they are useful after initial setup too.

Exit gate: cancelling edits makes no change; saving a shortened range cannot silently lose content;
starting shapes never erase fixed bookings and default to unset days only.

### Slice 6 — three-route setup flow

Purpose: get each kind of user to a useful Plan state with only relevant questions.

Build a persisted `TripSetupDraft` separate from the live trip. Every route uses Back, Continue, Skip
where safe, and a final review. Switching route keeps compatible answers and clearly identifies fields
that will not carry over.

#### 6A. Setup shell and self-directed route

- First screen: `I know what I'm doing`, `I have things booked`, or `Help me plan`.
- Self-directed asks only for name and dates before review.
- Tickets and starting shape are optional shortcuts. Blank remains the default.
- Commit the trip once at review, then open Plan on the first unset day.

#### 6B. Booked route

- Ask which facts exist, then show only relevant steps for dates, flights, stays, tickets, dining,
  tours/events, and other reservations.
- Store bookings with date and location even when they currently match the chosen park.
- Review summarises fixed anchors, conflicts, and remaining unset days.
- Commit anchors first; any suggested shape fills around them and cannot replace them.

#### 6C. Guided route

- Extend the existing date-window finder with party age bands, accessibility needs, trip length,
  must-do parks, thrill level, pace/rest preference, heat tolerance, priorities, and tickets.
- Ask a question only when its answer changes the recommendation. Explain the effect before continuing.
- Produce an editable planning brief with reasons and trade-offs before generating anything.
- Confirm exact dates, then preview the generated trip shape. Clearly label forecast confidence and
  avoid claiming one objectively best date.

Exit gate: the self-directed route reaches Plan with only name and dates; booked facts never need to be
re-entered; the guided route explains its assumptions; all routes can go back, resume, review, and
change direction without mutating an existing trip.

### Slice 7 — Social Share Studio

Purpose: turn useful trip images into a lightweight marketing loop for Orlando-planning communities,
especially Facebook groups.

The current `ShareCard` is a good technical proof, but its one fixed-height canvas can clip long or
dense trips and it exposes content without a deliberate privacy review. Replace it with a presenter +
renderer + export flow.

#### Share stories

Offer a small set of reasons people actually post in planning groups:

1. **My trip overview** — the complete park/rest shape and trip range.
2. **Week by week** — a readable multi-image set, seven days per image, including selected detail.
3. **How does this pacing look?** — overview plus an editable question and concise trip facts.
4. **Help me choose** — two selected days, parks, hotels, or date windows presented side by side.
5. **Countdown/update** — sleeps-to-go, planning progress, and the next useful milestone.

Ship the first three initially. Add Help me choose and Countdown after the core exporter is stable.

#### Output and layout

- Default to a 1080×1350 portrait feed card, which matches the current asset and reads well on mobile.
  Add 1080×1080 square as a secondary option. Treat 1080×1920 story output as later work.
- Use multiple numbered cards for long or detailed trips instead of shrinking text or clipping rows.
- Put the trip-specific content first. Add restrained Orlando Planner branding, the canonical site URL,
  and an optional QR code in the footer so the image still identifies the tool after reposting.
- Generate an accessible text caption from the same presenter, with an editable question and a short
  site link. Provide `Copy caption` because receiving apps may ignore shared text.
- Support sharing several files through the Web Share API when available. Fall back to clearly named
  individual downloads and keep a single-image download path for desktop.

#### Privacy review

- Before rendering, show exactly which fields will be included.
- Default to a generic title such as `Our Orlando trip`; make the real trip name opt-in.
- Never export confirmation numbers or raw free-text notes.
- Hide hotel names, flight routes/times, traveller details, and exact booking titles by default.
- Offer safe summary toggles such as `Split stay`, `Travel day`, `Dining booked`, and `Fixed event`.
- Keep the privacy defaults in code and test them; do not infer safety from whether a field is visible
  elsewhere in the app.

#### Export reliability and measurement

- Create pure share-presenter functions independent of Vue and `html-to-image`.
- Render local fonts or a deterministic system stack; wait for images/fonts before capture.
- Verify every output is the requested pixel size, has no overflow, and remains readable for 14-, 17-,
  and 21-day fixtures.
- Add visual-regression fixtures for each story and privacy combination.
- Record privacy-safe local events for story selected, preview generated, caption copied, native share
  opened, and file downloaded. Defer remote analytics consent and collection to a separate decision.

Exit gate: a 21-day trip exports without clipping; a user can preview every image, confirm its contents,
share/download it, and copy a useful caption; default output contains no sensitive booking details.

### Slice 8 — regression, accessibility, and pre-accounts release

Purpose: release the new journey as one coherent local-first product before persistence work expands its
failure modes.

- Add store tests for migration, stable identity, fixed versus movable data, undo, batch changes,
  date-range impact/recovery, setup commits, and starting-plan generation.
- Add browser smoke journeys for all three setup routes and for:
  setup -> review -> Plan -> assign five days -> add booking -> move plan -> reload same day -> share.
- Test 360 px, 390 px, tablet, and desktop; touch, keyboard, screen reader labels, focus return, reduced
  motion, and large text.
- Compare the benchmark tasks from Slice 0 and record the before/after result.
- Release behind a local feature flag first, migrate existing data without deleting the old key, then
  make the new flow default after recovery and export tests pass.

Exit gate: all acceptance criteria in the roadmap pass, the old local trip remains recoverable, and the
new workflow measurably reduces repeated editor opens and day-to-day navigation effort.

### Slice 9 — anonymous persistence foundation

Purpose: prove server-backed storage without crossing into accounts or collaboration.

- Finalise the D1/Drizzle schema for the data already shipped by Slices 1–8.
- Implement one repository-backed anonymous trip create/fetch/update path behind a feature flag.
- Use opaque, revocable, hashed edit capabilities; use a separate view capability if unlisted viewing
  is enabled. A random public URL must never grant edit access.
- Add optimistic revisions, idempotent creation, conflict responses, server-side validation, redaction,
  and an activity record for writes.
- Keep localStorage as a recoverable fallback and require a clear upload choice. Never delete local data
  after a failed or partial sync.
- Isolate local, preview, and production data and migrations. Prove migration rollback and app-version
  compatibility before enabling the feature.

Exit gate: one anonymous trip can be created, fetched, updated, recovered locally after failure, and
protected from unauthorised reads/writes. The feature remains off by default until operational checks
pass.

## Stop boundary: accounts and collaboration

After Slice 9, stop implementation and review the evidence. The next phase may design and build:

- sign-up, sign-in, sessions, recovery, OAuth, and account linking;
- claiming an anonymous/local trip;
- invitations and owner, travel-agent, editor, viewer, and admin permissions;
- edit history, presence, merge/conflict UI, comments, and real-time collaboration;
- multi-trip navigation and account settings.

The pre-accounts phase may prepare decision records and permission tests, but it must not create account
tables, authentication routes, invitation flows, role UI, or collaboration services.

## Suggested commit/PR sequence

1. Stable IDs, migration fixtures, repository boundary, and recovery archive.
2. Plan route, shared day-card model, and Overview-to-Plan navigation.
3. Responsive desktop board and mobile date rail/selected panel.
4. Continuous assignment editor, Next unset, Undo, and batch actions.
5. Rich day details, fixed anchors, staged forms, and actionable warnings.
6. Draft trip editing and safe starting-shape preview.
7. Setup shell plus self-directed route.
8. Booked route and fixed-anchor review.
9. Guided route and explained recommendation preview.
10. Share presenters, privacy model, and paginated card renderers.
11. Share Studio UI, native multi-file share/download, and caption flow.
12. Browser/accessibility/visual regression coverage and staged release.
13. Anonymous D1 repository spike behind a disabled feature flag.

Do not combine the data migration, all responsive layouts, all setup routes, and anonymous persistence
into one branch. The rollback tag protects the old product, while these smaller slices make the new
product reviewable before it reaches the accounts boundary.
