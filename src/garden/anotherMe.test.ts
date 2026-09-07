import { describe, expect, it } from 'vitest'
import {
  appearLines,
  farewellScript,
  flowerTint,
  journeyMatchPortraits,
  nextWalkIndex,
  prevAgentState,
  reportPrompt,
  resolveAnotherMe,
  resolveForkAge,
  rewindWalkAges,
  walkBeat,
  walkOptions,
} from './anotherMe'

const planted = [
  { age: 20, choiceId: 'intern' },
  { age: 22, choiceId: 'major' },
]

describe('another me walk', () => {
  it('starts from the archive rewind age, not the last planted flower', () => {
    expect(resolveForkAge(20, planted, 22)).toBe(20)
    expect(resolveForkAge(20, [{ age: 22, choiceId: 'major' }], 22)).toBe(20)
    const profile = resolveAnotherMe(planted, 22, 20, null, 20)
    expect(profile.forkAge).toBe(20)
    expect(profile.presentAge).toBe(22)
    expect(profile.years[0]).toBe(20)
    expect(profile.years.at(-1)).toBe(22)
    expect(rewindWalkAges(20, 22, 20).every(age => age >= 20 && age <= 22)).toBe(true)
    expect(profile.altLabel).toBeTruthy()
    expect(profile.altLabel).not.toBe(profile.yourLabel)
  })

  it('lets the player pick among unused roads, then shows gain, cost and result', () => {
    const profile = resolveAnotherMe(planted, 22, 20, null, 20)
    const open = walkBeat(profile, planted, 0)
    expect(open.age).toBe(20)
    expect(open.last).toBe(false)
    expect(open.choice).toBeUndefined()
    expect(open.options.length).toBeGreaterThanOrEqual(3)
    expect(open.options.every(item => item.id !== 'intern')).toBe(true)
    expect(walkOptions(20, planted).length).toBeGreaterThanOrEqual(3)
    expect(nextWalkIndex(profile, 0)).toBe(1)

    const first = walkBeat(profile, planted, 0, { 20: 'pause' })
    expect(first.choice?.id).toBe('pause')
    expect(first.gain).toBeTruthy()
    expect(first.advantage).toBeTruthy()
    expect(first.cost).toBeTruthy()
    expect(first.result).toBeTruthy()

    const last = walkBeat(profile, planted, profile.years.length - 1, { 20: 'pause' })
    expect(last.age).toBe(22)
    expect(last.last).toBe(true)
    expect(last.choice).toBeUndefined()
    expect(nextWalkIndex(profile, last.index)).toBeNull()

    const cards = journeyMatchPortraits(planted, 22, 20, { 20: 'pause', 22: 'dropout20' })
    expect(cards.filter(item => item.kind === 'A')).toHaveLength(2)
    expect(cards.filter(item => item.kind === 'B')).toHaveLength(2)
    expect(cards.every(item => item.npc.match)).toBe(true)
  })

  it('keeps the appear poem and lets escape walk backward year by year', () => {
    expect(appearLines()).toEqual([
      '有些人生没有消失。',
      '它只是没有发生在你身上。',
      '而现在，你终于看见了它。',
    ])
    expect(farewellScript()).toEqual(['我该回去了。', '剩下的路，你来走。'])
    expect(reportPrompt().title).toContain('两种人生')
    expect(prevAgentState('appear', 0)).toBeNull()
    expect(prevAgentState('walk', 0)).toEqual({ chapter: 'appear', walkIndex: 0 })
    expect(prevAgentState('walk', 1)).toEqual({ chapter: 'walk', walkIndex: 0 })
    expect(prevAgentState('meet', 1)).toEqual({ chapter: 'walk', walkIndex: 1 })
    expect(flowerTint('appear')).toBeLessThan(flowerTint('walk', 0, 2))
    expect(flowerTint('meet')).toBeGreaterThan(0.5)
    expect(flowerTint('farewell')).toBe(1)
  })
})
