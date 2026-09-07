import { describe, expect, it } from 'vitest'
import {
  companionQueries,
  discoverChoices,
  discoverTitleForks,
  explainAuthored,
  explainMatch,
  journeyContext,
  journeyKeywords,
  mergeDiscoveredChoices,
  nodeDiscoveryQueries,
  npcFromSearch,
  rankSearchItems,
} from './recommend'
import { eraChoice, eraNodeForAge } from '../garden/gardenContent'

const armyPost = {
  Title: '18岁当兵还是上大学？我选了入伍',
  ContentText: '家里供不起复读。我在工地干过一个月，后来入伍。大学接住分数，接不住生活。当兵第一年最难开口的是想家。',
  AuthorName: '新兵连的灯',
  AuthorAvatar: 'https://picx.zhimg.com/50/v2-84ce3330420f9332a1d69d4cd1f10c2f_l.jpg',
  AuthorBadgeText: '退役后再读书的人',
  VoteUpCount: 42,
  AuthorityLevel: '2',
  RankingScore: 1.2,
  EditTime: 1535760000,
}

const collegePost = {
  Title: '高考后直接上大学，我没有后悔',
  ContentText: '我填了服从调剂。大学接住的是分数。上班以后才懂家里为什么催。',
  AuthorName: '服从调剂的人',
  VoteUpCount: 8,
  RankingScore: 0.4,
}

describe('journey-aware Zhihu queries', () => {
  it('searches a year using planted history, status and an explicit calendar year', () => {
    const ctx = journeyContext({
      selectedAge: 18,
      currentAge: 24,
      target: { raw: '2020年', kind: 'year', age: 18, year: 2020 },
      profile: { status: '上班', family: '与父母同住', rewind: '2020年' },
      planted: [{ age: 15, choiceId: 'senior' }],
    })
    const queries = nodeDiscoveryQueries(ctx, '高考后的去向')
    expect(queries[0]).toContain('18岁')
    expect(queries.some(item => item.includes('2020年'))).toBe(true)
    expect(queries.some(item => item.includes('读普通高中') || item.includes('之后'))).toBe(true)
    expect(journeyKeywords(ctx)).toContain('读普通高中')
    expect(journeyKeywords(ctx)).toContain('上班')
  })

  it('does not invent a birth year just because current age is known', () => {
    const ctx = journeyContext({
      selectedAge: 18,
      currentAge: 24,
      target: { raw: '毕业前', kind: 'stage', age: 18, year: null },
      planted: [],
    })
    expect(ctx.calendarYear).toBeNull()
    expect(nodeDiscoveryQueries(ctx, '高考后的去向').join(' ')).not.toMatch(/20\d{2}年/)
  })

  it('builds companion queries that keep the last planted fork', () => {
    const ctx = journeyContext({
      selectedAge: 25,
      currentAge: 25,
      planted: [{ age: 20, choiceId: 'intern' }],
    })
    const same = companionQueries(ctx, '再搏一次（考研 / 再考 / 再试）', 'same-era')
    expect(same.some(item => item.includes('25岁'))).toBe(true)
    expect(same.some(item => item.includes('实习'))).toBe(true)
    const cross = companionQueries(ctx, '创业 / 自己干', 'cross-era')
    expect(cross[0]).toContain('后来怎样')
  })
})

describe('choice discovery and specific match reasons', () => {
  it('can surface 当兵 from search hits even when the authored 18-year node omitted it', () => {
    const authored = eraNodeForAge(18).choices
    expect(authored.some(item => item.label.includes('当兵'))).toBe(false)
    const found = discoverChoices([armyPost, collegePost], journeyContext({
      selectedAge: 18,
      currentAge: 24,
      planted: [{ age: 15, choiceId: 'senior' }],
    }), authored)
    expect(found.map(item => item.patternId)).toContain('army')
    expect(mergeDiscoveredChoices(authored, []).length).toBe(5)
  })

  it('lets Zhihu search add 武校 or 卫校, but not 舞校 once 艺校 is already there', () => {
    const five = eraNodeForAge(5).choices
    expect(five.map(item => item.label)).toContain('去艺校')
    const wushu = discoverChoices([{
      Title: '五岁被送去武校以后',
      ContentText: '我进了武校。早操、劈叉和挨打是同一套功课。',
      AuthorName: '晨操的灰',
    }, {
      Title: '我五岁进了舞校',
      ContentText: '舞校的基训从压腿开始。',
      AuthorName: '停不下来的脚尖',
    }], journeyContext({ selectedAge: 5, currentAge: 24, planted: [] }), five)
    expect(wushu.map(item => item.patternId)).toContain('wushu')
    expect(wushu.map(item => item.label).join('')).not.toMatch(/舞校/)
    const fifteen = discoverChoices([{
      Title: '中考后我去了卫校',
      ContentText: '家里让我去卫校学护理。医校的日子比普通高中更早看见疼。',
      AuthorName: '第一次测血压',
    }], journeyContext({ selectedAge: 15, currentAge: 24, planted: [] }), eraNodeForAge(15).choices)
    expect(fifteen.map(item => item.patternId)).toContain('medical-school')
    expect(nodeDiscoveryQueries(journeyContext({ selectedAge: 5, currentAge: 24, planted: [] }), '第一次离开家').some(item => item.includes('武校'))).toBe(true)
  })

  it('can surface 早产 at age 0 without dropping the six authored starts', () => {
    const authored = eraNodeForAge(0).choices
    expect(authored).toHaveLength(6)
    const found = discoverChoices([{
      Title: '早产儿在保温箱里待了两个月',
      ContentText: '出生后先在保温箱里学呼吸。父母轮流去医院。',
      AuthorName: '保温箱外的人',
    }], journeyContext({
      selectedAge: 0,
      currentAge: 24,
      planted: [],
    }), authored)
    expect(found.map(item => item.patternId)).toContain('preterm')
    expect(found.map(item => item.patternId)).not.toContain('leftbehind')
    expect(mergeDiscoveredChoices(authored, []).length).toBe(6)
  })

  it('explains a person with planted history, status and a real quote', () => {
    const ctx = journeyContext({
      selectedAge: 18,
      currentAge: 24,
      target: { raw: '2020年', kind: 'year', age: 18, year: 2020 },
      profile: { status: '上班' },
      planted: [{ age: 15, choiceId: 'senior' }],
    })
    const explain = explainMatch(armyPost, ctx, '去当兵 / 入伍')
    expect(explain.headline).toContain('新兵连的灯')
    expect(explain.story).toMatch(/当兵|入伍/)
    expect(explain.story).toMatch(/18 岁|2020/)
    expect(explain.quote.length).toBeGreaterThan(6)
    expect(`${explain.headline}${explain.story}`).not.toMatch(/检索|热帖|标题\/摘要|相似度|匹配分/)
    const npc = npcFromSearch(armyPost, ctx, '去当兵 / 入伍', eraChoice(18, 'college')!.npc)
    expect(npc.name).toBe('新兵连的灯')
    expect(npc.avatar).toContain('zhimg.com')
  })

  it('ranks the post that overlaps the planted path above a generic one', () => {
    const ctx = journeyContext({
      selectedAge: 18,
      currentAge: 24,
      planted: [{ age: 15, choiceId: 'senior' }],
    })
    const ranked = rankSearchItems([collegePost, armyPost], ctx, '去当兵 / 入伍', 2)
    expect(ranked[0].AuthorName).toBe('新兵连的灯')
  })

  it('still names a concrete overlap when Zhihu is offline', () => {
    const choice = eraNodeForAge(25).choices.find(item => item.id === 'job')!
    const explain = explainAuthored(choice, journeyContext({
      selectedAge: 25,
      currentAge: 25,
      profile: { status: '上班' },
      planted: [{ age: 20, choiceId: 'intern' }, { age: 25, choiceId: 'job' }],
    }))
    expect(explain.story).toContain('上班')
    expect(explain.story).toMatch(/选了/)
    expect(explain.headline + explain.story).not.toMatch(/检索|热帖|相似度/)
    expect(explain.quote.length).toBeGreaterThan(4)
  })

  it('lets a later planted path outrank a generic hot post', () => {
    const hot = {
      Title: '今日热榜闲聊',
      ContentText: '随便聊聊天气和热搜。',
      AuthorName: '热帖',
      VoteUpCount: 9999,
      RankingScore: 5,
    }
    const path = {
      Title: '实习转正以后我还是去上了班',
      ContentText: '读普通高中之后去上大学，二十岁提前实习，后来先去工作，不再把一年押进去。',
      AuthorName: '路径重合',
      VoteUpCount: 3,
      RankingScore: 0.2,
    }
    const later = journeyContext({
      selectedAge: 30,
      currentAge: 30,
      planted: [
        { age: 15, choiceId: 'senior' },
        { age: 18, choiceId: 'college' },
        { age: 20, choiceId: 'intern' },
        { age: 25, choiceId: 'job' },
      ],
    })
    const ranked = rankSearchItems([hot, path], later, '转行，重新开始', 2)
    expect(ranked[0].AuthorName).toBe('路径重合')
    const queries = companionQueries(later, '转行，重新开始', 'same-era')
    expect(queries.some(item => item.includes('工作') || item.includes('实习'))).toBe(true)
  })

  it('still discovers later-life forks when the player is in their fifties', () => {
    const authored = eraNodeForAge(50).choices
    const found = discoverChoices([{
      Title: '48岁被内退后我去学了烘焙',
      ContentText: '提前退休不是享福。内退以后才发现日子要自己重新搭。',
      AuthorName: '空下来的早晨',
    }], journeyContext({
      selectedAge: 50,
      currentAge: 52,
      planted: [{ age: 40, choiceId: 'hold' }],
    }), authored)
    expect(found.map(item => item.patternId)).toContain('early-retire')
    const queries = nodeDiscoveryQueries(journeyContext({
      selectedAge: 50,
      currentAge: 52,
      planted: [{ age: 40, choiceId: 'hold' }],
    }), '下半场怎么走')
    expect(queries[0]).toContain('50岁')
    expect(queries.join(' ')).not.toMatch(/24岁/)
  })

  it('keeps a player-written fork in later queries and can lift a title fork from search', () => {
    const ctx = journeyContext({
      selectedAge: 20,
      currentAge: 24,
      planted: [{ age: 18, choiceId: 'own', label: '去当兵后来又复员' }],
    })
    expect(journeyKeywords(ctx)).toContain('去当兵后来又复员')
    const titles = discoverTitleForks([armyPost], eraNodeForAge(18).choices)
    expect(titles.some(item => item.label.includes('当兵') || item.label.includes('入伍'))).toBe(true)
  })
})
