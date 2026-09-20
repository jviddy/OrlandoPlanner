import { describe, expect, it } from 'vitest'
import {
  crowdBackground,
  resolveCrowdPrediction,
  type CrowdCalendarDay,
} from '../app/composables/useCrowdPredictions'

const day: CrowdCalendarDay = {
  date: '2026-09-07',
  rating: 2,
  sourceComparison: { MK: 7, USF: 3 },
}

describe('crowd predictions', () => {
  it('uses an available activity-specific score and preserves its ten-point scale', () => {
    expect(resolveCrowdPrediction(day, 'mk')).toEqual({
      rating: 4,
      score: 7,
      max: 10,
      label: 'Busy',
      source: 'activity',
    })
  })

  it('falls back to the Orlando score when an activity has no specific forecast', () => {
    expect(resolveCrowdPrediction(day, 'sw')).toEqual({
      rating: 2,
      score: 2,
      max: 5,
      label: 'Light',
      source: 'orlando',
    })
  })

  it('returns no prediction outside the dataset and keeps crowd colours subtle', () => {
    expect(resolveCrowdPrediction(undefined, 'mk')).toBeNull()
    expect(crowdBackground(5)).toBe('#f8e7e3')
  })
})
