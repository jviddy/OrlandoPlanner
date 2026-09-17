export type TripDay = { date: string; rating: number; factors: string[]; eveningEvents?: { name: string }[] }
export type TripPreference = { key: string; required: boolean }
export type TripResult = { start: string; end: string; scores: number[]; average: number }
export function rankTripWindows(days: TripDay[], nights: number, preferences: TripPreference[], score: (day: TripDay, key: string) => number) {
  if (!Number.isInteger(nights) || nights < 1 || nights > 30 || !preferences.length) return []
  const results: TripResult[] = []
  for (let i = 0; i + nights < days.length; i++) {
    const stay = days.slice(i, i + nights + 1)
    if (Date.parse(stay.at(-1)!.date) - Date.parse(stay[0]!.date) !== nights * 86400000) continue
    const scores = preferences.map(p => {
      const values = stay.map(d => score(d, p.key))
      return p.key.startsWith('event:') || p.key.startsWith('festival:') ? Math.max(...values) : values.reduce((a, b) => a + b, 0) / values.length
    })
    if (preferences.some((p, j) => p.required && scores[j]! < 1 - 1e-9)) continue
    results.push({ start: stay[0]!.date, end: stay.at(-1)!.date, scores, average: stay.reduce((a, d) => a + d.rating, 0) / stay.length })
  }
  return results.sort((a, b) => {
    for (let j = 0; j < preferences.length; j++) {
      const difference = b.scores[j]! - a.scores[j]!
      if (Math.abs(difference) > 1e-9) return difference
    }
    return a.start.localeCompare(b.start)
  })
}
