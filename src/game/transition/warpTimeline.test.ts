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

  it('holds on one distant particle before it rushes toward the reveal point', () => {
    const particle = sampleWarpTimeline(5.9)
    expect(particle.phase).toBe('focusing')
    expect(particle.particleProgress).toBe(1)
    expect(particle.approachProgress).toBe(0)
    expect(particle.revealProgress).toBe(0)

    const approach = sampleWarpTimeline(6.3)
    expect(approach.phase).toBe('approaching')
    expect(approach.approachProgress).toBeGreaterThan(0)
    expect(approach.approachProgress).toBeLessThan(1)
    expect(approach.approachStretch).toBeGreaterThan(0.95)
    expect(approach.revealProgress).toBe(0)

    const landed = sampleWarpTimeline(6.68)
    expect(landed.phase).toBe('revealing')
    expect(landed.approachProgress).toBe(1)
    expect(landed.approachStretch).toBe(0)

    const reveal = sampleWarpTimeline(6.9)
    expect(reveal.phase).toBe('revealing')
    expect(reveal.revealProgress).toBeGreaterThan(0)
    expect(reveal.revealProgress).toBeLessThan(1)
  })

  it('finishes the reveal with the archive fully visible', () => {
    expect(sampleWarpTimeline(WARP_DURATION_SECONDS).revealProgress).toBe(1)
  })

  it('settles into an arrived state at the end without overshooting', () => {
    const sample = sampleWarpTimeline(WARP_DURATION_SECONDS + 10)
    expect(sample.phase).toBe('arrived')
    expect(sample.arrivalProgress).toBe(1)
    expect(sample.complete).toBe(true)
    expect(sample.elapsed).toBe(WARP_DURATION_SECONDS)
  })
})
