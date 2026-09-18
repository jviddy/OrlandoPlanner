import { describe, expect, it } from 'vitest'
import { recommendSetup } from '~/utils/setupRecommendation'

describe('guided setup recommendation', () => {
  it('includes both resorts when Universal is a priority and explains heat constraints', () => {
    const result = recommendSetup({ pace: 'relaxed', party: 'young-family', priorities: ['Universal parks'], heatTolerance: 'low', thrillLevel: 'low', mustDoParks: [], accessibility: '' })
    expect(result.templateId).toBe('both')
    expect(result.reasons.join(' ')).toMatch(/Universal/)
    expect(result.reasons.join(' ')).toMatch(/heat/i)
    expect(result.confidence).toBe('medium')
  })

  it('labels an answer-light recommendation as low confidence', () => {
    expect(recommendSetup({ pace: 'balanced', party: 'adults', priorities: [], heatTolerance: 'medium', thrillLevel: 'mixed', mustDoParks: [], accessibility: '' }).confidence).toBe('low')
  })
})
