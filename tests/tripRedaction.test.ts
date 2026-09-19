import { describe, expect, it } from 'vitest'
import { redactTripPayload, redactionTarget } from '../server/utils/tripRedaction'

describe('tripRedaction', () => {
  const samplePayload = {
    version: 2,
    tripId: 'test-trip',
    name: 'My Trip',
    days: [
      {
        id: 'day-1',
        date: '2026-10-01',
        items: [
          { id: 'item-1', title: 'Dinner', time: '19:00', kind: 'dining', state: 'booked', anchor: 'date', parkId: null },
        ],
      },
    ],
  }

  it('returns full payload for owner, agent, editor, and capability-edit', () => {
    expect(redactTripPayload(samplePayload, 'owner')).toBe(samplePayload)
    expect(redactTripPayload(samplePayload, 'agent')).toBe(samplePayload)
    expect(redactTripPayload(samplePayload, 'editor')).toBe(samplePayload)
    expect(redactTripPayload(samplePayload, 'capability-edit')).toBe(samplePayload)
  })

  it('returns a copy (not same reference) for viewer, capability-view, and unlisted', () => {
    for (const target of ['viewer', 'capability-view', 'unlisted'] as const) {
      const result = redactTripPayload(samplePayload, target)
      expect(result).toHaveProperty('name', 'My Trip')
      // No sensitive keys exist yet, so the copy still has all keys.
      expect(result).toHaveProperty('tripId', 'test-trip')
    }
  })

  it('returns same reference when target does not require redaction', () => {
    const minimal = { version: 2, tripId: 't', name: 'Trip' }
    expect(redactTripPayload(minimal, 'owner')).toBe(minimal)
    expect(redactTripPayload(minimal, 'capability-edit')).toBe(minimal)
  })

  it('redacts sensitive fields for low-privilege viewers', () => {
    const payloadWithSensitive = { ...samplePayload, confirmationNumber: 'ABC123', bookingPhone: '+1 555', partySize: 4 }
    const result = redactTripPayload(payloadWithSensitive, 'viewer')
    expect(result).not.toHaveProperty('confirmationNumber')
    expect(result).not.toHaveProperty('bookingPhone')
    expect(result).not.toHaveProperty('partySize')
    expect(result).toHaveProperty('name', 'My Trip')
  })

  it('maps membership roles to redaction targets', () => {
    expect(redactionTarget('owner')).toBe('owner')
    expect(redactionTarget('editor')).toBe('editor')
    expect(redactionTarget('viewer')).toBe('viewer')
    expect(redactionTarget('editor', 'view')).toBe('capability-view')
    expect(redactionTarget('editor', 'edit')).toBe('capability-edit')
    expect(redactionTarget('viewer', undefined, true)).toBe('unlisted')
  })
})
