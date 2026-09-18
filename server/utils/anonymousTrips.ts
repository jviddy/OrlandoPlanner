import type { H3Event } from 'h3'

export interface D1StatementLike { bind(...values: unknown[]): D1StatementLike; first<T>(): Promise<T | null>; run(): Promise<{ success: boolean; meta?: { changes?: number } }> }
export interface D1DatabaseLike { prepare(query: string): D1StatementLike }

export function requireAnonymousDb(event: H3Event): D1DatabaseLike {
  const config = useRuntimeConfig(event)
  if (!config.anonymousSyncEnabled) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  if (!config.anonymousCapabilitySecret) throw createError({ statusCode: 503, statusMessage: 'Anonymous storage unavailable' })
  const db = (event.context as any).cloudflare?.env?.ORLANDO_DB as D1DatabaseLike | undefined
  if (!db) throw createError({ statusCode: 503, statusMessage: 'Anonymous storage unavailable' })
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
export function validateTripPayload(value: unknown): asserts value is Record<string, unknown> {
  const trip = value as any
  if (!trip || typeof trip !== 'object' || typeof trip.tripId !== 'string' || !Array.isArray(trip.days) || trip.days.length > 60) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid trip payload' })
  }
}
