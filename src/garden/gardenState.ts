import type { ArchiveProfile } from '../archive/archiveInterview'

export const GARDEN_SAVE_KEY = 'life-backtest.garden.v1'
export const FLOWER_NAMES = ['种子', '含苞', '待放', '盛放', '初落', '渐落', '结籽', '延续']
export type RewindTarget = { raw: string; kind: 'age' | 'year' | 'stage' | 'missing'; age: number | null; year: number | null }
export type GardenRecord = { age: number; text: string; recordedAt: string }
export type GardenState = {
  version: 1
  profile: ArchiveProfile
  currentAge: number | null
  target: RewindTarget
  selectedAge: number
  planted: number[]
  records: GardenRecord[]
  recordedAt: string
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
export function chapterNodes(chapter: number, targetAge: number | null, selectedAge: number): number[] {
  const start = chapter * 10
  const base = chapter === 7 ? [70, 75, 80, 90, 100] : [start, start + 2, start + 5, start + 7, start + 10]
  if (targetAge !== null && chapterForAge(targetAge) === chapter) base.push(targetAge)
  if (chapterForAge(selectedAge) === chapter) base.push(selectedAge)
  return [...new Set(base)].sort((a, b) => a - b)
}
export function newGardenState(profile: unknown): GardenState {
  const safe = cleanProfile(profile)
  const target = parseTarget(safe.rewind)
  const currentAge = ageValue(safe.age)
  return { version: 1, profile: safe, currentAge, target, selectedAge: target.age ?? currentAge ?? 0,
    planted: [], records: [], recordedAt: new Date().toISOString() }
}
export function restoreGardenState(raw: string | null, profile?: ArchiveProfile): GardenState {
  const fresh = newGardenState(profile)
  try {
    const value = JSON.parse(raw ?? 'null') as GardenState | null
    if (!value || value.version !== 1 || !value.profile || typeof value.profile !== 'object') return fresh
    const savedProfile = cleanProfile(value.profile)
    // A new second-act registration starts its own garden; never reuse another person's progress.
    if (profile && (['age', 'gender', 'family', 'status', 'rewind'] as const).some(key => savedProfile[key] !== fresh.profile[key])) return fresh
    const state = newGardenState(savedProfile)
    state.selectedAge = ageValue(value.selectedAge) ?? state.selectedAge
    const confirmedAge = ageValue(value.target?.age)
    if (confirmedAge !== null && value.target?.raw === state.target.raw) state.target.age = confirmedAge
    state.planted = Array.isArray(value.planted) ? [...new Set(value.planted.filter(n => Number.isInteger(n) && n >= 0 && n <= 7))] : []
    state.records = Array.isArray(value.records) ? value.records.filter(r => r && ageValue(r.age) !== null && typeof r.text === 'string' && typeof r.recordedAt === 'string').slice(-100).map(r => ({ age: r.age, text: r.text.slice(0, 500), recordedAt: r.recordedAt })) : []
    state.recordedAt = typeof value.recordedAt === 'string' ? value.recordedAt : state.recordedAt
    return state
  } catch { return fresh }
}
