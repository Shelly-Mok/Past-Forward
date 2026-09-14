import { describe, expect, it } from 'vitest'
import { ageValue, chapterForAge, eventTalkAt, forkAges, GARDEN_DEBUG_PROFILE, historyComplete, interviewTrail, isPresentAge, isSkipDemoProfile, lineIdeal, linePlanted, newGardenState, nextTimelineAge, parseTarget, readPlanted, resetYearChoice, restoreGardenState, shouldEnterCrossroads, timelineBand, timelineNodes, uniquePlantedByAge, upsertPlanted, debugGardenProfile } from './gardenState'

describe('garden profile handoff', () => {
  it('keeps present age distinct from rewind age', () => {
    const state = newGardenState({ age: '35', lifeEvent: '18岁高考', education: '本科' })
    expect(state.currentAge).toBe(35)
    expect(state.selectedAge).toBe(0)
    expect(state.target.age).toBe(18)
    expect(chapterForAge(state.selectedAge)).toBe(0)
  })
  it('does not invent age for a year or graduation', () => {
    expect(parseTarget('2020年')).toEqual({ raw: '2020年', kind: 'year', age: null, year: 2020 })
    expect(parseTarget('大学毕业前').age).toBeNull()
    expect(parseTarget('0岁').age).toBe(0)
    expect(ageValue('35garbage')).toBeNull()
  })
  it('parses a rewind time point out of a free-form life event', () => {
    expect(parseTarget('高考那年我选了省内，那时18岁').age).toBe(18)
    expect(parseTarget('我想回到20岁那年辞职').age).toBe(20)
    expect(parseTarget('18周岁高考').age).toBe(18)
    expect(parseTarget('2020年我18岁换了工作')).toMatchObject({ kind: 'age', age: 18, year: 2020 })
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
    const state = newGardenState({ age: '35', lifeEvent: '毕业前' })
    state.target.age = 18
    state.selectedAge = 18
    state.planted = [{ age: 18, choiceId: 'college' }]
    const restored = restoreGardenState(JSON.stringify(state))
    expect(restored.target).toMatchObject({ raw: '毕业前', age: 18 })
    expect(restored.currentAge).toBe(35)
    expect(restored.planted).toEqual([{ age: 18, choiceId: 'college' }])
    state.planted = [{ age: 18, choiceId: 'own', label: '去当兵后来又复员' }]
    expect(restoreGardenState(JSON.stringify(state)).planted).toEqual([{ age: 18, choiceId: 'own', label: '去当兵后来又复员' }])
  })
  it('handles corrupt saves and isolates a new registration', () => {
    expect(restoreGardenState('{broken').currentAge).toBeNull()
    const old = newGardenState({ age: '24', lifeEvent: '18岁高考' }); old.planted = [{ age: 18, choiceId: 'college' }]
    expect(restoreGardenState(JSON.stringify(old), { age: '35', lifeEvent: '20岁实习' }).planted).toEqual([])
    expect(isSkipDemoProfile(GARDEN_DEBUG_PROFILE)).toBe(true)
    const real = newGardenState({ age: '31', lifeEvent: '20岁实习', gender: '女' })
    real.planted = [{ age: 20, choiceId: 'intern' }]
    const kept = restoreGardenState(JSON.stringify(real), GARDEN_DEBUG_PROFILE)
    expect(kept.currentAge).toBe(31)
    expect(kept.planted).toEqual([{ age: 20, choiceId: 'intern' }])
  })
  it('opens the present-age fork only when a real age is known', () => {
    expect(isPresentAge(22, null)).toBe(false)
    expect(isPresentAge(22, 22)).toBe(true)
    expect(isPresentAge(25, 22)).toBe(false)
    expect(shouldEnterCrossroads(20, null, 22)).toBe(false)
    expect(shouldEnterCrossroads(20, 22, 22)).toBe(false)
    expect(shouldEnterCrossroads(20, 24, 24)).toBe(false)
    expect(shouldEnterCrossroads(20, 35, 22)).toBe(false)
    expect(shouldEnterCrossroads(24, 24, null)).toBe(true)
    expect(shouldEnterCrossroads(35, 35, 40)).toBe(true)
    const state = newGardenState({ age: '22', lifeEvent: '40岁转岗' })
    expect(state.selectedAge).toBe(0)
    expect(state.currentAge).toBe(22)
    state.reachedPresent = true
    expect(restoreGardenState(JSON.stringify(state)).reachedPresent).toBe(true)
    const stale = newGardenState({ age: '24', lifeEvent: '18岁高考' })
    stale.planted = [{ age: 18, choiceId: 'college' }, { age: 25, choiceId: 'second' }]
    expect(restoreGardenState(JSON.stringify(stale)).planted).toEqual([{ age: 18, choiceId: 'college' }])
  })
  it('keeps one flower per year when the same age is planted twice', () => {
    expect(uniquePlantedByAge([
      { age: 0, choiceId: 'hometown' },
      { age: 5, choiceId: 'kinder' },
      { age: 0, choiceId: 'city' },
    ])).toEqual([
      { age: 0, choiceId: 'city' },
      { age: 5, choiceId: 'kinder' },
    ])
    expect(upsertPlanted([{ age: 0, choiceId: 'hometown' }], { age: 0, choiceId: 'city' })).toEqual([
      { age: 0, choiceId: 'city' },
    ])
    expect(readPlanted([
      { age: 0, choiceId: 'hometown' },
      { age: 0, choiceId: 'city' },
    ])).toEqual([{ age: 0, choiceId: 'city' }])
  })

  it('stores ideal choices separately from planted flowers and restores them', () => {
    const state = newGardenState({ age: '24', lifeEvent: '18岁高考' })
    expect(state.ideal).toEqual([])
    expect(state.parallelIdeal).toEqual([])
    state.planted = [{ age: 0, choiceId: 'hometown' }, { age: 5, choiceId: 'kinder' }]
    state.ideal = [{ age: 0, choiceId: 'city' }, { age: 5, choiceId: 'art' }]
    const restored = restoreGardenState(JSON.stringify(state))
    expect(restored.planted).toEqual(state.planted)
    expect(restored.ideal).toEqual(state.ideal)
    expect(restored.parallelIdeal).toEqual([])
  })

  it('clears ideal choices from the reset year onward without planting them', () => {
    const state = newGardenState({ age: '24', lifeEvent: '18岁高考' })
    state.planted = [{ age: 0, choiceId: 'hometown' }, { age: 5, choiceId: 'kinder' }]
    state.ideal = [{ age: 0, choiceId: 'city' }, { age: 5, choiceId: 'art' }]
    const reset = resetYearChoice(state, 5)
    expect(reset.planted).toEqual([{ age: 0, choiceId: 'hometown' }])
    expect(reset.ideal).toEqual([{ age: 0, choiceId: 'city' }])
  })

  it('uses the ideal path for interview fusion and falls back to planted years', () => {
    const state = newGardenState({ age: '24', lifeEvent: '18岁高考' })
    state.planted = [{ age: 0, choiceId: 'hometown' }, { age: 5, choiceId: 'kinder' }]
    expect(interviewTrail(state)).toEqual(state.planted)
    state.ideal = [{ age: 0, choiceId: 'city' }]
    expect(interviewTrail(state)).toEqual([
      { age: 0, choiceId: 'city' },
      { age: 5, choiceId: 'kinder' },
    ])
    state.ideal = [{ age: 0, choiceId: 'city' }, { age: 5, choiceId: 'art' }]
    expect(interviewTrail(state)).toEqual(state.ideal)
  })

  it('walks the parallel ideal line from the fork and resets it with that year', () => {
    const state = newGardenState({ age: '24', lifeEvent: '10岁比较' })
    state.line = 'parallel'
    state.forkAge = 10
    state.planted = [{ age: 0, choiceId: 'hometown' }, { age: 10, choiceId: 'contest' }]
    state.parallelPlanted = [{ age: 10, choiceId: 'art' }, { age: 15, choiceId: 'sports' }]
    state.ideal = [{ age: 0, choiceId: 'city' }, { age: 10, choiceId: 'contest' }]
    state.parallelIdeal = [{ age: 10, choiceId: 'art' }, { age: 15, choiceId: 'sports' }]
    expect(lineIdeal(state)).toEqual([
      { age: 0, choiceId: 'city' },
      { age: 10, choiceId: 'art' },
      { age: 15, choiceId: 'sports' },
    ])
    const reset = resetYearChoice(state, 10)
    expect(reset.parallelIdeal).toEqual([])
    expect(reset.ideal).toEqual(state.ideal)
    expect(interviewTrail(reset)).toEqual([{ age: 0, choiceId: 'city' }])
  })

  it('resets this year and later flowers so the path can be chosen again', () => {
    const state = newGardenState({ age: '24', lifeEvent: '18岁高考' })
    state.planted = [
      { age: 0, choiceId: 'hometown' },
      { age: 5, choiceId: 'kinder' },
      { age: 10, choiceId: 'contest' },
    ]
    state.reachedPresent = true
    const reset = resetYearChoice(state, 5)
    expect(reset.planted).toEqual([{ age: 0, choiceId: 'hometown' }])
    expect(reset.reachedPresent).toBe(false)
    expect(state.planted).toHaveLength(3)
  })

  it('resets only the walking parallel years and drops a later fork on the main line', () => {
    const parallel = newGardenState({ age: '24', lifeEvent: '10岁比较' })
    parallel.line = 'parallel'
    parallel.forkAge = 10
    parallel.planted = [{ age: 0, choiceId: 'hometown' }, { age: 10, choiceId: 'contest' }]
    parallel.parallelPlanted = [{ age: 10, choiceId: 'art' }, { age: 15, choiceId: 'sports' }]
    expect(resetYearChoice(parallel, 10).parallelPlanted).toEqual([])
    expect(resetYearChoice(parallel, 10).planted).toEqual(parallel.planted)

    const main = newGardenState({ age: '24', lifeEvent: '10岁比较' })
    main.forkAge = 10
    main.line = 'parallel'
    main.planted = [{ age: 0, choiceId: 'hometown' }, { age: 5, choiceId: 'kinder' }, { age: 10, choiceId: 'contest' }]
    main.parallelPlanted = [{ age: 10, choiceId: 'art' }]
    const resetMain = resetYearChoice({ ...main, line: 'main' }, 5)
    expect(resetMain.planted).toEqual([{ age: 0, choiceId: 'hometown' }])
    expect(resetMain.line).toBe('main')
    expect(resetMain.forkAge).toBeNull()
    expect(resetMain.parallelPlanted).toEqual([])
  })

  it('builds a marked demo profile for skipping to act three', () => {
    expect(debugGardenProfile()).toMatchObject({ age: '24', lifeEvent: '18岁高考', gender: '演示' })
    expect(debugGardenProfile(new URLSearchParams('age=22&event=20岁实习'))).toMatchObject({ age: '22', lifeEvent: '20岁实习' })
    expect(debugGardenProfile(new URLSearchParams('age=22&rewind=20岁'))).toMatchObject({ age: '22', lifeEvent: '20岁' })
    expect(debugGardenProfile(new URLSearchParams('age=52'))).toMatchObject({ age: '52' })
    expect(timelineBand(39)).toBe(0)
    expect(timelineBand(40)).toBe(1)
    expect(linePlanted({
      line: 'parallel', forkAge: 20,
      planted: [{ age: 10, choiceId: 'home' }, { age: 20, choiceId: 'major' }],
      parallelPlanted: [{ age: 20, choiceId: 'intern' }],
    })).toEqual([{ age: 10, choiceId: 'home' }, { age: 20, choiceId: 'intern' }])
    const forked = newGardenState({ age: '40', lifeEvent: '20岁实习' })
    forked.planted = [{ age: 20, choiceId: 'major' }, { age: 40, choiceId: 'hold' }]
    expect(forkAges(forked)).toEqual([20, 40])
    expect(timelineNodes(1, 18, 0, 52)).toEqual([40, 45, 50, 52])
    expect(timelineNodes(0, 18, 0, 52)).toEqual([0, 5, 10, 15, 18, 20, 25, 30, 35, 40])
    expect(timelineNodes(1, 18, 0, 24)).toEqual([])
  })

  it('pins extra life-event ages on the timeline and opens talk only after every year is planted', () => {
    expect(timelineNodes(0, 18, 0, 24, [12, 16])).toEqual([0, 5, 10, 12, 15, 16, 18, 20, 24])
    expect(nextTimelineAge(10, 18, 24, [12])).toBe(12)
    const state = newGardenState({
      age: '24',
      lifeEvent: '18岁高考',
      lifeEvents: [{ age: 12, text: '跟着父母搬家' }],
    })
    expect(eventTalkAt(state, 12)).toBeNull()
    state.planted = [0, 5, 10, 12, 15, 18, 20, 24].map(age => ({ age, choiceId: 'mark' }))
    expect(historyComplete(state)).toBe(true)
    expect(eventTalkAt(state, 12)).toEqual({ age: 12, text: '跟着父母搬家' })
    expect(eventTalkAt(state, 10)).toBeNull()
    expect(restoreGardenState(JSON.stringify(state)).profile.lifeEvents).toEqual([{ age: 12, text: '跟着父母搬家' }])
  })
})
