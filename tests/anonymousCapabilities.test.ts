import { describe, expect, it } from 'vitest'
import { capabilityToken, tokenHash } from '../server/utils/anonymousTrips'

describe('anonymous trip capabilities', () => {
  it('derives stable, separate edit and view capabilities without storing the secret', async () => {
    const edit = await capabilityToken('server-only-secret', 'request-1:edit')
    const view = await capabilityToken('server-only-secret', 'request-1:view')
    expect(edit).not.toBe(view)
    expect(edit).toBe(await capabilityToken('server-only-secret', 'request-1:edit'))
    expect(edit).not.toContain('server-only-secret')
    expect(await tokenHash(edit)).toHaveLength(64)
  })
})
