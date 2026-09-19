import { assertSameOrigin, requireAuthDb, requireSession } from '../../../utils/auth'
import { randomToken, tokenHash } from '../../../utils/anonymousTrips'

interface ClaimRow { id: string; trip_id: string; revision: number }

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const db = requireAuthDb(event)
  const { user } = await requireSession(event, db)
  const tripId = getRouterParam(event, 'id') ?? ''
  const body = await readBody(event)
  const claimToken = typeof body?.claimToken === 'string' ? body.claimToken : ''
  const now = new Date().toISOString()
  const claim = await db.prepare("SELECT c.id, c.trip_id, t.revision FROM claim_tokens c JOIN trips t ON t.id = c.trip_id WHERE c.trip_id = ? AND c.token_hash = ? AND c.used_at IS NULL AND c.revoked_at IS NULL AND c.expires_at > ? AND t.status IN ('anonymous', 'seeded') AND t.deleted_at IS NULL").bind(tripId, await tokenHash(claimToken), now).first<ClaimRow>()
  if (!claim) throw createError({ statusCode: 400, statusMessage: 'Claim link is invalid or expired', data: { code: 'invalid_claim' } })
  const membershipId = `membership-${randomToken()}`
  const results = await db.batch([
    db.prepare('UPDATE claim_tokens SET used_at = ?, used_by_user_id = ? WHERE id = ? AND used_at IS NULL AND revoked_at IS NULL').bind(now, user.id, claim.id),
    db.prepare("UPDATE trips SET status = 'owned', visibility = 'private', allow_anonymous_edit = 0, expires_at = NULL, updated_at = ?, revision = revision + 1 WHERE id = ? AND status IN ('anonymous', 'seeded') AND deleted_at IS NULL").bind(now, tripId),
    db.prepare("INSERT INTO trip_memberships (id, trip_id, user_id, role, created_at) SELECT ?, ?, ?, 'owner', ? WHERE EXISTS (SELECT 1 FROM claim_tokens WHERE id = ? AND used_at = ? AND used_by_user_id = ?)").bind(membershipId, tripId, user.id, now, claim.id, now, user.id),
    db.prepare("UPDATE trip_capabilities SET revoked_at = ? WHERE trip_id = ? AND kind = 'edit' AND revoked_at IS NULL").bind(now, tripId),
    db.prepare("INSERT INTO activity_log (trip_id, from_revision, to_revision, actor_user_id, actor_display_name, action, summary, created_at) SELECT id, ?, revision, ?, ?, 'claim', 'Trip claimed and anonymous editing locked', ? FROM trips WHERE id = ? AND revision = ?").bind(claim.revision, user.id, user.displayName, now, tripId, claim.revision + 1),
  ])
  if (!results[0]?.meta?.changes || !results[1]?.meta?.changes || !results[2]?.meta?.changes) {
    throw createError({ statusCode: 409, statusMessage: 'Trip could not be claimed', data: { code: 'claim_conflict' } })
  }
  return { tripId, revision: claim.revision + 1, role: 'owner' }
})
