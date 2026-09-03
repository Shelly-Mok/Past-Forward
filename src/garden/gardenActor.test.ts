import { describe, it, expect } from 'vitest'
import { GardenActor, GARDEN_HOME, GARDEN_SOIL, gardenPath, pointOnPath } from './gardenActor'

function finish(actor: GardenActor) {
  const events = []
  for (let i = 0; i < 2000 && actor.busy; i++) events.push(...actor.advance(.016))
  return events
}
describe('grounded garden actor', () => {
  it('uses the foreground lane and reaches the soil without entering the cabin', () => {
    const route = gardenPath(GARDEN_HOME, { x: 534, y: 730 })
    expect(route[1]).toEqual({ x: 1380, y: 682 })
    for (let t = 0; t <= 1; t += .01) {
      const p = pointOnPath(route, t)
      if (p.x < 1300) expect(p.y).toBeGreaterThanOrEqual(729)
    }
    expect(pointOnPath(route, 1)).toEqual({ x: 534, y: 730 })
  })
  it('walks before kneeling, drops exactly one seed and completes after rising', () => {
    const actor = new GardenActor()
    actor.start(2, GARDEN_SOIL[2], false)
    const events = finish(actor)
    expect(events.filter(e => e.type === 'phase').map(e => e.phase)).toEqual(['walking', 'kneeling', 'planting', 'rising', 'observing', 'idle'])
    expect(events.filter(e => e.type === 'seed')).toHaveLength(1)
    expect(events.filter(e => e.type === 'complete')).toEqual([{ type: 'complete', chapter: 2, revisit: false }])
    expect(actor.position).toEqual({ x: 1042, y: 730 })
  })
  it('revisits by touching without another seed and rejects overlapping actions', () => {
    const actor = new GardenActor()
    actor.start(1, GARDEN_SOIL[1], true)
    expect(actor.start(3, GARDEN_SOIL[3], false)).toBe(false)
    const events = finish(actor)
    expect(events.some(e => e.type === 'seed')).toBe(false)
    expect(events.some(e => e.type === 'phase' && e.phase === 'touching')).toBe(true)
  })
  it('cancels at current feet instead of teleporting home or committing a seed', () => {
    const actor = new GardenActor()
    actor.start(0, GARDEN_SOIL[0], false)
    for (let i = 0; i < 100; i++) actor.advance(.016)
    const location = { ...actor.position }
    actor.cancel()
    expect(actor.advance(1)).toEqual([])
    expect(actor.position).toEqual(location)
    expect(actor.busy).toBe(false)
  })
})
