import { describe, expect, it } from 'vitest'
import { projectedDragProgress, resolveMoonRelease } from './moonDrag'

describe('moon drag corridor', () => {
  it('advances when the pointer follows the authored down-right route', () => {
    expect(projectedDragProgress(0, 50, 25, 100, 50)).toBeCloseTo(0.5)
  })

  it('ignores perpendicular drift and clamps movement to the route', () => {
    expect(projectedDragProgress(0, -25, 50, 100, 50)).toBe(0)
    expect(projectedDragProgress(0.9, 100, 50, 100, 50)).toBe(1)
  })

  it('returns early releases and docks completed pulls', () => {
    expect(resolveMoonRelease(0.77)).toBe('return')
    expect(resolveMoonRelease(0.78)).toBe('dock')
  })
})
