import { readLifeEvents, type LifeEventEntry } from '../archive/archiveInterview'
import { historyComplete, type GardenState } from './gardenState'

export const IDEAL_NOTE = '我们来查找平行宇宙的「你」'

export const NPC_KIND_NOTE = 'A 是同代：年纪相近，也站在同一选择这一侧的人。B 是跨代：在另一个年纪面对过相近分岔的人。没有真实匹配分数。没有公开原文时，不会伪造真人原话。'

export const SKELETON_NOTE = ''

export const MATCH_HONESTY = '「同代相近」是对照关系，没有真实匹配分数。没有公开原文时，不会伪造真人原话。'

export const NOTE_IS_NOT_CHOICE = '这里记下的是本机笔记，不等于已经提交的人生分支选择。种下的路只在星球上的花和时间线上。'

export const EVENT_NOTE_COPY = '用你的话写下这件事当时是怎样的。会保存在个人标签里，之后的对话都能读到。不等于种下的分支选择。'

export const EVENT_TALK_START = '开始这一年的对话'
export const EVENT_TALK_OPEN = EVENT_TALK_START
export const EVENT_TALK_CONTINUE = '继续这一年的对话'
export const EVENT_TALK_HINT = '这是时间记录员的对话，用来回看这件事的代价和成就。点「开始这一年的对话」开聊；收起后点左上「继续这一年的对话」。'
export const EVENT_TALK_READY = '点「开始这一年的对话」或发送第一句开始。收起后，点左上「继续这一年的对话」还能回来。'

export function eventTalkActionLabel(started: boolean) {
  return started ? EVENT_TALK_CONTINUE : EVENT_TALK_START
}

export function eventTalkLaunchVisible(input: { pending: boolean, away: boolean, talkOpen: boolean }) {
  return input.pending && !input.away && !input.talkOpen
}

export const PRESENT_ADVANCE = '寻找平行宇宙的「他」 →'

export function isPublicZhihuSource(input: { href?: string, source?: 'zhihu' | 'authored' | 'demo' } = {}): boolean {
  if (input.source === 'zhihu') return true
  const raw = input.href?.trim() || ''
  if (!raw) return false
  try {
    const url = new URL(raw)
    if (!/(^|\.)zhihu\.com$/i.test(url.hostname)) return false
    return /\/(question|answer|p|zvideo|pin)\//i.test(url.pathname)
  } catch {
    return false
  }
}

export function portraitQuote(input: { quote?: string, href?: string, source?: 'zhihu' | 'authored' | 'demo' }): string {
  const quote = input.quote?.trim() || ''
  if (!quote || !isPublicZhihuSource(input)) return ''
  return quote
}

export function eraHeading(age: number, parallel = false, _event?: string) {
  return parallel ? `${age}岁 · 平行宇宙` : `${age}岁`
}

export function unfinishedEventTalk(
  state: Pick<GardenState, 'profile' | 'target' | 'selectedAge' | 'currentAge' | 'line' | 'forkAge' | 'planted' | 'parallelPlanted'>,
  talks: Array<{ age: number, lines: Array<{ who?: string, text?: string }> }> = [],
): LifeEventEntry | null {
  if (!historyComplete(state)) return null
  const done = new Set(talks.filter(item => item.lines.length).map(item => item.age))
  return readLifeEvents(state.profile, state.target.age).find(item => !done.has(item.age)) ?? null
}
