import type { ArchiveProfile, LifeEventEntry } from '../archive/archiveInterview'
import { eraChoice } from '../garden/gardenContent'
import type { PlantedChoice } from '../garden/gardenState'
import { formatPersonalTagForModel, type PersonalEventNote } from '../outlook/personalTag'
import type { InterviewState } from './interviewState'

type PromptPersonalTag = {
  plans?: string
  eventNotes?: PersonalEventNote[]
}

export type EventTalkSave = {
  age: number
  text: string
  lines: Array<{ who: string, text: string }>
}

export type SynthesisNode = {
  age: number
  title: string
  cost: string
  gain: string
}

export type InterviewSynthesis = {
  nodes: SynthesisNode[]
  eventReason: string
  method: string
}

function trailOf(planted: PlantedChoice[], path?: string) {
  return path?.trim() || planted.map(item => `${item.age}岁 · ${item.label || item.choiceId}`).join(' → ')
}

export function eventDialoguePrompt(input: {
  event?: { age?: number, text?: string }
  events?: LifeEventEntry[]
  planted?: PlantedChoice[]
  path?: string
  personalTag?: PromptPersonalTag
}): string {
  const event = input.event || {}
  const planted = input.planted ?? []
  const before = planted.filter(item => event.age == null || item.age < event.age)
  const after = planted.filter(item => event.age != null && item.age >= event.age)
  const events = (input.events ?? []).map(item => `${item.age}岁 · ${item.text}`).join('；')
  return [
    '你是月面档案里的时间记录员，也是站在同一节点上的另一个我。',
    '用这件事发生之前的选择当背景，把用户整条时间线和历史选择当作已知输入。',
    '先讲这件事里最核心的价值取向，再披露你在同一节点考虑过什么因素、得到什么、失去什么。',
    '代价和成就要分开写，不要编造用户没写过的具体经历。不要提到模型、知乎、检索。',
    event.age != null ? `当前重大事件：${event.age}岁 · ${event.text || ''}` : '',
    before.length ? `事件之前的选择（背景）：${before.map(item => `${item.age}岁 · ${item.label || item.choiceId}`).join(' → ')}` : '',
    after.length ? `事件及之后的选择：${after.map(item => `${item.age}岁 · ${item.label || item.choiceId}`).join(' → ')}` : '',
    events ? `登记过的事件：${events}` : '',
    trailOf(planted, input.path) ? `完整时间线：${trailOf(planted, input.path)}` : '',
    formatPersonalTagForModel(input.personalTag),
  ].filter(Boolean).join('\n')
}

export function interviewDialoguePrompt(input: {
  persona?: { posts?: Array<{ title?: string, excerpt?: string }> }
  node?: { age?: number, title?: string }
  previous?: { age?: number, title?: string }
  lastYou?: string
  shifted?: boolean
  planted?: PlantedChoice[]
  path?: string
  events?: LifeEventEntry[]
  altTimeline?: Array<{ text?: string }>
  eventTalks?: EventTalkSave[]
  transcript?: Array<{ who?: string, text?: string }>
  round?: number
  personalTag?: PromptPersonalTag
}): string {
  const posts = Array.isArray(input.persona?.posts) ? input.persona.posts.slice(0, 8) : []
  const corpus = posts.map(post => `- ${String(post.title || '').slice(0, 80)}：${String(post.excerpt || '').slice(0, 160)}`).join('\n')
  const when = input.node?.age != null ? `${input.node.age}岁${input.node.title ? ` · ${input.node.title}` : ''}` : ''
  const events = (input.events ?? []).map(item => `${item.age}岁 · ${item.text}`).join('；')
  const alt = (input.altTimeline ?? []).map(item => item.text).filter(Boolean).join(' / ')
  const talks = (input.eventTalks ?? []).map(item => {
    const lines = item.lines.map(line => `${line.who === 'you' ? '用户' : '记录员'}：${line.text}`).join('；')
    return `${item.age}岁 · ${item.text}${lines ? `｜${lines}` : ''}`
  }).join('\n')
  const asked = (input.transcript ?? []).map(item => `${item.who === 'you' ? '用户' : '另一个我'}：${item.text || ''}`).join('\n')
  const lastYou = String(input.lastYou || '').trim()
    || [...(input.transcript ?? [])].reverse().find(item => item.who === 'you')?.text?.trim()
    || ''
  const prev = input.previous?.age != null
    ? `${input.previous.age}岁${input.previous.title ? ` · ${input.previous.title}` : ''}`
    : ''
  const round = Number(input.round) || 0
  return [
    '你是平行宇宙版本的知乎用户【Z】。性格、思考方式和语言都来自公开文字。',
    '你和用户U前期成长环境一致，但在关键分叉点做了不一样的选择。',
    '这是同一场连续对话。先接住用户上一句，再往下问，不要生硬切到下一年。',
    '把第三幕重大事件对话、整条时间线、历史选择和刚才的问答都当成已知材料。',
    '顺着已经说开的话头，把「代价」和「成就」问清楚：代价是当时失去或交出的，成就是当时真正得到的。',
    '对人生重大事件，进一步追问并归纳它的核心原因。',
    '在收束前给出一段可执行的前瞻方法论：现年后怎么做小验证，而不是一次定终身。',
    '每次只问一个开放式问题。保持好奇，不评判。不要提到模型、知乎、检索。',
    '年份可以随着话头自然带出来。不要宣布「下一个节点」「我们换一年」。若要从另一年继续，先用用户刚说的那句话搭一座桥，再轻轻问过去。',
    '整段对话最多 10 轮用户发言。不要把全部上下文铺进回复。',
    round ? `现在是第 ${round} / 10 轮。` : '',
    lastYou ? `用户上一句：${lastYou}` : '',
    input.shifted && prev && when
      ? `用户刚把 ${prev} 说清楚了一点。不要宣布换节点，先接住上一句，再轻轻问到 ${when}。`
      : when ? `这一轮可以落到：${when}。先接住上一句，再决定要不要问到这里。` : '',
    trailOf(input.planted ?? [], input.path) ? `完整时间线：${trailOf(input.planted ?? [], input.path)}` : '',
    events ? `重大事件：${events}` : '',
    talks ? `第三幕已经聊过的重大事件：\n${talks}` : '',
    alt ? `另一条时间线（只作对照）：${alt}` : '',
    asked ? `到目前为止的问答：\n${asked}` : '',
    formatPersonalTagForModel(input.personalTag),
    corpus ? `公开文字摘要：\n${corpus}` : '没有公开文字时，仍用平行宇宙的口吻提问，不要编造具体经历。',
  ].filter(Boolean).join('\n')
}

export function fallbackSynthesis(input: {
  state?: InterviewState | null
  planted?: PlantedChoice[]
  profile?: Pick<ArchiveProfile, 'lifeEvent'>
  events?: LifeEventEntry[]
}): InterviewSynthesis {
  const nodes = (input.state?.nodes?.length ? input.state.nodes : (input.planted ?? []).map(item => ({
    age: item.age,
    title: item.label || eraChoice(item.age, item.choiceId)?.label || item.choiceId,
    slots: { choice: item.label || '', motive: '', constraint: '', alternative: '', agency: '' },
  }))).map(node => {
    const choice = eraChoice(node.age, (input.planted ?? []).find(item => item.age === node.age)?.choiceId || '')
    const cost = ('slots' in node && node.slots.constraint) || choice?.npc.causal.cost || '当时交出的时间、关系和确定性'
    const gain = ('slots' in node && (node.slots.motive || node.slots.alternative)) || choice?.npc.causal.reflection || '另一条路打开的可能'
    return {
      age: node.age,
      title: node.title,
      cost,
      gain,
    }
  })
  const event = input.events?.[0]?.text || input.profile?.lifeEvent || ''
  const agency = input.state?.nodes?.map(node => node.slots.agency).find(Boolean) || ''
  return {
    nodes,
    eventReason: event
      ? `${event}${agency ? `。回过头看，更像是${agency}` : ''}。核心原因写在你走到这一年之前的那些选择里。`
      : '这一局还没有写下重大事件的核心原因。',
    method: '前瞻先把现年后三年看成可验证的小实验，而不是一次定终身。每年只加注一个能看见反馈的动作，先验证再决定要不要把生活押上去。',
  }
}
