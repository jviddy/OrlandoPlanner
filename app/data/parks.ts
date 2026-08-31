export interface Park {
  id: string
  name: string
  resort: 'Walt Disney World' | 'Universal Orlando' | 'SeaWorld Parks' | 'Other'
  short: string
  /** Accent colour used for chips / day headers. */
  color: string
  blurb: string
}

export const PARKS: Park[] = [
  {
    id: 'mk',
    name: 'Magic Kingdom',
    resort: 'Walt Disney World',
    short: 'MK',
    color: '#8b5cf6',
    blurb: 'Cinderella Castle, classic dark rides, fireworks and parades.',
  },
  {
    id: 'epcot',
    name: 'EPCOT',
    resort: 'Walt Disney World',
    short: 'EP',
    color: '#0ea5e9',
    blurb: 'World Showcase, Guardians coaster, food-and-wine energy year round.',
  },
  {
    id: 'hs',
    name: 'Hollywood Studios',
    resort: 'Walt Disney World',
    short: 'HS',
    color: '#f43f5e',
    blurb: 'Star Wars: Galaxy’s Edge, Toy Story Land, Tower of Terror.',
  },
  {
    id: 'ak',
    name: 'Animal Kingdom',
    resort: 'Walt Disney World',
    short: 'AK',
    color: '#22c55e',
    blurb: 'Pandora – The World of Avatar, Kilimanjaro Safaris, Expedition Everest.',
  },
  {
    id: 'usf',
    name: 'Universal Studios Florida',
    resort: 'Universal Orlando',
    short: 'USF',
    color: '#f59e0b',
    blurb: 'Diagon Alley, The Simpsons, movie-backlot thrill rides.',
  },
  {
    id: 'ioa',
    name: 'Islands of Adventure',
    resort: 'Universal Orlando',
    short: 'IOA',
    color: '#14b8a6',
    blurb: 'Hogsmeade, Jurassic World, Hagrid’s and the Hulk coaster.',
  },
  {
    id: 'eu',
    name: 'Epic Universe',
    resort: 'Universal Orlando',
    short: 'EU',
    color: '#6366f1',
    blurb: 'Super Nintendo World, How to Train Your Dragon, Dark Universe.',
  },
  {
    id: 'volcano',
    name: 'Volcano Bay',
    resort: 'Universal Orlando',
    short: 'VB',
    color: '#ef4444',
    blurb: 'Universal’s water theme park – slides, a wave pool and a lazy river.',
  },
  {
    id: 'seaworld',
    name: 'SeaWorld Orlando',
    resort: 'SeaWorld Parks',
    short: 'SW',
    color: '#3b82f6',
    blurb: 'Record-breaking coasters plus animal encounters and shows.',
  },
  {
    id: 'other',
    name: 'Other / Off-park day',
    resort: 'Other',
    short: '—',
    color: '#64748b',
    blurb: 'Rest day, outlet shopping, Disney Springs, CityWalk or a travel day.',
  },
]

export const PARK_BY_ID: Record<string, Park> = Object.fromEntries(
  PARKS.map((p) => [p.id, p]),
)

export function parkName(id: string | null | undefined): string {
  if (!id) return 'Unassigned'
  return PARK_BY_ID[id]?.name ?? 'Unassigned'
}

export function parkColor(id: string | null | undefined): string {
  if (!id) return '#64748b'
  return PARK_BY_ID[id]?.color ?? '#64748b'
}
