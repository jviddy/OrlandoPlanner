# Backend Implementation Progress

Auto-updated checklist. If you lose context, read this file first.

Last updated: 19 September 2026 (Google OAuth route verified locally; moving from Direct Upload to Git-integrated Pages deployment)

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
- [ ] `/trips` list page with local vs server status — **UI not built**
- [ ] Trip-scoped routes (`/trips/:tripId/plan` etc.) — **UI not built**
- [ ] Upload/claim UI for existing local trips — **UI not built**
- [ ] Account/trip deletion UI — **UI not built**

## Phase 2 — ordinary sharing and collaboration

- [x] Invitations table (`migrations/0004_invitations.sql` + rollback)
- [x] Editor/viewer invitation creation (`POST /api/trips/:id/invitations`) — owner/agent only, auto-revokes previous for same email+role
- [x] Invitation acceptance (`POST /api/invitations/:token/accept`) — session required, prevents self-accept and duplicate membership
- [x] Revocable unlisted view/edit links (via existing capabilities system)
- [x] Server-side redaction for viewer/unlisted/public reads (`server/utils/tripRedaction.ts`)
- [x] Sensitive booking fields (`confirmationNumber`, `bookingPhone`, `partySize` — schema v3, rejected on anonymous trips, redacted for viewers)
- [x] Activity attribution (`actor_display_name` populated on all owned-trip mutations)
- [x] Revision-conflict compare/retry flow (`TripSyncPanel.vue` — fetches server version, shows diff table, keep-local/keep-server/cancel)
- [~] Google OAuth route implementation (`/api/auth/google/start` and callback) — source and local Cloudflare preview verified; repo pushed to `main` (`54030af`) and ready for the new Git-integrated Pages project; follow `docs/cloudflare-pages-git-worker-migration.md` to create the project and verify production OAuth

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
| GET | `/api/auth/google/start` | ✅ locally; production deployment blocked |
| GET | `/api/auth/google/callback` | ✅ locally; production deployment blocked |

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
| POST | `/api/trips/:id/capabilities` | ✅ |
| DELETE | `/api/trips/:id/capabilities/:capId` | ✅ |
| POST | `/api/trips/:id/claim-token` | ✅ |
| POST | `/api/trips/:id/claim` | ✅ |
| POST | `/api/trips/:id/invitations` | ✅ |
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
| `server/utils/tripAccess.ts` | `requireMemberTrip()` DB helper, `persistedDetailsSignature()` |
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
