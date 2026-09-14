import { applySearchChoice, type AltLine } from '../interview/altTimeline'
import { parseEventYearPayload, type EventYearPayload } from '../garden/gardenEventYear'
import { eraChoice, eraNodeForAge, signalPortraits, type EraChoice, type EraNode, type PortraitMode, type SignalPortrait } from '../garden/gardenContent'
import { choicePostFor, type ChoicePost, type OutlookBlogger } from '../garden/riftContent'
import { mapSearchItem, pickSearchItems } from './mapPost'
import { discoveryQueriesFor } from './queries'
import {
  companionQueries,
  discoverChoices,
  eraChoiceFromDiscovery,
  explainMatch,
  foresightQueries,
  mergeDiscoveredChoices,
  npcFromSearch,
  plantedLabel,
  rankSearchItems,
  selectCompanionPortraits,
  authorAvatar,
  type JourneyContext,
  type MatchExplain,
} from './recommend'
import type { ZhihuHealth, ZhihuSearchItem } from './types'

const cache = new Map<string, { at: number, posts: ChoicePost[] }>()
const nodeCache = new Map<string, { at: number, node: EraNode, extras: EraChoice[] }>()
const CACHE_MS = 8 * 60 * 1000
let healthPromise: Promise<ZhihuHealth | null> | null = null

export function liveEnabled(): boolean {
  if (import.meta.env.MODE === 'test') return false
  if (import.meta.env.VITE_ZHIHU_LIVE === '0') return false
  return true
}

export async function probeZhihuHealth(): Promise<ZhihuHealth | null> {
  if (!liveEnabled()) return null
  healthPromise ??= fetch('/api/health')
    .then(response => response.ok ? response.json() as Promise<ZhihuHealth> : null)
    .catch(() => null)
  return healthPromise
}

async function readItems(response: Response): Promise<ZhihuSearchItem[]> {
  if (!response.ok) return []
  const payload = await response.json() as { ok?: boolean, items?: ZhihuSearchItem[] }
  return payload.ok === false ? [] : payload.items ?? []
}

function remember(key: string, posts: ChoicePost[]) {
  cache.set(key, { at: Date.now(), posts })
  return posts
}

function recalled(key: string): ChoicePost[] | null {
  const hit = cache.get(key)
  if (!hit || Date.now() - hit.at > CACHE_MS) {
    cache.delete(key)
    return null
  }
  return hit.posts
}

async function searchMatch(queries: string[], count = 8): Promise<ZhihuSearchItem[]> {
  const response = await fetch('/api/life/match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ queries, count }),
  })
  return readItems(response)
}

export async function loadChoicePosts(age: number, choiceId: string, journey?: JourneyContext): Promise<ChoicePost[]> {
  const key = `choice:${age}:${choiceId}:${journey?.planted.map(item => item.choiceId).join(',') ?? ''}`
  const cached = recalled(key)
  if (cached) return cached
  const node = eraNodeForAge(age)
  const choice = eraChoice(age, choiceId) ?? node.choices[0]
  const queries = journey ? companionQueries(journey, choice.label, 'same-era') : [ `${node.age}岁 ${choice.label}` ]
  try {
    const posts = pickSearchItems(await searchMatch(queries, 8)).map(item => mapSearchItem(item, age, choiceId))
    return remember(key, posts)
  } catch {
    return remember(key, [])
  }
}

export async function loadAuthorPosts(author: string, hint: string, age: number, choiceId: string): Promise<ChoicePost[]> {
  const key = `author:${author}:${hint}:${age}:${choiceId}`
  const cached = recalled(key)
  if (cached) return cached
  try {
    const query = new URLSearchParams({ name: author, hint })
    const response = await fetch(`/api/life/author?${query}`)
    const posts = pickSearchItems(await readItems(response), 3).map(item => mapSearchItem(item, age, choiceId))
    return remember(key, posts)
  } catch {
    return remember(key, [])
  }
}

export async function loadForesightVoice(
  ctx: JourneyContext,
  age: number,
  branchLabel: string,
): Promise<{ author: string, later: string, href: string } | null> {
  try {
    const ranked = rankSearchItems(await searchMatch(foresightQueries(ctx, age), 8), ctx, branchLabel, 1)
    const item = ranked[0]
    if (!item) return null
    const explain = explainMatch(item, ctx, branchLabel)
    return {
      author: String(item.AuthorName || item.Author?.Name || '').trim() || '走过这条路的人',
      later: explain.quote || explain.story,
      href: String(item.Url || 'https://www.zhihu.com'),
    }
  } catch {
    return null
  }
}

export async function hydrateAltTimeline(
  lines: AltLine[],
  planted: Array<{ age: number, choiceId: string, label?: string }>,
  ctx: JourneyContext,
): Promise<AltLine[]> {
  if (!liveEnabled()) return lines
  const next = [...lines]
  try {
    const response = await fetch('/api/life/alt-timeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ages: lines.filter(line => !line.same).map(line => line.age),
        planted,
        profile: ctx.profile,
        currentAge: ctx.currentAge,
      }),
    })
    if (response.ok) {
      const payload = await response.json() as { items?: Array<{ age: number, label: string }> }
      for (const item of payload.items ?? []) {
        const index = next.findIndex(line => line.age === item.age && !line.same)
        if (index >= 0 && item.label) next[index] = applySearchChoice(next[index], item.label)
      }
    }
  } catch { /* keep authored forks */ }
  for (let index = 0; index < next.length; index++) {
    const line = next[index]
    if (line.same) continue
    try {
      const yours = planted.find(item => item.age === line.age)
      const extras = discoverChoices(
        await searchMatch(foresightQueries({ ...ctx, selectedAge: line.age }, line.age), 6),
        { ...ctx, selectedAge: line.age },
        eraNodeForAge(line.age).choices,
      )
      const pick = extras.find(item => item.label !== yours?.label && item.label !== line.choice) ?? extras[0]
      if (pick?.label) next[index] = applySearchChoice(line, pick.label)
    } catch { /* keep the line already filled */ }
  }
  return next
}

export async function loadOutlookBloggers(ctx: JourneyContext, count = 8): Promise<OutlookBlogger[]> {
  const seen = new Set<string>()
  const people: OutlookBlogger[] = []
  const ages = [ctx.currentAge ?? ctx.selectedAge, (ctx.currentAge ?? ctx.selectedAge) + 1]
  try {
    for (const age of ages) {
      const items = await searchMatch(foresightQueries(ctx, age), 8)
      const hint = String(ctx.profile.lifeEvent || (ctx.planted.at(-1) ? plantedLabel(ctx.planted.at(-1)!) : '')).trim()
      const ranked = rankSearchItems(items, ctx, hint, 4)
      const keep = ranked.length ? ranked : rankSearchItems(items, ctx, '', 4)
      for (const item of keep) {
        const name = String(item.AuthorName || item.Author?.Name || '').trim()
        if (!name || seen.has(name)) continue
        seen.add(name)
        const explain = explainMatch(item, ctx, '')
        people.push({
          name,
          headline: explain.headline || String(item.Title || '').trim() || '走过相近路口的人',
          quote: explain.quote || explain.story,
          href: String(item.Url || 'https://www.zhihu.com'),
          avatar: authorAvatar(item) || undefined,
          why: explain.headline || `TA 的公开文字和你种下的选择对上了。`,
          kind: people.length % 2 === 0 ? 'peer' : 'elder',
          source: /\/(question|answer|p|zvideo|pin)\//i.test(String(item.Url || '')) ? 'zhihu' : 'authored',
        })
        if (people.length >= count) return people
      }
    }
  } catch {
    return people
  }
  return people
}

export async function hydrateChoicePost(age: number, choiceId: string, journey?: JourneyContext): Promise<ChoicePost> {
  const live = await loadChoicePosts(age, choiceId, journey)
  return live[0] ?? choicePostFor(age, choiceId)
}

export async function hydrateAuthorArchive(item: {
  npc: { name: string }
  choice: { id: string, label: string }
  age: number
}): Promise<ChoicePost[]> {
  const node = eraNodeForAge(item.age)
  const live = await loadAuthorPosts(item.npc.name, item.choice.label || node.event, item.age, item.choice.id)
  if (live.length) return live
  const fallback = await loadChoicePosts(item.age, item.choice.id)
  return fallback.slice(0, 3)
}

export async function loadEventYear(input: {
  age: number
  event: { age: number, text: string }
  planted?: Array<{ age: number, choiceId: string, label?: string }>
  personalTag?: { plans?: string, eventNotes?: Array<{ age: number, event: string, note: string }> }
}): Promise<EventYearPayload | null> {
  if (!liveEnabled()) return null
  try {
    const response = await fetch('/api/life/event-year', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        age: input.age,
        event: input.event,
        planted: input.planted ?? [],
        personalTag: input.personalTag,
      }),
    })
    if (!response.ok) return null
    return parseEventYearPayload(await response.json())
  } catch {
    return null
  }
}

export async function loadLifeNode(ctx: JourneyContext): Promise<EraNode> {
  const authored = eraNodeForAge(ctx.selectedAge)
  if (!liveEnabled()) return authored
  const key = `node:${ctx.selectedAge}:${ctx.planted.map(item => item.choiceId).join(',')}:${ctx.calendarYear ?? ''}:${ctx.profile.lifeEvent ?? ''}:${ctx.profile.education ?? ''}`
  const hit = nodeCache.get(key)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.node
  try {
    const response = await fetch('/api/life/nodes/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queries: discoveryQueriesFor(ctx.selectedAge, ctx),
        count: 8,
        selectedAge: ctx.selectedAge,
      }),
    })
    const items = await readItems(response)
    const extras = discoverChoices(items, ctx, authored.choices).map((item, index) => eraChoiceFromDiscovery(item, items, ctx, index))
    const node = { ...authored, choices: mergeDiscoveredChoices(authored.choices, extras) }
    nodeCache.set(key, { at: Date.now(), node, extras })
    return node
  } catch {
    return authored
  }
}

export type LivePortrait = SignalPortrait & { explain?: MatchExplain, href?: string }

export async function loadLivePortraits(ctx: JourneyContext, choiceId: string, mode: PortraitMode = 'planted'): Promise<LivePortrait[]> {
  const fallback = signalPortraits(ctx.selectedAge, choiceId, mode)
  if (!liveEnabled()) return fallback
  const node = eraNodeForAge(ctx.selectedAge)
  const choice = eraChoice(ctx.selectedAge, choiceId) ?? node.choices[0]
  const assign = (base: SignalPortrait, item: ZhihuSearchItem | undefined, label: string): LivePortrait => {
    if (!item) return base
    return {
      ...base,
      npc: npcFromSearch(item, ctx, label, base.npc),
      note: item.AuthorBadgeText || base.note,
      explain: explainMatch(item, ctx, label),
      href: String(item.Url || ''),
    }
  }
  try {
    if (mode === 'backtrack') {
      return await Promise.all(fallback.map(async base => {
        const hits = rankSearchItems(await searchMatch(companionQueries(ctx, base.choice.label, 'same-era'), 6), ctx, base.choice.label, 1)
        return assign(base, hits[0], base.choice.label)
      }))
    }
    const sameHits = await searchMatch(companionQueries(ctx, choice.label, 'same-era'), 8)
    const crossHits = await searchMatch(companionQueries(ctx, choice.label, 'cross-era'), 6)
    const picked = selectCompanionPortraits(sameHits, crossHits, ctx, choice.label)
    const cards: LivePortrait[] = [assign(fallback[0], picked.similar, choice.label)]
    if (picked.peer) {
      cards.push({
        slot: 'A · 同代同行',
        kind: 'A',
        npc: npcFromSearch(picked.peer, ctx, choice.label, choice.npc),
        note: picked.peer.AuthorBadgeText || '也这样选的人',
        choice,
        age: ctx.selectedAge,
        explain: explainMatch(picked.peer, ctx, choice.label),
        href: String(picked.peer.Url || ''),
      })
    }
    const crossBase = fallback.find(item => item.kind === 'B') ?? fallback[1]
    if (crossBase) cards.push(assign(crossBase, picked.far, choice.label))
    return cards
  } catch {
    return fallback
  }
}

export { authorQueryFor, searchQueriesFor } from './queries'
