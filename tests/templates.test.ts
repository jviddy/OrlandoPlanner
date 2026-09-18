import { describe, expect, it } from 'vitest'
import { TEMPLATES, templatePlan } from '~/data/templates'

const recovery = new Set(['pool', 'shop', 'rest', 'travel'])

describe('long-trip starting shapes', () => {
  for (const template of TEMPLATES.filter((item) => item.pattern)) {
    it(`${template.name} keeps long trips plausible`, () => {
      const plan = templatePlan(template.pattern, 35)
      expect(plan[0]).toBe('travel')
      expect(plan.at(-1)).toBe('travel')
      expect(plan.slice(1, -1)).not.toContain('travel')
      for (let index = 2; index < plan.length - 1; index++) expect(plan[index]).not.toBe(plan[index - 1])
      let run = 0
      for (const day of plan.slice(1, -1)) {
        run = day && !recovery.has(day) ? run + 1 : 0
        expect(run).toBeLessThanOrEqual(3)
      }
    })
  }
})
