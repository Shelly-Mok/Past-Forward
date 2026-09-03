import { describe, expect, it } from 'vitest'
import { ArchiveMovementGate } from './archiveMovementGate'

describe('archive movement input gate', () => {
  it('swallows a held W until that physical press is released', () => {
    const gate = new ArchiveMovementGate()
    gate.captureHeldKeys(new Set(['KeyW']))

    expect(gate.blocksTextInput('KeyW')).toBe(true)
    gate.release('KeyW')
    expect(gate.blocksTextInput('KeyW')).toBe(false)
  })

  it('does not block unrelated text keys', () => {
    const gate = new ArchiveMovementGate()
    gate.captureHeldKeys(new Set(['KeyW', 'PointerForward']))

    expect(gate.blocksTextInput('KeyA')).toBe(false)
    expect(gate.blocksTextInput('PointerForward')).toBe(false)
  })

  it('clears stale held-key state when the scene resets', () => {
    const gate = new ArchiveMovementGate()
    gate.captureHeldKeys(new Set(['ArrowUp']))
    gate.reset()

    expect(gate.blocksTextInput('ArrowUp')).toBe(false)
  })
})
