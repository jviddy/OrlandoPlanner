export type ViewMode = 'grid' | 'list'

const STORAGE_KEY = 'orlando-view-mode'
const viewMode = ref<ViewMode>('grid')
let initialized = false

/**
 * Grid-vs-list is a display preference, not trip content, so it's kept out
 * of the trip store and its own small localStorage key instead.
 */
export function useViewMode() {
  if (!initialized && typeof window !== 'undefined') {
    initialized = true
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'grid' || stored === 'list') viewMode.value = stored
    watch(viewMode, (v) => window.localStorage.setItem(STORAGE_KEY, v))
  }
  return { viewMode }
}
