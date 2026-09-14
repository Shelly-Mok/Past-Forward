import type { SlotId } from './interviewState'

export type InterviewCandidate = {
  id: string
  author: string
  headline: string
  quote: string
  source: 'zhihu' | 'demo'
  href?: string
  identity?: string
}

export const DEMO_CANDIDATES: InterviewCandidate[] = [
  {
    id: 'demo-a',
    author: '另一条路上的人',
    headline: '种下的路和你写下的事件对上了。',
    quote: '我在那个年纪也站过差不多的路口。',
    source: 'demo',
  },
  {
    id: 'demo-b',
    author: '晚一点出发的人',
    headline: '学历和近况挨着，重合还浅。',
    quote: '后来才懂，当时看见的选项并不完整。',
    source: 'demo',
  },
  {
    id: 'demo-c',
    author: '先稳住再回头的人',
    headline: '同一类分叉，不是同一个人。',
    quote: '我没有走你走的那条，所以想听听你为什么走。',
    source: 'demo',
  },
]

export const NEXT_QUESTION: Record<SlotId, string> = {
  choice: '你刚说到的，落到那一年，你真正选的是什么？',
  motive: '你刚才那句话里，当时心里最放不下的是什么？',
  constraint: '听你这么说，有哪些条件是你当时没法改的？',
  alternative: '顺着你刚说的，当时还能看见哪一条没走的路？',
  agency: '回头看，那是你更想要的，还是条件逼出来的？',
}

export const OPENING_QUESTION = '从你记得最清楚的那一年说起也行。当时你最先想到的是什么？'

export function cannedReply(slot: SlotId | null, lastYou = ''): string {
  const heard = lastYou.trim()
  if (!slot) {
    return heard
      ? `你刚才说「${heard.slice(0, 24)}」，后面几年好像还连着。后来你最先碰到的是什么？`
      : '你刚才说的这一点，后面几年好像还连着。后来你最先碰到的是什么？'
  }
  return heard ? `${NEXT_QUESTION[slot]}` : NEXT_QUESTION[slot]
}
