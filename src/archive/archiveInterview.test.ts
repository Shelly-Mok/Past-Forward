import { describe, expect, it } from 'vitest'
import {
  ARCHIVE_QUESTIONS,
  archiveAnswerError,
  nextArchiveQuestion,
  normalizeArchiveAnswer,
  previousArchiveQuestion,
} from './archiveInterview'

describe('archive interview checkpoints', () => {
  it('keeps the four lamps and desk question in route order', () => {
    expect(ARCHIVE_QUESTIONS.map((question) => question.id)).toEqual([
      'age', 'gender', 'family', 'status', 'rewind',
    ])
    expect(ARCHIVE_QUESTIONS.map((question) => question.progress)).toEqual([
      0.14, 0.3, 0.47, 0.7, 1,
    ])
  })

  it('stops at the first unanswered checkpoint crossed by movement', () => {
    expect(nextArchiveQuestion(0.1, 0.5, {})?.id).toBe('age')
    expect(nextArchiveQuestion(0.14, 0.5, { age: '24' })?.id).toBe('gender')
    expect(nextArchiveQuestion(0.47, 0.9, {
      age: '24', gender: '不透露', family: '与父母同住',
    })?.id).toBe('status')
  })

  it('normalizes and validates age answers', () => {
    const question = ARCHIVE_QUESTIONS[0]
    expect(normalizeArchiveAnswer(question, ' 024 岁 ')).toBe('24')
    expect(archiveAnswerError(question, '9')).not.toBe('')
    expect(archiveAnswerError(question, '24')).toBe('')
  })

  it('returns the previous physical checkpoint for answer correction', () => {
    expect(previousArchiveQuestion('age')).toBeUndefined()
    expect(previousArchiveQuestion('gender')?.id).toBe('age')
    expect(previousArchiveQuestion('rewind')?.id).toBe('status')
  })
})
