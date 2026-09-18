import type { TripState } from '~/types/trip'
import { migratePersistedTrip } from '~/utils/tripSchema'

export type PersistedTrip = ReturnType<typeof migratePersistedTrip>

export interface TripRepository {
  load(id: string): Promise<PersistedTrip | null>
  save(trip: PersistedTrip, revision?: number): Promise<{ revision: number }>
  remove(id: string): Promise<void>
}

export class LocalTripRepository implements TripRepository {
  constructor(
    private readonly storage: Storage,
    private readonly prefix = 'orlando-trip-v2:',
    private readonly currentKey = 'orlando-trip-v2:current',
    private readonly legacyKey = 'orlando-trip',
  ) {}
  async load(id: string) {
    const raw = this.storage.getItem(`${this.prefix}${id}`)
    if (!raw) return null
    try { return migratePersistedTrip(JSON.parse(raw)) } catch { return null }
  }
  async save(trip: PersistedTrip) {
    this.storage.setItem(`${this.prefix}${trip.tripId}`, JSON.stringify(trip))
    return { revision: 0 }
  }
  async remove(id: string) { this.storage.removeItem(`${this.prefix}${id}`) }
  async loadCurrent(): Promise<PersistedTrip | null> {
    const currentId = this.storage.getItem(this.currentKey)
    if (currentId) {
      const current = await this.load(currentId)
      if (current) return current
    }
    const legacy = this.storage.getItem(this.legacyKey)
    if (!legacy) return null
    try {
      const migrated = migratePersistedTrip(JSON.parse(legacy))
      await this.saveCurrent(migrated)
      return migrated
    } catch { return null }
  }
  async saveCurrent(trip: PersistedTrip) {
    await this.save(trip)
    this.storage.setItem(this.currentKey, trip.tripId)
    return { revision: 0 }
  }
}

export interface AnonymousCapability {
  tripId: string
  editToken: string
  viewToken: string
  revision: number
  /** Legacy capabilities created before inactivity expiry do not include this. */
  expiresAt?: string
}

/** Disabled-by-default server repository. Tokens stay client-side and are never put in trip data. */
export class AnonymousTripRepository implements TripRepository {
  constructor(private capability: AnonymousCapability | null = null) {}
  async create(trip: PersistedTrip, idempotencyKey: string): Promise<AnonymousCapability> {
    const response = await $fetch<AnonymousCapability>('/api/anonymous-trips', { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: trip })
    this.capability = response
    return response
  }
  async load(id: string) {
    if (!this.capability || this.capability.tripId !== id) return null
    return await $fetch<PersistedTrip>(`/api/anonymous-trips/${id}`, { headers: { Authorization: `Bearer ${this.capability.viewToken}` } })
  }
  async save(trip: PersistedTrip, revision = this.capability?.revision ?? 0) {
    if (!this.capability || this.capability.tripId !== trip.tripId) throw new Error('Missing edit capability')
    const result = await $fetch<{ revision: number; expiresAt: string }>(`/api/anonymous-trips/${trip.tripId}`, { method: 'PUT', headers: { Authorization: `Bearer ${this.capability.editToken}`, 'If-Match': String(revision) }, body: trip })
    this.capability.revision = result.revision
    this.capability.expiresAt = result.expiresAt
    return result
  }
  async remove(id: string) {
    if (!this.capability || this.capability.tripId !== id) throw new Error('Missing edit capability')
    await $fetch(`/api/anonymous-trips/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${this.capability.editToken}` } })
    this.capability = null
  }
}

export function snapshotTrip(state: TripState): PersistedTrip { return migratePersistedTrip(state) }
