# Backend & User Management Plan

Updated 18 September 2026 after the pre-accounts planning release and the
anonymous-persistence spike.

Status: **foundation built and disabled; accounts and collaboration not built.**
The app still uses `localStorage` by default and does not upload a trip without
an explicit choice. A repository boundary, stable IDs, two D1 environments, an
anonymous-trip API, capability checks, optimistic revisions, validation, and
write activity records now exist behind feature flags. The next backend work is
to turn that spike into the canonical trip service, then add the smallest useful
account-and-claim vertical slice.

This document is now the implementation plan. “Working decision” means use that
answer unless product review changes it. “Open decision” means do not build the
affected feature until it is resolved.

---

## 1. Current baseline

### Shipped locally

- `TripState` has schema version 2 and stable IDs for trips, days, stays,
  flights, and day items. It now includes setup/seed provenance, up to three
  activities per day, custom activities, movable versus date-fixed items, split
  stays, multiple flights, safe date-change recovery, and the Plan workflow.
- `LocalTripRepository` stores trips under `orlando-trip-v2:<tripId>` and keeps
  `orlando-trip-v2:current`. Migration from the legacy `orlando-trip` key keeps
  the old value as a rollback copy.
- Only persisted trip fields cross the repository boundary. Transient UI state
  such as the selected day, open sheet, recent choices, and Undo is not synced.
- `AnonymousTripRepository` and `/api/anonymous-trips/*` support create, fetch,
  update, and revoke. Creation is idempotent; updates require `If-Match`; view
  and edit capabilities are separate; only SHA-256 token hashes are stored.
- Server-side flags and public UI flags both default to `false`. When enabled,
  Trip settings offers an explicit upload, manual sync, failure recovery copy,
  and revoke action. There is no silent migration or background upload.
- Migration `0001_anonymous_trips.sql` and its rollback exist. Separate
  `orlando-planner-preview` and `orlando-planner-production` D1 databases are
  bound as `ORLANDO_DB`, and the migration has been applied to both.
- A local Worker/D1 lifecycle check has covered create, idempotent retry,
  unauthorized read, separate view/edit access, update, revision conflict,
  revoke, and read-after-revoke. See
  [`docs/anonymous-sync-foundation.md`](./docs/anonymous-sync-foundation.md).

### Not built

- Accounts, authentication, sessions, account recovery, or account linking.
- A trip list or account-scoped multi-trip navigation.
- Claiming, invitations, memberships, share-link management, or role UI.
- Cross-device capability recovery or actual view/edit link routes.
- Conflict resolution beyond returning an error and retaining the local copy.
- Sensitive booking fields, API redaction, encryption of those fields, or a
  retention cleanup job.
- Agent/admin tooling, duplication, or a public gallery.

### Known spike gaps to close before enabling it

- The UI says capabilities are “encrypted”; they are opaque tokens stored in
  `localStorage`, not encrypted. Correct the copy and document the XSS risk.
- Anonymous rows expire 180 days after creation, even if actively updated.
  Choose and implement an inactivity-based policy plus expiry warnings.
- Secret rotation breaks deterministic capability re-derivation for an old
  idempotency key. Add a capability key version/keyring or another rotation-safe
  replay design before relying on this in production.
- Validation checks size and the broad day/item shape, not the complete shared
  `TripState` schema. Unknown and transient fields must not be persisted.
- Rate-limit buckets and expired/soft-deleted trips have no purge process.
- CI currently builds only; it does not run typecheck, tests, or migration
  forward/rollback checks.

## 2. Non-negotiable guardrails

1. **Local-first migration.** Existing local trips remain usable until a server
   write succeeds, and the local recovery copy is never silently deleted.
2. **Explicit upload.** No existing trip is sent to the server merely because a
   user opened the upgraded app or created an account.
3. **Server-enforced authorization.** The API checks every read and mutation.
   Hiding a control in Vue is not authorization.
4. **Separate capabilities.** A trip ID is an identifier, never a credential.
   View, edit, invitation, and claim secrets are distinct, expiring, revocable,
   and stored only as hashes.
5. **Safe defaults.** Owned trips start private. Claiming locks anonymous edit
   access unless the new owner deliberately creates a new edit link.
6. **Optimistic concurrency.** Every write supplies the revision it read. A
   stale write never silently overwrites newer server data.
7. **No sensitive data in anonymous-edit trips.** Until account permissions,
   server redaction, and encryption exist, confirmation numbers and similar
   fields must not be accepted or stored.
8. **Environment isolation.** Local, preview, and production data and secrets
   stay separate. Preview must never point at production D1.
9. **Auditable privilege.** Ownership transfer, agent access, invitations,
   capability creation/revocation, claims, and admin support access create
   activity records.

## 3. Ownership and permission model

There are two independent role layers:

- A global account role: `user`, `agent`, or `admin`.
- A per-trip membership role: `owner`, `agent`, `editor`, or `viewer`.

**Working decision — one source of ownership truth:** the single `owner`
`TripMembership` row is authoritative. Do not also add an independently editable
`Trip.owner_user_id`. Anonymous/admin-seeded trips have no owner membership.
Claim and ownership transfer run as transactions, and a partial unique index
enforces at most one active owner per trip.

| Actor | View | Edit plan | Edit trip details | Manage sharing | Sensitive fields | Transfer ownership | Delete |
|---|---:|---:|---:|---:|---:|---:|---:|
| Owner | yes | yes | yes | yes | yes | yes | yes |
| Agent member | yes | yes | yes | yes | yes | no | no |
| Editor | yes | yes | no | no | yes | no | no |
| Viewer | yes | no | no | no | no | no | no |
| Anonymous edit capability | yes | yes | yes | no | no | no | revoke only |
| Anonymous view capability | yes | no | no | no | no | no | no |
| Unlisted viewer | yes | no | no | no | no | no | no |
| Admin, ownerless trip | yes | yes | yes | claim/share setup | n/a | no | yes |
| Admin, owned trip | no by default | no | no | no | no | no | no |

An `admin` does not automatically become a visible trip member. Admin-seeded,
ownerless trips can be managed through an audited admin permission. Access to an
owned trip should be an explicit, logged support action rather than an invisible
standing permission in the normal UI.

**Open decision — agent removal:** the earlier plan made agent memberships
permanent except for self-removal or an admin dispute path. That is unusually
powerful. Decide and disclose the policy before agent support is built. It does
not block ordinary owner/editor/viewer work.

**Working decision — agent approval:** the global `agent` role is manually
approved initially; it is not selected during self-service sign-up.

## 4. Trip lifecycles

### Registered user

A signed-in user creates or explicitly uploads a trip and receives its owner
membership. The trip is private by default. They can create viewer/editor
invitations and unlisted view links, revoke them, or transfer ownership.

### Anonymous trip

The current capability model remains the pre-account route:

- The trip has a random stable ID, but the ID alone grants nothing.
- The creating device receives distinct edit and view capabilities.
- A view link carries only a view capability. Editing is available only when
  somebody deliberately shares an edit capability.
- Put capability secrets in the URL fragment, not the path/query, then have the
  client exchange/use them in an `Authorization` header. This avoids routine
  server logs and referrer headers capturing the secret.
- An optional display name can attribute anonymous writes, but is not identity
  or authentication.

### Claiming an anonymous or admin-seeded trip

**Working decision:** claim in place; do not copy. The public trip ID and payload
revision survive. Claiming requires a verified account and atomically:

1. verifies and burns the one-use claim token;
2. creates the owner membership;
3. changes the trip from `anonymous`/`seeded` to `owned`;
4. revokes all anonymous edit capabilities;
5. makes the trip private unless the new owner explicitly chooses otherwise;
6. records the claim and revocations in the activity log.

Claim tokens are different from ordinary view/edit links. A cosmetic source
attribution such as a Facebook display name may appear on the confirmation
screen, but it is not identity verification.

### Travel-agent trip

An approved agent creates the trip and gets an `agent` membership. The client
claims or accepts ownership separately, so ownership changes do not accidentally
remove the agent membership. Agent-specific behaviour belongs after ordinary
accounts, claiming, and invitations are proven.

### Duplication

Claiming and copying stay separate:

- **Claim** changes ownership of the existing trip.
- **Duplicate** creates an independent trip with a new ID and records
  `duplicated_from_trip_id` for provenance.

Duplication is allowed only when the source is viewable and
`allow_duplication = true`. It is not part of the first account slice.

## 5. Sharing and visibility

- `private`: active members and valid invitation/claim flows only.
- `unlisted`: anyone holding a valid, revocable view capability can read the
  redacted representation. The bare trip URL is still not a credential.
- `public` *(future)*: discoverable and eligible for a gallery. Do not add it to
  the persisted enum or user-facing controls until the gallery is explicitly
  approved.

Owned trips default to `private`; anonymous and admin-seeded trips can create
unlisted view links. Link access and membership access pass through the same
central permission evaluator so individual endpoints cannot drift.

Invitations are one-use, role-specific, email-bound where applicable, expiring,
and revocable. Accepting an invitation requires login so the membership attaches
to a real account. Never put reusable bearer tokens into email analytics URLs.

## 6. Sensitive booking data

Sensitive fields do not exist in `TripState` yet. When they are introduced:

- Give them structured fields such as `confirmationNumber`, `bookingPhone`, and
  `partySize`; never rely on a free-text note for access control.
- Reject them on anonymous-edit trips.
- Redact them in the API serializer for viewer, unlisted, and public reads. Test
  every read route, including duplication, activity summaries, exports, and
  error payloads.
- Encrypt sensitive values at the application layer with a versioned Workers
  secret before storing them. A key ID on each encrypted value must support key
  rotation without a big-bang rewrite.
- Never place sensitive values in logs, analytics, share images, notification
  text, or activity summaries.

Access control and redaction must land before the UI starts collecting these
fields. Encryption, deletion, and recovery procedures must land before a
production release containing real booking data.

## 7. Canonical data model

Use a **hybrid model** for the first backend release. Relational tables own
identity, access, lifecycle, revision, and audit data. The existing persisted
`TripState` remains one versioned JSON payload. This matches the repository spike
and avoids maintaining a second relational representation of days, flights,
stays, recovery data, and custom activities while those features are still
changing.

Normalize individual planning entities later only when query/reporting or
collaborative merge requirements justify it. Sensitive booking values may be
split into encrypted records sooner so redaction cannot accidentally serialize
them with public trip data.

```text
User
  id, email, display_name, global_role, email_verified_at,
  created_at, updated_at, deleted_at

AuthIdentity
  id, user_id, provider, provider_subject, created_at
  unique(provider, provider_subject)

Session
  id, user_id, token_hash, expires_at, last_seen_at, revoked_at, created_at

AuthToken
  id, email, purpose, token_hash, expires_at, used_at, created_at

IdempotencyRecord
  key_hash, scope, resource_id, capability_key_version,
  response_revision, expires_at, created_at

Trip
  id, status ('anonymous'|'seeded'|'owned'|'archived'),
  visibility ('private'|'unlisted'),
  payload_schema_version, payload_json, revision,
  allow_anonymous_edit, allow_duplication,
  duplicated_from_trip_id, source_attribution,
  expires_at, created_at, updated_at, deleted_at

TripMembership
  trip_id, user_id, role ('owner'|'agent'|'editor'|'viewer'),
  invited_by_user_id, created_at, revoked_at
  unique active membership per (trip_id, user_id)
  unique active owner per trip

TripCapability
  id, trip_id, kind ('view'|'edit'), token_hash, key_version,
  created_by_user_id, expires_at, last_used_at, revoked_at, created_at

Invitation
  id, trip_id, email, role ('editor'|'viewer'), token_hash,
  invited_by_user_id, expires_at, accepted_by_user_id,
  accepted_at, revoked_at, created_at

ClaimToken
  id, trip_id, token_hash, created_by_user_id,
  expires_at, used_by_user_id, used_at, revoked_at, created_at

ActivityLog
  id, trip_id, from_revision, to_revision,
  actor_user_id, actor_capability_id, actor_display_name,
  action, summary, created_at

RateLimitBucket
  bucket_hash, scope, requests, window_started_at, updated_at
```

The JSON contract is the output of `migratePersistedTrip`, not raw Pinia state.
It includes the current planning fields and excludes transient UI fields. The
server must validate/migrate it using the same schema rules as the client before
storage and again before returning it.

### Evolution from migration 0001

Before accounts are exposed, add a migration that creates the canonical `trips`,
`trip_capabilities`, and `activity_log` shape and copies any spike rows while
preserving trip IDs, revisions, payloads, token hashes, and timestamps. Keep the
old `/api/anonymous-trips/*` contract as a short compatibility adapter during the
flagged preview, then remove it before public enablement. Because the spike is
still disabled, this is the cheapest point to establish one trip table rather
than maintain parallel anonymous and owned stores.

## 8. API and authentication contract

### Trip endpoints

The target resource family is:

```text
POST   /api/trips
GET    /api/trips
GET    /api/trips/:tripId
PUT    /api/trips/:tripId
DELETE /api/trips/:tripId
POST   /api/trips/:tripId/claim
GET    /api/trips/:tripId/activity

POST   /api/trips/:tripId/capabilities
DELETE /api/trips/:tripId/capabilities/:capabilityId
POST   /api/trips/:tripId/invitations
POST   /api/invitations/:token/accept
```

Create operations use an idempotency key. Mutations use `If-Match` and return
the new revision/ETag. For an authorized writer, a stale revision returns a
structured `409 revision_conflict`; invalid or revoked credentials do not reveal
whether a trip exists. The client must offer reload/compare/retry and retain its
local draft. Do not turn on background autosave until that conflict path works.

Central helpers perform authentication, trip lookup, capability verification,
permission evaluation, payload validation/migration, redaction, and activity
logging. Endpoint files should not reimplement those rules.

### Authentication

**Working decision:** passwordless email magic link first. Add Google OAuth only
after the email/session/claim path works end to end; Facebook OAuth is a later
product decision. Do not add passwords in the first release.

- Sessions use a high-entropy opaque token in an `HttpOnly`, `Secure`,
  `SameSite=Lax` cookie; only its hash is stored in D1.
- Magic-link and OAuth state tokens are one-use, short-lived, hashed, rate
  limited, and protected against open redirects and account enumeration.
- Mutating cookie-authenticated routes validate the request origin. OAuth uses
  state and PKCE where the provider supports it.
- Session revocation, “log out everywhere,” disabled accounts, and account
  deletion are database operations, not JWT-expiry workarounds.
- Account linking requires an authenticated user action. Do not silently merge
  identities solely because two providers return the same unverified email.

**Open decision blocking auth implementation:** choose the auth library/build
versus a small in-repo implementation, the transactional email provider, token
and session lifetimes, recovery behaviour, and the initial OAuth provider. Prove
the chosen stack in the Cloudflare Pages runtime before committing the schema.

### Routes and navigation

**Working decision:** introduce `/trips` and `/trips/:tripId/plan` (plus child
settings/share routes) rather than continuing to infer one current trip from
global state. Preserve redirects from today’s `/`, `/plan`, and `/edit` routes
during migration. A local-only trip can appear alongside server trips with a
clear “On this device” status.

## 9. D1, migrations, and operations

- Continue the approach already proven: reviewed SQL migrations in
  `migrations/` and typed wrappers around D1 prepared statements. Do **not** add
  Drizzle merely to match the old proposal. Reconsider an ORM only if the query
  surface becomes costly to maintain.
- Add explicit package scripts for local, preview, and production migration
  list/apply commands. Production application is a deliberate release step,
  never an implicit side effect of a preview deploy.
- Every migration needs a compatibility note and, where SQLite permits, a
  rollback or forward-recovery script. Apply it to a disposable local database
  in CI before either shared environment.
- Keep preview and production bindings and secrets distinct. Preview contains
  synthetic test trips only once sensitive fields exist.
- Add cleanup for expired auth tokens, sessions, capabilities, rate-limit
  buckets, anonymous trips, and soft-deleted records. Proposed policy: anonymous
  expiry is 180 days after the last successful write; soft-deleted owned data is
  purged after a 30-day recovery window. Confirm both before enablement.
- Document D1 restore and export procedures, capability-secret rotation,
  incident revocation, and account/trip deletion. Test restore before depending
  on it.
- Keep PII and bearer secrets out of application logs. Use request IDs and
  actor/resource IDs for support diagnostics.

## 10. Delivery plan

### Phase 0 — pre-accounts foundation (complete, feature disabled)

Stable IDs, local repository migration, explicit upload UI, D1 bindings,
migration/rollback, capability-protected anonymous CRUD, idempotent creation,
optimistic revisions, rate limiting, and lifecycle verification are complete.

### Phase 0.5 — make the foundation production-shaped (next)

This is the immediate next slice.

1. Record the ownership, claim-lockdown, capability-link, hybrid-payload, and
   auth-stack decisions as short ADRs or settled sections of this plan.
2. Add a central operation-level permission evaluator and table-driven tests for
   every actor in §3.
3. Replace the spike tables with the canonical trip/capability/activity schema
   through a tested migration and compatibility adapter.
4. Share strict persisted-payload validation between client and server; reject
   unknown/transient fields and sensitive fields on anonymous trips.
5. Close the known gaps in §1: accurate capability copy, inactivity expiry,
   key rotation, cleanup, and structured revision conflicts.
6. Add `typecheck`, unit/authorization tests, build, and migration
   forward/rollback checks to CI.
7. Enable anonymous sync only in a controlled preview with an environment-
   specific secret, repeat the full lifecycle check, and keep production off.

Exit gate: the preview can create, fetch, update, conflict, revoke, expire, and
purge an anonymous trip without data loss; unauthorized operations and every
permission-matrix denial have automated coverage; rollback/recovery is written
down and rehearsed.

### Phase 1 — accounts and claim vertical slice

- Implement magic-link login, opaque sessions, logout, and session revocation.
- Add `/trips` plus trip-scoped routes and show local versus server status.
- Let a verified user explicitly upload/claim one existing local or anonymous
  trip in place.
- Enforce the claim transaction and lockdown rules in §4.
- Add account/trip deletion and minimum activity history for claim/security
  events.

Do not add invitations or agent behaviour yet.

Exit gate: a new user can sign in, claim a trip without changing its ID or
losing local recovery, open it on a second device, sign out/revoke sessions, and
cannot use the old anonymous edit capability after claim.

### Phase 2 — ordinary sharing and collaboration

- Add editor/viewer invitations and revocable unlisted view/edit links.
- Add server-side redaction and permission tests before collecting sensitive
  booking fields.
- Add activity attribution and a usable revision-conflict compare/retry flow.
- Add Google OAuth and safe account linking if still wanted.

Real-time presence, CRDTs, comments, and live cursor collaboration are not part
of this phase; revision-safe whole-trip writes are sufficient initially.

### Phase 3 — agents, duplication, and hardening

- Add manually approved agent accounts after the removal/dispute policy is
  settled.
- Add agent dashboards and persistent trip membership with explicit disclosure.
- Add trip duplication and provenance.
- Add encrypted sensitive booking fields, key rotation, Turnstile where abuse
  data justifies it, and longer-retention backup/export procedures.

### Phase 4 — optional marketing/admin features

- Admin-seeded trip tooling and claim-link management.
- Public/featured trip gallery, only if unlisted links are insufficient.
- Bulk support/operations tools with audited access.

Each phase must ship independently, preserve local recovery, and keep later
privileges out of earlier schemas and UI until their policies are settled.

## 11. Decisions still needed

Only the first item blocks the immediate account work; the others can wait for
their phase.

1. **Auth implementation and email delivery:** library or in-repo flow, email
   provider, token/session lifetimes, recovery, and initial OAuth scope.
2. **Anonymous retention:** confirm 180 days since last successful write and the
   warning/recovery experience before expiry.
3. **Agent removal/disputes:** whether the owner can revoke an agent and what
   admin/support process exists.
4. **Agent commercial approval:** who can approve the role and how entitlement
   is removed when a plan ends.
5. **Public gallery:** whether it is actually needed beyond unlisted sharing.

## 12. Definition of done for backend changes

A backend slice is not complete until:

- authorization and redaction are tested at the API boundary;
- legacy and current local fixtures survive migration and failure;
- typecheck, tests, build, and disposable migration checks pass in CI;
- preview and production bindings/secrets are proven distinct;
- forward migration, rollback/forward-recovery, and app-version compatibility
  are documented;
- logs contain no raw bearer tokens or sensitive booking data;
- the feature is exercised in preview before any production flag changes; and
- production enablement is a separate, explicit decision.
