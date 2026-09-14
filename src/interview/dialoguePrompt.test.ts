import { describe, expect, it } from 'vitest'
import { emptyInterview } from './interviewState'
import { eventDialoguePrompt, fallbackSynthesis, interviewDialoguePrompt } from './dialoguePrompt'

describe('act 3 / act 4 dialogue prompts', () => {
  it('asks the event talk to use the pre-event trail as background and name gain and loss', () => {
    const prompt = eventDialoguePrompt({
      event: { age: 20, text: '第一次实习' },
      events: [{ age: 20, text: '第一次实习' }],
      planted: [
        { age: 18, choiceId: 'college', label: '去上大学' },
        { age: 20, choiceId: 'intern', label: '提前实习' },
      ],
      path: '18岁 · 去上大学 → 20岁 · 提前实习',
    })
    expect(prompt).toContain('去上大学')
    expect(prompt).toContain('第一次实习')
    expect(prompt).toMatch(/得到什么|收益|成就/)
    expect(prompt).toMatch(/失去什么|代价|成本/)
    expect(prompt).toMatch(/考虑/)
    expect(prompt).not.toContain('走廊很静')
  })

  it('gives event talk the personal-tag event description as player wording', () => {
    const prompt = eventDialoguePrompt({
      event: { age: 18, text: '18岁高考' },
      personalTag: {
        plans: '给自己一年',
        eventNotes: [{ age: 18, event: '18岁高考', note: '那天走廊很静' }],
      },
    })
    expect(prompt).toContain('给自己一年')
    expect(prompt).toContain('那天走廊很静')
    expect(prompt).toMatch(/玩家原文|用户写下|记下的事件/)
  })

  it('asks the interview to turn every node into cost, gain, a core reason and a foresight method', () => {
    const prompt = interviewDialoguePrompt({
      node: { age: 20, title: '提前实习' },
      planted: [{ age: 20, choiceId: 'intern', label: '提前实习' }],
      events: [{ age: 20, text: '第一次实习' }],
      eventTalks: [{ age: 20, text: '第一次实习', lines: [{ who: 'other', text: '当时换来的是反馈，交出的是睡眠。' }] }],
      transcript: [{ who: 'you', text: '我想离家近一点' }],
      round: 3,
    })
    expect(prompt).toContain('代价')
    expect(prompt).toContain('成就')
    expect(prompt).toContain('核心原因')
    expect(prompt).toMatch(/前瞻|方法论/)
    expect(prompt).toContain('第一次实习')
    expect(prompt).toContain('我想离家近一点')
    expect(prompt).not.toContain('走廊很静')
  })

  it('gives the interview the personal-tag plans and event descriptions', () => {
    const prompt = interviewDialoguePrompt({
      node: { age: 18, title: '高考' },
      personalTag: {
        plans: '给自己一年',
        eventNotes: [{ age: 18, event: '18岁高考', note: '那天走廊很静' }],
      },
    })
    expect(prompt).toContain('给自己一年')
    expect(prompt).toContain('那天走廊很静')
  })

  it('asks the interview to stay in one conversation and bridge years from the last answer', () => {
    const prompt = interviewDialoguePrompt({
      node: { age: 22, title: '再搏一年' },
      previous: { age: 20, title: '提前实习' },
      lastYou: '我想离家近一点',
      shifted: true,
      transcript: [
        { who: 'other', text: '实习那年你最放不下什么？' },
        { who: 'you', text: '我想离家近一点' },
      ],
      round: 4,
    })
    expect(prompt).toMatch(/连续|连贯|接住/)
    expect(prompt).toContain('我想离家近一点')
    expect(prompt).toMatch(/不要宣布|不要生硬|搭一座桥|轻轻/)
    expect(prompt).not.toMatch(/按时间节点访谈/)
  })

  it('builds a local synthesis of cost, gain, event reason and method from interview slots', () => {
    const state = emptyInterview([{
      id: '20:提前实习',
      age: 20,
      title: '提前实习',
      status: 'complete',
      slots: {
        choice: '先去实习碰世界',
        motive: '想离家近一点也想让家里少操心',
        constraint: '家里存款不够再读一年',
        alternative: '再搏考研',
        agency: '条件妥协',
      },
      sparse: {},
    }])
    const synthesis = fallbackSynthesis({
      state,
      planted: [{ age: 20, choiceId: 'intern', label: '提前实习' }],
      profile: { lifeEvent: '20岁实习' },
      events: [{ age: 20, text: '20岁实习' }],
    })
    expect(synthesis.nodes[0].cost).toContain('家里存款')
    expect(synthesis.nodes[0].gain).toContain('离家近')
    expect(synthesis.eventReason).toMatch(/实习|条件妥协/)
    expect(synthesis.method.length).toBeGreaterThan(8)
  })
})
