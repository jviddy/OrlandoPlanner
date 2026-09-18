export type GlobalRole = 'user' | 'agent' | 'admin'
export type MembershipRole = 'owner' | 'agent' | 'editor' | 'viewer'
export type TripStatus = 'anonymous' | 'seeded' | 'owned' | 'archived'
export type TripOperation =
  | 'trip:view'
  | 'plan:edit'
  | 'details:edit'
  | 'sharing:manage'
  | 'sensitive:view'
  | 'ownership:transfer'
  | 'trip:delete'
  | 'server-copy:revoke'

export type TripActor =
  | { kind: 'member'; role: MembershipRole; globalRole?: GlobalRole }
  | { kind: 'capability'; capability: 'view' | 'edit' }
  | { kind: 'unlisted' }
  | { kind: 'admin'; supportAccess?: boolean }
  | { kind: 'none' }

const MEMBER_PERMISSIONS: Record<MembershipRole, ReadonlySet<TripOperation>> = {
  owner: new Set(['trip:view', 'plan:edit', 'details:edit', 'sharing:manage', 'sensitive:view', 'ownership:transfer', 'trip:delete']),
  agent: new Set(['trip:view', 'plan:edit', 'details:edit', 'sharing:manage', 'sensitive:view']),
  editor: new Set(['trip:view', 'plan:edit', 'sensitive:view']),
  viewer: new Set(['trip:view']),
}

const EDIT_CAPABILITY = new Set<TripOperation>(['trip:view', 'plan:edit', 'details:edit', 'server-copy:revoke'])
const VIEW_CAPABILITY = new Set<TripOperation>(['trip:view'])

/** One operation-level authorization policy shared by every trip endpoint. */
export function canPerformTripOperation(actor: TripActor, operation: TripOperation, status: TripStatus): boolean {
  if (status === 'archived') return operation === 'trip:view' && actor.kind === 'member' && actor.role === 'owner'
  if (actor.kind === 'member') return MEMBER_PERMISSIONS[actor.role].has(operation)
  if (actor.kind === 'capability') return (actor.capability === 'edit' ? EDIT_CAPABILITY : VIEW_CAPABILITY).has(operation)
  if (actor.kind === 'unlisted') return operation === 'trip:view'
  if (actor.kind === 'admin') {
    if (status === 'anonymous' || status === 'seeded') return operation !== 'sensitive:view' && operation !== 'ownership:transfer'
    return Boolean(actor.supportAccess) && operation !== 'ownership:transfer'
  }
  return false
}
