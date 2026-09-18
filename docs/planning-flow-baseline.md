# Planning-flow baseline

Measured against checkpoint `ec44122` on 17 September 2026. These are product/code-audit benchmarks,
not user-research results. Repeat the same tasks with observed users after the Plan workspace exists.

Fixtures live in `tests/fixtures/planningTrips.ts`: a blank 14-day trip, a booked 17-day split stay,
and a dense 21-day trip with notes, park hopping, fixed bookings, warnings, and unset days.

## Current journey map

| Screen | User's question | UI action offered | Friction or risk |
| --- | --- | --- | --- |
| New trip | How do I begin? | Enter all details, then continue to templates | Every user gets the same form and templates are mandatory |
| Templates | What should my trip look like? | Apply a template immediately | No full preview, scope choice, or safe reapplication |
| Overview grid | Is the trip paced well? | Tap to assign; long-press for detail | The detail route is hidden behind a gesture and hint below the trip |
| Overview list | What is planned each day? | Tap row to assign; separate arrow for detail | Two targets on one row have unexplained meanings |
| Quick assign | What happens on this date? | Choose up to two activities and close | Repeats for every day and hides the surrounding pace |
| Day page | What detail is attached to this day? | Previous/Next, notes, meals, fixed times | No direct jump or persistent URL; refresh loses the day |
| Edit trip | What facts or dates changed? | Fields update immediately; Done returns | Save semantics are misleading and removed dates get no impact review |
| Share | How can I show this plan? | Pick one fixed image mode and share/save | Dense/long plans can clip and there is no privacy review |

## Benchmark tasks

| Task | Current path | Baseline observation |
| --- | --- | --- |
| Assign five days | Grid day -> choose -> close, repeated five times | At least 15 deliberate actions and five editor openings; no Next unset |
| Jump from day 3 to day 15 | Open day 3, then press Next 12 times, or return and find day 15 | The detail page has no jump control and selection is only an array index |
| Add a booking | Find/open day -> Fixed times -> Add -> complete form -> save | The booking context is detached from whole-trip pacing |
| Find and fix a warning | Global alert -> Fix -> day page -> change day or edit item | The warning can reach the day, but not the exact conflicting control |
| Change dates safely | Edit -> change date range -> Done | Mutation is immediate; removed days are discarded with no preview/recovery |
| Share a 21-day plan | Share -> choose mode -> Share/Save | One 1080×1350 canvas uses overflow clipping rather than pagination |

## Ranked friction

1. Moving between days while retaining whole-trip context.
2. Seeing enough detail without leaving the pacing view.
3. Hidden or split interaction rules for assignment versus details.
4. Unsafe date/template changes and misleading save semantics.
5. One-size-fits-all setup and social output.

## Success measures for the replacement

- Five sequential assignments require one editor opening.
- Any day in a 21-day trip is reachable in two deliberate actions or fewer.
- No essential action depends on long-press, swipe, or explanatory help text.
- The selected day, neighbouring pace, fixed anchors, and relevant warnings remain visible together.
- Cancelling a form changes nothing; one-step changes offer Undo.
- Date and starting-shape changes preview their impact and preserve recoverable content.
- Share output paginates rather than shrinking below readable text or clipping content.

## After implementation

Code-audit and browser checks were repeated on 18 September 2026 against the completed pre-accounts
flow. These remain product benchmarks rather than observed-user research.

| Task | Implemented path | Result against baseline |
| --- | --- | --- |
| Assign five days | Plan -> Change day -> keep the editor open and use Next/Next unset, or batch-select days | One editor session replaces five separate opens; surrounding pace stays visible |
| Jump from day 3 to day 15 | Select the dated card/rail item in Plan | One deliberate selection rather than up to 12 Next presses |
| Add a booking | Selected Plan day -> + Booking -> Save | The selected day, neighbours, and warning context remain in the workspace |
| Find and fix a warning | Warning -> Fix -> targeted Plan control | The fix opens at the affected day and control |
| Change dates safely | Edit -> date preview -> Save, with recovery confirmation when needed | No immediate destructive mutation; removed content is recoverable |
| Share a 21-day plan | Share -> story/privacy review -> paginated preview -> share/download | Requested-size images are checked for overflow and pixel dimensions; long trips use numbered files |

The self-directed, booked-first, and guided setup routes were each run from start through review and
Plan in a browser. The booked route retained a dated EPCOT dining anchor across reload. The guided
route produced a 14-day recovery-first plan with travel at both boundaries and regular rest days. The
overview, week, pacing, comparison, and countdown share stories generated previews; privacy defaults
kept the real trip name and booking titles out of the output.
