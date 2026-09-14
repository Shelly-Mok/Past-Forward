import { describe, expect, it } from 'vitest'
import { bloggerArchiveFor, chanceText, choicePostFor, closestForesightId, CROSSROADS_VOYAGE, endInsightFor, endSessionFor, endSkyLetterFor, endSourcesFor, followKeyForChoice, FORESIGHT_YEARS, foresightAges, foresightTitle, foresightYearsFor, holeHintFor, outlookBloggerPool, pickOutlookBlogger, RIFT_HOLES, threeYearPlanFor } from './riftContent'
import { signalPortraits } from './gardenContent'

describe('present-age rift content', () => {
  it('keeps the transit caption that opens the last-year departure', () => {
    expect(CROSSROADS_VOYAGE.kicker).toContain('前往三岔口')
    expect(CROSSROADS_VOYAGE.title).toContain('新的节点')
    expect(CROSSROADS_VOYAGE.lead).toContain('过去已经写下')
    expect(CROSSROADS_VOYAGE.action).toContain('前往三岔口')
  })
  it('keeps a single backtrack planet in the center', () => {
    expect(RIFT_HOLES.map(item => item.id)).toEqual(['backtrack'])
    expect(RIFT_HOLES.map(item => item.label)).toEqual(['回溯'])
    expect(RIFT_HOLES[0].kicker).toContain('第四幕')
    expect(RIFT_HOLES[0].x).toBe(50)
    expect(RIFT_HOLES[0].y).toBeGreaterThan(35)
    expect(RIFT_HOLES[0].y).toBeLessThan(50)
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
    expect(post.votes).toMatch(/作者骨架|不是匹配分数/)
    expect(post.votes).not.toMatch(/%/)
  })
  it('builds a demo archive of posts for a companion blogger', () => {
    const [same] = signalPortraits(20, 'major')
    const archive = bloggerArchiveFor(same)
    expect(archive).toHaveLength(3)
    expect(archive.every(item => item.author === same.npc.name)).toBe(true)
    expect(archive[0].title).toContain(same.choice.label)
    expect(archive.every(item => item.href.includes('zhihu.com'))).toBe(true)
  })
  it('writes a three-year plan from the opened foresight branch and personal outlook', () => {
    const years = foresightYearsFor(22)
    expect(closestForesightId(years[0], 'intern')).toBe('stay-city')
    expect(closestForesightId(years[0], 'intern', ['再给自己一年'])).toBe('one-more-year')
    const plan = threeYearPlanFor({
      currentAge: 22,
      openedKey: '23:go-home',
      lastChoiceId: 'intern',
      plans: '先回家把晚上留给自己',
    })
    expect(plan.kicker).toContain('接下来三年')
    expect(plan.years.map(item => item.age)).toEqual([23, 24, 25])
    expect(plan.years[0].label).toBe('回到家乡 / 求稳')
    expect(plan.reading).toContain('先回家把晚上留给自己')
    const blank = threeYearPlanFor({ currentAge: 22 })
    expect(blank.reading).toMatch(/还没有写下个人展望/)
  })

  it('writes the ending sentence from outlook, then agency, then the planted trail', () => {
    expect(endInsightFor({ planted: [] })).toBe('这一局还停在选择发生之前。')
    expect(endInsightFor({
      planted: [{ age: 20, choiceId: 'intern' }],
      plans: '先回家把晚上留给自己',
      agency: '条件妥协',
    })).toBe('你给以后写下的是「先回家把晚上留给自己」。')
    expect(endInsightFor({
      planted: [{ age: 20, choiceId: 'intern' }],
      agency: '条件妥协',
    })).toBe('回过头看，当时更像是条件妥协，不是被写成命运。')
    expect(endInsightFor({
      planted: [{ age: 20, choiceId: 'intern' }, { age: 25, choiceId: 'job' }],
    })).toBe('从 20 岁的「提前实习 / 兼职，先碰世界」，走到 25 岁的「先去工作，不再把一年押进去」。')
    expect(endInsightFor({
      planted: [{ age: 20, choiceId: 'intern' }],
    })).toBe('20 岁，你写下了「提前实习 / 兼职，先碰世界」。')
  })

  it('summarizes this session in four lines and keeps the last-node trio for the ending', () => {
    expect(endSessionFor({ planted: [], currentAge: null })).toEqual({
      age: '尚未登记',
      flowers: '还没有花',
      interview: '还没有做完回测',
      next: '还没有写下打算',
    })
    expect(endSessionFor({
      planted: [{ age: 20, choiceId: 'intern' }, { age: 25, choiceId: 'job' }],
      currentAge: 26,
      agency: '条件妥协',
      plans: '先回家把晚上留给自己',
      nextLabel: '回到家乡 / 求稳',
    })).toEqual({
      age: '26 岁',
      flowers: '2 朵',
      interview: '条件妥协',
      next: '先回家把晚上留给自己',
    })
    expect(endSessionFor({
      planted: [{ age: 20, choiceId: 'intern' }],
      currentAge: 22,
      nextLabel: '回到家乡 / 求稳',
    }).next).toBe('回到家乡 / 求稳')

    const empty = endSourcesFor({ planted: [] })
    expect(empty.empty).toBe(true)
    expect(empty.people).toEqual([])
    expect(empty.note).toBe('还没有对得上的原文')
    expect(empty.refined).toBe(false)

    const source = endSourcesFor({ planted: [{ age: 20, choiceId: 'intern' }] })
    expect(source.empty).toBe(false)
    expect(source.refined).toBe(false)
    expect(source.note).toBe('第三幕这一年遇见的人')
    expect(source.people.map(item => item.name)).toEqual(['通勤第七站', '一只脆脆鲨', '晚到的学生证'])
    expect(source.people.map(item => item.slot)).toEqual(['A · 同代相近', 'A · 同代同行', 'B · 跨代对照'])
    expect(source.people[0].headline).toContain('提前实习')
    expect(source.people[0].quote).toBe('')
    expect(source.ask).toBe('要不要从当时最贵的那一笔，继续看他们怎么走？')
    expect(source.people.every(item => item.href.includes('zhihu.com'))).toBe(true)

    const refined = endSourcesFor({
      planted: [{ age: 20, choiceId: 'intern' }],
      interview: { nodes: [{ slots: { motive: '想离家近一点也想让家里少操心', agency: '条件妥协' } }] },
    })
    expect(refined.refined).toBe(true)
    expect(refined.note).toBe('结合第四幕访谈，再看这三位')
    expect(refined.people).toHaveLength(3)

    const pool = outlookBloggerPool({
      planted: [{ age: 20, choiceId: 'intern' }, { age: 22, choiceId: 'major' }],
      currentAge: 22,
    })
    expect(pool.length).toBeGreaterThanOrEqual(2)
    expect(pool.every(item => item.name && item.quote === '' && item.source === 'authored' && item.href.includes('zhihu.com') && item.why)).toBe(true)
    expect(pool.some(item => item.kind === 'peer')).toBe(true)
    expect(pool.some(item => item.kind === 'elder')).toBe(true)
    expect(pickOutlookBlogger(pool, 0).name).not.toBe(pickOutlookBlogger(pool, 1).name)
    expect(pickOutlookBlogger(pool, pool.length).name).toBe(pool[0].name)
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
