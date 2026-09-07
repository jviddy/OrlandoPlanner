import { RESORTS, resolvePark } from '~/data/parks'
import { parseISO } from '~/composables/useDates'
import type { DayItem } from '~/types/trip'

export interface DayCellItem {
  /** The restaurant/activity name itself. */
  label: string
  /** Colour matches the item's own park when it has one, or the day's. */
  color: string
  /** Fuller text for a hover tooltip — name plus its park. */
  title: string
}

export interface DayCellData {
  dateNumber: number
  parkId: string | null
  secondParkId: string | null
  short: string
  items: DayCellItem[]
  more: string
  hotel: string
}

/** Per-day rendering data shared by every overview view (grid, list, share image). */
export function useDayCell() {
  const store = useTripStore()

  function cellItem(item: DayItem, dayParkId: string | null): DayCellItem {
    const effectiveParkId = item.parkId ?? dayParkId
    const park = resolvePark(effectiveParkId, store.customActivities)
    return {
      label: item.title,
      color: park
        ? RESORTS[park.resort].dot
        : item.kind === 'dining'
          ? 'var(--dot-dining)'
          : 'var(--dot-fixed)',
      title: park ? `${item.title} — ${park.name}` : item.title,
    }
  }

  function dayCell(index: number): DayCellData {
    const day = store.days[index]!
    const d = parseISO(day.date)
    const park = resolvePark(day.parkId, store.customActivities)
    const park2 = resolvePark(day.secondParkId, store.customActivities)
    // Budget is 3 slots total: all items if 3 or fewer, otherwise the first
    // two plus a "+N" badge for the rest.
    const visibleItems = day.items.length <= 3 ? day.items : day.items.slice(0, 2)
    const items = visibleItems.map((it) => cellItem(it, day.parkId))
    const extra = day.items.length - visibleItems.length
    return {
      dateNumber: d.getUTCDate(),
      parkId: day.parkId,
      secondParkId: day.secondParkId,
      short: [park?.short, park2?.short].filter(Boolean).join(' + '),
      items,
      more: extra > 0 ? `+${extra}` : '',
      hotel: store.hotelsForDate(day.date).join(' + '),
    }
  }

  return { dayCell }
}
