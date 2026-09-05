import { describe, expect, it } from 'vitest'
import { authorQueryFor, searchQueriesFor } from './queries'

describe('zhihu search queries', () => {
  it('builds age and event queries from a planted garden choice', () => {
    const queries = searchQueriesFor(20, 'intern')
    expect(queries[0]).toContain('20岁')
    expect(queries[0]).toContain('实习')
    expect(queries.some(item => item.includes('专业') || item.includes('第一条路'))).toBe(true)
  })
  it('joins an author name with the node hint', () => {
    expect(authorQueryFor('林深见鹿', '考研二战')).toBe('林深见鹿 考研二战')
    expect(authorQueryFor(' 止语 ', '')).toBe('止语')
  })
})
