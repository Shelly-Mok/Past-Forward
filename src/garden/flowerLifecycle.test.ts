import { describe, it, expect } from 'vitest'
import { flowerDuration, flowerEndpoint, flowerPoseAt } from './flowerLifecycle'
import { GardenActor, GARDEN_SOIL } from './gardenActor'

describe('authored flower lifecycle', () => {
  it('grows every chosen species through the complete sixteen-pose lifecycle', () => {
    expect(Array.from({ length: 8 }, (_, i) => flowerEndpoint(i))).toEqual([15, 15, 15, 15, 15, 15, 15, 15])
    for (let chapter = 0; chapter < 8; chapter++) expect(flowerPoseAt(chapter, 0).pose).toBe(0)
  })
  it('finishes the complete growth sequence at a brisk but readable pace', () => {
    expect(flowerDuration(0)).toBeGreaterThan(1.2)
    expect(flowerDuration(0)).toBeLessThan(1.7)
  })
  it('visits every intermediate pose, never overshoots, then holds the endpoint', () => {
    for (let chapter = 0; chapter < 8; chapter++) {
      const seen = new Set<number>()
      for (let time = 0; time < flowerDuration(chapter) + .5; time += .01) {
        const sample = flowerPoseAt(chapter, time)
        seen.add(sample.pose)
        expect(sample.next).toBeLessThanOrEqual(flowerEndpoint(chapter))
        expect(sample.mix).toBeGreaterThanOrEqual(0)
        expect(sample.mix).toBeLessThanOrEqual(1)
      }
      expect([...seen]).toEqual(Array.from({ length: flowerEndpoint(chapter) + 1 }, (_, i) => i))
      expect(flowerPoseAt(chapter, 100).pose).toBe(flowerEndpoint(chapter))
    }
  })
  it('keeps the protagonist observing until the complete flower sequence finishes', () => {
    for (let chapter = 0; chapter < 8; chapter++) {
      const actor = new GardenActor()
      actor.start(chapter, GARDEN_SOIL[0], false)
      let completions = 0
      for (let i = 0; i < 2000 && actor.busy; i++) {
        for (const event of actor.advance(.016)) {
          if (event.type === 'complete') {
            completions++
            expect(actor.growthElapsed).toBeGreaterThanOrEqual(flowerDuration(chapter) - .001)
          }
        }
      }
      expect(completions).toBe(1)
    }
  })
  it('cancels growth without later completion events and does not grow on a revisit', () => {
    const actor = new GardenActor()
    actor.start(6, GARDEN_SOIL[2], false)
    for (let i = 0; i < 2000 && actor.phase !== 'observing'; i++) actor.advance(.016)
    expect(actor.growthElapsed).toBeGreaterThan(.6)
    actor.cancel()
    expect(actor.growthElapsed).toBe(0)
    expect(actor.advance(.1)).toEqual([])
    actor.start(6, GARDEN_SOIL[2], true)
    for (let i = 0; i < 1000 && actor.busy; i++) actor.advance(.016)
    expect(actor.growthElapsed).toBe(0)
  })
})
