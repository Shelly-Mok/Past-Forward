import { describe, expect, it } from 'vitest'
import { bloggerArchiveFor, chanceText, choicePostFor, endSkyLetterFor, followKeyForChoice, FORESIGHT_YEARS, RIFT_HOLES } from './riftContent'
import { signalPortraits } from './gardenContent'

describe('present-age rift content', () => {
  it('keeps four labeled holes on the moon', () => {
    expect(RIFT_HOLES.map(item => item.label)).toEqual(['回溯', '前进', '前瞻', '结束'])
    expect(RIFT_HOLES.every(item => item.x > 20 && item.x < 85 && item.y > 14 && item.y < 38)).toBe(true)
    expect(RIFT_HOLES.every(item => item.y < 50)).toBe(true)
  })
  it('maps garden choices onto follow scenes and nudges foresight chances', () => {
    expect(followKeyForChoice('second')).toBe('second')
    expect(followKeyForChoice('major')).toBe('job')
    const year = FORESIGHT_YEARS[0]
    const boosted = chanceText(year.branches[2], 'second')
    const base = chanceText(year.branches[2], 'job')
    expect(boosted.startsWith('26%')).toBe(true)
    expect(Number.parseInt(base, 10)).toBeLessThan(Number.parseInt(boosted, 10))
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
