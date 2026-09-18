import type { SetupDraft } from '~/stores/setup'

export interface SetupRecommendation {
  templateId: 'disney' | 'both'
  confidence: 'medium' | 'low'
  headline: string
  reasons: string[]
  tradeoffs: string[]
}

export function recommendSetup(input: Pick<SetupDraft, 'pace' | 'party' | 'priorities' | 'heatTolerance' | 'thrillLevel' | 'mustDoParks' | 'accessibility'>): SetupRecommendation {
  const wantsUniversal = input.priorities.includes('Universal parks') || input.mustDoParks.some((id) => ['usf', 'ioa', 'eu', 'vb'].includes(id))
  const templateId = wantsUniversal ? 'both' : 'disney'
  const reasons = [
    input.pace === 'relaxed' ? 'Regular recovery days reduce long park runs.' : input.pace === 'full' ? 'More park days match the fuller pace you selected.' : 'Park days and recovery time are kept in balance.',
    input.party === 'young-family' ? 'Shorter runs and flexible recovery time suit a young family.' : input.party === 'mixed' ? 'The mix leaves room for different ages and energy levels.' : 'The plan keeps headline parks while leaving evenings flexible.',
  ]
  if (wantsUniversal) reasons.push('Universal is included because it is one of your priorities or must-do parks.')
  if (input.heatTolerance === 'low') reasons.push('Low heat tolerance makes pool and recovery time especially useful.')
  if (input.accessibility.trim()) reasons.push('Your accessibility note is retained as a planning constraint for review.')
  const tradeoffs = [
    templateId === 'both' ? 'Covering both resorts creates more transfer and ticket complexity.' : 'This shape concentrates on Disney and leaves other resorts unset.',
    input.thrillLevel === 'low' ? 'Park choice still needs attraction-level checks for low-thrill preferences.' : 'Ride-level preferences are not used to promise exact attraction coverage.',
  ]
  return { templateId, confidence: input.mustDoParks.length || input.priorities.length ? 'medium' : 'low', headline: input.pace === 'relaxed' ? 'A recovery-first Orlando shape' : input.pace === 'full' ? 'A fuller park-focused shape' : 'A balanced Orlando shape', reasons, tradeoffs }
}
