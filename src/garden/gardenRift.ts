import { eraChoice, eraNodeForAge, npcFace, ownChoice, signalPortraits, type EraChoice, type SignalPortrait } from './gardenContent'
import type { PlantedChoice } from './gardenState'
import { paintRiftWorld } from './paintRiftWorld'
import { openPersonalTag } from '../outlook/createPersonalTag'
import { readPersonalTag } from '../outlook/personalTag'
import {
  appearLines,
  farewellScript,
  flowerTint,
  journeyMatchPortraits,
  nextWalkIndex,
  paintAgentEncounter,
  reportPrompt,
  resolveAnotherMe,
  walkBeat,
  type AgentChapter,
  type AgentReply,
  type AnotherMeProfile,
  type WalkPicks,
} from './anotherMe'
import {
  DEMO_EXITS, END_INSIGHT, END_LEAD,
  bloggerArchiveFor, chanceText, choicePostFor, closestForesightId, endSkyLetterFor, followSceneForChoice, foresightTeller, foresightTitle, foresightYearsFor,
  type ChoicePost, type FollowScene, type RiftKind,
} from './riftContent'
import { hydrateAuthorArchive, liveEnabled, loadChoicePosts, loadLivePortraits } from '../zhihu/liveContent'
import { explainAuthored, journeyContext, type MatchExplain } from '../zhihu/recommend'

export type RiftView = {
  kind: RiftKind
  backtrackAge: number | null
  altChoiceId: string | null
  followSlot: string | null
  age28Id: string | null
  foreOpen: string | null
  agentChapter: AgentChapter
  agentReply: AgentReply | null
  evidenceOpen: boolean
  walkIndex: number
  walkPicks: WalkPicks
}

export type RiftContext = {
  planted: PlantedChoice[]
  currentAge: number | null
  targetAge: number | null
  profileAge: string
  profileStatus?: string
  profileFamily?: string
  lastChoiceId: string | null
  view: RiftView
}

export type AgentPatch = {
  chapter?: AgentChapter
  reply?: AgentReply | null
  evidenceOpen?: boolean
  walkIndex?: number
  walkPick?: { age: number, choiceId: string | null }
}

export type RiftHandlers = {
  back: () => void
  open: (kind: RiftKind) => void
  setBacktrack: (age: number | null) => void
  setAlt: (id: string | null) => void
  setFollow: (slot: string | null) => void
  setAge28: (id: string | null) => void
  setForeOpen: (key: string | null) => void
  setAgent: (patch: AgentPatch) => void
  startParallel: (age: number) => void
  toShore: () => void
}

function agentView(view: RiftView): RiftView {
  return {
    ...view,
    agentChapter: view.agentChapter ?? 'appear',
    agentReply: view.agentReply ?? null,
    evidenceOpen: Boolean(view.evidenceOpen),
    walkIndex: view.walkIndex ?? 0,
    walkPicks: view.walkPicks ?? {},
  }
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

function journeyFromRift(ctx: RiftContext, age: number) {
  return journeyContext({
    selectedAge: age,
    currentAge: ctx.currentAge,
    profile: {
      age: ctx.profileAge,
      status: ctx.profileStatus,
      family: ctx.profileFamily,
    },
    planted: ctx.planted,
  })
}

function renderExplain(explain: MatchExplain) {
  const box = el('section', 'garden-rift-explain')
  box.append(el('p', 'garden-rift-archive-kicker', '当时'))
  box.append(el('p', 'garden-rift-story', explain.story))
  if (explain.quote) box.append(el('p', 'garden-rift-quote', `「${explain.quote}」`))
  return box
}

function plantedChoice(item: PlantedChoice): EraChoice | undefined {
  if (item.choiceId === 'own') return ownChoice(item.age, item.label ?? '')
  return eraChoice(item.age, item.choiceId)
}

function portrait(seed: string, avatar?: string) {
  return npcFace(seed, avatar)
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

function loadSprite(src: string, redraw: () => void) {
  if (typeof Image === 'undefined') return null
  try {
    const image = new Image()
    image.src = src
    image.addEventListener('load', redraw, { once: true })
    return image
  } catch {
    return null
  }
}

function renderEvidenceDrawer(posts: ChoicePost[], handlers: RiftHandlers) {
  const drawer = el('aside', 'garden-agent-evidence')
  drawer.setAttribute('aria-label', '这句话来自哪些真实经历？')
  drawer.append(el('p', 'garden-rift-archive-kicker', '这句话来自哪些真实经历？'))
  drawer.append(el('p', 'garden-rift-lead', liveEnabled()
    ? '这些是公开检索到的知乎原文。另一个我不是答主本人，只是被这些轨迹约束出来的平行自我。'
    : '演示来源。没有真实 URL 时不伪造原文。另一个我不是答主本人。'))
  for (const post of posts.slice(0, 2)) {
    const card = el('article', 'garden-agent-source')
    card.dataset.source = post.source
    card.append(el('small', '', post.source === 'zhihu' ? '知乎原文' : '演示来源'))
    card.append(el('h3', '', post.title))
    card.append(el('p', '', `${post.author} · ${post.identity}`))
    card.append(el('p', '', post.excerpt))
    const link = el('a', '') as HTMLAnchorElement
    link.href = post.href
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.textContent = post.source === 'zhihu' ? '查看知乎原文 ↗' : '查看知乎原文（演示）↗'
    card.append(link)
    drawer.append(card)
  }
  drawer.append(button('收起来源', () => handlers.setAgent({ evidenceOpen: false })))
  return drawer
}

function renderAgentDialog(
  title: string,
  lines: string[],
  options: HTMLElement[],
  evidence?: { label: string, onOpen: () => void },
) {
  const box = el('article', 'garden-agent-dialog')
  box.append(el('p', 'garden-agent-name', title))
  for (const line of lines) box.append(el('p', 'garden-agent-line', line))
  if (evidence) {
    const mark = button(evidence.label, evidence.onOpen)
    mark.className = 'garden-agent-trace'
    box.append(mark)
  }
  if (options.length) {
    const row = el('div', 'garden-agent-replies')
    for (const node of options) row.append(node)
    box.append(row)
  }
  return box
}

function renderWalkCard(
  beat: ReturnType<typeof walkBeat>,
  profile: AnotherMeProfile,
  ctx: RiftContext,
  handlers: RiftHandlers,
) {
  const card = el('article', 'garden-agent-year')
  card.append(el('p', 'garden-rift-archive-kicker', beat.last
    ? `${beat.age} 岁 · 现年 · 另一条时间线`
    : `${beat.age} 岁 · 从 ${profile.forkAge} 岁另选`))
  card.append(el('h2', '', beat.event))
  card.append(el('p', 'garden-agent-era', beat.era))
  if (beat.yours) card.append(el('p', 'garden-agent-yours', `你走过的是「${beat.yours.label}」。`))

  if (!beat.choice) {
    card.append(el('p', '', '在你没走的几条里，给另一个我选一条。'))
    const options = el('div', 'garden-agent-options')
    for (const choice of beat.options) {
      options.append(button(choice.label, () => handlers.setAgent({
        walkPick: { age: beat.age, choiceId: choice.id },
      })))
    }
    card.append(options)
    return card
  }

  card.append(el('p', '', `另一条时间线选了「${beat.choice.label}」。`))
  const costs = el('div', 'garden-agent-contrast')
  for (const [label, text] of [
    ['好处', beat.gain],
    ['优势', beat.advantage],
    ['劣势 / 代价', beat.cost],
    ['结果', beat.result],
  ] as const) {
    const row = el('div', 'garden-agent-cost')
    row.append(el('strong', '', label))
    row.append(el('span', '', text))
    costs.append(row)
  }
  card.append(costs)

  const sources = el('section', 'garden-agent-year-sources')
  sources.append(el('p', 'garden-rift-archive-kicker', liveEnabled() ? '知乎经验 · 不是命运定论' : '经验对照 · 演示内容'))
  const demo = choicePostFor(beat.age, beat.choice.id)
  const fillPosts = (posts: ChoicePost[]) => {
    sources.replaceChildren()
    sources.append(el('p', 'garden-rift-archive-kicker', posts.some(item => item.source === 'zhihu')
      ? '知乎经验 · 不是命运定论'
      : '经验对照 · 演示内容'))
    for (const post of posts.slice(0, 2)) {
      const item = el('article', 'garden-agent-source')
      item.append(el('small', '', post.source === 'zhihu' ? '知乎原文' : '演示来源'))
      item.append(el('h3', '', post.title))
      item.append(el('p', '', post.excerpt))
      const link = el('a', '') as HTMLAnchorElement
      link.href = post.href
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      link.textContent = post.source === 'zhihu' ? '查看知乎原文 ↗' : '查看经验对照（演示）↗'
      item.append(link)
      sources.append(item)
    }
  }
  fillPosts([demo])
  card.append(sources)
  if (liveEnabled()) {
    void loadChoicePosts(beat.age, beat.choice.id, journeyFromRift(ctx, beat.age)).then(posts => {
      if (!sources.isConnected) return
      fillPosts(posts.length ? posts : [demo])
    })
  }

  const next = nextWalkIndex(profile, beat.index)
  const row = el('div', 'garden-agent-year-actions')
  row.append(button('换一条路', () => handlers.setAgent({ walkPick: { age: beat.age, choiceId: null } })))
  row.append(button(next === null ? '这一路走到了现在' : `走到 ${profile.years[next]} 岁 →`, () => {
    if (next === null) handlers.setAgent({ chapter: 'meet', walkIndex: beat.index })
    else handlers.setAgent({ chapter: 'walk', walkIndex: next })
  }))
  card.append(row)
  return card
}

function renderMeet(ctx: RiftContext, profile: ReturnType<typeof resolveAnotherMe>, handlers: RiftHandlers) {
  const box = el('section', 'garden-agent-meet')
  box.append(el('p', 'garden-rift-archive-kicker', `${profile.presentAge} 岁 · 这一路的人`))
  box.append(el('p', '', `从 ${profile.forkAge} 岁走到现在，才按整段轨迹匹配。A 类同代各两位，B 类跨代各两位。中间年份不再推荐人。`))
  const row = el('div', 'garden-agent-matches')
  const portraits = journeyMatchPortraits(ctx.planted, ctx.currentAge, profile.forkAge, ctx.view.walkPicks)
  const fill = (list: typeof portraits) => {
    row.replaceChildren()
    for (const item of list) {
      const card = el('article', `garden-agent-match is-${item.kind}`)
      card.append(el('small', '', item.slot))
      card.append(portrait(`${item.slot}:${item.npc.name}`, item.npc.avatar))
      card.append(el('strong', '', item.npc.name))
      card.append(el('span', '', item.note))
      card.append(el('p', '', item.npc.match))
      row.append(card)
    }
  }
  fill(portraits)
  box.append(row)
  box.append(button('……', () => handlers.setAgent({ chapter: 'farewell' })))
  if (liveEnabled()) {
    const last = ctx.planted.at(-1)
    void loadLivePortraits(journeyFromRift(ctx, profile.presentAge), last?.choiceId ?? profile.alt.id).then(list => {
      if (!row.isConnected || list.length < 2) return
      const live = [
        ...list.filter(item => item.kind === 'A').slice(0, 2),
        ...list.filter(item => item.kind === 'B').slice(0, 2),
      ]
      if (live.length === 4) fill(live)
    })
  }
  return box
}

function renderBacktrack(ctx: RiftContext, handlers: RiftHandlers) {
  const view = agentView(ctx.view)
  const profile = resolveAnotherMe(yearSource(ctx), ctx.currentAge, view.backtrackAge, view.altChoiceId, ctx.targetAge)
  const chapter = view.agentChapter
  const wrap = play('backtrack')
  wrap.dataset.chapter = chapter
  wrap.style.setProperty('--agent-tint', String(flowerTint(chapter, view.walkIndex, profile.years.length)))

  const stage = el('div', 'garden-agent-stage')
  const canvas = document.createElement('canvas')
  canvas.className = 'garden-agent-canvas'
  canvas.setAttribute('aria-hidden', 'true')
  const redraw = () => paintAgentEncounter(canvas, profile, chapter, sprite, flowers, view.walkIndex)
  const sprite = loadSprite('/assets/player/player-walk-sheet-v2.png', redraw)
  const flowers = loadSprite('/assets/garden/flower-lifecycle-v1.png', redraw)
  redraw()
  stage.append(canvas)
  wrap.append(stage)

  if (chapter !== 'appear') {
    wrap.append(el('p', 'garden-agent-badge', '由真实经历轨迹生成的平行自我'))
    wrap.append(el('p', 'garden-rift-demo', liveEnabled() ? '知乎原文检索 · 不是命运定论' : '演示内容 · 不是真实匹配结果'))
  }

  if (chapter === 'appear') {
    const copy = el('blockquote', 'garden-agent-appear')
    copy.append(el('i', 'garden-agent-star'))
    for (const line of appearLines()) copy.append(el('p', '', line))
    wrap.append(copy)
    const enter = button('走近看看', () => handlers.setAgent({ chapter: 'walk', walkIndex: 0 }))
    enter.className = 'garden-agent-enter'
    wrap.append(enter)
  } else if (chapter === 'walk') {
    wrap.append(renderWalkCard(walkBeat(profile, ctx.planted, view.walkIndex, view.walkPicks), profile, ctx, handlers))
  } else if (chapter === 'meet') {
    wrap.append(renderMeet(ctx, profile, handlers))
  } else if (chapter === 'farewell') {
    wrap.append(renderAgentDialog(
      '另一个我 ——',
      farewellScript(),
      [button('看他离开', () => handlers.setAgent({ chapter: 'report' }))],
    ))
  } else {
    const prompt = reportPrompt()
    wrap.append(renderAgentDialog(prompt.title, [prompt.lead], [
      button('生成我的人生回测', () => handlers.open('end')),
      button('再和他坐一会儿', () => handlers.setAgent({ chapter: 'farewell' })),
      button(`从 ${profile.forkAge} 岁重选`, () => handlers.startParallel(profile.forkAge)),
    ]))
  }

  if (view.evidenceOpen) {
    const pane = renderEvidenceDrawer(profile.evidence, handlers)
    wrap.append(pane)
    if (liveEnabled()) {
      void loadChoicePosts(profile.forkAge, profile.alt.id, journeyFromRift(ctx, profile.forkAge)).then(posts => {
        if (!pane.isConnected) return
        const live = posts.length ? posts : profile.evidence
        pane.replaceWith(renderEvidenceDrawer(live, handlers))
      })
    }
  }

  return wrap
}

function renderCompanions(portraits: SignalPortrait[], followSlot: string | null, handlers: RiftHandlers) {
  const row = el('div', 'garden-rift-portraits')
  portraits.forEach((item, index) => {
    const card = el('div', `garden-rift-npc${item.slot === followSlot ? ' is-open' : ''}`)
    card.style.setProperty('--orbit', String(index))
    const planet = world('forward', item.npc.name, item.note)
    card.append(planet, portrait(`${item.slot}:${item.npc.name}`, item.npc.avatar))
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

function renderDossier(item: SignalPortrait, scene: FollowScene, ctx: RiftContext) {
  const card = el('article', 'garden-rift-dossier')
  card.append(el('p', 'garden-rift-kicker', '前进 · 人物画像'))
  card.append(el('p', 'garden-rift-demo', liveEnabled() ? '知乎原文检索 · 按你的轨迹对照 · 不是命运定论' : '演示内容 · 不是真实匹配结果'))
  const head = el('header')
  head.append(portrait(`${item.slot}:${item.npc.name}`, item.npc.avatar))
  const who = el('div')
  who.append(el('strong', '', item.npc.name))
  who.append(el('span', '', `${item.slot} · ${item.age} 岁`))
  who.append(el('p', '', item.npc.identity))
  head.append(who)
  card.append(head)
  const explain = explainAuthored(item.choice, journeyFromRift(ctx, item.age))
  card.append(el('p', 'garden-rift-dossier-match', explain.headline))
  card.append(renderExplain(explain))
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
  if (liveEnabled()) {
    void loadLivePortraits(journeyFromRift(ctx, item.age), item.choice.id).then(list => {
      if (!card.isConnected) return
      const live = list.find(entry => entry.slot === item.slot)
      if (!live?.explain) return
      const old = card.querySelector('.garden-rift-explain')
      old?.replaceWith(renderExplain(live.explain))
      const match = card.querySelector('.garden-rift-dossier-match')
      if (match) match.textContent = live.explain.headline
      const head = card.querySelector('header')
      const face = head?.querySelector('canvas, img')
      face?.replaceWith(portrait(`${live.slot}:${live.npc.name}`, live.npc.avatar))
      const strong = head?.querySelector('strong')
      if (strong) strong.textContent = live.npc.name
      const identity = head?.querySelector('p')
      if (identity) identity.textContent = live.npc.identity
    })
  }
  return card
}

function renderFollowTrail(ctx: RiftContext, handlers: RiftHandlers) {
  const planted = lastPlanted(ctx.planted)
  const sourceAge = planted?.age ?? (ctx.currentAge ?? 20)
  const sourceChoice = planted?.choiceId ?? eraNodeForAge(sourceAge).choices[0].id
  const portraits = signalPortraits(sourceAge, sourceChoice)
  const opened = portraits.find(item => item.slot === ctx.view.followSlot)
  const box = el('section', 'garden-rift-follow')
  box.append(el('p', 'garden-rift-archive-kicker', '沿着相近的人生继续'))
  box.append(el('p', 'garden-rift-hub', '这里只遇见和你同一选择的人。点谁，先看 TA 和你对上的句子。概率推演，非命运定论。'))
  box.append(renderCompanions(portraits, opened?.slot ?? null, handlers))
  if (opened) box.append(renderDossier(opened, followSceneForChoice(opened.choice.id), ctx))
  return box
}

function renderForesight(ctx: RiftContext, handlers: RiftHandlers) {
  const wrap = play('foresight')
  wrap.append(hud('第五幕 · 前瞻 · 尚未发生的年', foresightTitle(ctx.currentAge), '三条都是可能，不是必经。点一颗星，听一位做过同类抉择的人说话。前瞻页里也能沿着相近人生继续往前。不是命运定论。'))
  const last = lastPlanted(ctx.planted)
  const lastLabel = last ? eraChoice(last.age, last.choiceId)?.label : null
  wrap.append(el('p', 'garden-rift-hub', lastLabel ? `你种下的最后一朵是「${lastLabel}」` : '从现年的岔路口往前看'))
  const skyway = el('div', 'garden-rift-skyway')
  const years = foresightYearsFor(ctx.currentAge)
  years.forEach((year, index) => {
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
  wrap.append(skyway, renderFollowTrail(ctx, handlers), actions(handlers, [
    button('写下个人展望', openPersonalTag),
    ...(ctx.view.followSlot ? [button('换一位再走', () => handlers.setFollow(null))] : []),
    button('结束回测', () => handlers.open('end')),
  ]))
  return wrap
}

function renderEnd(ctx: RiftContext, handlers: RiftHandlers) {
  const wrap = play('end')
  wrap.append(hud('第六幕 · 结束 · 把选择链看成自己的', END_INSIGHT, END_LEAD))

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
  const featuredChoice = last ? plantedChoice(last) : undefined
  if (featuredChoice) {
    const explain = explainAuthored(featuredChoice, journeyFromRift(ctx, last!.age))
    const bubble = el('article', 'garden-rift-bubble garden-rift-end-blogger')
    bubble.append(portrait(`end:${featuredChoice.npc.name}`, featuredChoice.npc.avatar))
    const who = el('div')
    who.append(el('strong', '', `还想跟 ${featuredChoice.npc.name} 聊下去`))
    who.append(el('p', '', `${featuredChoice.npc.identity} · ${last!.age} 岁 · ${featuredChoice.label}`))
    bubble.append(who)
    bubble.append(renderExplain(explain))
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
    : ctx.view.kind === 'end' ? renderEnd(ctx, handlers)
      : renderForesight(ctx, handlers)
  body.append(page)
  body.scrollTop = 0
  page.scrollTop = 0
}
