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
  thrillLevel: 'low' | 'mixed' | 'high'
  heatTolerance: 'low' | 'medium' | 'high'
  mustDoParks: string[]
  bookings: SetupBooking[]
}

export interface SetupBooking {
  id: string
  title: string
  date: string
  time: string
  parkId: string
  kind: 'dining' | 'fixed'
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
    confirmationNumber: '',
    bookingPhone: '',
    partySize: null,
    templateId: 'blank',
    bookedFacts: [],
    party: 'mixed',
    pace: 'balanced',
    priorities: [],
    accessibility: '',
    thrillLevel: 'mixed',
    heatTolerance: 'medium',
    mustDoParks: [],
    bookings: [],
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
    addBooking(kind: 'dining' | 'fixed') {
      this.bookings.push({ id: createStableId('item'), title: '', date: this.startDate, time: '', parkId: '', kind })
    },
    removeBooking(id: string) { this.bookings = this.bookings.filter((booking) => booking.id !== id) },
    toggleMustDo(parkId: string) {
      this.mustDoParks = this.mustDoParks.includes(parkId)
        ? this.mustDoParks.filter((id) => id !== parkId)
        : [...this.mustDoParks, parkId]
    },
    clear() { this.$patch(freshSetup()) },
  },
})
