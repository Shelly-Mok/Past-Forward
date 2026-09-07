import { describe, it, expect } from 'vitest'
import { GardenActor, GARDEN_HOME, GARDEN_SOIL, BOARDING_DOOR, RAMP_FOOT, SHIP_HATCH, boardPath, choicePads, gardenPath, pointOnPath, soilForAge, spreadGroundPoints } from './gardenActor'

function finish(actor: GardenActor) {
  const events = []
  for (let i = 0; i < 2000 && actor.busy; i++) events.push(...actor.advance(.016))
  return events
}
describe('grounded garden actor', () => {
  it('uses the foreground lane and reaches the soil without entering the cabin', () => {
    const route = gardenPath(GARDEN_HOME, { x: 534, y: 776 })
    expect(route[1]).toEqual({ x: GARDEN_HOME.x, y: 776 })
    for (let t = 0; t <= 1; t += .01) {
      const p = pointOnPath(route, t)
      if (p.x < 1300) expect(p.y).toBeGreaterThanOrEqual(775)
    }
    expect(pointOnPath(route, 1)).toEqual({ x: 534, y: 776 })
  })
  it('walks before kneeling, drops exactly one seed and completes after rising', () => {
    const actor = new GardenActor()
    actor.start(2, GARDEN_SOIL[2], false)
    const events = finish(actor)
    expect(events.filter(e => e.type === 'phase').map(e => e.phase)).toEqual(['walking', 'kneeling', 'planting', 'rising', 'observing', 'idle'])
    expect(events.filter(e => e.type === 'seed')).toHaveLength(1)
    expect(events.filter(e => e.type === 'complete')).toEqual([{ type: 'complete', chapter: 2, revisit: false }])
    expect(actor.position).toEqual({ x: 1042, y: 782 })
  })
  it('revisits by touching without another seed and rejects overlapping actions', () => {
    const actor = new GardenActor()
    actor.start(1, GARDEN_SOIL[1], true)
    expect(actor.start(3, GARDEN_SOIL[3], false)).toBe(false)
    const events = finish(actor)
    expect(events.some(e => e.type === 'seed')).toBe(false)
    expect(events.some(e => e.type === 'phase' && e.phase === 'touching')).toBe(true)
  })
  it('places later ages further along the walkable soil line', () => {
    expect(soilForAge(0)).toEqual({ x: 520, y: 776 })
    expect(soilForAge(30).x).toBeGreaterThan(soilForAge(10).x)
    expect(soilForAge(80).y).toBe(776)
    expect(soilForAge(40, 40).x).toBeGreaterThan(soilForAge(20, 40).x)
    expect(soilForAge(40, 40).x).toBe(1380)
  })
  it('spreads adjacent year soils so planted flowers stay clickable', () => {
    const packed = spreadGroundPoints([soilForAge(20), soilForAge(22)])
    expect(packed[1].x - packed[0].x).toBeGreaterThanOrEqual(100)
  })
  it('puts every choice on the lower soil arc above the timeline', () => {
    expect(choicePads(2)).toHaveLength(2)
    expect(choicePads(4)).toHaveLength(4)
    expect(choicePads(6)).toHaveLength(6)
    const pads = choicePads(3)
    expect(pads.every(pad => pad.x > 500 && pad.x < 1300)).toBe(true)
    expect(pads.every(pad => pad.y > 600 && pad.y < 660)).toBe(true)
    expect(pads[1].y).toBeLessThan(pads[0].y)
  })
  it('spills extra flowers to the right of the ship instead of crowding the front arc', () => {
    const pads = choicePads(8)
    expect(pads).toHaveLength(8)
    expect(pads.slice(0, 6).every(pad => pad.x < 1200 && pad.y > 600 && pad.y < 660)).toBe(true)
    expect(pads.slice(6).every(pad => pad.x > 1460 && pad.x < 1640 && pad.y > 560 && pad.y < 780)).toBe(true)
    const extras = pads.slice(6)
    for (let i = 1; i < extras.length; i++) {
      expect(Math.hypot(extras[i].x - extras[i - 1].x, extras[i].y - extras[i - 1].y)).toBeGreaterThanOrEqual(84)
    }
    const nine = choicePads(9).slice(6)
    expect(nine).toHaveLength(3)
    expect(new Set(nine.map(pad => pad.x)).size).toBeGreaterThan(1)
    expect(nine[0].y).toBeGreaterThan(560)
    expect(nine[2].y - nine[0].y).toBeLessThan(200)
  })
  it('walks to the hatch and boards without planting a seed', () => {
    const actor = new GardenActor()
    expect(actor.walkTo(BOARDING_DOOR)).toBe(true)
    expect(actor.walkTo(BOARDING_DOOR)).toBe(false)
    const events = finish(actor)
    expect(events.some(e => e.type === 'seed')).toBe(false)
    expect(events.filter(e => e.type === 'boarded')).toEqual([{ type: 'boarded' }])
    expect(events.filter(e => e.type === 'phase').map(e => e.phase)).toContain('boarding')
    expect(actor.busy).toBe(false)
  })
  it('returns to the hatch along the foreground lane', () => {
    const route = boardPath({ x: 1042, y: 776 })
    expect(route).toContainEqual(RAMP_FOOT)
    expect(route.at(-1)).toEqual(BOARDING_DOOR)
    const mid = pointOnPath(route, .88)
    expect(mid.y).toBeLessThan(RAMP_FOOT.y)
    expect(mid.y).toBeGreaterThan(BOARDING_DOOR.y - 4)
    expect(Math.abs(SHIP_HATCH.x - 68.54)).toBeLessThan(0.05)
    expect(Math.abs(SHIP_HATCH.y - 49.95)).toBeLessThan(0.05)
  })
  it('keeps ship-exit flowers and planted soil on different rows', () => {
    const pads = choicePads(6)
    const soils = [0, 20, 40].map(age => soilForAge(age, 40))
    const maxPadY = Math.max(...pads.map(pad => pad.y))
    expect(soils.every(soil => soil.y - maxPadY >= 110)).toBe(true)
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
