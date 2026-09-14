import { describe, expect, it } from 'vitest'
import { eraNodeForAge, OWN_CHOICE_ID } from './gardenContent'
import {
  EVENT_MARK_ID,
  EVENT_MARK_LABEL,
  eventEraFallback,
  eventIdealChoices,
  eventMarkChoice,
  eventPlantedLabel,
  eventYearChoices,
  eventYearMemoryVisible,
  lifeEventAtAge,
  parseEventYearPayload,
} from './gardenEventYear'

describe('event-year garden overlay', () => {
  const event = { age: 18, text: '18岁高考' }

  it('treats registered life-event ages as event years and other ages as ordinary', () => {
    const profile = {
      lifeEvent: '18岁高考',
      lifeEvents: [{ age: 12, text: '跟着父母搬家' }],
    }
    expect(lifeEventAtAge(profile, 18, 18)?.text).toBe('18岁高考')
    expect(lifeEventAtAge(profile, 12, 18)?.text).toBe('跟着父母搬家')
    expect(lifeEventAtAge(profile, 20, 18)).toBeNull()
  })

  it('plants the event year as a single mark flower labeled 记下这一岁', () => {
    const choice = eventMarkChoice(event.age, event.text)
    expect(choice.id).toBe(EVENT_MARK_ID)
    expect(choice.label).toBe(EVENT_MARK_LABEL)
    expect(choice.label).toBe('记下这一岁')
    expect(eventPlantedLabel(choice, event.text)).toBe('18岁高考')
    expect(eventYearChoices(event.age, event, 'plant', [], eraNodeForAge(18))).toEqual([choice])
  })

  it('uses the registered event text for era copy when the model is silent', () => {
    expect(eventEraFallback(event)).toContain('18岁高考')
    expect(eventEraFallback(event)).not.toMatch(/知乎|模型|检索/)
  })

  it('reads model era copy and hoped-for flowers from the event-year payload', () => {
    const parsed = parseEventYearPayload({
      ok: true,
      era: '分数把走廊分成两半。你写下了高考这一年。',
      ideals: [
        { id: 'hope-leave', label: '去外省读书', reason: '想离开熟悉的城' },
        { label: '复读一年', reason: '还想再搏一次' },
      ],
    })
    expect(parsed).toEqual({
      era: '分数把走廊分成两半。你写下了高考这一年。',
      ideals: [
        { id: 'hope-leave', label: '去外省读书', reason: '想离开熟悉的城' },
        { id: 'ideal-1', label: '复读一年', reason: '还想再搏一次' },
      ],
    })
    expect(parseEventYearPayload({ era: '' })).toBeNull()
    expect(parseEventYearPayload({ ideals: [{ label: '去外省' }] })).toBeNull()
  })

  it('shows hoped-for flowers after planting, falling back to authored forks without the mark flower', () => {
    const fromModel = eventIdealChoices(18, [
      { id: 'hope-leave', label: '去外省读书', reason: '想离开熟悉的城' },
    ], eraNodeForAge(18))
    expect(fromModel).toHaveLength(1)
    expect(fromModel[0]?.id).toBe('hope-leave')
    expect(fromModel[0]?.label).toBe('去外省读书')
    expect(fromModel[0]?.id).not.toBe(EVENT_MARK_ID)

    const fallback = eventYearChoices(18, event, 'ideal', [], eraNodeForAge(18))
    expect(fallback.length).toBeGreaterThanOrEqual(3)
    expect(fallback.every(item => item.id !== EVENT_MARK_ID && item.id !== OWN_CHOICE_ID)).toBe(true)
    expect(fallback.some(item => item.label === '记下这一岁')).toBe(false)
  })

  it('shows the left 记下这一岁 control only on an opened event year', () => {
    expect(eventYearMemoryVisible({ eventYear: true, away: false, yearOpen: true })).toBe(true)
    expect(eventYearMemoryVisible({ eventYear: true, away: false, yearOpen: false })).toBe(false)
    expect(eventYearMemoryVisible({ eventYear: false, away: false, yearOpen: true })).toBe(false)
    expect(eventYearMemoryVisible({ eventYear: true, away: true, yearOpen: true })).toBe(false)
  })
})
