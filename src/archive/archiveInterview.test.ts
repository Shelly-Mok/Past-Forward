import { describe, expect, it } from 'vitest'
import {
  ARCHIVE_QUESTIONS,
  addLifeEvent,
  archiveAnswerError,
  extraLifeEventError,
  LIFE_EVENT_LIMIT,
  lifeEventFollowUp,
  nextArchiveQuestion,
  normalizeArchiveAnswer,
  previousArchiveQuestion,
  readLifeEvents,
} from './archiveInterview'

describe('archive interview checkpoints', () => {
  it('keeps the four lamps and desk question in route order', () => {
    expect(ARCHIVE_QUESTIONS.map((question) => question.id)).toEqual([
      'age', 'gender', 'education', 'health', 'lifeEvent',
    ])
    expect(ARCHIVE_QUESTIONS.map((question) => question.progress)).toEqual([
      0.14, 0.3, 0.47, 0.7, 1,
    ])
  })

  it('asks for living situation instead of body health', () => {
    const health = ARCHIVE_QUESTIONS.find(question => question.id === 'health')
    expect(health?.prompt).toContain('生活状况')
    expect(health?.options).toEqual(['上学', '工作', '空档过渡', '照顾家庭', '不透露'])
    expect(archiveAnswerError(health!, '工作')).toBe('')
    expect(archiveAnswerError(health!, '良好')).toBe('')
    expect(archiveAnswerError(health!, '飞天')).not.toBe('')
    expect(archiveAnswerError(health!, '飞天')).toContain('生活状况')
  })

  it('only accepts male or female for gender', () => {
    const gender = ARCHIVE_QUESTIONS.find(question => question.id === 'gender')
    expect(gender?.options).toEqual(['男', '女'])
    expect(archiveAnswerError(gender!, '不透露')).not.toBe('')
    expect(archiveAnswerError(gender!, '非二元')).not.toBe('')
    expect(archiveAnswerError(gender!, '女')).toBe('')
    expect(archiveAnswerError(gender!, '男')).toBe('')
  })

  it('stops at the first unanswered checkpoint crossed by movement', () => {
    expect(nextArchiveQuestion(0.1, 0.5, {})?.id).toBe('age')
    expect(nextArchiveQuestion(0.14, 0.5, { age: '24' })?.id).toBe('gender')
    expect(nextArchiveQuestion(0.47, 0.9, {
      age: '24', gender: '女', education: '本科',
    })?.id).toBe('health')
  })

  it('normalizes and validates age answers', () => {
    const question = ARCHIVE_QUESTIONS[0]
    expect(normalizeArchiveAnswer(question, ' 024 岁 ')).toBe('24')
    expect(archiveAnswerError(question, '9')).not.toBe('')
    expect(archiveAnswerError(question, '24')).toBe('')
  })

  it('asks for an age when a life event has no year or stage word', () => {
    expect(lifeEventFollowUp('18岁高考选了省内')).toBe('age')
    expect(lifeEventFollowUp('2020年我18岁换了工作')).toBe('age')
    expect(lifeEventFollowUp('2020年换了工作')).toBe('year')
    expect(lifeEventFollowUp('毕业那年')).toBe('stage')
    expect(lifeEventFollowUp('换了工作')).toBe('need-age')
    const lifeEvent = ARCHIVE_QUESTIONS.find(question => question.id === 'lifeEvent')!
    expect(archiveAnswerError(lifeEvent, '换了工作')).toContain('几岁')
    expect(archiveAnswerError(lifeEvent, '18岁高考选了省内')).toBe('')
    expect(archiveAnswerError(lifeEvent, '毕业那年')).toBe('')
  })

  it('collects up to five dated life events and refuses a sixth', () => {
    const profile = {
      age: '24',
      lifeEvent: '18岁高考选了省内',
      lifeEvents: [
        { age: 12, text: '跟着父母搬家' },
        { age: 16, text: '转去县中' },
      ],
    }
    expect(readLifeEvents(profile)).toEqual([
      { age: 12, text: '跟着父母搬家' },
      { age: 16, text: '转去县中' },
      { age: 18, text: '18岁高考选了省内' },
    ])
    const filled = [
      { age: 0, text: '出生' },
      { age: 5, text: '幼儿园' },
      { age: 10, text: '转学' },
      { age: 15, text: '中考' },
      { age: 18, text: '高考' },
    ]
    expect(addLifeEvent(filled, { age: 20, text: '实习' })).toEqual(filled)
    expect(filled).toHaveLength(LIFE_EVENT_LIMIT)
    expect(extraLifeEventError('12', '跟着父母搬家', 24)).toBe('')
    expect(extraLifeEventError('', '搬家', 24)).toContain('几岁')
    expect(extraLifeEventError('30', '出国', 24)).toContain('现在')
  })

  it('returns the previous physical checkpoint for answer correction', () => {
    expect(previousArchiveQuestion('age')).toBeUndefined()
    expect(previousArchiveQuestion('gender')?.id).toBe('age')
    expect(previousArchiveQuestion('lifeEvent')?.id).toBe('health')
  })
})
