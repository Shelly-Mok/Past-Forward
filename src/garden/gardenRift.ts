import { CAUSAL_LABELS, eraChoice, eraNodeForAge, paintNpcPortrait, signalPortraits, type EraChoice, type SignalPortrait } from './gardenContent'
import type { PlantedChoice } from './gardenState'
import { paintRiftWorld } from './paintRiftWorld'
import { openPersonalTag } from '../outlook/createPersonalTag'
import { readPersonalTag } from '../outlook/personalTag'
import { lifePoint, paintMeteorShower } from './paintMeteorShower'
import {
  DEMO_EXITS, END_INSIGHT, END_LEAD, FORESIGHT_YEARS,
  bloggerArchiveFor, chanceText, choicePostFor, closestForesightId, endSkyLetterFor, followSceneForChoice, foresightTeller,
  type ChoicePost, type FollowScene, type RiftKind,
} from './riftContent'
import { hydrateAuthorArchive, hydrateChoicePost, liveEnabled } from '../zhihu/liveContent'

export type RiftView = {
  kind: RiftKind
  backtrackAge: number | null
  altChoiceId: string | null
  followSlot: string | null
  age28Id: string | null
  foreOpen: string | null
}

export type RiftContext = {
  planted: PlantedChoice[]
  currentAge: number | null
  profileAge: string
  lastChoiceId: string | null
  view: RiftView
}

export type RiftHandlers = {
  back: () => void
  open: (kind: RiftKind) => void
  setBacktrack: (age: number | null) => void
  setAlt: (id: string | null) => void
  setFollow: (slot: string | null) => void
  setAge28: (id: string | null) => void
  setForeOpen: (key: string | null) => void
  toShore: () => void
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text) node.textContent = text
  return node
}

function play(kind: RiftKind) {
  return el('div', `garden-rift-play is-${kind}`)
}

function hud(kicker: string, title: string, note: string) {
  const head = el('header', 'garden-rift-hud')
  head.append(el('p', 'garden-rift-kicker', kicker))
  head.append(el('p', 'garden-rift-demo', liveEnabled() ? '知乎原文检索 · 不是命运定论' : '演示内容 · 不是真实匹配结果'))
  head.append(el('h1', '', title))
  if (note) head.append(el('p', 'garden-rift-lead', note))
  return head
}

function actions(handlers: RiftHandlers, extra?: HTMLElement[]) {
  const row = el('div', 'garden-rift-actions')
  for (const node of extra ?? []) row.append(node)
  const back = el('button', '', '返回三岔口')
  back.type = 'button'
  back.addEventListener('click', handlers.back)
  row.append(back)
  return row
}

function button(label: string, onClick: () => void) {
  const node = el('button', '', label)
  node.type = 'button'
  node.addEventListener('click', onClick)
  return node
}

function lastPlanted(planted: PlantedChoice[]): PlantedChoice | undefined {
  return planted.at(-1)
}

function plantedChoice(item: PlantedChoice): EraChoice | undefined {
  return eraChoice(item.age, item.choiceId)
}

function portrait(seed: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 96
  canvas.height = 96
  canvas.setAttribute('aria-hidden', 'true')
  paintNpcPortrait(canvas, seed)
  return canvas
}

function world(kind: RiftKind, label: string, hint: string) {
  const node = el('button', 'garden-rift-world')
  node.type = 'button'
  node.setAttribute('aria-label', `${label} · ${hint}`)
  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  paintRiftWorld(canvas, kind)
  node.append(canvas, el('strong', '', label), el('span', '', hint))
  return node
}

function yearSource(ctx: RiftContext): PlantedChoice[] {
  if (ctx.planted.length) return ctx.planted
  const age = eraNodeForAge(ctx.currentAge ? Math.max(0, ctx.currentAge - 2) : 20).age
  return [{ age, choiceId: eraNodeForAge(age).choices[0].id }]
}

function renderTrail(years: PlantedChoice[], selected: number | null, handlers: RiftHandlers) {
  const fig = el('figure', 'garden-rift-trail')
  fig.append(el('figcaption', '', '你走过的轨迹'))
  fig.append(el('p', 'garden-rift-trail-note', '流星雨斜着划过天空。年份嵌在最亮那一道上，点它或点月面上的花。'))
  const sky = el('div', 'garden-rift-trail-sky')
  const shower = document.createElement('canvas')
  shower.className = 'garden-rift-shower'
  shower.setAttribute('aria-hidden', 'true')
  paintMeteorShower(shower)
  for (const delay of [0, 1.1, 2.3, 3.4]) {
    const fall = el('i', 'garden-rift-fall')
    fall.setAttribute('aria-hidden', 'true')
    fall.style.setProperty('--delay', `${delay}s`)
    sky.append(fall)
  }
  const list = el('ol')
  years.forEach((item, index) => {
    const choice = plantedChoice(item)
    const point = lifePoint(years.length <= 1 ? 0.78 : 0.16 + (index / (years.length - 1)) * 0.78)
    const star = el('li', `garden-rift-trail-star${selected === item.age ? ' is-active' : ''}${index === 0 ? ' is-first' : ''}${index === years.length - 1 ? ' is-latest' : ''}`)
    star.dataset.age = String(item.age)
    star.style.left = `${point.x}%`
    star.style.top = `${point.y}%`
    const pick = el('button', 'garden-rift-trail-year')
    pick.type = 'button'
    pick.setAttribute('aria-label', `${item.age}岁 · ${choice?.label ?? '已种下的花'}`)
    pick.append(el('strong', '', `${item.age}岁`))
    pick.append(el('em', '', index === 0 ? '起点' : index === years.length - 1 ? '此刻' : ''))
    pick.addEventListener('click', () => handlers.setBacktrack(item.age))
    star.append(pick, el('span', '', choice?.label ?? eraNodeForAge(item.age).event))
    list.append(star)
  })
  sky.append(shower, list)
  fig.append(sky)
  return fig
}

function postKicker(post: ChoicePost, pending: boolean) {
  if (pending) return '相关帖子 · 正在检索知乎原文…'
  return post.source === 'zhihu' ? '相关帖子 · 知乎原文' : '相关帖子 · 演示内容 · 不是真实匹配结果'
}

function fillPost(pane: HTMLElement, post: ChoicePost, pending = false) {
  pane.replaceChildren()
  pane.dataset.source = post.source
  pane.classList.toggle('is-wait', pending)
  pane.append(el('p', 'garden-rift-post-kicker', postKicker(post, pending)))
  const head = el('header', 'garden-rift-post-who')
  head.append(portrait(`${post.choiceId}:${post.author}`))
  const who = el('div')
  who.append(el('strong', '', post.author), el('span', '', post.identity))
  head.append(who)
  pane.append(head)
  pane.append(el('h2', '', post.title))
  pane.append(el('p', 'garden-rift-post-excerpt', post.excerpt))
  for (const line of post.paragraphs.slice(0, 2)) pane.append(el('p', '', line))
  const foot = el('footer', 'garden-rift-post-foot')
  foot.append(el('small', '', post.votes))
  const link = el('a', 'garden-rift-exit-star')
  link.href = post.href
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.append(el('strong', '', post.source === 'zhihu' ? '阅读原文' : '阅读原文（演示）'))
  foot.append(link)
  pane.append(foot)
}

function renderPost(age: number, choiceId: string) {
  const pane = el('article', 'garden-rift-post')
  fillPost(pane, choicePostFor(age, choiceId), liveEnabled())
  if (liveEnabled()) {
    void hydrateChoicePost(age, choiceId).then(post => {
      if (!pane.isConnected) return
      fillPost(pane, post)
    })
  }
  return pane
}

function renderBacktrack(ctx: RiftContext, handlers: RiftHandlers) {
  const wrap = play('backtrack')
  const years = yearSource(ctx)
  if (ctx.view.backtrackAge === null) {
    wrap.append(hud('回溯 · 未选择之路', '你想回到哪一个没想通的节点？', '点月面上你种下的花。不是把当年再看一遍，是去没选的那条路上看看。'))
    wrap.append(renderTrail(years, null, handlers), actions(handlers))
    return wrap
  }

  const age = ctx.view.backtrackAge
  const node = eraNodeForAge(age)
  const planted = ctx.planted.find(item => item.age === age)
  const chosen = planted ? eraChoice(age, planted.choiceId) : undefined
  wrap.append(hud('回溯 · 未选择之路', `${age} 岁 · ${node.event}`, chosen
    ? `未选择之路：你种下的是「${chosen.label}」。点一条没走的路，帖子会出现在飞船上方的天空里。`
    : '未选择之路：点一条没走的路，帖子会出现在飞船上方的天空里。'))
  if (ctx.view.altChoiceId) wrap.append(renderPost(age, ctx.view.altChoiceId))
  const alts = el('nav', 'garden-rift-alts')
  alts.setAttribute('aria-label', '未选择之路')
  for (const opt of node.choices.filter(item => item.id !== chosen?.id)) {
    const open = ctx.view.altChoiceId === opt.id
    const moon = el('button', `garden-rift-alt garden-rift-moon${open ? ' is-open' : ''}`)
    moon.type = 'button'
    moon.append(el('h2', '', `如果你当时选了「${opt.label}」`))
    moon.append(el('p', 'garden-rift-whisper', `${opt.npc.name} 站在这条路上。${opt.npc.match}`))
    moon.addEventListener('click', () => handlers.setAlt(open ? null : opt.id))
    alts.append(moon)
  }
  wrap.append(alts, actions(handlers, [button('换一个节点', () => handlers.setBacktrack(null))]))
  return wrap
}

function renderCompanions(portraits: SignalPortrait[], followSlot: string | null, handlers: RiftHandlers) {
  const row = el('div', 'garden-rift-portraits')
  portraits.forEach((item, index) => {
    const card = el('div', `garden-rift-npc${item.slot === followSlot ? ' is-open' : ''}`)
    card.style.setProperty('--orbit', String(index))
    const planet = world('forward', item.npc.name, item.note)
    card.append(planet, portrait(`${item.slot}:${item.npc.name}`))
    card.addEventListener('click', () => handlers.setFollow(item.slot === followSlot ? null : item.slot))
    row.append(card)
  })
  return row
}

function fillArchive(list: HTMLElement, posts: ChoicePost[], pending: boolean) {
  list.replaceChildren()
  list.append(el('p', 'garden-rift-archive-kicker', pending
    ? 'TA 写过的 · 正在检索知乎原文…'
    : posts.some(item => item.source === 'zhihu')
      ? 'TA 写过的 · 知乎原文'
      : 'TA 写过的 · 演示内容 · 不是真实匹配结果'))
  for (const post of posts) {
    const card = el('article', 'garden-rift-archive-post')
    card.dataset.source = post.source
    card.append(el('small', '', `${post.age} 岁`))
    card.append(el('h3', '', post.title))
    card.append(el('p', '', post.excerpt))
    const foot = el('footer')
    foot.append(el('span', '', post.votes))
    const link = el('a', '')
    link.href = post.href
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.textContent = post.source === 'zhihu' ? '阅读原文' : '阅读原文（演示）'
    foot.append(link)
    card.append(foot)
    list.append(card)
  }
}

function renderArchive(item: SignalPortrait) {
  const list = el('section', 'garden-rift-archive')
  const demo = bloggerArchiveFor(item)
  fillArchive(list, demo, liveEnabled())
  if (liveEnabled()) {
    void hydrateAuthorArchive(item).then(posts => {
      if (!list.isConnected) return
      fillArchive(list, posts.length ? posts : demo, false)
    })
  }
  return list
}

function renderDossier(item: SignalPortrait, scene: FollowScene) {
  const card = el('article', 'garden-rift-dossier')
  card.append(el('p', 'garden-rift-kicker', '前进 · 人物画像'))
  card.append(el('p', 'garden-rift-demo', liveEnabled() ? '知乎原文检索 · 不是命运定论' : '演示内容 · 不是真实匹配结果'))
  const head = el('header')
  head.append(portrait(`${item.slot}:${item.npc.name}`))
  const who = el('div')
  who.append(el('strong', '', item.npc.name))
  who.append(el('span', '', `${item.slot} · ${item.age} 岁`))
  who.append(el('p', '', item.npc.identity))
  head.append(who)
  card.append(head)
  card.append(el('p', 'garden-rift-dossier-match', item.npc.match))
  const choice = el('p', 'garden-rift-dossier-choice')
  choice.append(el('strong', '', `TA 的选择 · ${item.choice.label} · ${item.choice.peer}%`))
  choice.append(el('span', '', item.choice.reason))
  card.append(choice)
  const chain = el('dl', 'garden-rift-dossier-chain')
  const causal = item.npc.causal
  const values = [causal.background, causal.options, causal.choice, causal.cost, causal.reflection]
  CAUSAL_LABELS.forEach((label, index) => {
    const row = el('div')
    row.append(el('dt', '', label), el('dd', '', values[index]))
    chain.append(row)
  })
  card.append(chain)
  const later = el('section', 'garden-rift-dossier-later')
  later.append(el('p', 'garden-rift-archive-kicker', scene.title))
  later.append(el('p', 'garden-rift-dossier-match', scene.lead))
  const beats = el('ol', 'garden-rift-beats')
  scene.beats.forEach((beat, index) => {
    const star = el('li', 'garden-rift-beat')
    star.style.setProperty('--orbit', String(index))
    star.append(el('i', 'garden-rift-spark'), el('span', '', beat))
    beats.append(star)
  })
  later.append(beats)
  card.append(later, renderArchive(item))
  return card
}

function renderForward(ctx: RiftContext, handlers: RiftHandlers) {
  const wrap = play('forward')
  const planted = lastPlanted(ctx.planted)
  const sourceAge = planted?.age ?? (ctx.currentAge ?? 20)
  const sourceChoice = planted?.choiceId ?? eraNodeForAge(sourceAge).choices[0].id
  const portraits = signalPortraits(sourceAge, sourceChoice)
  const opened = portraits.find(item => item.slot === ctx.view.followSlot)

  if (!opened) {
    wrap.append(hud('前进 · 沿着谁走', '沿着谁的选择，继续往前走？', '三颗伴星，各住着一位相近的人。点谁，看 TA 的选择和人物画像。概率推演，非命运定论。'))
    wrap.append(renderCompanions(portraits, null, handlers), actions(handlers))
    return wrap
  }

  const scene = followSceneForChoice(opened.choice.id)
  wrap.classList.add('is-following')
  wrap.append(renderCompanions(portraits, opened.slot, handlers))
  wrap.append(renderDossier(opened, scene), actions(handlers, [
    button('换一位再走', () => handlers.setFollow(null)),
    button('去前瞻', () => handlers.open('foresight')),
    button('我看够了，结束', () => handlers.open('end')),
  ]))
  return wrap
}

function renderForesight(ctx: RiftContext, handlers: RiftHandlers) {
  const wrap = play('foresight')
  wrap.append(hud('前瞻 · 尚未发生的年', '25 → 26 → 27 岁可能的走向', '三条都是可能，不是必经。点一颗星，听一位做过同类抉择的人说话。不是命运定论。'))
  const last = lastPlanted(ctx.planted)
  const lastLabel = last ? eraChoice(last.age, last.choiceId)?.label : null
  wrap.append(el('p', 'garden-rift-hub', lastLabel ? `你种下的最后一朵是「${lastLabel}」` : '从现年的岔路口往前看'))
  const skyway = el('div', 'garden-rift-skyway')
  FORESIGHT_YEARS.forEach((year, index) => {
    const closest = closestForesightId(year, ctx.lastChoiceId)
    const hub = el('section', 'garden-rift-year')
    hub.style.setProperty('--orbit', String(index))
    const planet = world('foresight', `${year.age} 岁`, year.hub)
    const closestKey = `${year.age}:${closest}`
    planet.addEventListener('click', () => handlers.setForeOpen(ctx.view.foreOpen === closestKey ? null : closestKey))
    hub.append(planet)
    const row = el('div', 'garden-rift-branches')
    year.branches.forEach((branch, branchIndex) => {
      const key = `${year.age}:${branch.id}`
      const open = ctx.view.foreOpen === key
      const hot = branch.id === closest
      const card = el('article', `garden-rift-branch${hot ? ' is-hot' : ''}${open ? ' is-open' : ''}`)
      card.tabIndex = 0
      const npc = foresightTeller(year.age, branchIndex)
      card.append(el('small', '', `${chanceText(branch, ctx.lastChoiceId)}${hot ? ' · 最接近你' : ''}`))
      card.append(el('strong', '', branch.label))
      if (open) {
        card.append(portrait(`${key}:${npc.name}`))
        card.append(el('p', '', `${npc.name} 说：${branch.later}`))
        card.append(el('p', 'garden-rift-insight', `前提：${branch.premise}`))
      } else {
        card.append(el('span', '', '点亮看看'))
      }
      const toggle = () => handlers.setForeOpen(open ? null : key)
      card.addEventListener('click', toggle)
      card.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle() }
      })
      row.append(card)
    })
    hub.append(row)
    skyway.append(hub)
  })
  wrap.append(skyway, actions(handlers, [
    button('写下个人展望', openPersonalTag),
    button('去前进 · 验证 28 岁', () => handlers.open('forward')),
    button('结束回测', () => handlers.open('end')),
  ]))
  return wrap
}

function renderEnd(ctx: RiftContext, handlers: RiftHandlers) {
  const wrap = play('end')
  wrap.append(hud('结束 · 把选择链看成自己的', END_INSIGHT, END_LEAD))

  const letter = endSkyLetterFor(ctx.planted, readPersonalTag().plans, ctx.currentAge)
  const sky = el('article', 'garden-rift-end-sky')
  sky.append(el('p', 'garden-rift-archive-kicker', letter.kicker))
  sky.append(el('p', 'garden-rift-end-era', letter.era))
  sky.append(el('p', '', letter.reading))
  sky.append(el('p', '', letter.courage))
  sky.append(el('p', 'garden-rift-end-blessing', letter.blessing))
  wrap.append(sky)

  const recap = el('article', 'garden-rift-end-recap')
  recap.append(el('p', 'garden-rift-archive-kicker', '你走过的选择链'))
  const chain = el('ol', 'garden-rift-end-chain')
  if (!ctx.planted.length) {
    chain.append(el('li', 'is-empty', '这一局还没有花。空白也可以是开始。'))
  } else {
    ctx.planted.forEach(item => {
      const choice = plantedChoice(item)
      const node = eraNodeForAge(item.age)
      const row = el('li')
      row.append(el('strong', '', `${item.age} 岁`))
      row.append(el('span', '', `${node.event} · ${choice?.label ?? item.choiceId}`))
      chain.append(row)
    })
  }
  recap.append(chain)

  const outlook = readPersonalTag()
  if (outlook.plans) {
    const note = el('section', 'garden-rift-end-outlook')
    note.append(el('p', 'garden-rift-archive-kicker', '你写下的个人展望'))
    note.append(el('p', '', outlook.plans))
    recap.append(note)
  }

  const last = lastPlanted(ctx.planted)
  const featured = last ? eraChoice(last.age, last.choiceId)?.npc : undefined
  if (featured) {
    const bubble = el('div', 'garden-rift-bubble')
    bubble.append(portrait(`end:${featured.name}`), el('p', '', `${featured.name} 留下一句：${featured.causal.reflection}`))
    recap.append(bubble)
  }

  const convert = el('div', 'garden-rift-convert')
  for (const exit of DEMO_EXITS) {
    const link = el('a', 'garden-rift-exit-star')
    link.href = exit.href
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.append(el('strong', '', exit.title), el('span', '', exit.copy))
    convert.append(link)
  }
  recap.append(convert)
  wrap.append(recap, actions(handlers, [
    button('写下个人展望', openPersonalTag),
    button('再看前瞻', () => handlers.open('foresight')),
    button('从第一幕重新体验', handlers.toShore),
  ]))
  return wrap
}

export function renderRiftView(body: HTMLElement, ctx: RiftContext, handlers: RiftHandlers) {
  body.replaceChildren()
  const page = ctx.view.kind === 'backtrack' ? renderBacktrack(ctx, handlers)
    : ctx.view.kind === 'forward' ? renderForward(ctx, handlers)
      : ctx.view.kind === 'foresight' ? renderForesight(ctx, handlers)
        : renderEnd(ctx, handlers)
  body.append(page)
  body.scrollTop = 0
  page.scrollTop = 0
}
