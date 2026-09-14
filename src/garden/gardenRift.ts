import { eraChoice, eraNodeForAge, npcFace, ownChoice, safeAvatarUrl, type EraChoice } from './gardenContent'
import type { PlantedChoice } from './gardenState'
import { fallbackSynthesis } from '../interview/dialoguePrompt'
import { interviewRecap, type InterviewState } from '../interview/interviewState'
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
  chanceText, choicePostFor, closestForesightId, endInsightFor, foresightTeller, foresightTitle, foresightYearsFor,
  outlookBloggerPool, outlookKindPool, pickOutlookBlogger, YANXUAN_HREF,
  type ChoicePost, type OutlookBlogger, type RiftKind,
} from './riftContent'
import { liveEnabled, loadChoicePosts, loadForesightVoice, loadLivePortraits, loadOutlookBloggers } from '../zhihu/liveContent'
import { MATCH_HONESTY, portraitQuote } from './gardenCopy'
import { interviewHintTexts, journeyContext } from '../zhihu/recommend'

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
  outlookFriend?: number
  outlookConsult?: number
}

export type RiftContext = {
  planted: PlantedChoice[]
  currentAge: number | null
  targetAge: number | null
  profileAge: string
  profileGender?: string
  profileEducation?: string
  profileHealth?: string
  profileLifeEvent?: string
  lastChoiceId: string | null
  interview?: InterviewState | null
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
  refreshOutlook?: (slot: 'friend' | 'consult') => void
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
  const back = el('button', '', '返回入口')
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
      gender: ctx.profileGender,
      education: ctx.profileEducation,
      health: ctx.profileHealth,
      lifeEvent: ctx.profileLifeEvent,
    },
    planted: ctx.planted,
    interview: ctx.interview ?? undefined,
  })
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
  box.append(el('p', '', `从 ${profile.forkAge} 岁走到现在，才按整段轨迹对照。A 类同代各两位，B 类跨代各两位。没有真实匹配分数。中间年份不再推荐人。`))
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

function latestAgency(interview?: InterviewState | null) {
  return [...(interview?.nodes ?? [])]
    .reverse()
    .map(node => node.slots.agency.trim())
    .find(Boolean) ?? ''
}

function renderForesight(ctx: RiftContext, handlers: RiftHandlers) {
  const wrap = play('foresight')
  wrap.append(hud('第五幕 · 前瞻 · 尚未发生的年', foresightTitle(ctx.currentAge), '三条都是可能，不是必经。点一颗星，听一位做过同类抉择的人说话。推荐结合你的登记、种下的路和第四幕访谈。不是命运定论。'))
  const last = lastPlanted(ctx.planted)
  const lastLabel = last ? eraChoice(last.age, last.choiceId)?.label : null
  wrap.append(el('p', 'garden-rift-hub', lastLabel ? `你种下的最后一朵是「${lastLabel}」` : '从现年的岔路口往前看'))
  const skyway = el('div', 'garden-rift-skyway')
  const years = foresightYearsFor(ctx.currentAge)
  const hints = interviewHintTexts(ctx.interview)
  const journey = journeyFromRift(ctx, ctx.currentAge ?? years[0]?.age ?? 23)
  years.forEach((year, index) => {
    const closest = closestForesightId(year, ctx.lastChoiceId, hints)
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
        const voice = el('p', 'garden-rift-voice', `${npc.name} 说：${branch.later}`)
        card.append(voice)
        card.append(el('p', 'garden-rift-insight', `前提：${branch.premise}`))
        if (liveEnabled()) {
          void loadForesightVoice(journey, year.age, branch.label).then(hit => {
            if (!voice.isConnected || !hit) return
            voice.textContent = `${hit.author} 说：${hit.later}`
          })
        }
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
    button('写下个人展望', () => openPersonalTag()),
    button('结束回测', () => handlers.open('end')),
  ]))
  return wrap
}

let outlookLivePool: OutlookBlogger[] | null = null

function spokenOutlook(blogger: OutlookBlogger): string {
  const quote = portraitQuote({ quote: blogger.quote, href: blogger.href, source: blogger.source })
  return quote ? `「${quote}」` : MATCH_HONESTY
}

export function fillOutlookAvatar(frame: HTMLElement, blogger: OutlookBlogger, title: string) {
  const src = safeAvatarUrl(blogger.avatar)
  frame.replaceChildren()
  frame.setAttribute('data-avatar-state', src ? 'live' : 'placeholder')
  frame.setAttribute('aria-label', src ? `${blogger.name}的知乎公开头像` : `${title}知乎博主头像占位`)

  const viewport = el('div', 'garden-outlook-avatar-viewport')
  if (src) {
    const image = document.createElement('img')
    image.alt = `${blogger.name}的知乎头像`
    image.referrerPolicy = 'no-referrer'
    image.src = src
    image.addEventListener('error', () => {
      fillOutlookAvatar(frame, { ...blogger, avatar: undefined }, title)
    }, { once: true })
    viewport.append(image)
  } else {
    const placeholder = el('div', 'garden-outlook-avatar-placeholder')
    placeholder.append(el('span', '', '知乎头像'), el('small', '', '待公开原文载入'))
    viewport.append(placeholder)
  }

  const caption = el('figcaption')
  caption.append(el('span', '', '知乎博主头像'), el('small', '', src ? '公开资料' : '预留框'))
  frame.append(viewport, caption)
}

function outlookAvatar(blogger: OutlookBlogger, title: string) {
  const frame = el('figure', 'garden-outlook-avatar-frame')
  fillOutlookAvatar(frame, blogger, title)
  return frame
}

function fillOutlookCard(card: HTMLElement, blogger: OutlookBlogger, slot: 'friend' | 'consult') {
  const title = slot === 'friend' ? '同代' : '前辈'
  const avatar = card.querySelector<HTMLElement>('.garden-outlook-avatar-frame')
  const name = card.querySelector('.garden-outlook-name')
  const headline = card.querySelector('.garden-outlook-headline')
  const quote = card.querySelector('.garden-outlook-quote')
  const why = card.querySelector('.garden-outlook-why')
  const link = card.querySelector<HTMLAnchorElement>('.garden-outlook-link')
  card.setAttribute('data-source', blogger.source ?? 'authored')
  if (avatar) fillOutlookAvatar(avatar, blogger, title)
  if (name) name.textContent = blogger.name
  if (headline) headline.textContent = blogger.headline
  if (quote) quote.textContent = spokenOutlook(blogger)
  if (why) why.textContent = blogger.why
  if (link) {
    link.href = slot === 'consult' ? 'https://www.zhihu.com/consult' : blogger.href
  }
}

function renderOutlookOffer(
  slot: 'friend' | 'consult',
  title: string,
  blogger: OutlookBlogger,
  handlers: RiftHandlers,
) {
  const card = el('article', `garden-outlook-${slot}`)
  card.setAttribute('data-source', blogger.source ?? 'authored')
  const head = el('header', 'garden-outlook-head')
  const heading = el('div', 'garden-outlook-heading')
  heading.append(
    el('p', 'garden-outlook-slot', slot === 'friend' ? 'SAME GENERATION' : 'PREDECESSOR'),
    el('h2', '', title),
  )
  head.append(heading)
  const refresh = el('button', 'garden-outlook-refresh')
  refresh.type = 'button'
  refresh.setAttribute('aria-label', `刷新${title}`)
  refresh.textContent = '↻'
  refresh.addEventListener('click', () => handlers.refreshOutlook?.(slot))
  head.append(refresh)
  card.append(head)

  const body = el('div', 'garden-outlook-card-body')
  const copy = el('div', 'garden-outlook-copy')
  copy.append(el('strong', 'garden-outlook-name', blogger.name))
  copy.append(el('p', 'garden-outlook-headline', blogger.headline))
  copy.append(el('p', 'garden-rift-quote garden-outlook-quote', spokenOutlook(blogger)))
  const link = el('a') as HTMLAnchorElement
  link.className = 'garden-outlook-link'
  link.href = slot === 'consult' ? 'https://www.zhihu.com/consult' : blogger.href
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.textContent = slot === 'consult' ? '去咨询' : '去认识'
  copy.append(link)
  body.append(outlookAvatar(blogger, title), copy)
  card.append(body)
  card.append(el('p', 'garden-outlook-why', blogger.why))
  return card
}

function renderEnd(ctx: RiftContext, handlers: RiftHandlers) {
  const outlook = readPersonalTag()
  const agency = latestAgency(ctx.interview)
  const insight = endInsightFor({ planted: ctx.planted, plans: outlook.plans, agency })
  const authored = outlookBloggerPool({ planted: ctx.planted, currentAge: ctx.currentAge })
  const pool = outlookLivePool?.length ? outlookLivePool : authored
  const peers = outlookKindPool(pool, 'peer')
  const elders = outlookKindPool(pool, 'elder')
  const friend = pickOutlookBlogger(peers, ctx.view.outlookFriend ?? 0)
  const consult = pickOutlookBlogger(elders, ctx.view.outlookConsult ?? 0)

  const wrap = play('end')
  wrap.append(hud('第五幕 · 回测报告与推荐', insight, '报告来自刚才的回溯访谈。同代和前辈按你种下的核心节点对照，不是匹配分数。没有公开原文时，不会伪造真人原话。不是命运定论。'))

  const report = interviewRecap(ctx.interview ?? null)
  const synthesis = report.synthesis ?? fallbackSynthesis({
    state: ctx.interview,
    planted: ctx.planted,
    profile: { lifeEvent: ctx.profileLifeEvent || '' },
  })
  const reportBox = el('section', 'garden-outlook-report')
  const reportHead = el('header', 'garden-outlook-report-head')
  const reportTitle = el('div', 'garden-outlook-report-title')
  reportTitle.append(
    el('p', 'garden-outlook-report-index', '05 · LIFE BACKTEST'),
    el('h2', '', report.title || '人生回测报告'),
  )
  const reportKind = report.kind === 'full' ? '完整报告' : report.kind === 'partial' ? '阶段报告' : '回测摘要'
  reportHead.append(reportTitle, el('span', 'garden-outlook-report-kind', reportKind))
  const completed = report.nodes.filter(node => node.status === 'complete').length
  reportHead.append(el('p', 'garden-outlook-report-meta', `${completed}/${report.nodes.length} 个访谈节点已核验 · ${ctx.planted.length} 段选择进入回测`))

  const reportBody = el('div', 'garden-outlook-report-body')
  const interviewColumn = el('section', 'garden-outlook-report-column is-interview')
  interviewColumn.append(el('p', 'garden-outlook-report-section', '访谈回看'))
  if (report.empty) {
    interviewColumn.append(el('p', 'garden-outlook-report-empty', synthesis.nodes.length
      ? '访谈还没有完成信息核验。右侧先按你种下的选择生成轨迹摘要。'
      : '这一局还没有做完回测'))
    for (const node of report.nodes) {
      const pending = el('article', 'garden-outlook-report-node is-pending')
      pending.append(el('h3', '', `${node.age} 岁 · ${node.title}`))
      pending.append(el('p', '', '待回到第四幕继续核验'))
      interviewColumn.append(pending)
    }
  } else {
    for (const node of report.nodes) {
      const nodeBox = el('article', 'garden-outlook-report-node')
      nodeBox.append(el('h3', '', node.status === 'complete'
        ? `${node.age} 岁 · ${node.title}`
        : `${node.age} 岁 · ${node.title}（未完成）`))
      if (node.slots.choice) nodeBox.append(el('p', '', `选择：${node.slots.choice}`))
      if (node.slots.motive) nodeBox.append(el('p', '', `动因：${node.slots.motive}`))
      if (node.slots.constraint) nodeBox.append(el('p', '', `约束：${node.slots.constraint}`))
      if (node.slots.alternative) nodeBox.append(el('p', '', `备选：${node.slots.alternative}`))
      nodeBox.append(el('p', 'garden-outlook-report-agency', `核验：${node.slots.agency || '尚未核验'}`))
      interviewColumn.append(nodeBox)
    }
  }

  const synthesisColumn = el('section', 'garden-outlook-report-column is-synthesis')
  synthesisColumn.append(el('p', 'garden-outlook-report-section', '轨迹提炼'))
  for (const node of synthesis.nodes) {
    const nodeBox = el('article', 'garden-outlook-report-node is-synthesis')
    nodeBox.append(el('h3', '', `${node.age} 岁 · ${node.title}`))
    nodeBox.append(el('p', '', `代价：${node.cost}`))
    nodeBox.append(el('p', '', `成就：${node.gain}`))
    synthesisColumn.append(nodeBox)
  }
  if (synthesis.eventReason) synthesisColumn.append(el('p', 'garden-outlook-report-highlight', `核心原因：${synthesis.eventReason}`))
  if (synthesis.method) synthesisColumn.append(el('p', 'garden-outlook-report-highlight', `前瞻方法论：${synthesis.method}`))
  synthesisColumn.append(el('p', 'garden-outlook-report-section is-trail', '月面选择链'))
  if (!ctx.planted.length) {
    synthesisColumn.append(el('p', 'garden-outlook-report-empty', '这一局还没有花。空白也可以是开始。'))
  } else {
    ctx.planted.forEach(item => {
      const choice = plantedChoice(item)
      const node = eraNodeForAge(item.age)
      synthesisColumn.append(el('p', 'garden-outlook-report-trail', `${item.age} 岁 · ${node.event} · ${choice?.label ?? item.choiceId}`))
    })
  }
  reportBody.append(interviewColumn, synthesisColumn)
  reportBox.append(reportHead, reportBody)

  const offers = el('div', 'garden-outlook-offers')
  const friendCard = renderOutlookOffer('friend', '同代', friend, handlers)
  const consultCard = renderOutlookOffer('consult', '前辈', consult, handlers)
  offers.append(friendCard, consultCard)

  const yanxuan = el('a', 'garden-outlook-yanxuan') as HTMLAnchorElement
  yanxuan.href = YANXUAN_HREF
  yanxuan.target = '_blank'
  yanxuan.rel = 'noopener noreferrer'
  yanxuan.textContent = '盐选会员'
  const vip = el('p', 'garden-outlook-yanxuan-note', '长期付费 · 把回测之后的阅读继续下去')
  const bar = el('div', 'garden-outlook-yanxuan-wrap')
  bar.append(vip, yanxuan)

  if (liveEnabled()) {
    const last = ctx.planted.at(-1)
    const age = last?.age ?? ctx.currentAge ?? 22
    void loadOutlookBloggers(journeyFromRift(ctx, age), 8).then(list => {
      if (!list.length) return
      outlookLivePool = list
      if (!offers.isConnected) return
      fillOutlookCard(friendCard, pickOutlookBlogger(outlookKindPool(list, 'peer'), ctx.view.outlookFriend ?? 0), 'friend')
      fillOutlookCard(consultCard, pickOutlookBlogger(outlookKindPool(list, 'elder'), ctx.view.outlookConsult ?? 0), 'consult')
    })
  }

  wrap.append(reportBox, offers, bar, actions(handlers, [
    button('写下个人展望', () => openPersonalTag('outlook')),
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
