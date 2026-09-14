export const EVENT_TALK_KEY = 'life-backtest.event-talk.v1'

export type EventTalkRecord = {
  age: number
  text: string
  lines: Array<{ who: 'you' | 'other', text: string }>
}

function readMap(): Record<string, EventTalkRecord> {
  try {
    const raw = localStorage.getItem(EVENT_TALK_KEY)
    return raw ? JSON.parse(raw) as Record<string, EventTalkRecord> : {}
  } catch {
    return {}
  }
}

export function readEventTalks(): EventTalkRecord[] {
  return Object.values(readMap())
    .filter(item => item && Number.isFinite(item.age) && item.text)
    .sort((a, b) => a.age - b.age)
}

export function readEventTalk(age: number): EventTalkRecord | null {
  return readMap()[String(age)] ?? null
}

export function writeEventTalk(record: EventTalkRecord) {
  const map = readMap()
  map[String(record.age)] = record
  try { localStorage.setItem(EVENT_TALK_KEY, JSON.stringify(map)) } catch { /* keep memory */ }
}
