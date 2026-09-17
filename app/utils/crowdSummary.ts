export function summarizeCrowds(days: { rating: number }[]) {
  if (!days.length) return null
  const average = days.reduce((sum, day) => sum + day.rating, 0) / days.length
  return {
    average: Number(average.toFixed(1)),
    level: Math.round(average),
    count: days.length,
    quiet: days.filter(day => day.rating <= 2).length,
    busy: days.filter(day => day.rating >= 4).length,
  }
}
