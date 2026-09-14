import { eraNodeForAge } from '../garden/gardenContent'
import { type PlantedChoice } from '../garden/gardenState'
import type { ArchiveProfile } from '../archive/archiveInterview'
import { buildAltTimeline, eventStartAge } from './altTimeline'
import { type MemoryTimelineItem } from './memoryTimeline'

export type OtherLifeLiveNode = {
  age: number
  label: string
  href?: string
  source?: 'zhihu' | 'demo'
}

export function extraElderAges(currentAge: number | null, origin: number): number[] {
  const now = currentAge ?? origin
  const ages = [now + 3, now + 7, now + 12, now + 18]
    .map(age => Math.min(100, age))
    .filter(age => age > now)
  return [...new Set(ages)]
}

function otherNode(age: number, detail: string, title: string, source: MemoryTimelineItem['source'], order: number): MemoryTimelineItem {
  return {
    id: `other:${age}:${detail}`,
    age,
    kind: 'choice',
    title,
    detail,
    order,
    source,
  }
}

export function buildOtherLifeTimeline(
  planted: PlantedChoice[],
  profile: Pick<ArchiveProfile, 'lifeEvent' | 'lifeEvents'>,
  currentAge: number | null = null,
): MemoryTimelineItem[] {
  const origin = eventStartAge(profile, planted)
  const lines = buildAltTimeline(planted, profile, currentAge)
  const items: MemoryTimelineItem[] = lines.map((line, index) => otherNode(
    line.age,
    line.choice,
    `${line.age}岁 · 对照人生`,
    'demo',
    index + 1,
  ))
  for (const age of extraElderAges(currentAge, origin)) {
    if (items.some(item => item.age === age)) continue
    const fallback = eraNodeForAge(age).choices.find(item => item.id !== 'own')?.label || '把这条路走得更远'
    items.push(otherNode(age, fallback, `${age}岁 · 前辈对照`, 'demo', age))
  }
  items.sort((a, b) => (a.age ?? 0) - (b.age ?? 0) || a.order - b.order)
  items.push({
    id: 'summary:other-life',
    age: null,
    kind: 'summary',
    title: '时间回声',
    detail: '这是公开检索对照的另一条人生，不是匹配分数。',
    order: Number.MAX_SAFE_INTEGER,
    source: 'system',
  })
  return items
}

export function mergeOtherLifeNodes(base: MemoryTimelineItem[], live: OtherLifeLiveNode[]): MemoryTimelineItem[] {
  const summary = base.filter(item => item.kind === 'summary')
  const nodes = base.filter(item => item.kind !== 'summary')
  for (const hit of live) {
    const detail = hit.label.trim()
    if (!detail || !Number.isFinite(hit.age)) continue
    const source = hit.source ?? 'zhihu'
    const title = `${hit.age}岁 · 公开检索对照`
    const index = nodes.findIndex(item => item.age === hit.age)
    const next = otherNode(hit.age, detail, title, source, hit.age)
    if (index >= 0) nodes[index] = { ...next, order: nodes[index].order }
    else nodes.push(next)
  }
  nodes.sort((a, b) => (a.age ?? 0) - (b.age ?? 0) || a.order - b.order)
  return [...nodes, ...summary]
}
