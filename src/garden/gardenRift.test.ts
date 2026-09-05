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
    if (selector.startsWith('.')) return this.classList.contains(selector.slice(1))
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
  return { kind, backtrackAge: null, altChoiceId: null, followSlot: null, age28Id: null, foreOpen: null, ...extra }
}

function ctx(extra: Partial<RiftContext> = {}): RiftContext {
  return {
    planted: [{ age: 20, choiceId: 'job' }],
    currentAge: 22,
    profileAge: '22',
    lastChoiceId: 'job',
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
  it('lists planted years on the backtrack sky, then shows the unchosen road', () => {
    const list = mount(ctx())
    expect(list.querySelector('h1')?.textContent).toBe('你想回到哪一个没想通的节点？')
    expect(textOf(list)).toContain('演示内容 · 不是真实匹配结果')
    expect(list.querySelector('.garden-rift-trail')).not.toBeNull()
    expect(textOf(list)).toContain('你走过的轨迹')
    expect(list.querySelectorAll('.garden-rift-trail-star')).toHaveLength(1)
    expect(list.querySelector('.garden-rift-trail-year')).not.toBeNull()
    expect(textOf(list)).toContain('流星雨')
    expect(list.querySelector('.garden-rift-trail-dot')).toBeNull()
    expect(list.querySelector('.garden-rift-journey')).toBeNull()
    expect(list.querySelector('.garden-rift-planet')).toBeNull()
    expect(list.querySelector('.garden-rift-trail-planet')).toBeNull()

    const detail = mount(ctx({ view: view('backtrack', { backtrackAge: 20 }) }))
    expect(detail.querySelector('.garden-rift-trail')).toBeNull()
    expect(textOf(detail.querySelector('.garden-rift-hud .garden-rift-lead')!)).toContain('未选择之路')
    expect(textOf(detail.querySelector('.garden-rift-alt')!)).toContain('如果你当时选了')
    expect(textOf(detail.querySelector('.garden-rift-whisper')!)).toMatch(/\S/)
    expect(detail.querySelector('.garden-rift-post')).toBeNull()
    expect(detail.querySelector('.garden-rift-sheet')).toBeNull()

    const opened = mount(ctx({ view: view('backtrack', { backtrackAge: 20, altChoiceId: 'intern' }) }))
    expect(opened.querySelector('.garden-rift-trail')).toBeNull()
    expect(textOf(opened.querySelector('.garden-rift-post')!)).toContain('如果选了')
    expect(textOf(opened.querySelector('.garden-rift-post')!)).toContain('阅读原文（演示）')
  })

  it('keeps follow beats and 28-year options readable', () => {
    const pick = mount(ctx({ view: view('forward') }))
    expect(textOf(pick)).toContain('概率推演，非命运定论')
    expect(pick.querySelector('.garden-rift-play')?.classList.contains('is-forward')).toBe(true)
    expect(pick.querySelectorAll('.garden-rift-npc')).toHaveLength(3)
    expect(pick.querySelectorAll('.garden-rift-portraits .garden-rift-world')).toHaveLength(3)

    const follow = mount(ctx({ view: view('forward', { followSlot: '同代 · 相近选择' }) }))
    expect(follow.querySelectorAll('.garden-rift-npc')).toHaveLength(3)
    expect(follow.querySelectorAll('.garden-rift-npc').filter(node => node.classList.contains('is-open'))).toHaveLength(1)
    expect(follow.querySelector('.garden-rift-dossier')).not.toBeNull()
    expect(follow.querySelectorAll('.garden-rift-beat')).toHaveLength(3)
    expect(follow.querySelectorAll('.garden-rift-options button')).toHaveLength(0)
    expect(textOf(follow.querySelector('.garden-rift-dossier-choice')!)).toMatch(/\d+%/)
    expect(textOf(follow.querySelector('.garden-rift-dossier')!)).toContain('背景')
    expect(textOf(follow.querySelector('.garden-rift-dossier')!)).toContain('选择')
    expect(follow.querySelectorAll('.garden-rift-archive-post')).toHaveLength(3)
    expect(textOf(follow.querySelector('.garden-rift-archive')!)).toContain('TA 写过的')
    expect(textOf(follow.querySelector('.garden-rift-archive-post')!)).toContain('阅读原文（演示）')
  })

  it('keeps the foresight and ending copy that the demo must not lose', () => {
    const fore = mount(ctx({ view: view('foresight') }))
    expect(fore.querySelector('h1')?.textContent).toBe('25 → 26 → 27 岁可能的走向')
    expect(textOf(fore)).toContain('不是命运定论')
    expect(fore.querySelectorAll('.garden-rift-year')).toHaveLength(3)
    expect(textOf(fore)).toContain('写下个人展望')

    const end = mount(ctx({ view: view('end') }))
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
