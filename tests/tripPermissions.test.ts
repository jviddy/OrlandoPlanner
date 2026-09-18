import { describe, expect, it } from 'vitest'
import { canPerformTripOperation, type TripActor, type TripOperation, type TripStatus } from '../server/utils/tripPermissions'

const operations: TripOperation[] = [
  'trip:view', 'plan:edit', 'details:edit', 'sharing:manage', 'sensitive:view',
  'ownership:transfer', 'trip:delete', 'server-copy:revoke',
]

function allowed(actor: TripActor, status: TripStatus = 'owned'): TripOperation[] {
  return operations.filter((operation) => canPerformTripOperation(actor, operation, status))
}

describe('trip operation permissions', () => {
  it.each([
    ['owner', ['trip:view', 'plan:edit', 'details:edit', 'sharing:manage', 'sensitive:view', 'ownership:transfer', 'trip:delete']],
    ['agent', ['trip:view', 'plan:edit', 'details:edit', 'sharing:manage', 'sensitive:view']],
    ['editor', ['trip:view', 'plan:edit', 'sensitive:view']],
    ['viewer', ['trip:view']],
  ] as const)('applies the %s membership role', (role, expected) => {
    expect(allowed({ kind: 'member', role })).toEqual(expected)
  })

  it('keeps view and edit capabilities separate and hides sensitive data', () => {
    expect(allowed({ kind: 'capability', capability: 'view' }, 'anonymous')).toEqual(['trip:view'])
    expect(allowed({ kind: 'capability', capability: 'edit' }, 'anonymous')).toEqual(['trip:view', 'plan:edit', 'details:edit', 'server-copy:revoke'])
  })

  it('limits ordinary admin access to ownerless trips', () => {
    expect(allowed({ kind: 'admin' }, 'seeded')).toEqual(['trip:view', 'plan:edit', 'details:edit', 'sharing:manage', 'trip:delete', 'server-copy:revoke'])
    expect(allowed({ kind: 'admin' }, 'owned')).toEqual([])
    expect(allowed({ kind: 'admin', supportAccess: true }, 'owned')).not.toContain('ownership:transfer')
  })

  it('makes archived trips owner-readable only', () => {
    expect(allowed({ kind: 'member', role: 'owner' }, 'archived')).toEqual(['trip:view'])
    expect(allowed({ kind: 'member', role: 'editor' }, 'archived')).toEqual([])
  })
})
