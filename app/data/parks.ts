import attractionManifest from '../../public/icons/attractions/manifest.json'
import { GLYPHS } from './glyphs'

export type AttractionGroupKey =
  | 'disney'
  | 'universal'
  | 'seaworld'
  | 'legoland'
  | 'busch-gardens'
  | 'wildlife'
  | 'science'
  | 'icon-park'
  | 'rides'
  | 'indoor'
  | 'nature'

export type ResortKey = AttractionGroupKey | 'off'

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
 * Activity group colours. The supplied SVGs use white artwork, so the group
 * colour lives on the circle behind each icon.
 */
export const RESORTS: Record<ResortKey, Resort> = {
  disney: {
    key: 'disney',
    name: 'Disney',
    bg: '#1680d8',
    fg: '#ffffff',
    dot: '#1680d8',
    shadow: 'rgba(22,128,216,.34)',
  },
  universal: {
    key: 'universal',
    name: 'Universal',
    bg: '#7650cf',
    fg: '#ffffff',
    dot: '#7650cf',
    shadow: 'rgba(118,80,207,.34)',
  },
  seaworld: {
    key: 'seaworld',
    name: 'SeaWorld',
    bg: '#12a59c',
    fg: '#ffffff',
    dot: '#12a59c',
    shadow: 'rgba(18,165,156,.34)',
  },
  legoland: {
    key: 'legoland',
    name: 'LEGOLAND / Winter Haven',
    bg: '#bd8a00',
    fg: '#ffffff',
    dot: '#bd8a00',
    shadow: 'rgba(189,138,0,.34)',
  },
  'busch-gardens': {
    key: 'busch-gardens',
    name: 'Busch Gardens / Tampa',
    bg: '#328345',
    fg: '#ffffff',
    dot: '#328345',
    shadow: 'rgba(50,131,69,.34)',
  },
  wildlife: {
    key: 'wildlife',
    name: 'Animals & Wildlife',
    bg: '#c26722',
    fg: '#ffffff',
    dot: '#c26722',
    shadow: 'rgba(194,103,34,.34)',
  },
  science: {
    key: 'science',
    name: 'Space & Science',
    bg: '#287daf',
    fg: '#ffffff',
    dot: '#287daf',
    shadow: 'rgba(40,125,175,.34)',
  },
  'icon-park': {
    key: 'icon-park',
    name: 'ICON Park / International Drive',
    bg: '#ca4581',
    fg: '#ffffff',
    dot: '#ca4581',
    shadow: 'rgba(202,69,129,.34)',
  },
  rides: {
    key: 'rides',
    name: 'Other Theme Parks & Rides',
    bg: '#8651b3',
    fg: '#ffffff',
    dot: '#8651b3',
    shadow: 'rgba(134,81,179,.34)',
  },
  indoor: {
    key: 'indoor',
    name: 'Museums & Indoor Attractions',
    bg: '#7854ad',
    fg: '#ffffff',
    dot: '#7854ad',
    shadow: 'rgba(120,84,173,.34)',
  },
  nature: {
    key: 'nature',
    name: 'Nature & Outdoor',
    bg: '#487f54',
    fg: '#ffffff',
    dot: '#487f54',
    shadow: 'rgba(72,127,84,.34)',
  },
  off: {
    key: 'off',
    name: 'Quick choices',
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
  /** Short label shown under the picker icon and on trip overview cells. */
  short: string
  /** Inline path used by the original generic activities and custom choices. */
  glyph?: string
  /** Supplied attraction SVG, served from public/. */
  icon?: string
}

/** Keep the original ids so activities already stored in users' trips survive. */
const LEGACY_IDS: Record<string, string> = {
  'magic-kingdom': 'mk',
  epcot: 'ep',
  'hollywood-studios': 'hs',
  'animal-kingdom': 'ak',
  'universal-studios': 'usf',
  'islands-of-adventure': 'ioa',
  'epic-universe': 'eu',
  'volcano-bay': 'vb',
  'seaworld-orlando': 'sw',
  aquatica: 'aq',
}

const SHORT_NAMES: Record<string, string> = {
  'magic-kingdom': 'Magic Kingdom',
  epcot: 'EPCOT',
  'hollywood-studios': 'Hollywood Studios',
  'animal-kingdom': 'Animal Kingdom',
  'typhoon-lagoon': 'Typhoon Lagoon',
  'blizzard-beach': 'Blizzard Beach',
  'disney-springs': 'Disney Springs',
  boardwalk: 'BoardWalk',
  'universal-studios': 'Universal Studios',
  'islands-of-adventure': 'Islands of Adventure',
  'epic-universe': 'Epic Universe',
  'volcano-bay': 'Volcano Bay',
  citywalk: 'CityWalk',
  'seaworld-orlando': 'SeaWorld',
  aquatica: 'Aquatica',
  'discovery-cove': 'Discovery Cove',
  'legoland-florida': 'LEGOLAND',
  'legoland-water-park': 'LEGOLAND Water Park',
  'peppa-pig-theme-park': 'Peppa Pig Park',
  'busch-gardens-tampa-bay': 'Busch Gardens',
  'adventure-island': 'Adventure Island',
  gatorland: 'Gatorland',
  'central-florida-zoo': 'Central Florida Zoo',
  'wild-florida': 'Wild Florida',
  'safari-wilderness': 'Safari Wilderness',
  zootampa: 'ZooTampa',
  'florida-aquarium': 'Florida Aquarium',
  'clearwater-marine-aquarium': 'Clearwater Aquarium',
  'kennedy-space-center': 'Kennedy Space Center',
  'orlando-science-center': 'Orlando Science Center',
  mosi: 'MOSI',
  'orlando-eye': 'Orlando Eye',
  'sea-life-orlando': 'SEA LIFE Orlando',
  'madame-tussauds': 'Madame Tussauds',
  'museum-of-illusions': 'Museum of Illusions',
  'fun-spot-orlando': 'Fun Spot Orlando',
  'fun-spot-kissimmee': 'Fun Spot Kissimmee',
  'old-town-kissimmee': 'Old Town Kissimmee',
  'orlando-starflyer': 'Orlando StarFlyer',
  wonderworks: 'WonderWorks',
  'titanic-exhibition': 'Titanic Exhibition',
  'ripleys-orlando': "Ripley's Orlando",
  'crayola-experience': 'Crayola Experience',
  'dezerland-park': 'Dezerland Park',
  'glazer-childrens-museum': "Glazer Children's Museum",
  'wekiwa-springs': 'Wekiwa Springs',
  'kelly-park-rock-springs': 'Kelly Park / Rock Springs',
  'boggy-creek-airboats': 'Boggy Creek Airboats',
  'winter-park-boat-tour': 'Winter Park Boat Tour',
  'tampa-riverwalk': 'Tampa Riverwalk',
}

const ATTRACTION_PARKS: Park[] = attractionManifest.attractions.map((attraction) => ({
  id: LEGACY_IDS[attraction.id] ?? attraction.id,
  resort: attraction.group as AttractionGroupKey,
  name: attraction.name,
  short: SHORT_NAMES[attraction.id] ?? attraction.name,
  icon: attraction.icon,
}))

export const GENERIC_ACTIVITY_IDS = ['pool', 'shop', 'rest', 'travel'] as const

const GENERIC_ACTIVITIES: Park[] = [
  { id: 'pool', resort: 'off', name: 'Pool / rest day', short: 'Pool', glyph: GLYPHS.sun },
  { id: 'shop', resort: 'off', name: 'Shopping', short: 'Shops', glyph: GLYPHS.bag },
  { id: 'rest', resort: 'off', name: 'Nothing planned', short: 'Rest', glyph: GLYPHS.moon },
  { id: 'travel', resort: 'off', name: 'Travel day', short: 'Travel', glyph: GLYPHS.plane },
]

export const PARKS: Park[] = [...ATTRACTION_PARKS, ...GENERIC_ACTIVITIES]

export const PARK_BY_ID: Record<string, Park> = Object.fromEntries(
  PARKS.map((p) => [p.id, p]),
)

export interface SheetGroup {
  key: AttractionGroupKey
  title: string
  ids: string[]
  defaultOpen: boolean
}

const GROUP_ORDER: AttractionGroupKey[] = [
  'disney',
  'universal',
  'seaworld',
  'legoland',
  'busch-gardens',
  'wildlife',
  'science',
  'icon-park',
  'rides',
  'indoor',
  'nature',
]

/** Groups for the quick-assign accordion, in folder order. */
export const SHEET_GROUPS: SheetGroup[] = GROUP_ORDER.map((key) => ({
  key,
  title: RESORTS[key].name,
  ids: ATTRACTION_PARKS.filter((park) => park.resort === key).map((park) => park.id),
  defaultOpen: key === 'disney' || key === 'universal',
}))

/** A user-defined off-park option: their own label, one of a few icons. */
export interface CustomActivity {
  id: string
  resort: 'off'
  name: string
  short: string
  glyph: string
  icon?: never
}

/** Icon choices offered when creating a custom activity. */
export const CUSTOM_ACTIVITY_GLYPHS: { id: string; glyph: string }[] = [
  { id: 'star', glyph: GLYPHS.star },
  { id: 'heart', glyph: GLYPHS.heart },
  { id: 'camera', glyph: GLYPHS.camera },
  { id: 'gift', glyph: GLYPHS.gift },
]

/** Looks an activity up in the fixed catalog, then in this trip's custom activities. */
export function resolvePark(
  parkId: string | null | undefined,
  custom: CustomActivity[] = [],
): Park | null {
  if (!parkId) return null
  return PARK_BY_ID[parkId] ?? custom.find((c) => c.id === parkId) ?? null
}

export function resortOf(
  parkId: string | null | undefined,
  custom: CustomActivity[] = [],
): Resort | null {
  const park = resolvePark(parkId, custom)
  return park ? RESORTS[park.resort] : null
}

export function parkName(
  parkId: string | null | undefined,
  custom: CustomActivity[] = [],
): string {
  if (!parkId) return 'Nothing set yet'
  return resolvePark(parkId, custom)?.name ?? 'Nothing set yet'
}
