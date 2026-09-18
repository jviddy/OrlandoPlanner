import { bearer, enforceRateLimit, requireAnonymousDb, tokenHash } from '../../utils/anonymousTrips'

export default defineEventHandler(async (event) => {
  const db = requireAnonymousDb(event); await enforceRateLimit(event, db, 120); const id = getRouterParam(event, 'id') ?? ''; const hash = await tokenHash(bearer(event))
  const row = await db.prepare('SELECT payload, revision FROM anonymous_trips WHERE id = ? AND deleted_at IS NULL AND expires_at > ? AND (view_token_hash = ? OR edit_token_hash = ?)').bind(id, new Date().toISOString(), hash, hash).first<any>()
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Trip not found' })
  setHeader(event, 'ETag', String(row.revision)); return JSON.parse(row.payload)
})
