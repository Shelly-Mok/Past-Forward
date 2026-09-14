import { describe, expect, it } from 'vitest'
import {
  candidateQueries,
  companionQueries,
  discoverChoices,
  discoverTitleForks,
  explainAuthored,
  explainMatch,
  foresightQueries,
  journeyBoost,
  journeyContext,
  journeyKeywords,
  mergeDiscoveredChoices,
  nodeDiscoveryQueries,
  npcFromSearch,
  rankSearchItems,
  selectCompanionPortraits,
  authorAvatar,
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
      profile: { education: '本科', health: '良好', lifeEvent: '2020年换了工作', gender: '女' },
      planted: [{ age: 15, choiceId: 'senior' }],
    })
    const queries = nodeDiscoveryQueries(ctx, '高考后的去向')
    expect(queries[0]).toContain('18岁')
    expect(queries.some(item => item.includes('2020年'))).toBe(true)
    expect(queries.some(item => item.includes('读普通高中') || item.includes('之后'))).toBe(true)
    expect(journeyKeywords(ctx)).toContain('读普通高中')
    expect(journeyKeywords(ctx)).toContain('2020年换了工作')
    expect(queries.join(' ')).toContain('本科')
    expect(queries.join(' ')).toContain('良好')
    expect(queries.join(' ')).toContain('女')
    expect(queries.join(' ')).not.toMatch(/女\s*考研/)
    expect(journeyKeywords(ctx)).toContain('女')
    expect(journeyKeywords(ctx)).toContain('良好')
    const childhood = nodeDiscoveryQueries({ ...ctx, selectedAge: 8 }, '童年').join(' ')
    expect(childhood).not.toContain('本科')
  })

  it('builds candidate search queries from gender, health, education and the life event', () => {
    const ctx = journeyContext({
      selectedAge: 18,
      currentAge: 24,
      profile: { education: '本科', health: '良好', lifeEvent: '18岁高考选了省内', gender: '女' },
      planted: [{ age: 15, choiceId: 'senior' }],
    })
    const queries = candidateQueries(ctx)
    expect(queries.some(item => item.includes('18岁高考'))).toBe(true)
    expect(queries.join(' ')).toContain('女')
    expect(queries.join(' ')).toContain('良好')
    expect(queries.join(' ')).toContain('本科')
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

  it('builds foresight queries from profile, planted history and interview slots', () => {
    const ctx = journeyContext({
      selectedAge: 23,
      currentAge: 22,
      profile: { education: '本科', health: '良好', lifeEvent: '20岁实习', gender: '女' },
      planted: [{ age: 20, choiceId: 'intern' }, { age: 22, choiceId: 'major' }],
      interview: {
        nodes: [{
          age: 20,
          title: '提前实习',
          slots: {
            choice: '先去实习碰世界',
            motive: '想离家近一点也想让家里少操心',
            constraint: '家里存款不够再读一年',
            alternative: '再搏考研',
            agency: '条件妥协',
          },
        }],
      },
    })
    const queries = foresightQueries(ctx, 23)
    expect(queries.join(' ')).toContain('23岁')
    expect(queries.join(' ')).toContain('女')
    expect(queries.join(' ')).toContain('本科')
    expect(queries.join(' ')).toContain('良好')
    expect(queries.join(' ')).toContain('20岁实习')
    expect(queries.some(item => item.includes('实习') || item.includes('专业'))).toBe(true)
    expect(queries.join(' ')).toMatch(/条件妥协|再搏考研|少操心/)
    expect(journeyKeywords(ctx)).toContain('条件妥协')
    expect(journeyKeywords(ctx)).toContain('再搏考研')
    expect(journeyBoost({
      Title: '实习之后我没有再考研',
      ContentText: '家里存款不够再读一年。我想离家近一点，后来条件妥协，先把实习坐实。',
      AuthorName: '相近的路',
    }, ctx, '留下一线')).toBeGreaterThan(journeyBoost({
      Title: '今日热榜闲聊',
      ContentText: '随便聊聊天气。',
      AuthorName: '热帖',
    }, ctx, '留下一线'))
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

  it('puts interview short words into companion queries, not whole sentences', () => {
    const ctx = journeyContext({
      selectedAge: 22,
      currentAge: 22,
      planted: [{ age: 20, choiceId: 'intern' }],
      interview: {
        nodes: [{
          age: 20,
          title: '提前实习',
          slots: {
            choice: '先去实习碰世界',
            motive: '想离家近一点也想让家里少操心',
            constraint: '家里存款不够再读一年',
            alternative: '再搏考研',
            agency: '条件妥协',
          },
        }],
      },
    })
    const blob = companionQueries(ctx, '留下一线', 'same-era').join(' ')
    expect(blob).toMatch(/离家近/)
    expect(blob).toMatch(/家里/)
    expect(blob).toMatch(/考研/)
    expect(blob).not.toContain('想离家近一点也想让家里少操心')
    expect(blob).not.toContain('条件妥协')
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

  it('does not fly 当兵 or 继续读书 onto the age-0 node', () => {
    const authored = eraNodeForAge(0).choices
    const found = discoverChoices([{
      Title: '18岁我该去当兵还是继续读书？我选了入伍',
      ContentText: '家里供不起大学。当兵第一年最难开口的是想家。',
      AuthorName: '军营的人',
    }], journeyContext({
      selectedAge: 0,
      currentAge: 24,
      planted: [],
    }), authored)
    expect(found.map(item => item.label).join('')).not.toMatch(/当兵|入伍|继续读书/)
    expect(found.map(item => item.patternId)).not.toContain('army')
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

  it('does not fly a second flower whose label already sits on the authored node', () => {
    const authored = eraNodeForAge(5).choices
    const found = discoverChoices([{
      Title: '5岁我选了上幼儿园，后来才懂排队',
      ContentText: '上幼儿园比识字更早。家里还问过要不要去艺校。',
      AuthorName: '排队的人',
    }], journeyContext({ selectedAge: 5, currentAge: 24, planted: [] }), authored)
    expect(found.map(item => item.label).join(' ')).not.toMatch(/幼儿园|艺校/)
    const merged = mergeDiscoveredChoices(authored, [{
      id: 'live-幼儿园',
      label: '上幼儿园',
      peer: 0,
      reason: '搜索里又出现了上幼儿园。',
      flowerKind: 3,
      npc: authored[0].npc,
    }])
    expect(merged.filter(item => item.label.includes('上幼儿园'))).toHaveLength(1)
  })

  it('explains a person with planted history, status and a real quote', () => {
    const ctx = journeyContext({
      selectedAge: 18,
      currentAge: 24,
      target: { raw: '2020年', kind: 'year', age: 18, year: 2020 },
      profile: { education: '本科', lifeEvent: '2020年换了工作' },
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

  it('reads a nested author avatar when the search item does not flatten AuthorAvatar', () => {
    expect(authorAvatar({
      Author: { Name: '新兵连的灯', Avatar: 'https://pic1.zhimg.com/v2-abc_l.jpg' },
    })).toContain('zhimg.com')
    expect(authorAvatar({ AuthorAvatar: 'https://picx.zhimg.com/50/v2-84ce3330420f9332a1d69d4cd1f10c2f_l.jpg' })).toContain('zhimg.com')
    expect(authorAvatar({ AuthorName: '没有头像的人' })).toBe('')
  })

  it('keeps outlook search hits when no single choice label is supplied', () => {
    const ctx = journeyContext({
      selectedAge: 24,
      currentAge: 24,
      planted: [{ age: 18, choiceId: 'college', label: '去上大学' }],
    })
    const ranked = rankSearchItems([armyPost], ctx, '', 4)
    expect(ranked[0]?.AuthorName).toBe('新兵连的灯')
    expect(authorAvatar(ranked[0]!)).toContain('zhimg.com')
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

  it('drops a hot post that never mentions the planted choice', () => {
    const hot = {
      Title: '今日热榜闲聊',
      ContentText: '随便聊聊天气和热搜。',
      AuthorName: '热帖',
      VoteUpCount: 9999,
      RankingScore: 5,
    }
    const hit = {
      Title: '考研二战那年我住在学校旁边',
      ContentText: '再考一次。家里不反对考研，只是怕我再耗一年。',
      AuthorName: '二战的人',
      VoteUpCount: 3,
      RankingScore: 0.1,
    }
    const ctx = journeyContext({
      selectedAge: 22,
      currentAge: 22,
      planted: [{ age: 22, choiceId: 'major' }],
    })
    const ranked = rankSearchItems([hot, hit], ctx, '再搏一次（考研 / 再考 / 再试）', 2)
    expect(ranked.map(item => item.AuthorName)).toEqual(['二战的人'])
  })

  it('does not substitute an unrelated hit when the choice label matches nothing', () => {
    const hot = {
      Title: '今日热榜闲聊',
      ContentText: '随便聊聊天气和热搜。',
      AuthorName: '热帖',
      VoteUpCount: 9999,
      RankingScore: 5,
    }
    const ctx = journeyContext({
      selectedAge: 22,
      currentAge: 22,
      planted: [{ age: 22, choiceId: 'major' }],
    })
    expect(rankSearchItems([hot], ctx, '再搏一次（考研 / 再考 / 再试）', 2)).toEqual([])
  })

  it('still names a concrete overlap when Zhihu is offline', () => {
    const choice = eraNodeForAge(25).choices.find(item => item.id === 'job')!
    const explain = explainAuthored(choice, journeyContext({
      selectedAge: 25,
      currentAge: 25,
      profile: { education: '本科', lifeEvent: '上班以后才懂' },
      planted: [{ age: 20, choiceId: 'intern' }, { age: 25, choiceId: 'job' }],
    }))
    expect(explain.story).toContain('上班以后才懂')
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
      ContentText: '读普通高中之后去上大学，二十岁提前实习，后来先去工作，转行，重新开始，不再把一年押进去。',
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
    expect(found.map(item => item.patternId)).not.toContain('early-retire')
    const midlife = discoverChoices([{
      Title: '48岁被内退后我去学了烘焙',
      ContentText: '提前退休不是享福。内退以后才发现日子要自己重新搭。',
      AuthorName: '空下来的早晨',
    }], journeyContext({
      selectedAge: 45,
      currentAge: 52,
      planted: [{ age: 40, choiceId: 'hold' }],
    }), eraNodeForAge(45).choices)
    expect(midlife.map(item => item.patternId)).toContain('early-retire')
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

  it('keeps the second same-era companion from retelling the same landing story', () => {
    const similar = {
      Title: '考研上岸以后我去了体制内',
      ContentText: '二战考研，终于上岸。后来进了事业单位。',
      AuthorName: '上岸甲',
      Url: 'https://www.zhihu.com/answer/1',
      RankingScore: 1.4,
    }
    const clone = {
      Title: '我也考研上岸进了体制内',
      ContentText: '考研上岸以后进了事业单位，和甲几乎同一条路。',
      AuthorName: '上岸乙',
      Url: 'https://www.zhihu.com/answer/2',
      RankingScore: 1.2,
    }
    const otherCost = {
      Title: '考研失败后我先去上班了',
      ContentText: '没有上岸。家里等不起，我把简历投出去，先把房租付上。',
      AuthorName: '先付房租',
      Url: 'https://www.zhihu.com/answer/3',
      RankingScore: 0.4,
    }
    const later = {
      Title: '十年后回头看，考研值不值',
      ContentText: '后来怎样呢。值不值要看你拿什么换。我现在不考了。',
      AuthorName: '十年后的人',
      Url: 'https://www.zhihu.com/answer/4',
      RankingScore: 0.5,
    }
    const ctx = journeyContext({
      selectedAge: 22,
      currentAge: 22,
      planted: [{ age: 22, choiceId: 'major' }],
    })
    const picked = selectCompanionPortraits([similar, clone, otherCost], [later, similar], ctx, '再搏一次（考研 / 再考 / 再试）')
    expect(picked.similar?.AuthorName).toBe('上岸甲')
    expect(picked.peer?.AuthorName).toBe('先付房租')
    expect(picked.far?.AuthorName).toBe('十年后的人')
  })
})
