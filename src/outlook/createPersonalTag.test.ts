import { describe, expect, it } from 'vitest'
import { shouldBlockOutlookReopen } from './createPersonalTag'

describe('personal tag outlook panel', () => {
  it('blocks an immediate reopen after save so the box stays closed', () => {
    expect(shouldBlockOutlookReopen(null, 1_000)).toBe(false)
    expect(shouldBlockOutlookReopen(1_000, 1_100)).toBe(true)
    expect(shouldBlockOutlookReopen(1_000, 1_400)).toBe(false)
  })
})
