import { describe, expect, it } from 'vitest'
import { ageValue, chapterForAge, chapterNodes, newGardenState, parseTarget, restoreGardenState } from './gardenState'

describe('garden profile handoff', () => {
  it('keeps present age distinct from rewind age', () => {
    const state = newGardenState({ age: '35', rewind: '18岁', family: '与父母同住' })
    expect(state.currentAge).toBe(35)
    expect(state.selectedAge).toBe(18)
    expect(chapterForAge(state.selectedAge)).toBe(1)
  })
  it('does not invent age for a year or graduation', () => {
    expect(parseTarget('2020年')).toEqual({ raw: '2020年', kind: 'year', age: null, year: 2020 })
    expect(parseTarget('大学毕业前').age).toBeNull()
    expect(parseTarget('0岁').age).toBe(0)
    expect(ageValue('35garbage')).toBeNull()
  })
  it('supports boundary ages, late life and exact target nodes', () => {
    expect([0, 10, 20, 60, 70, 100].map(chapterForAge)).toEqual([0, 1, 2, 6, 7, 7])
    expect(chapterNodes(1, 18, 18)).toContain(18)
    expect(chapterNodes(7, 83, 83)).toContain(83)
  })
  it('restores confirmation without mutating the original answer', () => {
    const state = newGardenState({ age: '35', rewind: '毕业前' })
    state.target.age = 18
    state.selectedAge = 18
    state.planted = [1]
    const restored = restoreGardenState(JSON.stringify(state))
    expect(restored.target).toMatchObject({ raw: '毕业前', age: 18 })
    expect(restored.currentAge).toBe(35)
    expect(restored.planted).toEqual([1])
  })
  it('handles corrupt saves and isolates a new registration', () => {
    expect(restoreGardenState('{broken').currentAge).toBeNull()
    const old = newGardenState({ age: '24', rewind: '18岁' }); old.planted = [1]
    expect(restoreGardenState(JSON.stringify(old), { age: '35', rewind: '20岁' }).planted).toEqual([])
  })
})
