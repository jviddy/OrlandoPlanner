import { defineStore } from 'pinia'
import type { SetupMode, TripDetailsDraft } from '~/types/trip'

export interface SetupDraft extends TripDetailsDraft {
  version: 1
  mode: SetupMode | null
  step: number
  templateId: 'blank' | 'disney' | 'both'
  bookedFacts: string[]
  party: 'adults' | 'young-family' | 'mixed'
  pace: 'relaxed' | 'balanced' | 'full'
  priorities: string[]
  accessibility: string
}

function freshSetup(): SetupDraft {
  return {
    version: 1,
    mode: null,
    step: 0,
    name: 'My Trip',
    startDate: '',
    endDate: '',
    weekStart: 'monday',
    hotels: [],
    ticketDays: { disney: 0, universal: 0 },
    parkHopper: false,
    flights: [],
    carHire: '',
    templateId: 'blank',
    bookedFacts: [],
    party: 'mixed',
    pace: 'balanced',
    priorities: [],
    accessibility: '',
  }
}

export const useSetupStore = defineStore('orlando-setup', {
  state: freshSetup,
  persist: true,
  actions: {
    start(mode: SetupMode) {
      this.mode = mode
      this.step = 1
    },
    toggleFact(value: string) {
      this.bookedFacts = this.bookedFacts.includes(value)
        ? this.bookedFacts.filter((item) => item !== value)
        : [...this.bookedFacts, value]
    },
    togglePriority(value: string) {
      this.priorities = this.priorities.includes(value)
        ? this.priorities.filter((item) => item !== value)
        : [...this.priorities, value]
    },
    clear() { this.$patch(freshSetup()) },
  },
})
