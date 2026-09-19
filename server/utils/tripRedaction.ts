/**
 * Server-side redaction for trip payloads.
 *
 * Sensitive booking fields (confirmationNumber, bookingPhone, partySize, etc.)
 * are not in TripState yet. When they are added, add their keys to
 * SENSITIVE_ROOT_KEYS and SENSITIVE_ITEM_KEYS so every read route redacts
 * them automatically for viewers, unlisted, and public access.
 *
 * Owner, agent, and editor roles see the full payload.
 */

import type { MembershipRole } from './tripPermissions'

/** Root-level fields to redact for low-privilege viewers. */
const SENSITIVE_ROOT_KEYS: readonly string[] = [
  'confirmationNumber',
  'bookingPhone',
  'partySize',
]

/** Day-item-level fields to redact for low-privilege viewers. */
const SENSITIVE_ITEM_KEYS: readonly string[] = [
  // 'confirmationNumber', 'bookingPhone',
]

type RedactTarget = 'owner' | 'agent' | 'editor' | 'viewer' | 'capability-edit' | 'capability-view' | 'unlisted'

function shouldRedact(target: RedactTarget): boolean {
  return target === 'viewer' || target === 'capability-view' || target === 'unlisted'
}

function redactObject(obj: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  if (!keys.length) return obj
  const result = { ...obj }
  for (const key of keys) {
    if (key in result) delete result[key]
  }
  return result
}

/** Map a membership role + trip context to a redaction target. */
export function redactionTarget(role: MembershipRole, capability?: 'view' | 'edit', isUnlisted?: boolean): RedactTarget {
  if (isUnlisted) return 'unlisted'
  if (capability === 'view') return 'capability-view'
  if (capability === 'edit') return 'capability-edit'
  return role
}

/** Deep-redact a trip payload based on viewer privilege. */
export function redactTripPayload(payload: Record<string, unknown>, target: RedactTarget): Record<string, unknown> {
  if (!shouldRedact(target)) return payload
  const redacted = redactObject(payload, SENSITIVE_ROOT_KEYS)

  // Redact sensitive fields inside day items.
  if (Array.isArray(redacted.days) && SENSITIVE_ITEM_KEYS.length) {
    redacted.days = redacted.days.map((day: any) => {
      if (!day || typeof day !== 'object' || !Array.isArray(day.items)) return day
      return { ...day, items: day.items.map((item: any) => redactObject(item, SENSITIVE_ITEM_KEYS)) }
    })
  }

  // Redact in recovery removed days too.
  if (redacted.recovery && typeof redacted.recovery === 'object' && Array.isArray((redacted.recovery as any).removedDays) && SENSITIVE_ITEM_KEYS.length) {
    const recovery = redacted.recovery as Record<string, unknown>
    recovery.removedDays = (recovery.removedDays as any[]).map((day: any) => {
      if (!day || typeof day !== 'object' || !Array.isArray(day.items)) return day
      return { ...day, items: day.items.map((item: any) => redactObject(item, SENSITIVE_ITEM_KEYS)) }
    })
  }

  return redacted
}
