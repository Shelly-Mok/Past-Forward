import { describe, expect, it } from 'vitest'
import { cannedReply, DEMO_CANDIDATES, OPENING_QUESTION } from './interviewView'

describe('interview view fixtures', () => {
  it('shows two to three demo candidates before a real search', () => {
    expect(DEMO_CANDIDATES.length).toBeGreaterThanOrEqual(2)
    expect(DEMO_CANDIDATES.length).toBeLessThanOrEqual(3)
    expect(DEMO_CANDIDATES.every(item => item.source === 'demo')).toBe(true)
  })

  it('asks one open question for the missing slot', () => {
    expect(cannedReply('choice')).toContain('选的是什么')
    expect(cannedReply('motive')).toContain('放不下')
    expect(cannedReply('agency')).toContain('想要的')
    expect(cannedReply(null)).toMatch(/连着|后来/)
    expect(cannedReply(null, '我想离家近一点')).toContain('离家近')
  })

  it('opens rewind talk from the year the person still remembers', () => {
    expect(OPENING_QUESTION).toMatch(/那一年|最先想到/)
  })
})
