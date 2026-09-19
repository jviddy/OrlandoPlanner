import { LocalTripRepository, snapshotTrip } from '~/repositories/tripRepository'
import { useTripStore } from '~/stores/trip'
import { useServerTrip } from '~/composables/useServerTrip'

export default defineNuxtPlugin(async (nuxtApp) => {
  const repository = new LocalTripRepository(window.localStorage)
  const store = useTripStore(nuxtApp.$pinia as any)
  const cloud = useServerTrip()
  const current = await repository.loadCurrent()
  if (current) store.$patch(current)
  await cloud.initialize()
  store.$subscribe((_mutation, state) => {
    const snapshot = snapshotTrip(state)
    void repository.saveCurrent(snapshot)
    cloud.scheduleAutoSave()
  }, { detached: true })
  cloud.resumePendingSave()
  return { provide: { tripRepository: repository } }
})
