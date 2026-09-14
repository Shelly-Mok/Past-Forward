import { readLifeEvents, type ArchiveProfile } from '../archive/archiveInterview'
import { parseTarget, type PlantedChoice } from '../garden/gardenState'
import { eraChoice } from '../garden/gardenContent'

export type MemoryTimelineKind = 'event' | 'choice' | 'summary'

export type MemoryTimelineItem = {
  id: string
  age: number | null
  kind: MemoryTimelineKind
  title: string
  detail: string
  order: number
  source: 'player-choice' | 'collected-info' | 'system' | 'zhihu' | 'demo'
}

function cleanEventText(text: string, age: number) {
  const withoutAge = text.replace(new RegExp(`^\\s*${age}\\s*(?:周)?岁[，、：:\\s·-]*`), '').trim()
  return withoutAge || text.trim()
}

function uniqueKey(item: Pick<MemoryTimelineItem, 'age' | 'kind' | 'detail'>) {
  return `${item.age ?? 'summary'}:${item.kind}:${item.detail}`
}

/**
 * Converts only facts already supplied or chosen by the player into Act 4 memories.
 * The registered major event is the rewind origin; choices before it stay off this route.
 */
export function buildMemoryTimeline(
  planted: PlantedChoice[],
  profile: ArchiveProfile,
  currentAge: number | null,
  confirmedAge: number | null = null,
): MemoryTimelineItem[] {
  const events = readLifeEvents(profile, confirmedAge)
  const origin = confirmedAge ?? parseTarget(profile.lifeEvent).age ?? events[0]?.age ?? Math.min(...planted.map(item => item.age), currentAge ?? 100)
  const items: MemoryTimelineItem[] = []

  for (const event of events) {
    if (event.age < origin || (currentAge !== null && event.age > currentAge)) continue
    items.push({
      id: `event:${event.age}:${event.text}`,
      age: event.age,
      kind: 'event',
      title: `${event.age}岁`,
      detail: cleanEventText(event.text, event.age),
      order: 0,
      source: 'collected-info',
    })
  }

  const finalChoices = [...new Map(planted.map(item => [item.age, item])).values()]
  for (const [index, choice] of finalChoices.entries()) {
    if (choice.age < origin || (currentAge !== null && choice.age > currentAge)) continue
    const detail = choice.label?.trim() || eraChoice(choice.age, choice.choiceId)?.label || ''
    if (!detail) continue
    items.push({
      id: `choice:${choice.age}:${choice.choiceId}:${index}`,
      age: choice.age,
      kind: 'choice',
      title: `${choice.age}岁 · 玩家选择`,
      detail,
      order: index + 1,
      source: 'player-choice',
    })
  }

  const seen = new Set<string>()
  const chronological = items
    .sort((a, b) => (a.age ?? 0) - (b.age ?? 0) || a.order - b.order || a.kind.localeCompare(b.kind))
    .filter((item) => {
      const key = uniqueKey(item)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

  chronological.push({
    id: 'summary:present',
    age: null,
    kind: 'summary',
    title: '时间回声',
    detail: chronological.length ? '这些选择，形成了现在的你。' : '这里还没有已记录的事件或选择。',
    order: Number.MAX_SAFE_INTEGER,
    source: 'system',
  })
  return chronological
}

export type MemoryPoint = { x: number, y: number }

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

/**
 * Keeps every memory inside the visible stage. Short histories rise across one
 * line; longer histories fold into a bottom-to-top serpentine grid.
 */
export function memoryTimelineLayout(total: number, viewportWidth: number, viewportHeight: number) {
  const count = Math.max(1, total)
  const width = Math.max(240, viewportWidth)
  const height = Math.max(220, viewportHeight)
  const paddingX = clamp(width * .045, 18, 108)
  const paddingY = clamp(height * .075, 20, 48)
  const usableWidth = width - paddingX * 2
  const usableHeight = height - paddingY * 2
  const points: MemoryPoint[] = []

  if (count <= 8 && width >= 720) {
    const spacing = count === 1 ? usableWidth : usableWidth / (count - 1)
    for (let index = 0; index < count; index += 1) {
      const progress = count === 1 ? 0 : index / (count - 1)
      points.push({
        x: paddingX + progress * usableWidth,
        y: height - paddingY - progress * usableHeight,
      })
    }
    const nodeMaxWidth = clamp((count === 1 ? usableWidth : spacing) - 14, 122, 210)
    const scale = clamp(nodeMaxWidth / 190, .72, 1)
    return {
      width,
      height,
      points,
      columns: count,
      rows: 1,
      nodeMaxWidth,
      nodeMinWidth: Math.min(nodeMaxWidth, Math.max(90, nodeMaxWidth * .66)),
      nodeFontSize: clamp(16 * scale, 11, 16),
      metaFontSize: clamp(12 * scale, 9, 12),
      paddingX: clamp(14 * scale, 7, 14),
      paddingY: clamp(9 * scale, 5, 9),
    }
  }

  let columns = 1
  let bestScore = Number.NEGATIVE_INFINITY
  for (let candidate = 1; candidate <= count; candidate += 1) {
    const rows = Math.ceil(count / candidate)
    const cellWidth = usableWidth / candidate
    const cellHeight = usableHeight / rows
    const fit = Math.min(cellWidth / 190, cellHeight / 78)
    const aspectPenalty = Math.abs(Math.log(Math.max(.1, cellWidth / cellHeight) / 2.2)) * .12
    const emptyPenalty = (candidate * rows - count) * .008
    const score = fit - aspectPenalty - emptyPenalty
    if (score > bestScore) {
      bestScore = score
      columns = candidate
    }
  }

  const rows = Math.ceil(count / columns)
  const cellWidth = usableWidth / columns
  const cellHeight = usableHeight / rows
  for (let index = 0; index < count; index += 1) {
    const rowFromBottom = Math.floor(index / columns)
    const positionInRow = index % columns
    const column = rowFromBottom % 2 === 0 ? positionInRow : columns - 1 - positionInRow
    points.push({
      x: paddingX + (column + .5) * cellWidth,
      y: height - paddingY - (rowFromBottom + .5) * cellHeight,
    })
  }

  const scale = clamp(Math.min(cellWidth / 190, cellHeight / 78), .54, 1)
  const nodeMaxWidth = clamp(cellWidth - clamp(cellWidth * .1, 8, 18), 76, 210)
  return {
    width,
    height,
    points,
    columns,
    rows,
    nodeMaxWidth,
    nodeMinWidth: Math.min(nodeMaxWidth, Math.max(68, nodeMaxWidth * .68)),
    nodeFontSize: clamp(16 * scale, 8.5, 16),
    metaFontSize: clamp(12 * scale, 7.5, 12),
    paddingX: clamp(14 * scale, 5, 14),
    paddingY: clamp(9 * scale, 3, 9),
  }
}
