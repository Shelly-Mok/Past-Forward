import { describe, expect, it } from 'vitest'
import { ageValue, chapterForAge, isPresentAge, newGardenState, nextTimelineAge, parseTarget, restoreGardenState, shouldEnterCrossroads, timelineNodes, debugGardenProfile } from './gardenState'

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
    expect(timelineNodes(0, 18, 18)).toEqual([0, 5, 10, 15, 18, 20, 25, 30, 35, 40])
    expect(timelineNodes(0, 20, 20, 22)).toEqual([0, 5, 10, 15, 20, 22])
    expect(timelineNodes(0, 18, 18, 24)).toEqual([0, 5, 10, 15, 18, 20, 24])
    expect(timelineNodes(0, 18, 18, 24)).not.toContain(25)
    expect(timelineNodes(1, 18, 18, 24)).toEqual([])
    expect(nextTimelineAge(20, 22)).toBe(22)
    expect(nextTimelineAge(20, 20, 22)).toBe(22)
    expect(nextTimelineAge(22, 20, 22)).toBeNull()
    expect(timelineNodes(2, 83, 83)).toContain(83)
    expect(timelineNodes(2, 83, 83)).toContain(80)
    expect(nextTimelineAge(20, 22)).toBe(22)
    expect(nextTimelineAge(40, null)).toBe(45)
    expect(nextTimelineAge(100, null)).toBeNull()
  })
  it('restores confirmation without mutating the original answer', () => {
    const state = newGardenState({ age: '35', rewind: '毕业前' })
    state.target.age = 18
    state.selectedAge = 18
    state.planted = [{ age: 18, choiceId: 'college' }]
    const restored = restoreGardenState(JSON.stringify(state))
    expect(restored.target).toMatchObject({ raw: '毕业前', age: 18 })
    expect(restored.currentAge).toBe(35)
    expect(restored.planted).toEqual([{ age: 18, choiceId: 'college' }])
  })
  it('handles corrupt saves and isolates a new registration', () => {
    expect(restoreGardenState('{broken').currentAge).toBeNull()
    const old = newGardenState({ age: '24', rewind: '18岁' }); old.planted = [{ age: 18, choiceId: 'college' }]
    expect(restoreGardenState(JSON.stringify(old), { age: '35', rewind: '20岁' }).planted).toEqual([])
  })
  it('opens the present-age fork only when a real age is known', () => {
    expect(isPresentAge(22, null)).toBe(false)
    expect(isPresentAge(22, 22)).toBe(true)
    expect(isPresentAge(25, 22)).toBe(false)
    expect(shouldEnterCrossroads(20, null, 22)).toBe(false)
    expect(shouldEnterCrossroads(20, 22, 22)).toBe(true)
    expect(shouldEnterCrossroads(20, 35, 22)).toBe(false)
    expect(shouldEnterCrossroads(35, 35, 40)).toBe(true)
    const state = newGardenState({ age: '22', rewind: '40岁' })
    expect(state.selectedAge).toBe(22)
    state.reachedPresent = true
    expect(restoreGardenState(JSON.stringify(state)).reachedPresent).toBe(true)
    const stale = newGardenState({ age: '24', rewind: '18岁' })
    stale.planted = [{ age: 18, choiceId: 'college' }, { age: 25, choiceId: 'second' }]
    expect(restoreGardenState(JSON.stringify(stale)).planted).toEqual([{ age: 18, choiceId: 'college' }])
  })
  it('builds a marked demo profile for skipping to act three', () => {
    expect(debugGardenProfile()).toMatchObject({ age: '24', rewind: '18岁', gender: '演示' })
    expect(debugGardenProfile(new URLSearchParams('age=22&rewind=20岁'))).toMatchObject({ age: '22', rewind: '20岁' })
  })
})
