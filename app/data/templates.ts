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
  /** Cycled over the trip length; null-pattern = blank. */
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

/** Build a parkId for day `i` of `n`, per a template's pattern. */
export function templateParkId(
  pattern: string[] | null,
  i: number,
  n: number,
): string | null {
  if (!pattern) return null
  if (i === 0 || i === n - 1) return 'travel'
  return pattern[i % pattern.length] ?? null
}
