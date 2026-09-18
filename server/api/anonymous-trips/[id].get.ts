import { bearer, requireAnonymousDb, tokenHash } from '../../utils/anonymousTrips'

export default defineEventHandler(async (event) => {
  const db = requireAnonymousDb(event); const id = getRouterParam(event, 'id') ?? ''; const hash = await tokenHash(bearer(event))
  const row = await db.prepare('SELECT payload, revision FROM anonymous_trips WHERE id = ? AND deleted_at IS NULL AND (view_token_hash = ? OR edit_token_hash = ?)').bind(id, hash, hash).first<any>()
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Trip not found' })
  setHeader(event, 'ETag', String(row.revision)); return JSON.parse(row.payload)
})
