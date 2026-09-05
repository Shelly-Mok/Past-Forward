import { eraNodeForAge } from '../garden/gardenContent'
import { choicePostFor, type ChoicePost } from '../garden/riftContent'
import { authorQueryFor, searchQueriesFor } from './queries'
import { mapSearchItem, pickSearchItems } from './mapPost'
import type { ZhihuHealth, ZhihuSearchItem } from './types'

const cache = new Map<string, { at: number, posts: ChoicePost[] }>()
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

export async function loadChoicePosts(age: number, choiceId: string): Promise<ChoicePost[]> {
  const key = `choice:${age}:${choiceId}`
  const cached = recalled(key)
  if (cached) return cached
  const queries = searchQueriesFor(age, choiceId)
  try {
    const response = await fetch('/api/life/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries, count: 8 }),
    })
    const posts = pickSearchItems(await readItems(response)).map(item => mapSearchItem(item, age, choiceId))
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

export async function hydrateChoicePost(age: number, choiceId: string): Promise<ChoicePost> {
  const live = await loadChoicePosts(age, choiceId)
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

export { authorQueryFor, searchQueriesFor }
