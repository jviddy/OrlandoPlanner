/**
 * Trip templates. A template only lays down day TYPES (park id per day).
 * Whatever the pattern says, day 1 and the final day are always forced to
 * `travel`. `blank` leaves every day unassigned.
 *
 * Preview circles on the picker card are a literal miniature of the pattern.
 */
export interface Template {
  id: 'blank' | 'disney' | 'both'
  name: string
  meta: string
  blurb: string
  /** Seed sequence. Travel markers are treated as boundaries, never cycled into the middle. */
  pattern: string[] | null
}

export const TEMPLATES: Template[] = [
  {
    id: 'blank',
    name: 'Blank slate',
    meta: '0 days set',
    blurb: 'Every day empty. Build it your way.',
    pattern: null,
  },
  {
    id: 'disney',
    name: 'First timer Disney',
    meta: 'Disney only',
    blurb: 'Four parks, a repeat of the big two, and a rest day after every three.',
    pattern: [
      'travel', 'mk', 'ep', 'pool', 'hs', 'ak', 'shop', 'mk', 'ep', 'rest',
      'hs', 'ak', 'pool', 'mk', 'travel',
    ],
  },
  {
    id: 'both',
    name: 'Best of both worlds',
    meta: 'Disney + Universal',
    blurb:
      'Split the trip — Universal front half, Disney back half, water park in the middle.',
    pattern: [
      'travel', 'eu', 'usf', 'ioa', 'pool', 'eu', 'shop', 'vb', 'rest', 'mk',
      'ep', 'hs', 'pool', 'ak', 'mk', 'rest', 'travel',
    ],
  },
]

const RECOVERY_DAYS = new Set(['pool', 'shop', 'rest'])

/**
 * Expand a seed into a complete trip without internal travel days, adjacent
 * duplicates, or more than three demanding park days in a row.
 */
export function templatePlan(pattern: string[] | null, n: number): Array<string | null> {
  if (n <= 0) return []
  if (!pattern) return Array.from({ length: n }, () => null)
  const seed = pattern.filter((id) => id !== 'travel')
  const result: Array<string | null> = Array.from({ length: n }, () => null)
  result[0] = 'travel'
  if (n > 1) result[n - 1] = 'travel'
  if (!seed.length) return result

  let cursor = 0
  let parkRun = 0
  let previous = 'travel'
  for (let index = 1; index < n - 1; index++) {
    let candidate = seed[cursor % seed.length]!
    cursor++
    if (candidate === previous && seed.length > 1) {
      candidate = seed[cursor % seed.length]!
      cursor++
    }
    const demanding = !RECOVERY_DAYS.has(candidate)
    if (demanding && parkRun >= 3) {
      candidate = 'rest'
      parkRun = 0
    } else {
      parkRun = demanding ? parkRun + 1 : 0
    }
    result[index] = candidate
    previous = candidate
  }
  return result
}

/** Build a parkId for day `i` of `n`, per a template's generated plan. */
export function templateParkId(
  pattern: string[] | null,
  i: number,
  n: number,
): string | null {
  return templatePlan(pattern, n)[i] ?? null
}
