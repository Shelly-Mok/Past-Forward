import { describe, expect, it } from 'vitest'
import { portalRoutePoint, PORTAL_WALK_SECONDS } from './archivePortalRoute'

describe('archive portal route', () => {
  it('starts beside the chair and stops at the centre of the vault threshold', () => {
    expect(portalRoutePoint(0)).toMatchObject({ x: 1370, y: 602, scale: 0.78, direction: 'left' })
    expect(portalRoutePoint(1)).toMatchObject({ x: 897, y: 543, scale: 0.64, direction: 'away' })
  })

  it('follows the right platform diagonally without crossing the desk or the doorway', () => {
    const samples = [0, 0.2, 0.4, 0.6, 0.8, 1].map(portalRoutePoint)
    expect(samples.every((point, index) => index === 0 || point.x < samples[index - 1].x)).toBe(true)
    expect(Math.max(...samples.map((point) => point.y)) - Math.min(...samples.map((point) => point.y))).toBeGreaterThan(55)
    expect(samples.at(-1)?.direction).toBe('away')
  })

  it('uses a restrained walk speed and perspective scale', () => {
    expect(PORTAL_WALK_SECONDS).toBeGreaterThan(7)
    expect(portalRoutePoint(1).scale).toBeLessThan(portalRoutePoint(0).scale)
  })
})
