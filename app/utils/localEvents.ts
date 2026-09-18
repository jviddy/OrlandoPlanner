export type LocalEventName = 'share_story_selected' | 'share_preview_generated' | 'share_caption_copied' | 'share_native_opened' | 'share_downloaded'

/** Privacy-safe local counters only. No trip content or remote analytics. */
export function recordLocalEvent(name: LocalEventName) {
  if (typeof localStorage === 'undefined') return
  const key = 'orlando-local-events'
  let current: Record<string, { count: number; lastAt: string }> = {}
  try { current = JSON.parse(localStorage.getItem(key) ?? '{}') } catch { current = {} }
  current[name] = { count: (current[name]?.count ?? 0) + 1, lastAt: new Date().toISOString() }
  localStorage.setItem(key, JSON.stringify(current))
}
