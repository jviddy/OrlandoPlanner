# Planning flow release evidence

Verified 18 September 2026 at the pre-accounts boundary.

## Automated checks

- `npm run typecheck`
- `npm test`
- `npm run build` using the Cloudflare Pages preset
- Disposable D1 forward migration and rollback, followed by an empty `anonymous_%` table query
- Built Worker/D1 API lifecycle: create, idempotent retry, rejected unknown capability, view access,
  rejected view-token write, edit update, stale revision conflict, revoke, and rejected post-revoke read

## Browser journeys

- Self-directed: name/dates -> Disney + Universal shape -> review -> Plan
- Booked-first: name/dates -> dining and event facts -> dated EPCOT dining anchor -> review -> Plan -> reload
- Guided: young family, relaxed pace, low thrill and heat tolerance, Disney/rest priorities -> explained
  recommendation -> review -> 14-day Plan. The generated plan placed travel at both ends and recovery
  days between park runs.
- Share Studio: overview, week, pacing, Help me choose, and countdown stories; portrait preview; generic
  title/privacy defaults; generated image availability and caption text
- Keyboard and screen-reader surfaces: named day buttons, selected-day semantics, modal focus containment
  and return, and labelled setup/share controls

## Release boundary

Local storage remains the default and preserves the legacy `orlando-trip` key during migration. The
anonymous D1 repository is deployed behind server and public flags that default to disabled. Accounts,
authentication, invitations, roles, and collaboration remain outside this release.
