import { describe, expect, it } from 'vitest'
import { horizontalSwipeDirection } from '../app/utils/swipe'

describe('horizontalSwipeDirection', () => {
  it('moves to the next day for a deliberate left swipe and back for a right swipe', () => {
    expect(horizontalSwipeDirection({ x: 300, y: 120, at: 0 }, { x: 180, y: 130, at: 220 })).toBe(1)
    expect(horizontalSwipeDirection({ x: 100, y: 120, at: 0 }, { x: 240, y: 126, at: 220 })).toBe(-1)
  })

  it('leaves scrolling, taps and slow gestures alone', () => {
    expect(horizontalSwipeDirection({ x: 200, y: 100, at: 0 }, { x: 210, y: 240, at: 120 })).toBeNull()
    expect(horizontalSwipeDirection({ x: 200, y: 100, at: 0 }, { x: 230, y: 102, at: 120 })).toBeNull()
    expect(horizontalSwipeDirection({ x: 300, y: 100, at: 0 }, { x: 180, y: 105, at: 800 })).toBeNull()
  })
})
