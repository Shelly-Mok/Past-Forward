import { beforeEach, describe, expect, it } from 'vitest'
import { emptyInterview, type InterviewState } from '../interview/interviewState'
import { fillOutlookAvatar, renderRiftView, type RiftContext, type RiftHandlers, type RiftView } from './gardenRift'

class FakeNode {
  tagName: string
  className = ''
  textContent = ''
  type = ''
  href = ''
  target = ''
  rel = ''
  tabIndex = 0
  parent: FakeNode | null = null
  children: FakeNode[] = []
  attrs: Record<string, string> = {}
  dataset: Record<string, string> = {}
  style: Record<string, unknown> = { setProperty() { /* layout-only in page CSS */ } }
  classList = {
    contains: (name: string) => this.className.split(/\s+/).includes(name),
    add: (name: string) => { if (!this.classList.contains(name)) this.className = `${this.className} ${name}`.trim() },
    remove: (name: string) => { this.className = this.className.split(/\s+/).filter(item => item && item !== name).join(' ') },
    toggle: (name: string, force?: boolean) => {
      const on = force === undefined ? !this.classList.contains(name) : force
      if (on) this.classList.add(name)
      else this.classList.remove(name)
      return on
    },
  }

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase()
  }
  setAttribute(name: string, value: string) { this.attrs[name] = value }
  getAttribute(name: string) { return this.attrs[name] ?? null }
  getContext() { return null }
  addEventListener() { /* handlers are wired in render, not invoked here */ }
  closest(selector: string): FakeNode | null {
    return this.matches(selector) ? this : this.parent?.closest(selector) ?? null
  }
  append(...nodes: FakeNode[]) {
    for (const node of nodes) {
      node.parent = this
      this.children.push(node)
    }
  }
  replaceChildren() {
    this.children = []
  }
  matches(selector: string) {
    if (selector.startsWith('.')) {
      return selector.slice(1).split('.').every(name => this.classList.contains(name))
    }
    return this.tagName === selector.toUpperCase()
  }
  querySelector(selector: string): FakeNode | null {
    return this.querySelectorAll(selector)[0] ?? null
  }
  querySelectorAll(selector: string): FakeNode[] {
    const parts = selector.trim().split(/\s+/)
    if (parts.length > 1) {
      return this.querySelectorAll(parts[0]).flatMap(node => node.querySelectorAll(parts.slice(1).join(' ')))
    }
    const found: FakeNode[] = []
    const visit = (node: FakeNode) => {
      if (node !== this && node.matches(selector)) found.push(node)
      node.children.forEach(visit)
    }
    visit(this)
    return found
  }
}

function view(kind: RiftView['kind'], extra: Partial<RiftView> = {}): RiftView {
  return { kind, backtrackAge: null, altChoiceId: null, followSlot: null, age28Id: null, foreOpen: null, agentChapter: 'appear', agentReply: null, evidenceOpen: false, walkIndex: 0, walkPicks: {}, ...extra }
}

function ctx(extra: Partial<RiftContext> = {}): RiftContext {
  return {
    planted: [{ age: 20, choiceId: 'intern' }, { age: 22, choiceId: 'major' }],
    currentAge: 22,
    targetAge: 20,
    profileAge: '22',
    lastChoiceId: 'major',
    interview: extra.interview ?? null,
    view: view('backtrack'),
    ...extra,
  }
}

function handlers(): RiftHandlers {
  return {
    back: () => undefined,
    open: () => undefined,
    setBacktrack: () => undefined,
    setAlt: () => undefined,
    setFollow: () => undefined,
    setAge28: () => undefined,
    setForeOpen: () => undefined,
    setAgent: () => undefined,
    startParallel: () => undefined,
    toShore: () => undefined,
  }
}

function mount(context: RiftContext) {
  const body = new FakeNode('div') as unknown as HTMLElement
  renderRiftView(body, context, handlers())
  return body as unknown as FakeNode
}

function textOf(node: FakeNode): string {
  if (node.children.length === 0) return node.textContent
  return node.children.map(textOf).join('')
}

beforeEach(() => {
  const create = (tag: string) => new FakeNode(tag)
  Object.assign(globalThis, {
    document: {
      createElement: create,
      createElementNS: (_ns: string, tag: string) => create(tag),
    },
    HTMLElement: FakeNode,
  })
})

describe('garden rift pages', () => {
  it('opens the fourth act as a meeting with another me, not a chat app', () => {
    const appear = mount(ctx())
    expect(appear.querySelector('.garden-rift-play')?.classList.contains('is-backtrack')).toBe(true)
    expect(textOf(appear)).toContain('有些人生没有消失')
    expect(textOf(appear)).toContain('走近看看')
    expect(appear.querySelector('.garden-agent-star')).not.toBeNull()
    expect(appear.querySelector('.garden-agent-dialog')).toBeNull()
    expect(appear.querySelector('.garden-agent-canvas')).not.toBeNull()
    expect(textOf(appear)).not.toContain('AI Assistant')
    expect(textOf(appear)).not.toContain('ChatGPT')

    const walk = mount(ctx({ view: view('backtrack', { agentChapter: 'walk', backtrackAge: 20, walkIndex: 0 }) }))
    expect(textOf(walk)).toContain('20 岁 · 从 20 岁另选')
    expect(textOf(walk)).toContain('给另一个我选一条')
    expect(walk.querySelector('.garden-agent-options')).not.toBeNull()
    expect(walk.querySelectorAll('.garden-agent-options button').length).toBeGreaterThanOrEqual(3)
    expect(walk.querySelectorAll('.garden-agent-match')).toHaveLength(0)
    expect(textOf(walk)).not.toContain('走到 22 岁')

    const picked = mount(ctx({ view: view('backtrack', { agentChapter: 'walk', backtrackAge: 20, walkIndex: 0, walkPicks: { 20: 'pause' } }) }))
    expect(textOf(picked)).toContain('好处')
    expect(textOf(picked)).toContain('优势')
    expect(textOf(picked)).toContain('劣势 / 代价')
    expect(textOf(picked)).toContain('结果')
    expect(textOf(picked)).toContain('走到 22 岁')
    expect(textOf(picked)).toContain('经验对照')

    const lastYear = mount(ctx({ view: view('backtrack', { agentChapter: 'walk', backtrackAge: 20, walkIndex: 1, walkPicks: { 20: 'pause', 22: 'dropout20' } }) }))
    expect(textOf(lastYear)).toContain('22 岁 · 现年')
    expect(textOf(lastYear)).toContain('这一路走到了现在')
    expect(lastYear.querySelectorAll('.garden-agent-match')).toHaveLength(0)

    const meet = mount(ctx({ view: view('backtrack', { agentChapter: 'meet', backtrackAge: 20, walkIndex: 1 }) }))
    expect(textOf(meet)).toContain('从 20 岁走到现在')
    expect(meet.querySelectorAll('.garden-agent-match')).toHaveLength(4)
    expect(meet.querySelectorAll('.garden-agent-match.is-A')).toHaveLength(2)
    expect(meet.querySelectorAll('.garden-agent-match.is-B')).toHaveLength(2)
    expect(textOf(meet)).not.toMatch(/更成功|幸福值|人生评分/)

    const farewell = mount(ctx({ view: view('backtrack', { agentChapter: 'farewell' }) }))
    expect(textOf(farewell)).toContain('剩下的路，你来走。')

    const report = mount(ctx({ view: view('backtrack', { agentChapter: 'report' }) }))
    expect(textOf(report)).toContain('你看见了两种人生')
    expect(textOf(report)).toContain('生成我的人生回测')
    expect(textOf(report)).toContain('再和他坐一会儿')
  })

  it('keeps foresight to the next three years and does not put companion bloggers there', () => {
    const pick = mount(ctx({ view: view('foresight') }))
    expect(textOf(pick)).toContain('第五幕')
    expect(textOf(pick)).toContain('不是命运定论')
    expect(textOf(pick)).not.toContain('去前进')
    expect(textOf(pick)).not.toContain('沿着相近的人生继续')
    expect(pick.querySelector('.garden-rift-play')?.classList.contains('is-foresight')).toBe(true)
    expect(pick.querySelector('.garden-rift-follow')).toBeNull()
    expect(pick.querySelectorAll('.garden-rift-npc')).toHaveLength(0)
    expect(pick.querySelectorAll('.garden-rift-year')).toHaveLength(3)
    expect(textOf(pick)).toContain('写下个人展望')
  })

  it('keeps the foresight copy and turns the ending into a farewell plus one source', () => {
    const fore = mount(ctx({ view: view('foresight') }))
    expect(fore.querySelector('h1')?.textContent).toBe('23 → 24 → 25 岁可能的走向')
    expect(textOf(fore)).toContain('不是命运定论')
    expect(fore.querySelectorAll('.garden-rift-year')).toHaveLength(3)
    expect(textOf(fore)).toContain('写下个人展望')
    expect(textOf(fore)).toContain('第五幕')

    const end = mount(ctx({ view: view('end') }))
    expect(textOf(end)).toContain('第五幕')
    expect(textOf(end)).toContain('不是匹配分数')
    expect(textOf(end)).toContain('不会伪造真人原话')
    expect(textOf(end)).not.toContain('「世界比课表更早收费」')
    expect(textOf(end)).not.toContain('第六幕')
    expect(end.querySelector('.garden-rift-play')?.classList.contains('is-end')).toBe(true)
    expect(end.querySelector('.garden-outlook-report')).not.toBeNull()
    expect(textOf(end.querySelector('.garden-outlook-report')!)).toContain('人生回测报告')
    expect(end.querySelector('.garden-outlook-friend')).not.toBeNull()
    expect(end.querySelector('.garden-outlook-consult')).not.toBeNull()
    expect(textOf(end.querySelector('.garden-outlook-friend')!)).toContain('同代')
    expect(textOf(end.querySelector('.garden-outlook-consult')!)).toContain('前辈')
    const avatarFrames = end.querySelectorAll('.garden-outlook-avatar-frame')
    expect(avatarFrames).toHaveLength(2)
    expect(avatarFrames.map(frame => frame.getAttribute('data-avatar-state'))).toEqual(['placeholder', 'placeholder'])
    expect(end.querySelectorAll('.garden-outlook-avatar-placeholder')).toHaveLength(2)
    const live = new FakeNode('figure') as unknown as HTMLElement
    fillOutlookAvatar(live, {
      name: '新兵连的灯',
      headline: '走过相近路口',
      quote: '',
      href: 'https://www.zhihu.com/question/1',
      avatar: 'https://picx.zhimg.com/50/v2-84ce3330420f9332a1d69d4cd1f10c2f_l.jpg',
      why: '公开文字和你种下的选择对上了。',
      kind: 'peer',
      source: 'zhihu',
    }, '同代')
    expect(live.getAttribute('data-avatar-state')).toBe('live')
    expect((live.querySelector('img') as { src?: string } | null)?.src).toContain('zhimg.com')
    expect(end.querySelectorAll('.garden-outlook-refresh')).toHaveLength(2)
    expect(end.querySelectorAll('.garden-outlook-why')).toHaveLength(2)
    expect(textOf(end.querySelector('.garden-outlook-why')!)).toMatch(/\S/)
    expect(end.querySelector('.garden-rift-follow')).toBeNull()
    expect(end.querySelectorAll('.garden-rift-npc')).toHaveLength(0)
    expect(textOf(end)).toContain('盐选会员')
    expect(textOf(end)).toContain('写下个人展望')
    expect(textOf(end)).toContain('从第一幕重新体验')
  })

  it('uses the interview agency on the ending and keeps the full report folded', () => {
    const interview: InterviewState = {
      ...emptyInterview([{
        id: '20:提前实习',
        age: 20,
        title: '提前实习',
        status: 'complete',
        slots: {
          choice: '先去实习碰世界',
          motive: '想离家近一点也想让家里少操心',
          constraint: '家里存款不够再读一年',
          alternative: '再搏考研',
          agency: '条件妥协',
        },
        sparse: {},
      }]),
      report: 'full',
    }
    const end = mount(ctx({
      interview,
      view: view('end', { followSlot: 'A · 同代相近', foreOpen: '23:go-home' }),
    }))
    expect(textOf(end.querySelector('.garden-outlook-report')!)).toContain('人生回测报告')
    expect(textOf(end.querySelector('.garden-outlook-report')!)).toContain('先去实习碰世界')
    expect(textOf(end.querySelector('.garden-outlook-report')!)).toMatch(/代价|成就|核心原因|方法论/)
    expect(end.querySelector('.garden-outlook-friend')).not.toBeNull()
    expect(end.querySelector('.garden-outlook-consult')).not.toBeNull()
    expect(end.querySelectorAll('.garden-outlook-avatar-frame')).toHaveLength(2)
    expect(end.querySelectorAll('.garden-outlook-refresh')).toHaveLength(2)
    expect(end.querySelector('.garden-rift-follow')).toBeNull()
    expect(end.querySelector('.garden-rift-dossier')).toBeNull()
  })
})
