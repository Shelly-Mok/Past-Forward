import type { AltLine } from './altTimeline'
import { formatPersonalTagForModel } from '../outlook/personalTag'

export const INTERVIEW_CONTEXT_KEY = 'life-backtest.interview-context.v1'

export type InterviewContextSave = {
  planted: Array<{ age: number, choiceId: string, label?: string }>
  events: Array<{ age: number, text: string }>
  eventTalks?: Array<{ age: number, text: string, lines: Array<{ who: string, text: string }> }>
  altTimeline: AltLine[]
  transcript: Array<{ who: string, text: string }>
  personalTag?: { plans?: string, eventNotes?: Array<{ age: number, event: string, note: string }> }
}

export function writeInterviewContext(payload: InterviewContextSave) {
  try { localStorage.setItem(INTERVIEW_CONTEXT_KEY, JSON.stringify(payload)) } catch { /* keep memory */ }
}

export function readInterviewContext(): InterviewContextSave | null {
  try {
    const raw = localStorage.getItem(INTERVIEW_CONTEXT_KEY)
    return raw ? JSON.parse(raw) as InterviewContextSave : null
  } catch {
    return null
  }
}

export function formatInterviewContext(payload: InterviewContextSave | null): string {
  if (!payload) return '这一局还没有保存上下文。'
  const events = payload.events.map(item => `${item.age}岁 · ${item.text}`).join('\n')
  const talks = (payload.eventTalks ?? []).map(item => {
    const lines = item.lines.map(line => `${line.who === 'you' ? '你' : '记录员'}：${line.text}`).join('；')
    return `${item.age}岁 · ${item.text}${lines ? `｜${lines}` : ''}`
  }).join('\n')
  const timeline = payload.altTimeline.map(item => item.text).join('\n')
  const talk = payload.transcript.map(item => `${item.who === 'you' ? '你' : '另一个我'}：${item.text}`).join('\n')
  const tag = formatPersonalTagForModel(payload.personalTag)
  return [
    events && `重大事件\n${events}`,
    talks && `第三幕事件对话\n${talks}`,
    tag && `个人标签\n${tag}`,
    timeline && `另一条时间线\n${timeline}`,
    talk && `对话\n${talk}`,
  ].filter(Boolean).join('\n\n')
}
