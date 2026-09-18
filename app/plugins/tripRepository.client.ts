import { LocalTripRepository, snapshotTrip } from '~/repositories/tripRepository'
import { useTripStore } from '~/stores/trip'

export default defineNuxtPlugin(async (nuxtApp) => {
  const repository = new LocalTripRepository(window.localStorage)
  const store = useTripStore(nuxtApp.$pinia as any)
  const current = await repository.loadCurrent()
  if (current) store.$patch(current)
  store.$subscribe((_mutation, state) => {
    void repository.saveCurrent(snapshotTrip(state))
  }, { detached: true })
  return { provide: { tripRepository: repository } }
})
