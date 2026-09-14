import { describe, expect, it } from 'vitest'
import { newGardenState } from './gardenState'
import { eraHeading, EVENT_NOTE_COPY, EVENT_TALK_CONTINUE, EVENT_TALK_HINT, EVENT_TALK_OPEN, EVENT_TALK_READY, EVENT_TALK_START, eventTalkActionLabel, eventTalkLaunchVisible, IDEAL_NOTE, MATCH_HONESTY, NOTE_IS_NOT_CHOICE, NPC_KIND_NOTE, portraitQuote, PRESENT_ADVANCE, SKELETON_NOTE, unfinishedEventTalk } from './gardenCopy'

describe('garden copy for parallel-you and event talk', () => {
  it('asks the ideal pick to look for the parallel you', () => {
    expect(IDEAL_NOTE).toBe('我们来查找平行宇宙的「你」')
  })

  it('keeps only the age on era and choice headings', () => {
    expect(eraHeading(5, false)).toBe('5岁')
    expect(eraHeading(5, true)).toBe('5岁 · 平行宇宙')
    expect(eraHeading(5, false, '第一次离开家')).toBe('5岁')
  })

  it('explains A as same-generation and B as cross-generation', () => {
    expect(NPC_KIND_NOTE).toMatch(/A.*同代/)
    expect(NPC_KIND_NOTE).toMatch(/B.*跨代/)
    expect(NPC_KIND_NOTE).not.toMatch(/先点开一位/)
  })

  it('renames the present-year advance after the event talk', () => {
    expect(PRESENT_ADVANCE).toContain('寻找平行宇宙的「他」')
    expect(PRESENT_ADVANCE).not.toContain('前往三岔口')
  })

  it('keeps the skeleton disclaimer off the garden voice', () => {
    expect(SKELETON_NOTE).toBe('')
  })

  it('refuses fake match scores and forged original quotes', () => {
    expect(MATCH_HONESTY).toMatch(/没有真实匹配分数|不是匹配分数/)
    expect(MATCH_HONESTY).toMatch(/不.*伪造|不是真人原话/)
    expect(portraitQuote({ quote: '世界比课表更早收费' })).toBe('')
    expect(portraitQuote({ quote: '世界比课表更早收费', href: 'https://www.zhihu.com' })).toBe('')
    expect(portraitQuote({ quote: '世界比课表更早收费', href: 'https://www.zhihu.com/question/1' })).toBe('世界比课表更早收费')
    expect(portraitQuote({ quote: '世界比课表更早收费', source: 'zhihu' })).toBe('世界比课表更早收费')
  })

  it('keeps local notes distinct from submitted life-branch choices', () => {
    expect(NOTE_IS_NOT_CHOICE).toMatch(/笔记/)
    expect(NOTE_IS_NOT_CHOICE).toMatch(/不等于|不是/)
    expect(NOTE_IS_NOT_CHOICE).toMatch(/分支选择|人生分支/)
  })

  it('asks the event-year memory to write a description into the personal tag', () => {
    expect(EVENT_NOTE_COPY).toMatch(/个人标签/)
    expect(EVENT_NOTE_COPY).toMatch(/怎样|当时/)
    expect(EVENT_NOTE_COPY).toMatch(/不等于|不是/)
  })

  it('holds the voyage until every registered event has been talked through', () => {
    const state = newGardenState({
      age: '24',
      lifeEvent: '18岁高考',
      lifeEvents: [{ age: 12, text: '跟着父母搬家' }],
    })
    state.planted = [0, 5, 10, 12, 15, 18, 20, 24].map(age => ({ age, choiceId: 'mark' }))
    expect(unfinishedEventTalk(state, [])?.text).toBe('跟着父母搬家')
    expect(unfinishedEventTalk(state, [
      { age: 12, lines: [{ who: 'other', text: '搬家那年。' }] },
    ])?.text).toBe('18岁高考')
    expect(unfinishedEventTalk(state, [
      { age: 12, lines: [{ who: 'other', text: '搬家那年。' }] },
      { age: 18, lines: [{ who: 'other', text: '先从高考前讲起。' }] },
    ])).toBeNull()
  })

  it('explains how to start the event talk and where to continue after closing it', () => {
    expect(EVENT_TALK_HINT).toMatch(/时间记录员|记录员/)
    expect(EVENT_TALK_HINT).toMatch(/代价|成就/)
    expect(EVENT_TALK_HINT).toMatch(/开始这一年的对话/)
    expect(EVENT_TALK_READY).toMatch(/开始这一年的对话/)
    expect(EVENT_TALK_READY).toMatch(/继续这一年的对话/)
    expect(EVENT_TALK_START).toBe('开始这一年的对话')
    expect(eventTalkActionLabel(false)).toBe(EVENT_TALK_START)
    expect(eventTalkActionLabel(true)).toBe(EVENT_TALK_CONTINUE)
    expect(EVENT_TALK_OPEN).toBe(EVENT_TALK_START)
    expect(eventTalkLaunchVisible({ pending: true, away: false, talkOpen: false })).toBe(true)
    expect(eventTalkLaunchVisible({ pending: true, away: false, talkOpen: true })).toBe(false)
    expect(eventTalkLaunchVisible({ pending: false, away: false, talkOpen: false })).toBe(false)
    expect(eventTalkLaunchVisible({ pending: true, away: true, talkOpen: false })).toBe(false)
  })
})
