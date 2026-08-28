import { describe, expect, it } from 'vitest'
import { createGameState } from './gameState'

describe('opening rewind', () => {
  it('snaps back when released too early', () => {
    const game = createGameState()
    game.armPlanet(); game.beginRewind(); game.setRewind(0.4); game.releaseRewind()
    expect(game.getState()).toMatchObject({ phase: 'armed', rewind: 0, year: 2026 })
  })

  it('reveals branches after crossing the threshold', () => {
    const game = createGameState()
    game.armPlanet(); game.beginRewind(); game.setRewind(0.82); game.releaseRewind()
    expect(game.getState()).toMatchObject({ phase: 'branched', rewind: 1, year: 2014 })
  })

  it('requires the planet to be opened before rewind can begin', () => {
    const game = createGameState()
    game.beginRewind()
    expect(game.getState().phase).toBe('idle')
    game.armPlanet()
    expect(game.getState().phase).toBe('armed')
  })
})
