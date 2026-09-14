import { describe, expect, it } from 'vitest'
import { buildAltTimeline } from './altTimeline'
import { buildOtherLifeTimeline, extraElderAges, mergeOtherLifeNodes } from './otherLifeTimeline'

describe('Act 4 other-life timeline', () => {
  it('draws extra predecessor ages past the present and labels them as contrast, not a match score', () => {
    const planted = [
      { age: 18, choiceId: 'college', label: '去上大学' },
      { age: 20, choiceId: 'intern', label: '提前实习 / 兼职，先碰世界' },
      { age: 24, choiceId: 'stable', label: '先求稳定' },
    ]
    const profile = { lifeEvent: '18岁高考', lifeEvents: [{ age: 18, text: '18岁高考' }] }
    const extras = extraElderAges(24, 18)
    expect(extras.length).toBeGreaterThanOrEqual(3)
    expect(extras.every(age => age > 24 && age <= 100)).toBe(true)

    const timeline = buildOtherLifeTimeline(planted, profile, 24)
    const ages = timeline.filter(item => item.age !== null).map(item => item.age as number)
    expect(Math.max(...ages)).toBeGreaterThan(24)
    expect(timeline.some(item => extras.includes(item.age as number))).toBe(true)
    expect(timeline.some(item => item.title.includes('对照'))).toBe(true)
    expect(timeline.at(-1)?.detail).toMatch(/不是匹配分数/)
    expect(timeline.map(item => `${item.title}${item.detail}`).join('')).not.toMatch(/匹配分为|匹配分数：/)
    expect(timeline.some(item => item.detail.includes('去上大学'))).toBe(false)
    expect(timeline.at(-1)?.kind).toBe('summary')
  })

  it('overlays public Zhihu nodes onto the demo fork without dropping extra ages', () => {
    const base = buildOtherLifeTimeline(
      [{ age: 18, choiceId: 'college', label: '去上大学' }],
      { lifeEvent: '18岁高考' },
      24,
    )
    const alt = buildAltTimeline(
      [{ age: 18, choiceId: 'college', label: '去上大学' }],
      { lifeEvent: '18岁高考' },
      24,
    )
    const merged = mergeOtherLifeNodes(base, [
      { age: 18, label: '先去当兵', href: 'https://www.zhihu.com/question/1', source: 'zhihu' },
      { age: 36, label: '带过一届新人', href: 'https://www.zhihu.com/answer/2', source: 'zhihu' },
    ])
    expect(merged.find(item => item.age === 18)?.detail).toBe('先去当兵')
    expect(merged.find(item => item.age === 18)?.source).toBe('zhihu')
    expect(merged.find(item => item.age === 36)?.detail).toBe('带过一届新人')
    expect(merged.filter(item => item.age !== null).length).toBeGreaterThan(alt.length)
    expect(merged.some(item => item.title.includes('公开检索') || item.source === 'zhihu')).toBe(true)
  })
})
