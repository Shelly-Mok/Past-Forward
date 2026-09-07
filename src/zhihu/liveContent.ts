import { eraChoice, eraNodeForAge, signalPortraits, type EraChoice, type EraNode, type PortraitMode, type SignalPortrait } from '../garden/gardenContent'
import { choicePostFor, type ChoicePost } from '../garden/riftContent'
import { mapSearchItem, pickSearchItems } from './mapPost'
import { discoveryQueriesFor } from './queries'
import {
  companionQueries,
  discoverChoices,
  eraChoiceFromDiscovery,
  explainMatch,
  mergeDiscoveredChoices,
  npcFromSearch,
  rankSearchItems,
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

export async function loadLifeNode(ctx: JourneyContext): Promise<EraNode> {
  const authored = eraNodeForAge(ctx.selectedAge)
  if (!liveEnabled()) return authored
  const key = `node:${ctx.selectedAge}:${ctx.planted.map(item => item.choiceId).join(',')}:${ctx.calendarYear ?? ''}:${ctx.profile.status ?? ''}`
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
    const same = rankSearchItems(await searchMatch(companionQueries(ctx, choice.label, 'same-era'), 8), ctx, choice.label, 3)
    const cross = rankSearchItems(await searchMatch(companionQueries(ctx, choice.label, 'cross-era'), 6), ctx, choice.label, 2)
    const similar = same[0]
    const peer = same.find(item => item !== similar && (item.AuthorName || item.Author?.Name) !== (similar?.AuthorName || similar?.Author?.Name))
    const far = cross.find(item => item !== similar) ?? cross[0]
    const cards: LivePortrait[] = [assign(fallback[0], similar, choice.label)]
    if (peer) {
      cards.push({
        slot: 'A · 同代同行',
        kind: 'A',
        npc: npcFromSearch(peer, ctx, choice.label, choice.npc),
        note: peer.AuthorBadgeText || '也这样选的人',
        choice,
        age: ctx.selectedAge,
        explain: explainMatch(peer, ctx, choice.label),
        href: String(peer.Url || ''),
      })
    }
    const crossBase = fallback.find(item => item.kind === 'B') ?? fallback[1]
    if (crossBase) cards.push(assign(crossBase, far, choice.label))
    return cards
  } catch {
    return fallback
  }
}

export { authorQueryFor, searchQueriesFor } from './queries'
