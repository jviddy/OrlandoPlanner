# Backend & User Management Plan

Status: **proposal, not yet built.** The app today is 100% client-side — a single
trip lives in one browser's `localStorage`, there is no server, no accounts, no
sharing. This document lays out what changes to support multiple users, trip
ownership, sharing/collaboration, and sensitive data (reservation numbers etc.),
and a phased path to get there without a rewrite.

Decisions below are recommendations, not commitments — anywhere I picked a
specific answer to one of the open questions, it's called out under **Decision**
so it's easy to spot and overrule.

---

## 1. What a "trip" needs to support

Today: name, dates, hotels, tickets, flights, a day grid, and per-day dining /
fixed-time items (`app/types/trip.ts`). That data model doesn't change much —
what changes is that a trip stops being "the one thing in this browser" and
becomes a row that belongs to *someone*, that other people can be let into, and
that carries a few fields sensitive enough to hide from casual viewers.

New per-trip concepts:
- **Ownership** — who's the primary account behind this trip, if anyone yet.
- **Collaborators** — who else can see or edit it, and at what level.
- **Visibility** — can a bare link view it; can it be publicly featured.
- **Provenance** — was this seeded by admin from something like a Facebook
  post, created by a travel agent, or started from scratch.
- **Sensitive fields** — reservation/confirmation numbers, phone numbers on
  bookings, etc. — visible to editors and above, not to viewers.

## 2. User & role model

Two separate role concepts, and it's worth keeping them distinct:

- **Global role** on the *account* — `admin`, `agent`, `user`. Mostly about
  what the platform lets the account *do* (admin tooling, agent features like
  managing multiple clients' trips from one dashboard).
- **Trip role** — per-trip, on the membership row, not the account. What that
  *account* can do to *this trip*.

| Trip role | View | Edit days/items | Edit trip details (dates/name) | Manage sharing | See sensitive fields | Remove other members | Delete trip |
|---|---|---|---|---|---|---|---|
| **Owner** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (except `agent` members, see §3.2) | ✅ |
| **Agent** (persistent collaborator) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (except other agents) | ❌ |
| **Editor** | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Viewer** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Anonymous editor** (no account, name-only) | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| **Public / link viewer** (visibility = unlisted, no membership row) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

The bottom two rows aren't accounts at all — they're what an unlisted link
grants by default, matching how the app behaves today (anyone with the link
can get in). "Anonymous editor" is today's actual behaviour (§4 covers how
that gets phased in as a real trip type rather than the whole app's only mode).

## 3. Trip lifecycle, by your four cases

### 3.1 Registered user (the baseline case)

Create a trip → you're `owner`. You invite people by email or link, choosing
`editor` or `viewer`. You can change visibility (private / unlisted-link) and
revoke anyone except an `agent` member (see below). This is the whole loop for
most users and needs no special-casing.

### 3.2 Travel agent

An agent creates the trip → the agent account gets a permanent `agent`
membership row, separate from ownership. The agent then adds the client as
`owner` (or invites them to claim it, if the client doesn't have an account
yet — same flow as §3.4). Ownership can move to the client, get renamed,
whatever — the `agent` membership is independent of the `owner_user_id` field
and isn't touched by it.

**Decision:** an `agent` membership can only be removed by that agent
themselves or by a platform admin — not by the trip's owner. That's the whole
point of the ask ("retain access, even if they are no longer the owner"), but
it means a client can't unilaterally cut an agent out through the UI. If that
ever needs to be revocable by the client, it should be a support/dispute path,
not a button, so an agent's book of business isn't one accidental click away
from disappearing.

Global `agent` role likely wants a lightweight approval step (you flip it on
per-account) since it's the paid tier — not a self-serve checkbox on sign-up.

### 3.3 Admin-seeded marketing trips

You build a trip from something you saw in a Facebook group, tweak it, post a
screenshot with a soft link back to it. Two things this needs that a normal
trip doesn't:

- **No real owner yet.** `owner_user_id` is null. You (admin) can edit it, but
  you're not recorded as the trip's owner — more like a caretaker until
  someone claims it. Modeling this as "admin edits anything with no owner"
  (a permission, not a membership row) means you never show up as a
  collaborator on someone else's claimed trip afterwards, which is the
  "I no longer want to be an owner" requirement almost for free.
- **A claim mechanism.** Each such trip gets a claim link (distinct from its
  normal view link — e.g. `/t/<id>/claim/<token>`) that you put wherever the
  screenshot points. Opening it while logged in (or after a quick sign-up)
  shows "Claim this trip?" — confirming sets `owner_user_id` to that account
  and burns the token. From that point it's a completely normal owned trip:
  admin has no lingering access, and the new owner controls sharing exactly
  like §3.1.

**Decision:** claiming requires *some* account (sign-up or login), not just
typing a name — someone needs to be accountable for it afterwards, and it's
the one moment this system asks "are you sure this is yours?" I'd resist
trying to verify identity against the Facebook name (e.g. auto-matching);
worst case someone claims a trip that isn't theirs, which just means that one
marketing template got used and you make another. Store the Facebook
poster's display name as a cosmetic `source_attribution` note purely so the
claim screen can say "Is this your trip, [name]?" — not as a check.

### 3.4 Unregistered / anonymous trips

This is today's app, basically unchanged, plus a path off of it:

- Trip gets a random, unguessable ID the moment it's created — no sign-up.
- First edit prompts for a display name ("Editing as: ___"), stored in a
  cookie/localStorage, reused for every subsequent edit from that browser and
  attached to an activity-log entry — this is the "change tracking without an
  account" ask. It's an attribution label, not authentication; nothing stops
  someone from typing a different name next time.
- Anyone with the link can view *and edit* — no membership rows, this is the
  trip's baseline visibility, same as today.
- **Converting to owned.** A persistent "Claim this trip" affordance, same
  flow as §3.3: sign up or log in, confirm, `owner_user_id` gets set on the
  *same* record (no copy). Once claimed, the owner can tighten sharing (e.g.
  turn off anonymous public editing) if they want — but the link doesn't
  change, so anyone who already had it still resolves to the same trip.

**Decision (your "not sure if copy or ownership" question):** convert in
place, don't copy, and make that the only option here. Copying is a genuinely
different feature — a *new*, independent trip pre-filled from an existing one
— and it's more useful as something *anyone* can do to *any* visible trip
(next section), not specifically tied to "claiming" an anonymous one.

## 4. Sharing, visibility, and copies

Per trip:

- **Private** — only the owner + explicit members.
- **Unlisted** — anyone with the link can view (and, for still-anonymous
  trips, edit). Default for anonymous and admin-seeded trips; a reasonable
  default for new registered-user trips too, since it matches current
  behaviour and most people planning a family trip aren't worried about
  strangers finding a random UUID.
- **Public** *(later, not MVP)* — listed/discoverable, e.g. an admin "featured
  trips" gallery. Not needed to ship the rest of this; unlisted-with-a-link
  covers the marketing use case fine.

**Your "copies" question — decision: yes, and make it separate from
claiming.** Any trip whose visibility allows viewing gets a "Duplicate this
trip" action, available to anyone (including anonymous visitors, who'd then
need to claim *their new copy* to keep it beyond that browser session). It
creates a brand-new trip, independent from the moment it's created — editing
the copy never touches the original and vice versa. Add a per-trip
`allow_duplication` flag, defaulting **on**, so an agent can switch it off for
a private client itinerary they don't want getting cloned by whoever they
sent the link to.

So: **claim** = same record, ownership changes, only meaningful while a trip
has no owner. **Duplicate** = new record, always available (unless the owner
turns it off), the mechanism behind "share publicly and let people start from
what already exists."

## 5. Sensitive data (reservation numbers, etc.)

Once real bookings live in this thing (confirmation numbers, phone numbers on
a reservation, party size), a `viewer` or a public link shouldn't see them —
someone could use a confirmation number to modify or cancel a real booking
that isn't theirs.

- Add clearly-separated fields on the dining/fixed-time item and on a stay —
  e.g. `confirmationNumber`, `bookingPhone` — rather than stuffing them into
  the free-text note, so they can actually be access-controlled.
- **Field-level gating at the API, not just the UI.** When a trip is served to
  a `viewer` or an unauthenticated link visitor, the response strips those
  fields server-side before it ever reaches the browser — don't rely on the
  frontend to just hide them, since that leaks in the network tab.
- **Phase 2 hardening:** encrypt those specific columns at the application
  layer (envelope encryption, key in Workers Secrets) before writing to the
  database, so a raw data export or DB compromise doesn't hand out booking
  references in plaintext either. Not needed for MVP — access control first,
  encryption-at-rest for the sensitive columns as a follow-up.
- General PII hygiene: minimise what you store (email + display name is
  probably it), never log it in plaintext application logs, support account
  deletion, rate-limit auth endpoints, consider Cloudflare Turnstile on
  sign-up and on anonymous trip creation to keep bot spam down.

## 6. Data model sketch

Relational, sketched as tables (maps cleanly onto Cloudflare D1 — see §7).
Existing client types (`Day`, `DayItem`, `Stay`, `TicketDays`, `Flights` in
`app/types/trip.ts`) stay close to what they are now; this is what wraps
around them.

```
User
  id, email, display_name, global_role ('user'|'agent'|'admin'),
  auth_provider, auth_subject_id,   -- see §7, no password column if we go passwordless
  created_at, deleted_at

Trip
  id (public, random — not sequential),
  name, start_date, end_date,
  owner_user_id (nullable),
  visibility ('private'|'unlisted'|'public'),
  allow_duplication (bool, default true),
  duplicated_from_trip_id (nullable, for provenance),
  source_attribution (nullable text — "shared by X on Facebook"),
  status ('anonymous'|'claimed'|'archived'),
  created_at, updated_at, deleted_at

TripMembership
  trip_id, user_id, role ('owner'|'agent'|'editor'|'viewer'),
  invited_by_user_id, created_at
  -- owner_user_id on Trip is a convenience/derived pointer; the
  -- membership row is the actual ACL entry, including for the owner.

AnonymousEditor
  trip_id, display_name, device_token (cookie value), last_active_at
  -- attribution only, not auth

ClaimToken
  trip_id, token, created_by_user_id (nullable, admin-seeded case),
  expires_at, used_at, used_by_user_id

TripDay
  trip_id, date, park_id (nullable), note

DayItem
  day_id, kind ('dining'|'fixed'), title, time, state ('idea'|'booked'),
  park_id (nullable),
  confirmation_number (nullable, sensitive),
  booking_phone (nullable, sensitive)

Stay
  trip_id, name, start_date (nullable), end_date (nullable),
  confirmation_number (nullable, sensitive)

ActivityLog
  trip_id, actor_user_id (nullable), actor_anonymous_name (nullable),
  action, summary, created_at
  -- powers both "who changed what" for anonymous editors and a general
  -- audit trail agents/owners can review
```

## 7. Auth & infrastructure

The app already deploys to **Cloudflare Pages** with the `cloudflare-pages`
Nitro preset, which means Nuxt server routes (`server/api/*`) run as
Cloudflare Pages Functions today, at no extra infra cost. That points
straight at:

- **Cloudflare D1** (serverless SQLite) for everything in §6. Relational,
  cheap, same platform, no new vendor.
- **Sessions:** an HttpOnly, Secure, `SameSite=Lax` cookie holding an opaque
  token, looked up against a `Session` row in D1 (not a JWT) — opaque +
  DB-backed means a session can actually be revoked (log out everywhere,
  suspend an account) without waiting for a token to expire.

**Decision on sign-up method:** passwordless — **email magic link** as the
default, **Google OAuth** as a one-click alternative (worth adding Facebook
login too, given the target audience is literally coming from Facebook travel
groups). This sidesteps password storage almost entirely: no hashes to pick
an algorithm for, no reset-flow to build, no "someone reused a leaked
password" risk. It also keeps the ask — "sign up should be easy" — true by
construction rather than by extra UX work bolted onto a password form.

If a password option ever gets added later (e.g. an agent wants a "log in
without email round-trip" option), use Workers' native WebCrypto PBKDF2 (or a
maintained Argon2/scrypt WASM build) — never a bespoke hash.

## 8. Database implementation specifics

§6 says *what* the schema looks like and §7 says *D1* — this is the plumbing
around that, none of which exists yet (today's `wrangler.toml` has no D1
binding at all).

- **Schema management — Decision: Drizzle ORM + Drizzle Kit.** D1 support is
  first-class, it's TypeScript-first (matches the `strict: true` setup this
  project already has), and it generates versioned SQL migration files from
  the schema instead of hand-written ALTER TABLE statements. The alternative
  is raw SQL via D1's own prepared-statement API — simpler dependency-wise,
  but no type safety on queries and migrations become hand-rolled. Given how
  much of §6's schema will still be moving during Phase 1, the type safety is
  worth the dependency.
- **Migrations live in the repo**, e.g. `migrations/*.sql` generated by
  Drizzle Kit, applied with `wrangler d1 migrations apply` as a deploy step —
  schema changes get reviewed in a PR diff exactly like app code, not run by
  hand against production.
- **Local dev.** `wrangler d1 create orlando-planner-db` once, then bind it in
  `wrangler.toml`. The dev server already logs `Using cloudflare-dev
  emulation in development mode` (Nitro's Miniflare-backed dev mode), which
  emulates D1 locally against a SQLite file on disk — so `npm run dev` keeps
  working with no separate database process to run, no Docker, nothing extra
  to install.
- **Environments — Decision: one production D1 database, one shared preview
  database** for all Cloudflare Pages preview deployments (branch/PR builds),
  rather than a database-per-branch. Simpler to reason about at this scale;
  revisit and isolate further once there's real paying-agent data that a
  preview build shouldn't ever be able to touch.
- **Backups.** D1's built-in Time Travel (point-in-time restore, ~30-day
  window) covers "I broke something, restore to an hour ago" out of the box —
  no custom backup job needed for MVP. Worth adding a periodic export to R2
  once there's real user data, as a longer-retention belt-and-suspenders copy
  Time Travel's window doesn't cover.
- **Retention & deletion.** Every table with a `deleted_at` in §6 is a soft
  delete — "delete my account" or "delete this trip" sets that column and
  removes it from the app immediately, but a scheduled cleanup job
  hard-deletes (actually purges the row, including the sensitive fields from
  §5) after a grace period, e.g. 30 days. Gives you an undo window without
  keeping PII around indefinitely, which is the actual "right to erasure"
  ask, not just hiding a flagged row forever.

## 9. Migration path — don't do this as one big-bang rewrite

The current store (`app/stores/trip.ts`) is a single Pinia store, one trip,
localStorage-persisted, no network calls. Rough phases:

**Phase 0 — foundation (no user-visible change).**
Create the D1 database, wire up Drizzle + the migrations workflow from §8,
and add `server/api/trips/*`. Every trip — including today's
localStorage-only ones — gets synced to a server row the first time the app
loads post-upgrade (auto-create an anonymous trip from whatever's in
localStorage, keep editing it locally with the server as a write-through
cache). No accounts yet; this just stops the data being single-browser-only
and gives every trip the stable ID everything else in this doc hangs off of.

**Phase 1 — accounts + claiming.**
Sign-up/login (magic link + OAuth), the "claim this trip" flow for both
anonymous (§3.4) and admin-seeded (§3.3) trips, basic sharing (invite by
email/link as editor/viewer). This is the point where §5's field-level
gating has to exist, since viewers are now a real thing.

**Phase 2 — agents + duplication + hardening.**
Agent global role + persistent `agent` membership (§3.2), "Duplicate this
trip" (§4), activity log UI, encryption at rest for sensitive columns,
Turnstile on the open endpoints.

**Phase 3 — polish.**
Public/featured trips gallery for marketing, admin dashboard for managing
seeded trips and claim links in bulk.

Each phase ships independently and the app keeps working for existing users
the whole way through — nothing here requires taking the site down or forcing
a migration moment on anyone.

## 10. Open questions worth a decision before Phase 1

- **Agent verification:** self-serve toggle, or do you manually approve agent
  accounts? (Recommended: manual, at least initially — it's the paid tier and
  the one role with reduced-revocability privileges.)
- **Anonymous trip edit access after claim:** once claimed, does the owner
  have to explicitly re-enable "anyone with the link can still edit," or does
  claiming automatically lock editing down to invited members only? (Leaning
  toward: claiming locks it down by default — matches the mental model of
  "now someone owns this" — but worth confirming since it's a behaviour
  change for anyone else already mid-edit on that trip.)
- **Public gallery (Phase 3):** is this actually wanted, or does the
  marketing flow work fine off unlisted links alone? Affects whether "public"
  visibility needs to exist as more than a placeholder enum value.
- **Preview-environment isolation (§8):** is a single shared preview D1
  database acceptable for now, or is even test/preview data sensitive enough
  (e.g. once agents are testing with real client trips) to warrant isolating
  it sooner than "later, once there's real paying-agent data"?
