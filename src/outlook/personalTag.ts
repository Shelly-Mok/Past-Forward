import type { ArchiveProfile } from '../archive/archiveInterview'
import { eraChoice, eraNodeForAge } from '../garden/gardenContent'
import { cleanProfile, GARDEN_SAVE_KEY, readPlanted } from '../garden/gardenState'

export const PERSONAL_TAG_KEY = 'life-backtest.personal-tag.v1'
export const PERSONAL_TAG_LIMIT = 800
export const ARCHIVE_PROFILE_KEY = 'life-backtest.archive-profile'

export const PROFILE_LABELS = {
  age: '现在的年龄',
  gender: '性别',
  family: '当前家庭情况',
  status: '当前学习／就业状态',
  rewind: '原始回溯目标',
} as const

export type PersonalTag = {
  plans: string
  updatedAt: string
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
  return { plans: '', updatedAt: '' }
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
  }
}

export function readPersonalTag(): PersonalTag {
  return cleanPersonalTag(readJson(globalThis.localStorage, PERSONAL_TAG_KEY))
}

export function writePersonalTag(value: { plans: string }): PersonalTag {
  const tag = cleanPersonalTag({
    plans: value.plans,
    updatedAt: new Date().toISOString(),
  })
  try {
    localStorage.setItem(PERSONAL_TAG_KEY, JSON.stringify(tag))
  } catch { /* In-memory tag still returns for this session. */ }
  return tag
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
