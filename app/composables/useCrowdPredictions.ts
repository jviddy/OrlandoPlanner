export interface CrowdCalendarDay {
  date: string
  rating: number
  sourceComparison: Record<string, number>
}

interface CrowdCalendarDataset {
  days: CrowdCalendarDay[]
}

export interface CrowdPrediction {
  /** Five-step level used for labels and background colours. */
  rating: number
  /** The score and scale as supplied by the dataset. */
  score: number
  max: 5 | 10
  label: string
  source: 'orlando' | 'activity'
}

const CROWD_LABELS = ['Low', 'Light', 'Moderate', 'Busy', 'High'] as const

/**
 * The activity catalogue keeps the app's original short ids, while the crowd
 * source uses its own park codes. Unmapped activities fall back to Orlando.
 */
export const ACTIVITY_CROWD_KEYS: Record<string, string> = {
  mk: 'MK',
  ep: 'EP',
  hs: 'HS',
  ak: 'AK',
  usf: 'USF',
  ioa: 'IOA',
  eu: 'EPU',
}

export function crowdLevelLabel(rating: number): string {
  const bounded = Math.max(1, Math.min(5, Math.round(rating)))
  return CROWD_LABELS[bounded - 1]!
}

export function crowdBackground(rating: number): string {
  const backgrounds = ['#edf7f3', '#f3f7e9', '#fff7e2', '#fdf0e7', '#f8e7e3']
  const bounded = Math.max(1, Math.min(5, Math.round(rating)))
  return backgrounds[bounded - 1]!
}

export function resolveCrowdPrediction(
  day: CrowdCalendarDay | undefined,
  activityId?: string | null,
): CrowdPrediction | null {
  if (!day || !Number.isFinite(day.rating)) return null

  const sourceKey = activityId ? ACTIVITY_CROWD_KEYS[activityId] : undefined
  const activityScore = sourceKey ? day.sourceComparison[sourceKey] : undefined
  if (activityScore !== undefined && Number.isFinite(activityScore)) {
    const rating = Math.max(1, Math.min(5, Math.ceil(activityScore / 2)))
    return {
      rating,
      score: activityScore,
      max: 10,
      label: crowdLevelLabel(rating),
      source: 'activity',
    }
  }

  const rating = Math.max(1, Math.min(5, Math.round(day.rating)))
  return {
    rating,
    score: day.rating,
    max: 5,
    label: crowdLevelLabel(rating),
    source: 'orlando',
  }
}

let crowdRequest: Promise<CrowdCalendarDataset> | null = null

/** Shared, on-demand access to the public crowd calendar. */
export function useCrowdPredictions() {
  const index = useState<Record<string, CrowdCalendarDay>>('crowd-predictions:index', () => ({}))
  const loaded = useState('crowd-predictions:loaded', () => false)
  const loadError = useState<string | null>('crowd-predictions:error', () => null)
  async function ensureLoaded() {
    if (loaded.value || import.meta.server) return
    if (!crowdRequest) {
      crowdRequest = fetch('/data/crowd-calendar.json').then(async (response) => {
        if (!response.ok) throw new Error(`Crowd predictions returned ${response.status}.`)
        return await response.json() as CrowdCalendarDataset
      })
    }
    try {
      const dataset = await crowdRequest
      if (!loaded.value) {
        index.value = Object.fromEntries(dataset.days.map(day => [day.date, day]))
        loaded.value = true
      }
    } catch (error) {
      crowdRequest = null
      loadError.value = error instanceof Error ? error.message : 'Crowd predictions could not be loaded.'
    }
  }

  function prediction(date: string, activityId?: string | null): CrowdPrediction | null {
    return resolveCrowdPrediction(index.value[date], activityId)
  }

  function backgroundStyle(date: string, activityId?: string | null): Record<string, string> | undefined {
    const result = prediction(date, activityId)
    return result ? { '--crowd-bg': crowdBackground(result.rating) } : undefined
  }

  return { ensureLoaded, prediction, backgroundStyle, loaded, loadError }
}
