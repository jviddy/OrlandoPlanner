import type { H3Event } from 'h3'
import { parsePersistedTripPayload, TripPayloadError, type PersistedTripPayload } from '~/utils/tripPayload'

export interface D1RunResultLike { success: boolean; meta?: { changes?: number } }
export interface D1StatementLike {
  bind(...values: unknown[]): D1StatementLike
  first<T>(): Promise<T | null>
  all<T>(): Promise<{ results?: T[]; success: boolean }>
  run(): Promise<D1RunResultLike>
}
export interface D1DatabaseLike {
  prepare(query: string): D1StatementLike
  batch(statements: D1StatementLike[]): Promise<D1RunResultLike[]>
}

export const ANONYMOUS_TTL_DAYS = 180
export const DELETED_TTL_DAYS = 30

export function requireAnonymousDb(event: H3Event): D1DatabaseLike {
  const config = useRuntimeConfig(event)
  if (!config.anonymousSyncEnabled) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  if (!config.anonymousCapabilitySecret) throw createError({ statusCode: 503, statusMessage: 'Anonymous storage unavailable' })
  const db = (event.context as any).cloudflare?.env?.ORLANDO_DB as D1DatabaseLike | undefined
  if (!db?.batch) throw createError({ statusCode: 503, statusMessage: 'Anonymous storage unavailable' })
  return db
}

export function bearer(event: H3Event): string {
  const value = getHeader(event, 'authorization') ?? ''
  return value.startsWith('Bearer ') ? value.slice(7) : ''
}

export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function tokenHash(token: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function capabilityToken(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function capabilityKey(event: H3Event, version?: number): { version: number; secret: string } {
  const config = useRuntimeConfig(event)
  const currentVersion = Number(config.anonymousCapabilityKeyVersion) || 1
  const currentSecret = String(config.anonymousCapabilitySecret)
  const requested = version ?? currentVersion
  if (requested === currentVersion) return { version: currentVersion, secret: currentSecret }
  try {
    const previous = JSON.parse(String(config.anonymousCapabilityPreviousSecrets || '{}')) as Record<string, unknown>
    const secret = previous[String(requested)]
    if (typeof secret === 'string' && secret) return { version: requested, secret }
  } catch { /* invalid configuration is reported below */ }
  throw createError({ statusCode: 503, statusMessage: 'Capability replay unavailable', data: { code: 'capability_key_unavailable' } })
}

export function anonymousExpiry(now = Date.now()): string {
  return new Date(now + ANONYMOUS_TTL_DAYS * 86_400_000).toISOString()
}

export async function enforceRateLimit(event: H3Event, db: D1DatabaseLike, limit: number, scope = 'anonymous-api') {
  const now = new Date()
  const windowStartedAt = `${now.toISOString().slice(0, 13)}:00:00.000Z`
  const identity = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const secret = String(useRuntimeConfig(event).anonymousCapabilitySecret)
  const bucket = await tokenHash(`${secret}:${scope}:${identity}:${windowStartedAt}`)
  await db.prepare('INSERT INTO rate_limit_buckets (bucket_hash, scope, requests, window_started_at, updated_at) VALUES (?, ?, 1, ?, ?) ON CONFLICT(scope, bucket_hash) DO UPDATE SET requests = requests + 1, updated_at = excluded.updated_at').bind(bucket, scope, windowStartedAt, now.toISOString()).run()
  const row = await db.prepare('SELECT requests FROM rate_limit_buckets WHERE scope = ? AND bucket_hash = ?').bind(scope, bucket).first<{ requests: number }>()
  if ((row?.requests ?? 0) > limit) throw createError({ statusCode: 429, statusMessage: 'Too many requests', data: { code: 'rate_limited' } })
}

/** Opportunistic cleanup; a protected scheduled endpoint can call the same helper later. */
export async function purgeExpiredAnonymousData(db: D1DatabaseLike, now = new Date()): Promise<void> {
  const rateLimitCutoff = new Date(now.getTime() - 2 * 86_400_000).toISOString()
  const deletedCutoff = new Date(now.getTime() - DELETED_TTL_DAYS * 86_400_000).toISOString()
  await db.batch([
    db.prepare('DELETE FROM idempotency_records WHERE expires_at <= ?').bind(now.toISOString()),
    db.prepare('DELETE FROM rate_limit_buckets WHERE updated_at <= ?').bind(rateLimitCutoff),
    db.prepare("DELETE FROM trips WHERE status = 'anonymous' AND (expires_at <= ? OR (deleted_at IS NOT NULL AND deleted_at <= ?))").bind(now.toISOString(), deletedCutoff),
  ])
}

export function validateTripPayload(value: unknown): PersistedTripPayload {
  try {
    return parsePersistedTripPayload(value)
  } catch (error) {
    if (error instanceof TripPayloadError) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid trip payload', data: { code: 'invalid_trip_payload', detail: error.message } })
    }
    throw error
  }
}

/** Reject trips that contain non-empty sensitive booking fields. */
export function rejectSensitiveFields(payload: PersistedTripPayload): void {
  const sensitive = ['confirmationNumber', 'bookingPhone'] as const
  for (const key of sensitive) {
    if (typeof payload[key] === 'string' && (payload[key] as string).trim()) {
      throw createError({ statusCode: 400, statusMessage: 'Anonymous trips cannot contain sensitive booking fields', data: { code: 'sensitive_field_rejected', field: key } })
    }
  }
  if (payload.partySize != null) {
    throw createError({ statusCode: 400, statusMessage: 'Anonymous trips cannot contain sensitive booking fields', data: { code: 'sensitive_field_rejected', field: 'partySize' } })
  }
}
