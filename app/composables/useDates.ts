const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MON = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

const DAY_MS = 86_400_000

/** Parse 'yyyy-mm-dd' as a UTC midnight Date (no timezone drift). */
export function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1))
}

export function toISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS)
}

export function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / DAY_MS)
}

/** Today at UTC midnight. */
export function todayUTC(): Date {
  const n = new Date()
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()))
}

export function useDates() {
  const dow = (d: Date) => DOW[d.getUTCDay()]!
  const mon = (d: Date) => MON[d.getUTCMonth()]!

  /** "3 Apr" */
  const dayMon = (d: Date | null) => (d ? `${d.getUTCDate()} ${mon(d)}` : '')

  /** "3 Apr – 19 Apr 2027" */
  const range = (a: Date | null, b: Date | null) => {
    if (!a || !b) return ''
    return `${a.getUTCDate()} ${mon(a)} – ${b.getUTCDate()} ${mon(b)} ${b.getUTCFullYear()}`
  }

  /** "Sun 3 Apr" */
  const dowDayMon = (d: Date | null) =>
    d ? `${dow(d)} ${d.getUTCDate()} ${mon(d)}` : ''

  const time12 = (t: string) => {
    if (!t) return ''
    const [h, m] = t.split(':').map(Number)
    if (h === undefined || Number.isNaN(h)) return t
    const suffix = h >= 12 ? 'pm' : 'am'
    const h12 = h % 12 === 0 ? 12 : h % 12
    return `${h12}:${String(m ?? 0).padStart(2, '0')}${suffix}`
  }

  return { DOW, MON, dow, mon, dayMon, dowDayMon, range, time12, parseISO, toISO, addDays, diffDays }
}
