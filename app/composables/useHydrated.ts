/**
 * `true` only after the client has mounted. Persisted store state is restored
 * from localStorage post-hydration, so gate anything that reads it on this to
 * avoid SSR/client markup mismatches.
 */
export function useHydrated() {
  const hydrated = useState('app-hydrated', () => false)
  onMounted(() => {
    hydrated.value = true
  })
  return hydrated
}
