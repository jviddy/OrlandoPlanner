# Backend Implementation Progress

Auto-updated checklist. If you lose context, read this file first.

Last updated: 20 September 2026 (production routing and Google OAuth verified after base-URL fix)

## Current production deployment

- [x] Git-integrated Cloudflare Pages project created: `orlando-planner-git`
- [x] Production URL: `https://orlando-planner-git.pages.dev`
- [x] GitHub repository/branch: `jviddy/OrlandoPlanner` / `main`
- [x] Latest production deployment: commit `cc3bd86`
- [x] Cloudflare compatibility: `nodejs_compat` with D1 binding `ORLANDO_DB`
- [x] Production D1 database: `orlando-planner-production`
- [x] Production migrations 0001–0004 applied and verified
- [x] Google OAuth client ID/secret configured as Cloudflare Production secrets
- [x] Google production callback registered:
      `https://orlando-planner-git.pages.dev/api/auth/google/callback`
- [x] Production Google sign-in tested end-to-end; user/session persisted in D1
- [x] Anonymous and authenticated API workers are responding in production
- [x] Removed the conflicting `NUXT_APP_BASE_URL` Pages variable that caused
      malformed redirects, desktop 431s, and mobile `__nuxt_error` downloads
- [x] `/trips` account page deployed and verified on `orlando-planner-git.pages.dev`
- [ ] Retire or redirect the old Direct Upload project
      `https://orlando-planner.pages.dev` — retain it as rollback until cutover
      is complete.

### Next deployment steps

- [x] Build the `/trips` account page; OAuth redirects there and the page now
      lists server/local trips and supports uploading local trips.
- [x] Build trip-scoped plan routes (`/trips/:tripId/plan`, etc.) so saved trips
      can be opened and edited. `/trips/:tripId`, `/trips/:tripId/plan`,
      `/trips/:tripId/edit`, and `/trips/:tripId/day` load the server trip and
      redirect to the corresponding planner view.
- [x] Complete upload/claim UI for local/anonymous trips. `/trips` supports
      uploading local trips; `TripSyncPanel` supports claiming anonymous trips
      to the signed-in account; `/trips` supports deleting owned trips.
- [x] Exercise authenticated trip create/list/update/delete against the
      production API through the new UI.
- [x] Make a small `main` commit to confirm the Git deployment pipeline.
- [ ] Configure remaining Cloudflare Pages secrets for production:
      `NUXT_RESEND_API_KEY`, `NUXT_AUTH_EMAIL_FROM`, `NUXT_GOOGLE_CLIENT_SECRET`,
      `NUXT_ANONYMOUS_CAPABILITY_SECRET`.
- [ ] Test logout, session expiry, capability links, invitations, and multi-trip
      behavior in the production browser flow.
- [ ] Decide on a final custom domain and add its Google OAuth callback URI.
- [ ] After UI and API acceptance, cut traffic over from the old project.
- [ ] Keep the old project available for one release window before deletion.

---

## Phase 0 — pre-accounts foundation

- [x] Stable IDs for trips, days, stays, flights, day items
- [x] Local repository migration from legacy `orlando-trip` key
- [x] Explicit upload UI (behind feature flag)
- [x] D1 bindings (preview + production)
- [x] Migration 0001 (anonymous trips) + rollback
- [x] Capability-protected anonymous CRUD (create, fetch, update, revoke)
- [x] Idempotent creation
- [x] Optimistic concurrency (If-Match / ETag)
- [x] Rate limiting on anonymous endpoints
- [x] Lifecycle verification (create, retry, read, update, conflict, revoke, read-after-revoke)
- [x] `docs/anonymous-sync-foundation.md` evidence document

## Phase 0.5 — make the foundation production-shaped

- [x] **ADR 0001**: Ownership and storage (owner-membership as single source of truth, hybrid payload, claim-in-place)
- [x] **ADR 0002**: Capability links and retention (URL fragment secrets, 180-day expiry, 30-day soft-delete, key versioning)
- [x] **ADR 0003**: Authentication (in-repo magic link, Resend, 15min tokens, 30-day sessions)
- [x] Central permission evaluator (`server/utils/tripPermissions.ts`)
- [x] Table-driven permission tests covering every actor in §3
- [x] Migration 0002 (canonical trips/capabilities/activity) + rollback
- [x] Migration 0003 (accounts: users, sessions, auth_tokens, memberships, claims) + rollback
- [x] Spike-to-canonical data migration in 0002
- [x] Shared persisted-payload validation (`app/utils/tripPayload.ts`) between client and server
- [x] Reject unknown/transient fields and size limits
- [x] Accurate capability copy (ADR 0002: "opaque, not encrypted")
- [x] Inactivity expiry (refreshes on every anonymous write)
- [x] Key rotation support (versioned secrets with previous-secret map)
- [x] Structured revision conflicts (409 with `revision_conflict` code + `currentRevision`)
- [x] Anonymous data purge (idempotency records, rate-limit buckets, expired/deleted trips)
- [x] `typecheck` in CI
- [x] Unit/authorization tests in CI
- [x] `db:verify` migration forward/rollback in CI
- [x] `build` in CI
- [x] Auth table cleanup (sessions, auth_tokens, revoked capabilities purge via `purgeExpiredAuthData`)
- [x] Apply migrations to remote preview D1 (all 4 applied, all tables verified)
- [x] Apply migrations to remote production D1 (all 4 applied, all tables verified)
- [x] Enable anonymous sync in controlled preview (env-specific secret + feature flags set)
- [x] Repeat full lifecycle check on remote preview (create, read, update, conflict, revoke, read-after-revoke — all passed)

## Phase 1 — accounts and claim vertical slice

- [x] Magic-link login (`POST /api/auth/magic-link`)
- [x] Magic-link verify (`POST /api/auth/verify`)
- [x] Session cookie management (`HttpOnly`, `Secure`, `SameSite=Lax`)
- [x] Session read (`GET /api/auth/session`)
- [x] Logout (`POST /api/auth/logout`)
- [x] Logout everywhere (`POST /api/auth/logout-all`)
- [x] Rate limiting on auth endpoints
- [x] Session revocation (database-driven, not JWT expiry)
- [x] Create owned trip (`POST /api/trips`)
- [x] List user's trips (`GET /api/trips`)
- [x] Get trip (`GET /api/trips/:id`)
- [x] Update trip with optimistic concurrency (`PUT /api/trips/:id`)
- [x] Delete/archive trip (`DELETE /api/trips/:id`)
- [x] Generate claim token (`POST /api/trips/:id/claim-token`)
- [x] Claim anonymous trip (`POST /api/trips/:id/claim`)
- [x] Editor-role detail-field gating (`persistedDetailsSignature`)
- [x] Trip activity log endpoint (`GET /api/trips/:id/activity`)
- [x] Create view/edit capability link (`POST /api/trips/:id/capabilities`)
- [x] Revoke capability link (`DELETE /api/trips/:id/capabilities/:capId`)
- [x] `/trips` list page with local vs server status — lists server trips and local trips; supports uploading local trips to the account
- [x] Trip-scoped routes (`/trips/:tripId/plan` etc.) — loader pages for
      `/trips/:tripId`, `/trips/:tripId/plan`, `/trips/:tripId/edit`, and
      `/trips/:tripId/day` implemented
- [x] Upload/claim UI for existing local trips — upload from `/trips`, claim
      from `TripSyncPanel`, delete from `/trips`
- [x] Account/trip deletion UI — trip delete button on `/trips`; account logout
      on `/trips`
- [x] New trips created while signed in become private owned trips automatically;
      subsequent changes use debounced, serialized cloud autosave with a local
      recovery copy, offline retry, and visible save status

## Phase 2 — ordinary sharing and collaboration

- [x] Invitations table (`migrations/0004_invitations.sql` + rollback)
- [x] Editor/viewer invitation creation (`POST /api/trips/:id/invitations`) — owner/agent only, auto-revokes previous for same email+role
- [x] List invitations (`GET /api/trips/:id/invitations`)
- [x] Revoke invitation (`DELETE /api/trips/:id/invitations/:inviteId`)
- [x] Invitation acceptance (`POST /api/invitations/:token/accept`) — session required, validates invitee email and prevents duplicate membership
- [x] Accept-invitation page (`/invitations/:token`)
- [x] List capability links (`GET /api/trips/:id/capabilities`)
- [x] Revocable unlisted view/edit links (via existing capabilities system)
- [x] Capability token consumption on trip loader pages (`/trips/:tripId#cap=...` and `Authorization: Bearer` header)
- [x] Sharing management UI (`TripSharingPanel.vue`) on `/edit` — explicit temporary anonymous view links, create/revoke owned view+edit links, and send/revoke email invitations
- [x] Invitation delivery through Resend; Google and magic-link authentication preserve the invitation/collaboration return path
- [x] Accepted-member list and removal (`GET /api/trips/:id/members`, `DELETE /api/trips/:id/members/:memberId`)
- [x] Viewer UI is read-only; editors can change the daily plan but cannot open trip-detail settings
- [x] Server-side redaction for viewer/unlisted/public reads (`server/utils/tripRedaction.ts`)
- [x] Sensitive booking fields (`confirmationNumber`, `bookingPhone`, `partySize` — schema v3, rejected on anonymous trips, redacted for viewers)
- [x] Activity attribution (`actor_display_name` populated on all owned-trip mutations)
- [x] Revision-conflict compare/retry flow (`TripSyncPanel.vue` — fetches server version, shows diff table, keep-local/keep-server/cancel)
- [x] Google OAuth route implementation (`/api/auth/google/start` and callback) — production sign-in completed successfully; session verified for the test account. Callback preserves a validated in-app return path.

## Phase 3 — agents, duplication, and hardening

- [ ] Agent removal/dispute policy — **open decision, blocks agent work**
- [ ] Manually approved agent accounts — **blocked on policy**
- [ ] Agent dashboards and persistent trip membership — **blocked on policy**
- [x] Trip duplication and provenance (`POST /api/trips/:id/duplicate`) — copies payload with new ID, sets `duplicated_from_trip_id`
- [ ] Encrypted sensitive booking fields — **depends on sensitive fields being added**
- [ ] Key rotation for encrypted fields — **depends on encryption**
- [ ] Turnstile — **depends on abuse data**
- [x] Backup/export (`GET /api/trips/:id/export`) — returns full payload as JSON download

## Phase 4 — optional marketing/admin features

- [ ] Admin-seeded trip tooling and claim-link management
- [ ] Public/featured trip gallery (only if unlisted links insufficient)
- [ ] Bulk support/operations tools with audited access

---

## Summary of all server routes

### Auth (`/api/auth/`)
| Method | Route | Status |
|--------|-------|--------|
| POST | `/api/auth/magic-link` | ✅ |
| POST | `/api/auth/verify` | ✅ |
| GET | `/api/auth/session` | ✅ |
| POST | `/api/auth/logout` | ✅ |
| POST | `/api/auth/logout-all` | ✅ |
| GET | `/api/auth/google/start` | ✅ production 302 verified |
| GET | `/api/auth/google/callback` | ✅ production callback creates a D1-backed session |

### Anonymous trips (`/api/anonymous-trips/`)
| Method | Route | Status |
|--------|-------|--------|
| POST | `/api/anonymous-trips` | ✅ |
| GET | `/api/anonymous-trips/:id` | ✅ (with redaction) |
| PUT | `/api/anonymous-trips/:id` | ✅ (sensitive field rejection) |
| DELETE | `/api/anonymous-trips/:id` | ✅ |

### Owned trips (`/api/trips/`)
| Method | Route | Status |
|--------|-------|--------|
| POST | `/api/trips` | ✅ |
| GET | `/api/trips` | ✅ |
| GET | `/api/trips/:id` | ✅ (with redaction) |
| PUT | `/api/trips/:id` | ✅ |
| DELETE | `/api/trips/:id` | ✅ |
| GET | `/api/trips/:id/activity` | ✅ |
| GET | `/api/trips/:id/export` | ✅ |
| GET | `/api/trips/:id/capabilities` | ✅ |
| POST | `/api/trips/:id/capabilities` | ✅ |
| DELETE | `/api/trips/:id/capabilities/:capId` | ✅ |
| POST | `/api/trips/:id/claim-token` | ✅ |
| POST | `/api/trips/:id/claim` | ✅ |
| GET | `/api/trips/:id/invitations` | ✅ |
| POST | `/api/trips/:id/invitations` | ✅ |
| DELETE | `/api/trips/:id/invitations/:inviteId` | ✅ |
| GET | `/api/trips/:id/members` | ✅ |
| DELETE | `/api/trips/:id/members/:memberId` | ✅ |
| POST | `/api/trips/:id/duplicate` | ✅ |

### Invitations (`/api/invitations/`)
| Method | Route | Status |
|--------|-------|--------|
| POST | `/api/invitations/:token/accept` | ✅ |

## Summary of server utilities

| File | Purpose |
|------|---------|
| `server/utils/anonymousTrips.ts` | D1 types, token hashing, HMAC capabilities, rate limiting, expiry, purge, payload validation |
| `server/utils/auth.ts` | Session management, magic-link delivery, rate limiting, origin checking, auth purge |
| `server/utils/tripPermissions.ts` | Central permission evaluator (pure function, table-driven) |
| `server/utils/tripAccess.ts` | `requireMemberTrip()`, `requireAccessibleTrip()` (member + capability token), `persistedDetailsSignature()` |
| `server/utils/tripRedaction.ts` | `redactTripPayload()`, `redactionTarget()` — server-side field redaction |

## Summary of migrations

| Migration | Tables | Rollback |
|-----------|--------|----------|
| 0001 | anonymous_trips, anonymous_trip_creations, anonymous_trip_activity, anonymous_rate_limits | ✅ |
| 0002 | trips, trip_capabilities, idempotency_records, activity_log, rate_limit_buckets | ✅ |
| 0003 | users, auth_identities, sessions, auth_tokens, trip_memberships, claim_tokens | ✅ |
| 0004 | invitations | ✅ |

## Open decisions (from BACKEND_PLAN.md §11)

1. **Auth implementation and email delivery** — settled in ADR 0003 (in-repo, Resend)
2. **Anonymous retention** — 180 days since last successful write (working decision)
3. **Agent removal/disputes** — OPEN, blocks Phase 3 agent work only
4. **Agent commercial approval** — OPEN, blocks Phase 3 agent work only
5. **Public gallery** — OPEN, blocks Phase 4 gallery only
