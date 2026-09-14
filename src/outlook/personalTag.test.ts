import { beforeEach, describe, expect, it } from 'vitest'
import { GARDEN_SAVE_KEY } from '../garden/gardenState'
import { ARCHIVE_PROFILE_KEY, cleanPersonalTag, emptyPersonalTag, formatPersonalTagForModel, hasPersonalTag, PERSONAL_TAG_KEY, readPersonalTag, readTagSnapshot, upsertPersonalEventNote, writePersonalTag } from './personalTag'

const local = new Map<string, string>()
const session = new Map<string, string>()

beforeEach(() => {
  local.clear()
  session.clear()
  const storage = (map: Map<string, string>) => ({
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value) },
  })
  Object.assign(globalThis, {
    localStorage: storage(local),
    sessionStorage: storage(session),
  })
})

describe('personal tag', () => {
  it('keeps only the future-plan field and can recover an older thoughts save', () => {
    const tag = cleanPersonalTag({ thoughts: '  想换一条路  ', extra: 'no', updatedAt: '2026-09-05' })
    expect(tag).toEqual({ plans: '想换一条路', updatedAt: '2026-09-05', eventNotes: [] })
    expect(cleanPersonalTag('{broken')).toEqual(emptyPersonalTag())
    expect(cleanPersonalTag({ plans: 'x'.repeat(900) }).plans).toHaveLength(800)
  })

  it('saves the outlook so the tag can reopen later', () => {
    expect(hasPersonalTag()).toBe(false)
    const saved = writePersonalTag({ plans: '给自己一年' })
    expect(saved.updatedAt.length).toBeGreaterThan(0)
    expect(local.get(PERSONAL_TAG_KEY)).toContain('给自己一年')
    expect(readPersonalTag()).toMatchObject({ plans: '给自己一年' })
    expect(hasPersonalTag()).toBe(true)
  })

  it('reads registration and planted choices into the tag snapshot', () => {
    session.set(ARCHIVE_PROFILE_KEY, JSON.stringify({ age: '24', gender: '女', education: '本科', health: '良好', lifeEvent: '18岁高考' }))
    local.set(GARDEN_SAVE_KEY, JSON.stringify({
      version: 2,
      profile: { age: '24', gender: '女', education: '本科', health: '良好', lifeEvent: '18岁高考' },
      planted: [{ age: 18, choiceId: 'college' }, { age: 20, choiceId: 'intern' }],
    }))
    const snap = readTagSnapshot()
    expect(snap.profile.age).toBe('24')
    expect(snap.profile.education).toBe('本科')
    expect(snap.choices.map(item => item.label)).toEqual(['去上大学', '提前实习 / 兼职，先碰世界'])
    expect(snap.choices[0].age).toBe(18)
  })

  it('keeps event-year descriptions on the personal tag', () => {
    const tag = cleanPersonalTag({
      plans: '给自己一年',
      eventNotes: [
        { age: 18, event: '18岁高考', note: '  那天走廊很静  ' },
        { age: 12, event: '搬家', note: '' },
        { extra: true },
      ],
    })
    expect(tag.eventNotes).toEqual([{ age: 18, event: '18岁高考', note: '那天走廊很静' }])
    expect(emptyPersonalTag().eventNotes).toEqual([])
  })

  it('upserts an event description without wiping future plans', () => {
    writePersonalTag({ plans: '给自己一年' })
    const saved = upsertPersonalEventNote({ age: 18, event: '18岁高考', note: '那天走廊很静' })
    expect(saved.plans).toBe('给自己一年')
    expect(readPersonalTag().eventNotes).toEqual([{ age: 18, event: '18岁高考', note: '那天走廊很静' }])
    writePersonalTag({ plans: '换一条路' })
    expect(readPersonalTag()).toMatchObject({
      plans: '换一条路',
      eventNotes: [{ age: 18, event: '18岁高考', note: '那天走廊很静' }],
    })
  })

  it('formats personal tag plans and event notes for the language model', () => {
    const text = formatPersonalTagForModel({
      plans: '给自己一年',
      eventNotes: [{ age: 18, event: '18岁高考', note: '那天走廊很静' }],
    })
    expect(text).toContain('给自己一年')
    expect(text).toContain('18岁高考')
    expect(text).toContain('那天走廊很静')
    expect(formatPersonalTagForModel(emptyPersonalTag())).toBe('')
  })
})
