import { beforeEach, describe, expect, it } from 'vitest'
import { renderRiftView, type RiftContext, type RiftHandlers, type RiftView } from './gardenRift'

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

  it('embeds follow companions inside foresight instead of a separate page', () => {
    const pick = mount(ctx({ view: view('foresight') }))
    expect(textOf(pick)).toContain('概率推演，非命运定论')
    expect(textOf(pick)).toContain('第五幕')
    expect(textOf(pick)).not.toContain('去前进')
    expect(pick.querySelector('.garden-rift-play')?.classList.contains('is-foresight')).toBe(true)
    expect(pick.querySelector('.garden-rift-follow')).not.toBeNull()
    expect(pick.querySelectorAll('.garden-rift-npc').length).toBeGreaterThanOrEqual(2)
    expect(pick.querySelectorAll('.garden-rift-portraits .garden-rift-world').length).toBeGreaterThanOrEqual(2)

    const follow = mount(ctx({ view: view('foresight', { followSlot: 'A · 同代相近' }) }))
    expect(follow.querySelectorAll('.garden-rift-npc').length).toBeGreaterThanOrEqual(2)
    expect(follow.querySelectorAll('.garden-rift-npc').filter(node => node.classList.contains('is-open'))).toHaveLength(1)
    expect(follow.querySelector('.garden-rift-dossier')).not.toBeNull()
    expect(follow.querySelectorAll('.garden-rift-beat')).toHaveLength(3)
    expect(follow.querySelectorAll('.garden-rift-options button')).toHaveLength(0)
    expect(follow.querySelector('.garden-rift-explain')).not.toBeNull()
    expect(textOf(follow.querySelector('.garden-rift-dossier')!)).toContain('当时')
    expect(follow.querySelectorAll('.garden-rift-archive-post')).toHaveLength(3)
    expect(textOf(follow.querySelector('.garden-rift-archive')!)).toContain('TA 写过的')
    expect(textOf(follow.querySelector('.garden-rift-archive-post')!)).toContain('阅读原文（演示）')
  })

  it('keeps the foresight and ending copy that the demo must not lose', () => {
    const fore = mount(ctx({ view: view('foresight') }))
    expect(fore.querySelector('h1')?.textContent).toBe('23 → 24 → 25 岁可能的走向')
    expect(textOf(fore)).toContain('不是命运定论')
    expect(fore.querySelectorAll('.garden-rift-year')).toHaveLength(3)
    expect(textOf(fore)).toContain('写下个人展望')
    expect(textOf(fore)).toContain('第五幕')

    const end = mount(ctx({ view: view('end') }))
    expect(textOf(end)).toContain('第六幕')
    expect(end.querySelector('h1')?.textContent).toMatch(/有了不一样的体会/)
    expect(end.querySelector('.garden-rift-play')?.classList.contains('is-end')).toBe(true)
    expect(textOf(end)).toContain('你走过的选择链')
    expect(textOf(end)).toContain('阅读原文（演示）')
    expect(end.querySelectorAll('.garden-rift-exit-star')).toHaveLength(3)
    expect(end.querySelectorAll('.garden-rift-end-chain li').length).toBeGreaterThan(0)
    expect(end.querySelector('.garden-rift-end-sky')).not.toBeNull()
    expect(end.querySelector('.garden-rift-journey')).toBeNull()
    expect(textOf(end.querySelector('.garden-rift-end-sky')!)).toContain('时代里的轨迹')
    expect(textOf(end.querySelector('.garden-rift-end-blessing')!)).toMatch(/\S/)
  })
})
