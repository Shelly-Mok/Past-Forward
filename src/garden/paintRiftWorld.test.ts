import { describe, expect, it } from 'vitest'
import { RIFT_WORLD_LOOK } from './paintRiftWorld'
import type { RiftKind } from './riftContent'

describe('rift world painting', () => {
  it('gives each fork a different planet mass, well and ring', () => {
    const kinds: RiftKind[] = ['backtrack', 'forward', 'foresight', 'end']
    const signatures = kinds.map(kind => {
      const look = RIFT_WORLD_LOOK[kind]
      expect(look.radius).toBeGreaterThan(12)
      expect(look.well).toBeGreaterThan(2)
      expect(look.ring).toBeGreaterThan(look.radius)
      return `${look.radius}:${look.well}:${look.ring}:${look.ringTilt}`
    })
    expect(new Set(signatures).size).toBe(4)
  })
})
