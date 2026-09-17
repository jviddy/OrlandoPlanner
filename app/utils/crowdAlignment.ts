/** Sunday-start comparison weeks, not ISO week numbers. Week 1 starts at
 * the first Sunday in each year; preceding January dates belong to week 0. */
export function alignedDate(year: number, offset: number): string | undefined {
  const first = new Date(Date.UTC(year, 0, 1))
  first.setUTCDate(1 + (7 - first.getUTCDay()) % 7 + offset)
  return first.getUTCFullYear() === year ? first.toISOString().slice(0, 10) : undefined
}

export function alignmentLabel(offset: number): string {
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][((offset % 7) + 7) % 7]
  return `W${offset < 0 ? 0 : Math.floor(offset / 7) + 1} · ${weekday}`
}
