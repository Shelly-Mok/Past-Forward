import { describe, expect, it } from 'vitest'
import { mapSearchItem, pickSearchItems, plainText, scoreSearchItem } from './mapPost'

const sample = {
  Title: '如何在复读与读大学之间做权衡与选择? - 知乎',
  ContentText: '写给在大学与复读之间徘徊的高考生\n对高考生来说，这个选择无疑是痛苦的。',
  Url: 'https://www.zhihu.com/question/48928797/answer/1',
  VoteUpCount: 12,
  AuthorName: '双轮驱动学习方法',
  AuthorBadgeText: '',
  AuthorityLevel: '3',
  RankingScore: 1.4,
}

describe('zhihu post mapping', () => {
  it('maps a search item into a sourced garden post', () => {
    const post = mapSearchItem(sample, 18, 'repeat')
    expect(post.source).toBe('zhihu')
    expect(post.author).toBe('双轮驱动学习方法')
    expect(post.title).toContain('复读')
    expect(post.href).toContain('zhihu.com')
    expect(post.paragraphs[0]).toContain('高考生')
    expect(post.votes).toContain('12 赞同')
    expect(post.votes).toContain('权威 3')
  })
  it('strips highlight tags and ranks higher-voted items first', () => {
    expect(plainText('先看<em>复读</em>再决定')).toBe('先看复读再决定')
    const weaker = { ...sample, VoteUpCount: 1, RankingScore: 0.2, ContentID: 'a' }
    const stronger = { ...sample, VoteUpCount: 80, RankingScore: 1.8, ContentID: 'b' }
    expect(scoreSearchItem(stronger)).toBeGreaterThan(scoreSearchItem(weaker))
    expect(pickSearchItems([weaker, stronger], 1)[0].ContentID).toBe('b')
  })
})
