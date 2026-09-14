import { describe, expect, it } from 'vitest'
import {
  buildLifePatch,
  buildLifeConnections,
  buildStarClusters,
  calculateVitality,
  stagedEnvironmentProgress,
  environmentProgress,
  getFlowerPalette,
  getLifePatchSeed,
} from './gardenLifeColor'

describe('choice-driven garden life color', () => {
  it('keeps a planted choice patch deterministic across reloads', () => {
    const first = buildLifePatch(18, 'college18', 2, { x: 760, y: 776 })
    const second = buildLifePatch(18, 'college18', 2, { x: 760, y: 776 })
    expect(first).toEqual(second)
    expect(getLifePatchSeed(18, 'college18')).toBe(getLifePatchSeed(18, 'college18'))
  })

  it('uses the selected flower kind instead of a fixed flower order', () => {
    expect(getFlowerPalette(2)).toEqual({ flower: '#6253c7', plant: '#405d9c', mineral: '#4c8992' })
    expect(getFlowerPalette(7)).toEqual({ flower: '#913e48', plant: '#425f48', mineral: '#8d684b' })
    expect(buildLifePatch(0, 'bell', 2, { x: 520, y: 776 }).palette)
      .not.toEqual(buildLifePatch(0, 'rose', 7, { x: 520, y: 776 }).palette)
  })

  it('calculates vitality from completed plants plus only the active pending fraction', () => {
    expect(calculateVitality(0, 8)).toBe(0)
    expect(calculateVitality(1, 8)).toBe(.125)
    expect(calculateVitality(1, 8, .5)).toBe(.1875)
    expect(calculateVitality(3, 8)).toBeGreaterThan(calculateVitality(2, 8))
    expect(calculateVitality(99, 8)).toBe(1)
  })

  it('holds environment color behind the authored thresholds', () => {
    expect(environmentProgress(.59)).toEqual({ ship: 0, earth: 0, galaxy: 0 })
    expect(environmentProgress(.79).earth).toBe(0)
    expect(environmentProgress(.8).earth).toBe(0)
    expect(environmentProgress(.81).earth).toBeGreaterThan(0)
    expect(environmentProgress(.81).galaxy).toBe(0)
    expect(environmentProgress(1)).toEqual({ ship: 1, earth: 1, galaxy: 1 })
  })

  it('builds deterministic connections only after neighbouring gardens wake', () => {
    const patches = [
      buildLifePatch(0, 'hometown', 0, { x: 520, y: 776 }),
      buildLifePatch(5, 'art', 1, { x: 670, y: 776 }),
      buildLifePatch(10, 'move10', 2, { x: 830, y: 776 }),
    ]
    expect(buildLifeConnections(patches, .34)).toEqual([])
    expect(buildLifeConnections(patches, .5)).toEqual(buildLifeConnections(patches, .5))
    expect(buildLifeConnections(patches, .5).length).toBeGreaterThan(0)
  })

  it('keeps star groups deterministic and activates them only after 82 percent', () => {
    const first = buildStarClusters()
    const second = buildStarClusters()
    expect(first).toEqual(second)
    expect(first[0].activationThreshold).toBe(.82)
    expect(first.every(cluster => cluster.activationThreshold >= .82)).toBe(true)
    expect(first.some(cluster => cluster.activationThreshold >= .97)).toBe(true)
  })

  it('restores feet, hull, earth and sky in separate stages', () => {
    expect(stagedEnvironmentProgress(.59).shipFeet).toBe(0)
    expect(stagedEnvironmentProgress(.7).shipFeet).toBeGreaterThan(0)
    expect(stagedEnvironmentProgress(.7).shipHull).toBe(0)
    expect(stagedEnvironmentProgress(.79).earthOcean).toBe(0)
    expect(stagedEnvironmentProgress(.86).earthOcean).toBeGreaterThan(0)
    expect(stagedEnvironmentProgress(.86).earthLand).toBe(0)
    expect(stagedEnvironmentProgress(1)).toEqual({
      shipFeet: 1, shipRamp: 1, shipHull: 1, shipDetails: 1,
      earthOcean: 1, earthLand: 1, earthComplete: 1, galaxy: 1,
    })
  })

  it('keeps surface reveal geometry anchored to the selected flower patch', () => {
    const patch = buildLifePatch(18, 'college', 4, { x: 920, y: 776 })
    expect(patch.root).toEqual({ x: 920, y: 776 })
    expect(patch.palette).toBe(getFlowerPalette(4))
    expect(patch.lobes.length).toBeGreaterThanOrEqual(3)
  })
})
