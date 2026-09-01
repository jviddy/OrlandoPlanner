import { GLYPHS } from './glyphs'

export type ResortKey = 'wdw' | 'uor' | 'sea' | 'off'

export interface Resort {
  key: ResortKey
  name: string
  /** Circle background. */
  bg: string
  /** Glyph ink on that background. */
  fg: string
  /** Counter / dot colour. */
  dot: string
  /** Circle drop-shadow colour (rgba). */
  shadow: string
}

/**
 * The core system: circle BACKGROUND = resort, circle GLYPH = park.
 * Per-park colour is deliberately not used on the overview — it makes a 21-day
 * grid unreadable.
 */
export const RESORTS: Record<ResortKey, Resort> = {
  wdw: {
    key: 'wdw',
    name: 'Walt Disney World',
    bg: '#0b3d91',
    fg: '#ffffff',
    dot: '#0b3d91',
    shadow: 'rgba(11,61,145,.34)',
  },
  uor: {
    key: 'uor',
    name: 'Universal Orlando',
    bg: '#f45d48',
    fg: '#ffffff',
    dot: '#f45d48',
    shadow: 'rgba(244,93,72,.34)',
  },
  sea: {
    key: 'sea',
    name: 'SeaWorld Parks',
    bg: '#17a398',
    fg: '#ffffff',
    dot: '#17a398',
    shadow: 'rgba(23,163,152,.34)',
  },
  off: {
    key: 'off',
    name: 'Off-park',
    bg: '#ffd86b',
    fg: '#7a5600',
    dot: '#e0a94a',
    shadow: 'rgba(224,169,74,.36)',
  },
}

export interface Park {
  id: string
  resort: ResortKey
  name: string
  /** 2–3 word label shown under the grid circle. */
  short: string
  glyph: string
}

export const PARKS: Park[] = [
  { id: 'mk', resort: 'wdw', name: 'Magic Kingdom', short: 'Magic K.', glyph: GLYPHS.castle },
  { id: 'ep', resort: 'wdw', name: 'EPCOT', short: 'EPCOT', glyph: GLYPHS.sphere },
  { id: 'hs', resort: 'wdw', name: 'Hollywood Studios', short: 'Studios', glyph: GLYPHS.clapper },
  { id: 'ak', resort: 'wdw', name: 'Animal Kingdom', short: 'Animal K.', glyph: GLYPHS.tree },
  { id: 'usf', resort: 'uor', name: 'Universal Studios', short: 'Studios', glyph: GLYPHS.globe },
  { id: 'ioa', resort: 'uor', name: 'Islands of Adventure', short: 'Islands', glyph: GLYPHS.island },
  { id: 'eu', resort: 'uor', name: 'Epic Universe', short: 'Epic', glyph: GLYPHS.portal },
  { id: 'vb', resort: 'uor', name: 'Volcano Bay', short: 'Volcano', glyph: GLYPHS.volcano },
  { id: 'sw', resort: 'sea', name: 'SeaWorld Orlando', short: 'SeaWorld', glyph: GLYPHS.fin },
  { id: 'aq', resort: 'sea', name: 'Aquatica', short: 'Aquatica', glyph: GLYPHS.water },
  { id: 'pool', resort: 'off', name: 'Pool / rest day', short: 'Pool', glyph: GLYPHS.sun },
  { id: 'shop', resort: 'off', name: 'Shopping', short: 'Shops', glyph: GLYPHS.bag },
  { id: 'rest', resort: 'off', name: 'Nothing planned', short: 'Rest', glyph: GLYPHS.moon },
  { id: 'travel', resort: 'off', name: 'Travel day', short: 'Travel', glyph: GLYPHS.plane },
]

export const PARK_BY_ID: Record<string, Park> = Object.fromEntries(
  PARKS.map((p) => [p.id, p]),
)

/** Groups for the quick-assign sheet, in order. */
export const SHEET_GROUPS: { title: string; ids: string[] }[] = [
  { title: 'Walt Disney World', ids: ['mk', 'ep', 'hs', 'ak'] },
  { title: 'Universal Orlando', ids: ['usf', 'ioa', 'eu', 'vb'] },
  { title: 'SeaWorld Parks', ids: ['sw', 'aq'] },
  { title: 'Off-park', ids: ['pool', 'shop', 'rest', 'travel'] },
]

export function resortOf(parkId: string | null | undefined): Resort | null {
  if (!parkId) return null
  const park = PARK_BY_ID[parkId]
  return park ? RESORTS[park.resort] : null
}

export function parkName(parkId: string | null | undefined): string {
  if (!parkId) return 'Nothing set yet'
  return PARK_BY_ID[parkId]?.name ?? 'Nothing set yet'
}
