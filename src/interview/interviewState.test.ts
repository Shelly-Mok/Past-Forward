import { describe, expect, it } from 'vitest'
import {
  applyUtterance,
  autoReportReady,
  buildNodes,
  confirmClosing,
  emptyInterview,
  interviewRecap,
  INTERVIEW_ROUND_LIMIT,
  isSparse,
  talkLimitReached,
  talkRounds,
  manualReportPrompt,
  markAgency,
  focusInterviewNode,
  nextMissingSlot,
  requestManualReport,
  authorizeReport,
  type InterviewState,
} from './interviewState'

const LONG = '当时我想离家近一点，也想让家里少操心'

function fillNode(state: InterviewState, id: string): InterviewState {
  let next = state
  for (const slot of ['choice', 'motive', 'constraint', 'alternative'] as const) {
    next = applyUtterance(next, id, slot, LONG)
  }
  return markAgency(next, id, '条件妥协')
}

describe('interview completeness', () => {
  it('builds K from planted flowers plus a life-event age that was not planted', () => {
    const nodes = buildNodes(
      [{ age: 18, choiceId: 'college' }, { age: 20, choiceId: 'intern' }],
      { lifeEvent: '24岁考研' },
      24,
    )
    expect(nodes.map(node => node.age)).toEqual([18, 20, 24])
    expect(nodes[2].title).toContain('考研')
  })

  it('starts the interview at the parsed rewind age, not the earliest planted flower', () => {
    const nodes = buildNodes(
      [{ age: 0, choiceId: 'hometown' }, { age: 18, choiceId: 'college' }],
      { lifeEvent: '18岁高考选了省内' },
      24,
    )
    const state = emptyInterview(nodes, 18)
    expect(state.currentId).toBe(nodes.find(node => node.age === 18)?.id)
  })

  it('treats short or vague answers as sparse and keeps the node interviewing', () => {
    expect(isSparse('还好')).toBe(true)
    expect(isSparse('不知道')).toBe(true)
    expect(isSparse('忘了')).toBe(true)
    expect(isSparse(LONG)).toBe(false)
    const state = emptyInterview(buildNodes([{ age: 18, choiceId: 'college' }], { lifeEvent: '18岁高考' }, 24))
    const next = applyUtterance(state, state.nodes[0].id, 'choice', '还好')
    expect(next.nodes[0].status).toBe('interviewing')
    expect(next.nodes[0].sparse.choice).toBe(true)
    expect(nextMissingSlot(next.nodes[0])).toBe('choice')
    expect(autoReportReady(next)).toBe(false)
  })

  it('does not complete a node until agency is marked', () => {
    const state = emptyInterview(buildNodes([{ age: 18, choiceId: 'college' }], {}, 24))
    let next = state
    for (const slot of ['choice', 'motive', 'constraint', 'alternative'] as const) {
      next = applyUtterance(next, state.nodes[0].id, slot, LONG)
    }
    expect(next.nodes[0].status).toBe('interviewing')
    expect(nextMissingSlot(next.nodes[0])).toBe('agency')
    next = markAgency(next, state.nodes[0].id, '主动偏好')
    expect(next.nodes[0].status).toBe('complete')
  })

  it('refuses a full report when one node is still open', () => {
    const state = emptyInterview(buildNodes(
      [{ age: 18, choiceId: 'college' }, { age: 20, choiceId: 'intern' }],
      {},
      24,
    ))
    const partial = fillNode(state, state.nodes[0].id)
    expect(autoReportReady(partial)).toBe(false)
    expect(manualReportPrompt(partial)).toMatch(/1\/2/)
    expect(manualReportPrompt(partial)).toContain(partial.nodes[0].title)
    const asked = requestManualReport(partial)
    expect(asked.report).toBe('none')
    expect(asked.manualOffered).toBe(true)
  })

  it('asks for closing confirmation before a complete report', () => {
    const state = emptyInterview(buildNodes([{ age: 18, choiceId: 'college' }], {}, 24))
    const filled = fillNode(state, state.nodes[0].id)
    expect(autoReportReady(filled)).toBe(false)
    expect(filled.closingAsked).toBe(true)
    const confirmed = confirmClosing(filled)
    expect(autoReportReady(confirmed)).toBe(true)
    expect(confirmed.report).toBe('full')
    expect(authorizeReport(filled, 'full')).toEqual({ ok: false, status: 409, error: 'INCOMPLETE' })
    expect(authorizeReport(confirmed, 'full').ok).toBe(true)
    expect(authorizeReport(filled, 'partial').ok).toBe(true)
  })

  it('stays on the open node instead of jumping by turn count', () => {
    const state = emptyInterview(buildNodes(
      [{ age: 18, choiceId: 'college' }, { age: 20, choiceId: 'intern' }],
      { lifeEvent: '18岁高考' },
      24,
    ), 18)
    expect(focusInterviewNode(state)?.age).toBe(18)
    const first = fillNode(state, state.nodes[0].id)
    expect(focusInterviewNode(first)?.age).toBe(20)
    const both = fillNode(first, first.nodes[1].id)
    expect(focusInterviewNode(both)?.age).toBe(20)
  })

  it('caps the interview at ten user turns', () => {
    expect(INTERVIEW_ROUND_LIMIT).toBe(10)
    expect(talkRounds([
      { who: 'other', text: '先从最早的节点谈' },
      { who: 'you', text: '我选了实习' },
      { who: 'other', text: '当时最放不下什么' },
      { who: 'you', text: '家里的账' },
    ])).toBe(2)
    expect(talkLimitReached(9)).toBe(false)
    expect(talkLimitReached(10)).toBe(true)
  })

  it('summarizes interview slots for the ending recap, or says the backtest is unfinished', () => {
    expect(interviewRecap(null).empty).toBe(true)
    expect(interviewRecap(null).title).toContain('人生回测')
    const empty = emptyInterview(buildNodes([{ age: 20, choiceId: 'intern' }], {}, 22))
    expect(interviewRecap(empty).empty).toBe(true)
    const filled = confirmClosing(fillNode(empty, empty.nodes[0].id))
    const recap = interviewRecap(filled)
    expect(recap.empty).toBe(false)
    expect(recap.title).toBe('人生回测报告')
    expect(recap.nodes[0].age).toBe(20)
    expect(recap.nodes[0].slots.agency).toBe('条件妥协')
    expect(recap.nodes[0].slots.choice).toContain('离家近')
  })
})
