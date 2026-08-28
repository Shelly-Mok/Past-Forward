import { describe, expect, it } from 'vitest'
import { sampleWarpTimeline, WARP_DURATION_SECONDS } from './warpTimeline'

describe('opening warp timeline', () => {
  it('returns the docked moon to center before the high-speed crossing', () => {
    expect(sampleWarpTimeline(0).returnProgress).toBe(0)
    expect(sampleWarpTimeline(1.35).returnProgress).toBe(1)
    expect(sampleWarpTimeline(1.35).crossingProgress).toBe(0)
  })

  it('reserves the strongest split for the middle of the journey', () => {
    expect(sampleWarpTimeline(2.5).splitPulse).toBe(0)
    expect(sampleWarpTimeline(3.6).splitPulse).toBeGreaterThan(0.95)
    expect(sampleWarpTimeline(5).splitPulse).toBe(0)
  })

  it('settles into an arrived state at the end without overshooting', () => {
    const sample = sampleWarpTimeline(WARP_DURATION_SECONDS + 10)
    expect(sample.phase).toBe('arrived')
    expect(sample.arrivalProgress).toBe(1)
    expect(sample.complete).toBe(true)
    expect(sample.elapsed).toBe(WARP_DURATION_SECONDS)
  })
})
