import { describe, expect, it } from 'vitest'
import { eraNodeForAge } from '../garden/gardenContent'
import { buildAltTimeline } from './altTimeline'

describe('alternate timeline from a major event', () => {
  it('starts at the major event and only shows the other life from there', () => {
    const lines = buildAltTimeline(
      [
        { age: 0, choiceId: 'hometown', label: '在老家出生' },
        { age: 18, choiceId: 'college', label: '去上大学' },
        { age: 20, choiceId: 'intern', label: '提前实习 / 兼职，先碰世界' },
        { age: 22, choiceId: 'second', label: '再搏一年' },
      ],
      { lifeEvent: '20岁实习', lifeEvents: [{ age: 20, text: '第一次实习' }] },
      22,
    )
    expect(lines[0]?.age).toBe(20)
    expect(lines.every(line => line.age >= 20)).toBe(true)
    expect(lines.every(line => !line.same)).toBe(true)
    expect(lines.some(line => line.text.includes('去上大学') || line.text.includes('在老家'))).toBe(false)
    const internAlt = eraNodeForAge(20).choices.find(item => item.id !== 'intern' && item.id !== 'own')
    expect(internAlt).toBeTruthy()
    expect(lines[0]?.text).toContain(internAlt!.label)
    expect(lines[0]?.text).not.toContain('提前实习')
    expect(lines.at(-1)?.age).toBe(22)
  })

  it('uses the registered major event, not an earlier extra event, as the fork', () => {
    const lines = buildAltTimeline(
      [
        { age: 12, choiceId: 'move', label: '跟着搬家' },
        { age: 18, choiceId: 'college', label: '去上大学' },
      ],
      { lifeEvent: '18岁高考', lifeEvents: [{ age: 12, text: '跟着父母搬家' }] },
      18,
    )
    expect(lines[0]?.age).toBe(18)
    expect(lines.every(line => line.age >= 18)).toBe(true)
    expect(lines.some(line => line.age === 12)).toBe(false)
  })
})
