import { describe, expect, it, vi } from 'vitest'
import { purgeExpiredAuthData } from '../server/utils/auth'
import type { D1DatabaseLike, D1RunResultLike, D1StatementLike } from '../server/utils/anonymousTrips'

function mockDb() {
  const calls: Array<{ query: string; bindings: unknown[] }> = []
  const statement: D1StatementLike = {
    bind(...values: unknown[]) {
      statement._bindings = values
      return statement
    },
    _bindings: [] as unknown[],
    async first() { return null },
    async all() { return { results: [], success: true } },
    async run(): Promise<D1RunResultLike> {
      calls.push({ query: (statement as any)._query, bindings: statement._bindings })
      return { success: true, meta: { changes: 0 } }
    },
  }
  const db: D1DatabaseLike = {
    prepare(query: string) {
      const stmt = { ...statement, _query: query, _bindings: [] as unknown[] }
      stmt.bind = function (...values: unknown[]) { stmt._bindings = values; return stmt }
      stmt.run = async function () {
        calls.push({ query: stmt._query, bindings: stmt._bindings })
        return { success: true, meta: { changes: 0 } }
      }
      return stmt
    },
    async batch(statements: D1StatementLike[]) {
      for (const s of statements) await s.run()
      return statements.map(() => ({ success: true, meta: { changes: 0 } }))
    },
  }
  return { db, calls }
}

describe('purgeExpiredAuthData', () => {
  it('issues cleanup queries for sessions, auth tokens, and capabilities', async () => {
    const { db, calls } = mockDb()
    const now = new Date('2026-09-18T12:00:00.000Z')
    await purgeExpiredAuthData(db, now)
    expect(calls).toHaveLength(3)
    // Session cleanup: expired or old revoked
    expect(calls[0].query).toContain('sessions')
    expect(calls[0].bindings[0]).toBe('2026-09-18T12:00:00.000Z')
    // Revoked session cutoff is 7 days before now
    expect(calls[0].bindings[1]).toBe('2026-09-11T12:00:00.000Z')
    // Auth token cleanup
    expect(calls[1].query).toContain('auth_tokens')
    // Capability revocation cleanup
    expect(calls[2].query).toContain('trip_capabilities')
    expect(calls[2].bindings[0]).toBe('2026-09-11T12:00:00.000Z')
  })
})
