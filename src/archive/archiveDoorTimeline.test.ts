import { describe, expect, it } from 'vitest'
import {
  ARCHIVE_DOOR_OPEN_SECONDS,
  ARCHIVE_DOOR_UNLOCK_SECONDS,
  ARCHIVE_MEMORY_REEL_SECONDS,
  sampleArchiveDoorTimeline,
} from './archiveDoorTimeline'

describe('archive door timeline', () => {
  it('keeps the vault closed for one complete memory reel', () => {
    expect(sampleArchiveDoorTimeline(0).phase).toBe('audit')
    expect(sampleArchiveDoorTimeline(ARCHIVE_MEMORY_REEL_SECONDS - 0.01).phase).toBe('audit')
  })

  it('unlocks before the heavy door starts opening', () => {
    expect(sampleArchiveDoorTimeline(ARCHIVE_MEMORY_REEL_SECONDS).phase).toBe('unlocking')
    expect(sampleArchiveDoorTimeline(
      ARCHIVE_MEMORY_REEL_SECONDS + ARCHIVE_DOOR_UNLOCK_SECONDS,
    ).phase).toBe('opening')
  })

  it('exposes the portal only after the opening motion finishes', () => {
    const portalAt = ARCHIVE_MEMORY_REEL_SECONDS
      + ARCHIVE_DOOR_UNLOCK_SECONDS
      + ARCHIVE_DOOR_OPEN_SECONDS
    expect(sampleArchiveDoorTimeline(portalAt - 0.01).phase).toBe('opening')
    expect(sampleArchiveDoorTimeline(portalAt).phase).toBe('portal')
  })

  it('keeps the door rigid and rotates it around the left edge', () => {
    const openingAt = ARCHIVE_MEMORY_REEL_SECONDS + ARCHIVE_DOOR_UNLOCK_SECONDS
    const early = sampleArchiveDoorTimeline(openingAt + ARCHIVE_DOOR_OPEN_SECONDS * 0.08)
    const middle = sampleArchiveDoorTimeline(openingAt + ARCHIVE_DOOR_OPEN_SECONDS * 0.55)

    expect(early.sealProgress).toBe(0)
    expect(early.doorDepth).toBe(0)
    expect(early.doorAngle).toBeGreaterThan(0)
    expect(middle.doorAngle).toBeGreaterThan(35)
    expect(middle.doorDepth).toBe(0)
  })

  it('slows cleanly into the final angle without changing the door itself', () => {
    const openingAt = ARCHIVE_MEMORY_REEL_SECONDS + ARCHIVE_DOOR_UNLOCK_SECONDS
    const nearStop = sampleArchiveDoorTimeline(openingAt + ARCHIVE_DOOR_OPEN_SECONDS * 0.92)
    const settled = sampleArchiveDoorTimeline(openingAt + ARCHIVE_DOOR_OPEN_SECONDS)

    expect(nearStop.doorAngle).toBeLessThanOrEqual(settled.doorAngle)
    expect(settled.doorAngle).toBe(75)
    expect(settled.settleProgress).toBe(1)
    expect(settled.finalBlend).toBe(0)
  })

  it('shortens the wait while preserving phase order for reduced motion', () => {
    expect(sampleArchiveDoorTimeline(0.92, true).phase).toBe('unlocking')
    expect(sampleArchiveDoorTimeline(1.6, true).phase).toBe('portal')
  })
})
