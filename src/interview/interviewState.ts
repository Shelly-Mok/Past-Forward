import type { InterviewSynthesis } from './dialoguePrompt'
import type { ArchiveProfile } from '../archive/archiveInterview'
import { eraChoice } from '../garden/gardenContent'
import { parseTarget, type PlantedChoice } from '../garden/gardenState'

export type SlotId = 'choice' | 'motive' | 'constraint' | 'alternative' | 'agency'
export type NodeStatus = 'pending' | 'interviewing' | 'complete'
export type AgencyValue = '主动偏好' | '条件妥协' | '两者兼有'
export type ReportKind = 'none' | 'partial' | 'full'

export const SLOT_ORDER: SlotId[] = ['choice', 'motive', 'constraint', 'alternative', 'agency']
const SPARSE_WORDS = ['还好', '不知道', '随便', '忘了']

export type InterviewNode = {
  id: string
  age: number
  title: string
  status: NodeStatus
  slots: Record<SlotId, string>
  sparse: Partial<Record<SlotId, boolean>>
}

export type InterviewState = {
  nodes: InterviewNode[]
  currentId: string
  closingAsked: boolean
  closingConfirmed: boolean
  manualOffered: boolean
  report: ReportKind
  synthesis?: InterviewSynthesis
}

function emptySlots(): Record<SlotId, string> {
  return { choice: '', motive: '', constraint: '', alternative: '', agency: '' }
}

function nodeId(age: number, title: string) {
  return `${age}:${title}`
}

function plantedTitle(item: PlantedChoice) {
  return item.label?.trim() || eraChoice(item.age, item.choiceId)?.label || item.choiceId
}

export function isSparse(text: string): boolean {
  const raw = text.trim().replace(/[，。！？、,.!?\s]/g, '')
  if (!raw) return true
  if (raw.length < 8) return true
  return SPARSE_WORDS.some(word => raw === word || raw.includes(word))
}

export function buildNodes(
  planted: PlantedChoice[],
  profile: ArchiveProfile,
  currentAge: number | null,
): InterviewNode[] {
  const byAge = new Map<number, InterviewNode>()
  for (const item of planted) {
    const title = plantedTitle(item)
    byAge.set(item.age, {
      id: nodeId(item.age, title),
      age: item.age,
      title,
      status: 'pending',
      slots: emptySlots(),
      sparse: {},
    })
  }
  const event = parseTarget(profile.lifeEvent)
  if (event.age !== null && !byAge.has(event.age)) {
    const title = profile.lifeEvent?.trim() || `${event.age}岁`
    byAge.set(event.age, {
      id: nodeId(event.age, title),
      age: event.age,
      title,
      status: 'pending',
      slots: emptySlots(),
      sparse: {},
    })
  }
  if (!byAge.size) {
    const ages = [event.age, currentAge].filter((age): age is number => age !== null)
    const unique = [...new Set(ages.length ? ages : [currentAge ?? 18])]
    for (const age of unique) {
      const title = `${age}岁`
      byAge.set(age, {
        id: nodeId(age, title),
        age,
        title,
        status: 'pending',
        slots: emptySlots(),
        sparse: {},
      })
    }
  }
  return [...byAge.values()].sort((a, b) => a.age - b.age)
}

export function emptyInterview(nodes: InterviewNode[], originAge?: number | null): InterviewState {
  const origin = originAge == null
    ? nodes[0]
    : nodes.find(item => item.age === originAge) ?? nodes[0]
  return {
    nodes,
    currentId: origin?.id ?? '',
    closingAsked: false,
    closingConfirmed: false,
    manualOffered: false,
    report: 'none',
  }
}

function replaceNode(state: InterviewState, node: InterviewNode): InterviewState {
  return {
    ...state,
    nodes: state.nodes.map(item => item.id === node.id ? node : item),
    currentId: node.id,
    report: 'none',
    closingAsked: false,
    closingConfirmed: false,
    manualOffered: false,
  }
}

function finalize(node: InterviewNode): InterviewNode {
  const missing = nextMissingSlot(node)
  const sparseOpen = SLOT_ORDER.some(slot => node.sparse[slot])
  if (!missing && !sparseOpen) return { ...node, status: 'complete' }
  return { ...node, status: 'interviewing' }
}

export function nextMissingSlot(node: InterviewNode): SlotId | null {
  for (const slot of SLOT_ORDER) {
    if (!node.slots[slot] || node.sparse[slot]) return slot
  }
  return null
}

export function focusInterviewNode(state: InterviewState): InterviewNode | undefined {
  if (!state.nodes.length) return undefined
  const current = state.nodes.find(item => item.id === state.currentId)
  if (current && nextMissingSlot(current)) return current
  const open = state.nodes.find(item => nextMissingSlot(item))
  return open ?? current ?? state.nodes.at(-1)
}

export function applyUtterance(state: InterviewState, nodeId: string, slot: SlotId, text: string): InterviewState {
  const node = state.nodes.find(item => item.id === nodeId)
  if (!node || slot === 'agency') return state
  const trimmed = text.trim()
  const sparse = isSparse(trimmed)
  const next: InterviewNode = {
    ...node,
    slots: { ...node.slots, [slot]: trimmed },
    sparse: { ...node.sparse, [slot]: sparse },
  }
  if (!sparse) delete next.sparse[slot]
  const updated = replaceNode(state, finalize(next))
  return maybeAskClosing(updated)
}

export function markAgency(state: InterviewState, nodeId: string, value: AgencyValue): InterviewState {
  const node = state.nodes.find(item => item.id === nodeId)
  if (!node) return state
  const next: InterviewNode = {
    ...node,
    slots: { ...node.slots, agency: value },
    sparse: { ...node.sparse },
  }
  delete next.sparse.agency
  return maybeAskClosing(replaceNode(state, finalize(next)))
}

function allComplete(state: InterviewState) {
  return state.nodes.length > 0 && state.nodes.every(node => node.status === 'complete')
}

function maybeAskClosing(state: InterviewState): InterviewState {
  if (!allComplete(state)) return { ...state, closingAsked: false, closingConfirmed: false, report: 'none' }
  return { ...state, closingAsked: true, report: 'none' }
}

export function autoReportReady(state: InterviewState): boolean {
  return allComplete(state) && state.closingConfirmed
}

export function confirmClosing(state: InterviewState): InterviewState {
  if (!allComplete(state)) return state
  return { ...state, closingAsked: true, closingConfirmed: true, report: 'full' }
}

export function manualReportPrompt(state: InterviewState): string {
  const done = state.nodes.filter(node => node.status === 'complete')
  const open = state.nodes.filter(node => node.status !== 'complete')
  const doneTitles = done.map(node => `${node.age} 岁${node.title}`).join('、') || '还没有'
  const openTitles = open.map(node => `${node.age} 岁${node.title}`).join('、') || '无'
  return `目前我们完成了 ${done.length}/${state.nodes.length} 个节点的访谈，${doneTitles}的信息收集完毕；${openTitles}还没有深入聊。你可以选择：① 先输出一份不完整的阶段性报告；② 继续聊剩下节点，等全部完成再生成完整报告。`
}

export function requestManualReport(state: InterviewState): InterviewState {
  return { ...state, manualOffered: true, report: 'none' }
}

export function acceptPartialReport(state: InterviewState): InterviewState {
  return { ...state, report: 'partial' }
}

export function authorizeReport(state: InterviewState, kind: 'partial' | 'full') {
  if (kind === 'full' && !autoReportReady(state)) {
    return { ok: false as const, status: 409, error: 'INCOMPLETE' }
  }
  return { ok: true as const, status: 200 }
}

export const INTERVIEW_ROUND_LIMIT = 10

export function talkRounds(transcript: Array<{ who: string, text?: string }>): number {
  return transcript.filter(line => line.who === 'you').length
}

export function talkLimitReached(rounds: number): boolean {
  return rounds >= INTERVIEW_ROUND_LIMIT
}

export const INTERVIEW_SAVE_KEY = 'life-backtest.interview.v1'

export function readInterviewSave(): InterviewState | null {
  try {
    const raw = localStorage.getItem(INTERVIEW_SAVE_KEY)
    return raw ? JSON.parse(raw) as InterviewState : null
  } catch {
    return null
  }
}

export function writeInterviewSave(state: InterviewState) {
  try { localStorage.setItem(INTERVIEW_SAVE_KEY, JSON.stringify(state)) } catch { /* keep memory */ }
}

export type InterviewRecap = {
  title: string
  empty: boolean
  kind: ReportKind
  nodes: InterviewNode[]
  synthesis?: InterviewSynthesis
}

export function interviewRecap(state: InterviewState | null): InterviewRecap {
  if (!state?.nodes.length) {
    return { title: '人生回测报告', empty: true, kind: 'none', nodes: [], synthesis: state?.synthesis }
  }
  const filled = state.nodes.some(node => SLOT_ORDER.some(slot => Boolean(node.slots[slot])))
  const done = state.nodes.filter(node => node.status === 'complete')
  const title = state.report === 'full' && done.length === state.nodes.length
    ? '人生回测报告'
    : done.length
      ? `不完整 · ${done.length}/${state.nodes.length}`
      : '人生回测报告'
  return { title, empty: !filled, kind: state.report, nodes: state.nodes, synthesis: state.synthesis }
}

export const CLOSING_QUESTION = '所有分叉点我们都聊完了。回过头看，有没有哪一个选择，现在回头看，还有当时没提到的考量？确认之后，我就整理完整报告。'
export const FULL_REPORT_OFFER = '我们已经聊完了你人生所有关键分叉点。现在我可以整理一份完整报告，汇总你每一次选择背后的想法与当时的客观条件，需要生成吗？'
