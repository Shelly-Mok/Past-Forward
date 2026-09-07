import { describe, expect, it } from 'vitest'
import { bloggerArchiveFor, chanceText, choicePostFor, CROSSROADS_VOYAGE, endSkyLetterFor, followKeyForChoice, FORESIGHT_YEARS, foresightAges, foresightTitle, foresightYearsFor, holeHintFor, RIFT_HOLES } from './riftContent'
import { signalPortraits } from './gardenContent'

describe('present-age rift content', () => {
  it('keeps the transit caption that opens the last-year departure', () => {
    expect(CROSSROADS_VOYAGE.kicker).toContain('前往三岔口')
    expect(CROSSROADS_VOYAGE.title).toContain('新的节点')
    expect(CROSSROADS_VOYAGE.lead).toContain('过去已经写下')
    expect(CROSSROADS_VOYAGE.action).toContain('前往三岔口')
  })
  it('keeps three labeled holes on the moon', () => {
    expect(RIFT_HOLES.map(item => item.label)).toEqual(['回溯', '前瞻', '结束'])
    expect(RIFT_HOLES.map(item => item.kicker)).toEqual([
      '第四幕 · 平行宇宙',
      '第五幕 · 尚未发生的年',
      '第六幕 · 带着领悟离开',
    ])
    expect(RIFT_HOLES.every(item => item.x > 18 && item.x < 85 && item.y > 28 && item.y < 46)).toBe(true)
    expect(RIFT_HOLES.every(item => item.y < 55)).toBe(true)
  })
  it('maps garden choices onto follow scenes and nudges foresight chances', () => {
    expect(followKeyForChoice('second')).toBe('second')
    expect(followKeyForChoice('major')).toBe('job')
    const year = FORESIGHT_YEARS[0]
    const boosted = chanceText(year.branches[2], 'second')
    const base = chanceText(year.branches[2], 'job')
    expect(boosted.startsWith('26%')).toBe(true)
    expect(Number.parseInt(base, 10)).toBeLessThan(Number.parseInt(boosted, 10))
    expect(foresightAges(22)).toEqual([23, 24, 25])
    expect(foresightAges(40)).toEqual([41, 42, 43])
    expect(foresightTitle(40)).toBe('41 → 42 → 43 岁可能的走向')
    expect(foresightYearsFor(40).map(item => item.age)).toEqual([41, 42, 43])
    expect(holeHintFor('foresight', 40)).toBe('看 41–43 岁的可能')
  })
  it('builds a demo Zhihu-shaped post that can be swapped for a real answer', () => {
    const post = choicePostFor(20, 'intern')
    expect(post.source).toBe('demo')
    expect(post.title).toContain('如果选了')
    expect(post.author.length).toBeGreaterThan(1)
    expect(post.paragraphs.length).toBeGreaterThan(1)
    expect(post.href).toContain('zhihu.com')
  })
  it('builds a demo archive of posts for a companion blogger', () => {
    const [same] = signalPortraits(20, 'major')
    const archive = bloggerArchiveFor(same)
    expect(archive).toHaveLength(3)
    expect(archive.every(item => item.author === same.npc.name)).toBe(true)
    expect(archive[0].title).toContain(same.choice.label)
    expect(archive.every(item => item.href.includes('zhihu.com'))).toBe(true)
  })
  it('writes an end-sky letter from era background, the planted trail and future plans', () => {
    const empty = endSkyLetterFor([])
    expect(empty.kicker).toBe('时代里的轨迹')
    expect(empty.blessing).toMatch(/空白写成开始/)

    const letter = endSkyLetterFor([{ age: 20, choiceId: 'intern' }, { age: 25, choiceId: 'job' }], '先验证再决定', 26)
    expect(letter.era).toContain('二十五岁')
    expect(letter.reading).toContain('提前实习')
    expect(letter.reading).toContain('先去工作')
    expect(letter.courage.length).toBeGreaterThan(12)
    expect(letter.blessing).toContain('先验证再决定')
  })
})
