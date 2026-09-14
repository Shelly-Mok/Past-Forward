import { readLifeEvents, type ArchiveProfile, type LifeEventEntry } from '../archive/archiveInterview'
import { eraNodeForAge, flowerKindAt, OWN_CHOICE_ID, SIGNAL_SLOTS, type EraChoice, type EraNode, type FlowerKind, type SignalPortrait } from './gardenContent'

export const EVENT_MARK_ID = 'mark'
export const EVENT_MARK_LABEL = '记下这一岁'

export type EventIdealDraft = {
  id: string
  label: string
  reason: string
  flowerKind?: FlowerKind
}

export type EventYearPayload = {
  era: string
  ideals: EventIdealDraft[]
}

export function lifeEventAtAge(
  profile: Pick<ArchiveProfile, 'lifeEvent' | 'lifeEvents'>,
  age: number,
  confirmedAge: number | null = null,
): LifeEventEntry | null {
  return readLifeEvents(profile, confirmedAge).find(item => item.age === age) ?? null
}

export function eventEraFallback(event: Pick<LifeEventEntry, 'text'>): string {
  const text = event.text.trim()
  return `这一年记下的是「${text}」。先把这件事种在星球上。`
}

export function eventMarkChoice(age: number, eventText: string): EraChoice {
  const written = eventText.trim().slice(0, 80)
  return {
    id: EVENT_MARK_ID,
    label: EVENT_MARK_LABEL,
    peer: 0,
    reason: written
      ? `你写下了「${written}」。这一年不再从现成选项里挑，先把这件事记下。`
      : '先把这一年记下，再去看你更希望走的路。',
    flowerKind: 0,
    npc: {
      name: '记下的这一年',
      identity: `${age}岁记下的事件`,
      proposition: written || EVENT_MARK_LABEL,
      match: written ? `这是你写下的原话：${written}。` : '先把这一年记下。',
      causal: {
        background: `${age}岁这一年，你亲口写下了一件大事。`,
        options: written || EVENT_MARK_LABEL,
        choice: written || EVENT_MARK_LABEL,
        cost: '记下不是从几条现成的路里挑选。',
        reflection: written ? '后面的选择会记得这句。' : '写下来，这一年才真正留下。',
      },
    },
  }
}

export function eventPlantedLabel(choice: Pick<EraChoice, 'id' | 'label'>, eventText: string): string {
  const written = eventText.trim()
  if (choice.id === EVENT_MARK_ID && written) return written.slice(0, 80)
  return choice.label
}

export function parseEventYearPayload(raw: unknown): EventYearPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as { era?: unknown, ideals?: unknown }
  const era = typeof data.era === 'string' ? data.era.trim().slice(0, 180) : ''
  if (!era) return null
  const ideals = Array.isArray(data.ideals)
    ? data.ideals.flatMap((item, index) => {
      if (!item || typeof item !== 'object') return []
      const row = item as { id?: unknown, label?: unknown, reason?: unknown, flowerKind?: unknown }
      const label = typeof row.label === 'string' ? row.label.trim().slice(0, 24) : ''
      if (!label) return []
      const id = typeof row.id === 'string' && row.id.trim() && row.id !== EVENT_MARK_ID && row.id !== OWN_CHOICE_ID
        ? row.id.trim().slice(0, 32)
        : `ideal-${index}`
      const kind = Number(row.flowerKind)
      return [{
        id,
        label,
        reason: typeof row.reason === 'string' ? row.reason.trim().slice(0, 80) : '',
        ...(Number.isInteger(kind) ? { flowerKind: flowerKindAt(kind) } : {}),
      }]
    }).slice(0, 5)
    : []
  return { era, ideals }
}

export function eventIdealChoices(age: number, drafts: EventIdealDraft[], fallback: EraNode): EraChoice[] {
  const fromModel = drafts
    .filter(item => item.id !== EVENT_MARK_ID && item.id !== OWN_CHOICE_ID && item.label && item.label !== EVENT_MARK_LABEL)
    .map((item, index) => idealChoiceFromDraft(age, item, index))
  if (fromModel.length) return fromModel
  return fallback.choices.filter(item => item.id !== OWN_CHOICE_ID && item.id !== EVENT_MARK_ID).slice(0, 5)
}

export function eventYearChoices(
  age: number,
  event: LifeEventEntry,
  phase: 'plant' | 'ideal',
  drafts: EventIdealDraft[],
  fallback: EraNode,
): EraChoice[] {
  if (phase === 'plant') return [eventMarkChoice(age, event.text)]
  return eventIdealChoices(age, drafts, fallback)
}

export function eventYearMemoryVisible(input: { eventYear: boolean, away: boolean, yearOpen: boolean }): boolean {
  return input.eventYear && !input.away && input.yearOpen
}

export function eventMarkPortraits(age: number, chosen: EraChoice): SignalPortrait[] {
  const current = eraNodeForAge(age)
  const crossNode = eraNodeForAge(age < 40 ? age + 25 : Math.max(5, age - 25))
  const cross = crossNode.choices[chosen.flowerKind % Math.max(1, crossNode.choices.length)] ?? current.choices[0]
  return [
    { slot: SIGNAL_SLOTS[0], kind: 'A', npc: chosen.npc, note: '也有人走过相近的大事，这是对照，不是匹配分数', choice: chosen, age: current.age },
    { slot: SIGNAL_SLOTS[3], kind: 'B', npc: { ...cross.npc, match: '在另一个年纪，TA 也面对过相近的分岔。' }, note: '相似的困境，不同的时代', choice: chosen, age: crossNode.age },
  ]
}

function idealChoiceFromDraft(age: number, draft: EventIdealDraft, index: number): EraChoice {
  const label = draft.label.trim().slice(0, 24)
  const reason = draft.reason.trim() || `如果当时更希望走，可能会靠近「${label}」。`
  return {
    id: draft.id,
    label,
    peer: 0,
    reason,
    flowerKind: draft.flowerKind ?? flowerKindAt(index + 1),
    npc: {
      name: '更希望的那一条',
      identity: `${age}岁可能更希望走的路`,
      proposition: label,
      match: `这不是当时种下的路，是更希望靠近的方向：${label}。`,
      causal: {
        background: `${age}岁记下的大事旁边，还有你可能更希望走的方向。`,
        options: label,
        choice: label,
        cost: '更希望走，不等于当时已经走。',
        reflection: reason,
      },
    },
  }
}
