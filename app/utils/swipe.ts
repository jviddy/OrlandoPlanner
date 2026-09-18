export interface SwipePoint {
  x: number
  y: number
  at: number
}

/**
 * Returns the direction a day pager should move. A vertical or slow gesture is
 * deliberately ignored so it remains a normal scroll or tap.
 */
export function horizontalSwipeDirection(start: SwipePoint, end: SwipePoint): -1 | 1 | null {
  const horizontal = end.x - start.x
  const vertical = end.y - start.y
  if (end.at - start.at > 750 || Math.abs(horizontal) < 52 || Math.abs(horizontal) < Math.abs(vertical) * 1.25) return null
  return horizontal < 0 ? 1 : -1
}
