import { describe, expect, it } from 'vitest'
import { routePoint } from './archiveWalkRoute'

describe('archive walk route', () => {
  it('starts in the foreground and finishes beside the chair', () => {
    expect(routePoint(0)).toMatchObject({ x: 570, y: 785, scale: 1.18, direction: 'away' })
    expect(routePoint(1)).toMatchObject({ x: 1370, y: 602, scale: 0.78, direction: 'right' })
  })

  it('rounds the desk instead of translating across one horizontal line', () => {
    const samples = [0.55, 0.68, 0.8, 0.92].map(routePoint)
    expect(samples.every((point, index) => index === 0 || point.x > samples[index - 1].x)).toBe(true)
    expect(Math.max(...samples.map((point) => point.y)) - Math.min(...samples.map((point) => point.y))).toBeGreaterThan(30)
    expect(samples.at(-1)?.direction).toBe('right')
  })

  it('keeps the character near one believable scale along the desk edge', () => {
    const deskScales = [0.7, 0.8, 0.9, 1].map((progress) => routePoint(progress).scale)
    expect(Math.max(...deskScales) - Math.min(...deskScales)).toBeLessThan(0.08)
  })
})
