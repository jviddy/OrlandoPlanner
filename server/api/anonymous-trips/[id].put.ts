import { bearer, enforceRateLimit, requireAnonymousDb, tokenHash, validateTripPayload } from '../../utils/anonymousTrips'

export default defineEventHandler(async (event) => {
  const db = requireAnonymousDb(event); await enforceRateLimit(event, db, 120); const id = getRouterParam(event, 'id') ?? ''; const expected = Number(getHeader(event, 'if-match'))
  if (!Number.isInteger(expected)) throw createError({ statusCode: 428, statusMessage: 'If-Match revision required' })
  const body = await readBody(event); validateTripPayload(body); const hash = await tokenHash(bearer(event)); const now = new Date().toISOString()
  const result = await db.prepare('UPDATE anonymous_trips SET payload = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND edit_token_hash = ? AND revision = ? AND deleted_at IS NULL AND expires_at > ?').bind(JSON.stringify({ ...body, tripId: id }), now, id, hash, expected, now).run()
  if (!result.meta?.changes) throw createError({ statusCode: 409, statusMessage: 'Trip changed or edit capability invalid' })
  await db.prepare('INSERT INTO anonymous_trip_activity (trip_id, revision, action, created_at) VALUES (?, ?, ?, ?)').bind(id, expected + 1, 'update', now).run()
  return { revision: expected + 1 }
})
