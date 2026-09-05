import type { ArchiveProfile } from '../archive/archiveInterview'

export const GARDEN_SAVE_KEY = 'life-backtest.garden.v2'
const GARDEN_SAVE_LEGACY_KEYS = ['life-backtest.garden.v1']
/** Local playtest registration. Marked as demo; not a real archive match. */
export const GARDEN_DEBUG_PROFILE: ArchiveProfile = {
  age: '24',
  gender: '演示',
  family: '演示 · 与父母同住',
  status: '演示 · 学生',
  rewind: '18岁',
}
export const FLOWER_NAMES = ['种子', '含苞', '待放', '盛放', '初落', '渐落', '结籽', '延续']
export type RewindTarget = { raw: string; kind: 'age' | 'year' | 'stage' | 'missing'; age: number | null; year: number | null }
export type GardenRecord = { age: number; text: string; recordedAt: string }
export type PlantedChoice = { age: number; choiceId: string }
export type GardenState = {
  version: 2
  profile: ArchiveProfile
  currentAge: number | null
  target: RewindTarget
  selectedAge: number
  planted: PlantedChoice[]
  records: GardenRecord[]
  recordedAt: string
  reachedPresent: boolean
}

export function ageValue(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string' && !/^\d{1,3}(?:\s*岁)?$/.test(value.trim())) return null
  const age = typeof value === 'number' ? value : Number.parseInt(value, 10)
  return Number.isInteger(age) && age >= 0 && age <= 100 ? age : null
}

export function cleanProfile(value: unknown): ArchiveProfile {
  const result: ArchiveProfile = {}
  if (!value || typeof value !== 'object') return result
  for (const key of ['age', 'gender', 'family', 'status', 'rewind'] as const) {
    const text = (value as Record<string, unknown>)[key]
    if (typeof text === 'string' && text.trim()) result[key] = text.trim().slice(0, 200)
  }
  return result
}

export function parseTarget(value?: string): RewindTarget {
  const raw = value?.trim() ?? ''
  if (!raw) return { raw, kind: 'missing', age: null, year: null }
  const ageMatch = raw.match(/^(?:回到|回看|想回到)?\s*(\d{1,3})\s*岁?$/)
  const age = ageMatch ? ageValue(ageMatch[1]) : null
  if (age !== null) return { raw, kind: 'age', age, year: null }
  const yearMatch = raw.match(/^(?:回到|回看|想回到)?\s*((?:19|20)\d{2})\s*年?$/)
  if (yearMatch) return { raw, kind: 'year', age: null, year: Number(yearMatch[1]) }
  return { raw, kind: 'stage', age: null, year: null }
}

export function chapterForAge(age: number): number {
  return age >= 70 ? 7 : Math.max(0, Math.floor(age / 10))
}
export function chapterLabel(chapter: number): string {
  return chapter === 7 ? '70岁以后' : `${chapter * 10}—${chapter * 10 + 10}岁`
}
export function timelineBand(age: number): number {
  return age >= 80 ? 2 : age >= 40 ? 1 : 0
}

export function nextTimelineAge(age: number, targetAge: number | null, currentAge: number | null = null): number | null {
  const ages = [0, 1, 2].flatMap(band => timelineNodes(band, targetAge, age, currentAge))
  return [...new Set(ages)].sort((a, b) => a - b).find(item => item > age) ?? null
}

export function timelineNodes(band: number, targetAge: number | null, selectedAge: number, currentAge: number | null = null): number[] {
  const start = [0, 40, 80][Math.max(0, Math.min(2, band))]
  const end = [40, 80, 100][Math.max(0, Math.min(2, band))]
  const cap = currentAge === null ? end : Math.min(end, currentAge)
  const base: number[] = []
  for (let age = start; age <= cap; age += 5) base.push(age)
  if (targetAge !== null && timelineBand(targetAge) === band && (currentAge === null || targetAge <= currentAge)) base.push(targetAge)
  if (timelineBand(selectedAge) === band && (currentAge === null || selectedAge <= currentAge)) base.push(selectedAge)
  if (currentAge !== null && timelineBand(currentAge) === band && currentAge >= start && currentAge <= end) base.push(currentAge)
  return [...new Set(base)].sort((a, b) => a - b)
}

export function hasPlanted(planted: PlantedChoice[], age: number, choiceId?: string): boolean {
  return planted.some(item => item.age === age && (choiceId === undefined || item.choiceId === choiceId))
}

/** The present-age node itself: clicking it opens the four-hole fork. */
export function isPresentAge(age: number, currentAge: number | null): boolean {
  return currentAge !== null && age === currentAge
}

/** After planting, the next timeline node would reach or pass the player's real age. */
export function shouldEnterCrossroads(selectedAge: number, currentAge: number | null, nextAge: number | null): boolean {
  if (currentAge === null) return false
  return selectedAge >= currentAge || (nextAge !== null && nextAge >= currentAge)
}

export function readPlanted(value: unknown): PlantedChoice[] {
  if (!Array.isArray(value)) return []
  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return []
    const age = ageValue((item as PlantedChoice).age)
    const choiceId = (item as PlantedChoice).choiceId
    return age !== null && typeof choiceId === 'string' && choiceId.trim()
      ? [{ age, choiceId: choiceId.trim().slice(0, 40) }]
      : []
  })
}
export function newGardenState(profile: unknown): GardenState {
  const safe = cleanProfile(profile)
  const target = parseTarget(safe.rewind)
  const currentAge = ageValue(safe.age)
  const selected = target.age ?? currentAge ?? 0
  return { version: 2, profile: safe, currentAge, target, selectedAge: currentAge === null ? selected : Math.min(selected, currentAge),
    planted: [], records: [], recordedAt: new Date().toISOString(), reachedPresent: false }
}
export function restoreGardenState(raw: string | null, profile?: ArchiveProfile): GardenState {
  const fresh = newGardenState(profile)
  try {
    const value = JSON.parse(raw ?? 'null') as { version?: number; profile?: unknown; selectedAge?: unknown; target?: RewindTarget; planted?: unknown; records?: unknown; recordedAt?: unknown; reachedPresent?: unknown } | null
    if (!value || (value.version !== 1 && value.version !== 2) || !value.profile || typeof value.profile !== 'object') return fresh
    const savedProfile = cleanProfile(value.profile)
    // A new second-act registration starts its own garden; never reuse another person's progress.
    if (profile && (['age', 'gender', 'family', 'status', 'rewind'] as const).some(key => savedProfile[key] !== fresh.profile[key])) return fresh
    const state = newGardenState(savedProfile)
    state.selectedAge = ageValue(value.selectedAge) ?? state.selectedAge
    if (state.currentAge !== null && state.selectedAge > state.currentAge) state.selectedAge = state.currentAge
    const confirmedAge = ageValue(value.target?.age)
    if (confirmedAge !== null && value.target?.raw === state.target.raw) state.target.age = confirmedAge
    state.planted = readPlanted(value.planted).filter(item => state.currentAge === null || item.age <= state.currentAge)
    state.reachedPresent = value.reachedPresent === true
    state.records = Array.isArray(value.records) ? value.records.filter(r => r && ageValue(r.age) !== null && typeof r.text === 'string' && typeof r.recordedAt === 'string').slice(-100).map(r => ({ age: r.age, text: r.text.slice(0, 500), recordedAt: r.recordedAt })) : []
    state.recordedAt = typeof value.recordedAt === 'string' ? value.recordedAt : state.recordedAt
    return state
  } catch { return fresh }
}

export function clearGardenSave() {
  for (const key of [GARDEN_SAVE_KEY, ...GARDEN_SAVE_LEGACY_KEYS]) {
    try { localStorage.removeItem(key) } catch { /* Memory garden can still start empty. */ }
  }
}

export function debugGardenProfile(search: URLSearchParams = new URLSearchParams()): ArchiveProfile {
  const profile = { ...GARDEN_DEBUG_PROFILE }
  const age = ageValue(search.get('age'))
  if (age !== null) profile.age = String(age)
  const rewind = search.get('rewind')?.trim()
  if (rewind) profile.rewind = rewind.slice(0, 80)
  return profile
}
