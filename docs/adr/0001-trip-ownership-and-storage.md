# ADR 0001: trip ownership and storage

Status: accepted for the first backend release, 18 September 2026.

## Decisions

- The active `owner` row in `trip_memberships` is the only ownership source of
  truth. There will be no separately editable `trips.owner_user_id`.
- Planning content remains a versioned JSON payload through the first account
  and sharing releases. Relational tables own lifecycle, access, revisions,
  identity, and audit data.
- A trip ID is never a credential. View, edit, invitation, and claim secrets
  are separate, revocable, expiring capabilities stored only as hashes.
- Claiming preserves the trip ID and revision, creates the owner membership,
  revokes anonymous edit access, and makes the trip private in one D1 batch.
- Existing local trips upload only after an explicit user choice and retain a
  local recovery copy.

## Consequences

The first backend can reuse the repository payload without duplicating every
day, stay, flight, and activity in SQL. Whole-trip optimistic revisions remain
the collaboration boundary until product evidence justifies finer-grained
storage or merge semantics.
