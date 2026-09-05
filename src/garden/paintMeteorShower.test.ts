import { describe, expect, it } from 'vitest'
import { LIFE_STREAK, lifePoint } from './paintMeteorShower'

describe('meteor shower', () => {
  it('puts the life streak across the sky, not in a corner fan', () => {
    const start = lifePoint(0)
    const end = lifePoint(1)
    expect(LIFE_STREAK.x1).toBeGreaterThan(LIFE_STREAK.x2)
    expect(LIFE_STREAK.y2).toBeGreaterThan(LIFE_STREAK.y1)
    expect(start.x).toBeGreaterThan(end.x)
    expect(end.y).toBeGreaterThan(start.y)
  })
})
