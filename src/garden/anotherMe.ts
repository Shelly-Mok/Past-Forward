import { eraChoice, eraNodeForAge, isOwnChoice, OWN_CHOICE_ID, ownChoice, SIGNAL_SLOTS, type EraChoice, type SignalPortrait } from './gardenContent'
import { choicePostFor, type ChoicePost } from './riftContent'
import { timelineNodes, type PlantedChoice } from './gardenState'

export type AgentChapter = 'appear' | 'walk' | 'meet' | 'farewell' | 'report'
export type AgentReply = 'path' | 'well' | 'silent'

export const AGENT_CHAPTERS: AgentChapter[] = ['appear', 'walk', 'meet', 'farewell', 'report']

export type AnotherMeProfile = {
  forkAge: number
  presentAge: number
  yours: EraChoice
  alt: EraChoice
  yourLabel: string
  altLabel: string
  gain: string
  left: string
  unexpected: string
  evidence: ChoicePost[]
  years: number[]
}

export type WalkPicks = Record<string, string>

export type WalkBeat = {
  age: number
  index: number
  last: boolean
  title: string
  event: string
  era: string
  options: EraChoice[]
  choice?: EraChoice
  yours?: EraChoice
  gain: string
  advantage: string
  cost: string
  result: string
}

function plantedChoice(item: PlantedChoice): EraChoice {
  if (item.choiceId === OWN_CHOICE_ID || isOwnChoice({ id: item.choiceId } as EraChoice)) {
    return ownChoice(item.age, item.label ?? '')
  }
  return eraChoice(item.age, item.choiceId) ?? eraNodeForAge(item.age).choices[0]
}

export function resolveForkAge(
  targetAge: number | null,
  planted: PlantedChoice[],
  currentAge: number | null,
): number {
  if (targetAge !== null && (currentAge === null || targetAge <= currentAge)) return targetAge
  const first = planted.find(item => currentAge === null || item.age <= currentAge)
  return first?.age ?? (currentAge ? Math.max(0, currentAge - 2) : 20)
}

export function rewindWalkAges(forkAge: number, currentAge: number | null, targetAge: number | null = forkAge): number[] {
  const start = Math.max(0, forkAge)
  const end = currentAge === null ? start : Math.max(start, currentAge)
  const ages = [0, 1, 2].flatMap(band => timelineNodes(band, targetAge ?? start, start, end))
  return [...new Set([start, end, ...ages.filter(age => age >= start && age <= end)])].sort((a, b) => a - b)
}

export function resolveAnotherMe(
  planted: PlantedChoice[],
  currentAge: number | null,
  backtrackAge?: number | null,
  altChoiceId?: string | null,
  targetAge?: number | null,
): AnotherMeProfile {
  const forkAge = resolveForkAge(backtrackAge ?? targetAge ?? null, planted, currentAge)
  const node = eraNodeForAge(forkAge)
  const plantedHere = planted.find(item => item.age === forkAge)
  const yours = plantedHere ? plantedChoice(plantedHere) : node.choices[0]
  const others = node.choices.filter(item => item.id !== yours.id && item.id !== OWN_CHOICE_ID)
  const alt = (altChoiceId ? eraChoice(forkAge, altChoiceId) : undefined)
    ?? others[0]
    ?? node.choices.find(item => item.id !== yours.id)
    ?? node.choices[0]
  const presentAge = currentAge ?? planted.at(-1)?.age ?? forkAge
  return {
    forkAge,
    presentAge,
    yours,
    alt,
    yourLabel: yours.label,
    altLabel: alt.label,
    gain: alt.npc.causal.choice,
    left: yours.npc.causal.choice,
    unexpected: alt.npc.causal.cost,
    evidence: [choicePostFor(node.age, alt.id)],
    years: rewindWalkAges(forkAge, presentAge, forkAge),
  }
}

export function walkOptions(age: number, planted: PlantedChoice[] = []): EraChoice[] {
  const yours = planted.find(item => item.age === age)?.choiceId
  const choices = eraNodeForAge(age).choices.filter(item => item.id !== OWN_CHOICE_ID)
  const unused = choices.filter(item => item.id !== yours)
  return unused.length ? unused : choices
}

export function anotherMeChoiceAt(
  age: number,
  profile: AnotherMeProfile,
  planted: PlantedChoice[],
  walkPicks: WalkPicks = {},
): EraChoice {
  const picked = walkPicks[String(age)]
  if (picked) return eraChoice(age, picked) ?? eraNodeForAge(age).choices[0]
  const options = walkOptions(age, planted)
  if (age === profile.forkAge) return eraChoice(age, profile.alt.id) ?? options[0] ?? profile.alt
  return options[0] ?? eraNodeForAge(age).choices[0]
}

export function walkBeat(
  profile: AnotherMeProfile,
  planted: PlantedChoice[],
  index: number,
  walkPicks: WalkPicks = {},
): WalkBeat {
  const years = profile.years
  const age = years[Math.max(0, Math.min(years.length - 1, index))] ?? profile.forkAge
  const node = eraNodeForAge(age)
  const options = walkOptions(age, planted)
  const pickedId = walkPicks[String(age)]
  const choice = pickedId ? eraChoice(age, pickedId) ?? options.find(item => item.id === pickedId) : undefined
  const yours = planted.find(item => item.age === age)
  return {
    age,
    index: years.indexOf(age),
    last: age === years.at(-1),
    title: node.title,
    event: node.event,
    era: node.era,
    options,
    choice,
    yours: yours ? plantedChoice(yours) : undefined,
    gain: choice?.npc.causal.choice ?? '',
    advantage: choice?.npc.proposition ?? '',
    cost: choice?.npc.causal.cost ?? '',
    result: choice?.npc.causal.reflection ?? '',
  }
}

export function nextWalkIndex(profile: AnotherMeProfile, index: number) {
  if (index >= profile.years.length - 1) return null
  return index + 1
}

export function prevAgentState(chapter: AgentChapter, walkIndex: number): { chapter: AgentChapter, walkIndex: number } | null {
  if (chapter === 'report') return { chapter: 'farewell', walkIndex }
  if (chapter === 'farewell') return { chapter: 'meet', walkIndex }
  if (chapter === 'meet') return { chapter: 'walk', walkIndex }
  if (chapter === 'walk') return walkIndex > 0 ? { chapter: 'walk', walkIndex: walkIndex - 1 } : { chapter: 'appear', walkIndex: 0 }
  return null
}

export function flowerTint(chapter: AgentChapter, walkIndex = 0, yearCount = 1) {
  if (chapter === 'appear') return 0.08
  if (chapter === 'walk') return 0.16 + (yearCount <= 1 ? 0.2 : (walkIndex / Math.max(1, yearCount - 1)) * 0.45)
  if (chapter === 'meet') return 0.72
  return 1
}

export function appearLines() {
  return [
    '有些人生没有消失。',
    '它只是没有发生在你身上。',
    '而现在，你终于看见了它。',
  ]
}

export function farewellScript() {
  return ['我该回去了。', '剩下的路，你来走。']
}

export function reportPrompt() {
  return {
    title: '你看见了两种人生。',
    lead: '现在，把你真正走过的这一条留下来。',
  }
}

export function journeyMatchPortraits(
  planted: PlantedChoice[],
  currentAge: number | null,
  forkAge: number,
  walkPicks: WalkPicks = {},
): SignalPortrait[] {
  const pickedTrail = Object.entries(walkPicks)
    .map(([age, choiceId]) => ({ age: Number(age), choiceId }))
    .filter(item => Number.isInteger(item.age) && item.age >= forkAge && (currentAge === null || item.age <= currentAge))
    .sort((a, b) => a.age - b.age)
  const trail = pickedTrail.length
    ? pickedTrail
    : planted.filter(item => item.age >= forkAge && (currentAge === null || item.age <= currentAge))
  const last = trail.at(-1) ?? planted.at(-1)
  const present = currentAge ?? last?.age ?? forkAge
  const lastChoice = last ? plantedChoice(last) : eraNodeForAge(present).choices[0]
  const labels = trail.map(item => plantedChoice(item).label).filter(Boolean)
  const trailText = labels.length ? labels.join(' → ') : lastChoice.label
  const first = trail[0] ? plantedChoice(trail[0]) : lastChoice
  const peerNode = eraNodeForAge(Math.max(forkAge, present - 5))
  const peer = peerNode.choices.find(item => item.id === lastChoice.id) ?? first
  const late = eraNodeForAge(Math.min(100, present + 25))
  const lateChoice = late.choices.find(item => item.id === lastChoice.id)
    ?? late.choices[lastChoice.flowerKind % late.choices.length]
    ?? late.choices[0]
  const older = eraNodeForAge(present < 40 ? Math.min(100, present + 40) : Math.max(0, present - 25))
  const olderChoice = older.choices.find(item => item.id === lastChoice.id)
    ?? older.choices[0]
  return [
    {
      slot: SIGNAL_SLOTS[0],
      kind: 'A',
      npc: { ...lastChoice.npc, match: `从 ${forkAge} 岁走到 ${present} 岁：${trailText}。` },
      note: `${present} 岁 · 同代相近`,
      choice: lastChoice,
      age: present,
    },
    {
      slot: SIGNAL_SLOTS[1],
      kind: 'A',
      npc: { ...peer.npc, match: `同一代里，TA 也走过相近的一段：${peer.label}。` },
      note: `${peerNode.age} 岁 · 同代同行`,
      choice: peer,
      age: peerNode.age,
    },
    {
      slot: SIGNAL_SLOTS[3],
      kind: 'B',
      npc: { ...lateChoice.npc, match: `跨代仍是同一类抉择。TA 在 ${late.age} 岁面对过相近的事。` },
      note: `${late.age} 岁 · 跨代对照`,
      choice: lateChoice,
      age: late.age,
    },
    {
      slot: 'B · 同事抉择',
      kind: 'B',
      npc: { ...olderChoice.npc, match: `不论出生年。遭遇同类事件的人，凭什么、为什么、后来如何。` },
      note: `${older.age} 岁 · 同事抉择`,
      choice: olderChoice,
      age: older.age,
    },
  ]
}

const BLOOM_POSE = 10
const IDLE_FRAME = { sx: 256, sy: 128, sw: 128, sh: 128 }

function readySheet(source: CanvasImageSource | null | undefined) {
  return source && 'naturalWidth' in source && Number(source.naturalWidth) > 0 ? source : null
}

function drawPrince(
  ctx: CanvasRenderingContext2D,
  sprite: CanvasImageSource | null,
  x: number,
  y: number,
  facing: 1 | -1,
  alpha: number,
  size: number,
) {
  ctx.save()
  ctx.translate(Math.round(x), Math.round(y))
  ctx.scale(facing, 1)
  ctx.globalAlpha = Math.min(1, alpha)
  ctx.fillStyle = '#050505a8'
  ctx.beginPath()
  ctx.ellipse(0, 1, size * 0.2, size * 0.042, -0.12, 0, Math.PI * 2)
  ctx.fill()
  const sheet = readySheet(sprite)
  if (sheet) ctx.drawImage(sheet, IDLE_FRAME.sx, IDLE_FRAME.sy, IDLE_FRAME.sw, IDLE_FRAME.sh, -size / 2, -size, size, size)
  else {
    const s = size / 32
    ctx.fillStyle = '#d8d8cc'
    ctx.fillRect(-3 * s, -28 * s, 6 * s, 6 * s)
    ctx.fillStyle = '#2a2a26'
    ctx.fillRect(-6 * s, -22 * s, 12 * s, 14 * s)
    ctx.fillStyle = '#1a1a18'
    ctx.fillRect(-5 * s, -8 * s, 4 * s, 8 * s)
    ctx.fillRect(1 * s, -8 * s, 4 * s, 8 * s)
  }
  ctx.restore()
}

function drawGhostPrince(
  ctx: CanvasRenderingContext2D,
  sprite: CanvasImageSource | null,
  x: number,
  y: number,
  size: number,
  alpha: number,
  seed: number,
) {
  ctx.save()
  ctx.translate(Math.round(x), Math.round(y))
  ctx.scale(-1, 1)
  ctx.globalAlpha = Math.min(0.72, alpha)
  ctx.filter = 'brightness(1.7) contrast(0.8)'
  ctx.fillStyle = '#ffffff22'
  ctx.beginPath()
  ctx.ellipse(0, 1, size * 0.2, size * 0.042, -0.12, 0, Math.PI * 2)
  ctx.fill()
  const sheet = readySheet(sprite)
  if (sheet) ctx.drawImage(sheet, IDLE_FRAME.sx, IDLE_FRAME.sy, IDLE_FRAME.sw, IDLE_FRAME.sh, -size / 2, -size, size, size)
  else {
    const s = size / 32
    ctx.fillStyle = '#c8c8bc'
    ctx.fillRect(-3 * s, -28 * s, 6 * s, 6 * s)
    ctx.fillStyle = '#7a7a72'
    ctx.fillRect(-6 * s, -22 * s, 12 * s, 14 * s)
    ctx.fillRect(-5 * s, -8 * s, 4 * s, 8 * s)
    ctx.fillRect(1 * s, -8 * s, 4 * s, 8 * s)
  }
  ctx.restore()
  ctx.fillStyle = '#ffffff'
  for (let i = 0; i < 18; i++) {
    const n = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453
    const unit = n - Math.floor(n)
    const dx = (unit - 0.5) * size * 0.4
    const dy = -size * (0.7 + unit * 0.3)
    ctx.globalAlpha = 0.22 + unit * 0.5
    ctx.fillRect(Math.round(x + dx), Math.round(y + dy), i % 4 === 0 ? 2 : 1, 1)
  }
  ctx.globalAlpha = 1
}

function drawGardenFlower(
  ctx: CanvasRenderingContext2D,
  flowers: CanvasImageSource | null,
  x: number,
  y: number,
  size: number,
  glow: boolean,
  alpha: number,
) {
  ctx.save()
  ctx.translate(Math.round(x), Math.round(y))
  ctx.globalAlpha = alpha
  if (glow) {
    ctx.shadowColor = '#ffffff'
    ctx.shadowBlur = 22
    ctx.fillStyle = '#ffffff14'
    ctx.beginPath()
    ctx.ellipse(0, -size * 0.42, size * 0.28, size * 0.22, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  const sheet = readySheet(flowers)
  if (sheet) ctx.drawImage(sheet, BLOOM_POSE * 128, 0, 128, 128, -size / 2, -size, size, size)
  else {
    const cell = Math.max(2, Math.round(size / 28))
    ctx.fillStyle = glow ? '#e8e8dc' : '#6a6a62'
    ctx.fillRect(-cell, 2 * cell, 2 * cell, 8 * cell)
    for (const [dx, dy] of [[-4, -4], [2, -4], [-1, -7], [-4, 0], [2, 0], [-1, -1]]) {
      ctx.fillRect(dx * cell, dy * cell, 4 * cell, 3 * cell)
    }
    ctx.fillStyle = glow ? '#f6f6ee' : '#8a8a80'
    ctx.fillRect(-2 * cell, -3 * cell, 4 * cell, 4 * cell)
  }
  ctx.restore()
}

export function paintAgentEncounter(
  canvas: HTMLCanvasElement,
  profile: AnotherMeProfile,
  chapter: AgentChapter,
  sprite?: CanvasImageSource | null,
  flowers?: CanvasImageSource | null,
  walkIndex = 0,
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const width = 980
  const height = 420
  canvas.width = width
  canvas.height = height
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, width, height)

  const tint = flowerTint(chapter, walkIndex, profile.years.length)
  const fading = chapter === 'farewell' || chapter === 'report'
  const left = { x: 392, y: 378 }
  const right = { x: 588, y: 378 }
  const prince = 118
  const bloom = 132

  drawGardenFlower(ctx, flowers ?? null, left.x - 92, left.y + 4, bloom, true, 1)
  drawGardenFlower(ctx, flowers ?? null, right.x + 92, right.y + 4, bloom * 0.92, tint > 0.55, fading ? 0.16 : 0.38)
  drawPrince(ctx, sprite ?? null, left.x, left.y, 1, 1, prince)
  if (!fading) drawGhostPrince(ctx, sprite ?? null, right.x, right.y, prince, chapter === 'appear' ? 0.4 : 0.48, profile.forkAge)
  else drawGhostPrince(ctx, sprite ?? null, right.x, right.y, prince, 0.14, profile.forkAge + 9)
}
