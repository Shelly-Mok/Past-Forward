import type { ArchiveProfile } from '../archive/archiveInterview'
import { eraChoice, eraNodeForAge } from '../garden/gardenContent'
import { cleanProfile, GARDEN_SAVE_KEY, readPlanted } from '../garden/gardenState'

export const PERSONAL_TAG_KEY = 'life-backtest.personal-tag.v1'
export const PERSONAL_TAG_LIMIT = 800
export const ARCHIVE_PROFILE_KEY = 'life-backtest.archive-profile'

export const PROFILE_LABELS = {
  age: '现在的年龄',
  gender: '性别',
  education: '学历',
  health: '生活状况',
  lifeEvent: '重大人生事件',
} as const

export type PersonalEventNote = {
  age: number
  event: string
  note: string
}

export type PersonalTag = {
  plans: string
  updatedAt: string
  eventNotes: PersonalEventNote[]
}

export type TagChoice = {
  age: number
  label: string
  event: string
}

export type TagSnapshot = {
  profile: ArchiveProfile
  choices: TagChoice[]
  outlook: PersonalTag
}

export function emptyPersonalTag(): PersonalTag {
  return { plans: '', updatedAt: '', eventNotes: [] }
}

function cleanEventNotes(value: unknown): PersonalEventNote[] {
  if (!Array.isArray(value)) return []
  const byAge = new Map<number, PersonalEventNote>()
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const raw = item as Record<string, unknown>
    const age = Number(raw.age)
    const event = clip(raw.event).slice(0, 80)
    const note = clip(raw.note)
    if (!Number.isInteger(age) || age < 0 || age > 100 || !note) continue
    byAge.set(age, { age, event, note })
  }
  return [...byAge.values()].sort((a, b) => a.age - b.age).slice(0, 20)
}

function clip(text: unknown) {
  return typeof text === 'string' ? text.trim().slice(0, PERSONAL_TAG_LIMIT) : ''
}

function readJson(storage: Storage | undefined, key: string): unknown {
  try {
    return JSON.parse(storage?.getItem(key) ?? 'null')
  } catch {
    return null
  }
}

export function cleanPersonalTag(value: unknown): PersonalTag {
  if (!value || typeof value !== 'object') return emptyPersonalTag()
  const raw = value as Record<string, unknown>
  return {
    plans: clip(raw.plans) || clip(raw.thoughts),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : '',
    eventNotes: cleanEventNotes(raw.eventNotes),
  }
}

export function readPersonalTag(): PersonalTag {
  return cleanPersonalTag(readJson(globalThis.localStorage, PERSONAL_TAG_KEY))
}

export function writePersonalTag(value: { plans: string, eventNotes?: PersonalEventNote[] }): PersonalTag {
  const current = readPersonalTag()
  const tag = cleanPersonalTag({
    plans: value.plans,
    eventNotes: value.eventNotes ?? current.eventNotes,
    updatedAt: new Date().toISOString(),
  })
  try {
    localStorage.setItem(PERSONAL_TAG_KEY, JSON.stringify(tag))
  } catch { /* In-memory tag still returns for this session. */ }
  return tag
}

export function upsertPersonalEventNote(input: { age: number, event: string, note: string }): PersonalTag {
  const current = readPersonalTag()
  const rest = current.eventNotes.filter(item => item.age !== input.age)
  return writePersonalTag({
    plans: current.plans,
    eventNotes: [...rest, { age: input.age, event: input.event, note: input.note }],
  })
}

export function personalTagPayload(tag: PersonalTag = readPersonalTag()) {
  return {
    plans: tag.plans,
    eventNotes: tag.eventNotes,
  }
}

export function formatPersonalTagForModel(tag: { plans?: string, eventNotes?: PersonalEventNote[] } | null | undefined): string {
  const plans = tag?.plans?.trim() || ''
  const notes = (tag?.eventNotes ?? [])
    .map(item => `${item.age}岁 · ${item.event}：${item.note}`)
    .join('\n')
  return [
    plans ? `用户写下的未来打算：${plans}` : '',
    notes ? `记下的事件（玩家原文）：\n${notes}` : '',
  ].filter(Boolean).join('\n')
}

export function hasPersonalTag(tag: PersonalTag = readPersonalTag()): boolean {
  return Boolean(tag.plans)
}

export function readTagSnapshot(): TagSnapshot {
  const garden = readJson(globalThis.localStorage, GARDEN_SAVE_KEY)
  const session = cleanProfile(readJson(globalThis.sessionStorage, ARCHIVE_PROFILE_KEY))
  let profile = session
  let planted = [] as ReturnType<typeof readPlanted>
  if (garden && typeof garden === 'object') {
    const saved = garden as { profile?: unknown, planted?: unknown }
    const fromGarden = cleanProfile(saved.profile)
    if (Object.keys(fromGarden).length) profile = fromGarden
    planted = readPlanted(saved.planted)
  }
  return {
    profile,
    choices: planted.map(item => ({
      age: item.age,
      label: eraChoice(item.age, item.choiceId)?.label ?? item.choiceId,
      event: eraNodeForAge(item.age).event,
    })),
    outlook: readPersonalTag(),
  }
}
