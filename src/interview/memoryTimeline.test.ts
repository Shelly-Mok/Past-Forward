import { describe, expect, it } from 'vitest'
import { buildMemoryTimeline, memoryTimelineLayout } from './memoryTimeline'

describe('Act 4 memory timeline', () => {
  it('uses collected events and the choices the player actually planted', () => {
    const timeline = buildMemoryTimeline(
      [
        { age: 12, choiceId: 'move', label: '跟着搬家' },
        { age: 18, choiceId: 'college', label: '去上大学' },
        { age: 20, choiceId: 'study', label: '把专业读完' },
      ],
      { lifeEvent: '18岁高考结束', lifeEvents: [{ age: 22, text: '第一次实习' }] },
      24,
    )
    expect(timeline.some(item => item.age === 12)).toBe(false)
    expect(timeline.map(item => item.detail)).toEqual([
      '高考结束',
      '去上大学',
      '把专业读完',
      '第一次实习',
      '这些选择，形成了现在的你。',
    ])
    expect(timeline.some(item => item.detail.includes('另一条路'))).toBe(false)
  })

  it('keeps a deterministic multi-row route inside the visible stage', () => {
    const first = memoryTimelineLayout(16, 1200, 560)
    const second = memoryTimelineLayout(16, 1200, 560)
    expect(first).toEqual(second)
    expect(first.width).toBe(1200)
    expect(first.rows).toBeGreaterThan(1)
    expect(first.points.every(point => point.x > 0 && point.x < first.width)).toBe(true)
    expect(first.points.every(point => point.y > 0 && point.y < first.height)).toBe(true)
    expect(new Set(first.points.map(point => point.y)).size).toBeGreaterThan(3)
  })
})
