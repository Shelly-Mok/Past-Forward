import { readLifeEvents, type ArchiveProfile } from '../archive/archiveInterview'
import { eraAges, eraNodeForAge } from '../garden/gardenContent'
import { parseTarget, type PlantedChoice } from '../garden/gardenState'

export type AltLine = {
  age: number
  text: string
  same: boolean
  choice: string
}

export function alternateChoice(age: number, chosenId: string) {
  const node = eraNodeForAge(age)
  return node.choices.find(item => item.id !== chosenId && item.id !== 'own')
    ?? node.choices.find(item => item.id !== chosenId)
    ?? null
}

function plantedAt(planted: PlantedChoice[], age: number) {
  return planted.find(item => item.age === age)
}

export function altTimelineAges(
  planted: PlantedChoice[],
  start: number,
  currentAge: number | null,
): number[] {
  const end = currentAge ?? planted.at(-1)?.age ?? start
  const ages = new Set<number>()
  for (const item of planted) {
    if (item.age >= start && item.age <= end) ages.add(item.age)
  }
  for (const age of eraAges()) {
    if (age >= start && age <= end) ages.add(age)
  }
  if (currentAge !== null && currentAge >= start) ages.add(currentAge)
  return [...ages].sort((a, b) => a - b)
}

export function eventStartAge(
  profile: Pick<ArchiveProfile, 'lifeEvent' | 'lifeEvents'>,
  planted: PlantedChoice[] = [],
): number {
  const origin = parseTarget(profile.lifeEvent).age
  if (origin !== null) return origin
  return readLifeEvents(profile)[0]?.age ?? planted[0]?.age ?? 0
}

export function buildAltTimeline(
  planted: PlantedChoice[],
  profile: Pick<ArchiveProfile, 'lifeEvent' | 'lifeEvents'>,
  currentAge: number | null = null,
): AltLine[] {
  const start = eventStartAge(profile, planted)
  const lines: AltLine[] = []
  for (const age of altTimelineAges(planted, start, currentAge)) {
    const yours = plantedAt(planted, age)
    const yoursId = yours?.choiceId ?? ''
    const alt = alternateChoice(age, yoursId)
    const label = alt?.label || eraNodeForAge(age).choices.find(item => item.id !== 'own')?.label || '另一条路'
    lines.push({
      age,
      same: false,
      choice: label,
      text: `${age}岁 · ${label}`,
    })
  }
  return lines
}

export function applySearchChoice(line: AltLine, label: string): AltLine {
  const clean = label.trim()
  if (!clean || line.same) return line
  return { ...line, choice: clean, text: `${line.age}岁 · ${clean}` }
}
