export interface Airport {
  code: string
  name: string
  city: string
  country: string
}

export const AIRPORTS: Airport[] = [
  // Orlando area
  { code: 'MCO', name: 'Orlando International', city: 'Orlando', country: 'US' },
  { code: 'SFB', name: 'Orlando Sanford', city: 'Orlando', country: 'US' },
  // UK / Ireland
  { code: 'MAN', name: 'Manchester', city: 'Manchester', country: 'GB' },
  { code: 'LHR', name: 'Heathrow', city: 'London', country: 'GB' },
  { code: 'LGW', name: 'Gatwick', city: 'London', country: 'GB' },
  { code: 'STN', name: 'Stansted', city: 'London', country: 'GB' },
  { code: 'LTN', name: 'Luton', city: 'London', country: 'GB' },
  { code: 'BHX', name: 'Birmingham', city: 'Birmingham', country: 'GB' },
  { code: 'BRS', name: 'Bristol', city: 'Bristol', country: 'GB' },
  { code: 'EDI', name: 'Edinburgh', city: 'Edinburgh', country: 'GB' },
  { code: 'GLA', name: 'Glasgow', city: 'Glasgow', country: 'GB' },
  { code: 'NCL', name: 'Newcastle', city: 'Newcastle', country: 'GB' },
  { code: 'LBA', name: 'Leeds Bradford', city: 'Leeds', country: 'GB' },
  { code: 'LPL', name: 'Liverpool John Lennon', city: 'Liverpool', country: 'GB' },
  { code: 'EMA', name: 'East Midlands', city: 'East Midlands', country: 'GB' },
  { code: 'BFS', name: 'Belfast International', city: 'Belfast', country: 'GB' },
  { code: 'DUB', name: 'Dublin', city: 'Dublin', country: 'IE' },
  // US hubs
  { code: 'JFK', name: 'John F. Kennedy', city: 'New York', country: 'US' },
  { code: 'EWR', name: 'Newark', city: 'New York', country: 'US' },
  { code: 'ATL', name: 'Hartsfield-Jackson Atlanta', city: 'Atlanta', country: 'US' },
  { code: 'ORD', name: "O'Hare", city: 'Chicago', country: 'US' },
  { code: 'DFW', name: 'Dallas/Fort Worth', city: 'Dallas', country: 'US' },
  { code: 'DEN', name: 'Denver International', city: 'Denver', country: 'US' },
  { code: 'LAX', name: 'Los Angeles International', city: 'Los Angeles', country: 'US' },
  { code: 'SFO', name: 'San Francisco', city: 'San Francisco', country: 'US' },
  { code: 'MIA', name: 'Miami', city: 'Miami', country: 'US' },
  { code: 'TPA', name: 'Tampa', city: 'Tampa', country: 'US' },
  { code: 'FLL', name: 'Fort Lauderdale', city: 'Fort Lauderdale', country: 'US' },
  { code: 'BOS', name: 'Logan', city: 'Boston', country: 'US' },
  { code: 'PHL', name: 'Philadelphia', city: 'Philadelphia', country: 'US' },
  { code: 'IAD', name: 'Dulles', city: 'Washington DC', country: 'US' },
  { code: 'DCA', name: 'Reagan National', city: 'Washington DC', country: 'US' },
  { code: 'SEA', name: 'Seattle-Tacoma', city: 'Seattle', country: 'US' },
  { code: 'LAS', name: 'Harry Reid Las Vegas', city: 'Las Vegas', country: 'US' },
  { code: 'PHX', name: 'Phoenix Sky Harbor', city: 'Phoenix', country: 'US' },
  { code: 'SAN', name: 'San Diego', city: 'San Diego', country: 'US' },
  { code: 'MSP', name: 'Minneapolis-Saint Paul', city: 'Minneapolis', country: 'US' },
  { code: 'DTW', name: 'Detroit', city: 'Detroit', country: 'US' },
  { code: 'CLT', name: 'Charlotte Douglas', city: 'Charlotte', country: 'US' },
  // Canada
  { code: 'YYZ', name: 'Toronto Pearson', city: 'Toronto', country: 'CA' },
  { code: 'YVR', name: 'Vancouver', city: 'Vancouver', country: 'CA' },
]

const AIRPORTS_BY_CODE = new Map(AIRPORTS.map((a) => [a.code.toLowerCase(), a]))

export function findAirport(query: string): Airport | null {
  const q = query.trim().toLowerCase()
  if (!q) return null
  // Exact code match
  const byCode = AIRPORTS_BY_CODE.get(q)
  if (byCode) return byCode
  // Name / city substring match
  return (
    AIRPORTS.find(
      (a) =>
        a.code.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.city.toLowerCase().includes(q),
    ) ?? null
  )
}

export function formatRoute(fromCode?: string, toCode?: string): string {
  if (fromCode && toCode) return `${fromCode} → ${toCode}`
  if (fromCode) return `${fromCode} → ?`
  if (toCode) return `? → ${toCode}`
  return ''
}

export function parseRoute(route: string): { fromCode: string; toCode: string } {
  const parts = route.split(/\s*[→\->]\s*/).map((s) => s.trim().toUpperCase())
  return { fromCode: parts[0] ?? '', toCode: parts[1] ?? '' }
}
