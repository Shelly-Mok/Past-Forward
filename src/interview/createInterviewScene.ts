import '../garden/garden.css'
import './interview.css'
import { readLifeEvents, type ArchiveProfile } from '../archive/archiveInterview'
import { parseTarget, type PlantedChoice } from '../garden/gardenState'
import { openPersonalTag } from '../outlook/createPersonalTag'
import { personalTagPayload } from '../outlook/personalTag'
import { hydrateAltTimeline, liveEnabled } from '../zhihu/liveContent'
import { candidateQueries, journeyContext } from '../zhihu/recommend'
import { buildAltTimeline, type AltLine } from './altTimeline'
import { formatInterviewContext, writeInterviewContext } from './interviewContext'
import {
  applyUtterance,
  buildNodes,
  emptyInterview,
  focusInterviewNode,
  markAgency,
  nextMissingSlot,
  readInterviewSave,
  INTERVIEW_ROUND_LIMIT,
  talkLimitReached,
  talkRounds,
  writeInterviewSave,
  type AgencyValue,
  type InterviewState,
} from './interviewState'
import { cannedReply, DEMO_CANDIDATES, OPENING_QUESTION, type InterviewCandidate } from './interviewView'
import { fallbackSynthesis } from './dialoguePrompt'
import { readEventTalks } from '../garden/eventTalkSave'
import { memoryTimelineLayout, type MemoryTimelineItem } from './memoryTimeline'
import { buildOtherLifeTimeline, extraElderAges, mergeOtherLifeNodes } from './otherLifeTimeline'
import { createInterviewEncounter } from './interviewEncounter'

export { INTERVIEW_SAVE_KEY, readInterviewSave } from './interviewState'

export type InterviewContext = {
  profile: ArchiveProfile
  planted: PlantedChoice[]
  actualPlanted?: PlantedChoice[]
  target?: { age: number | null }
  currentAge: number | null
}

type PersonaPost = { title: string, excerpt: string, href: string }
type TalkLine = { who: 'you' | 'other', text: string }

const AGENCY_WORDS: AgencyValue[] = ['主动偏好', '条件妥协', '两者兼有']

function readSave(): InterviewState | null {
  return readInterviewSave()
}

function writeSave(state: InterviewState) {
  writeInterviewSave(state)
}

export function createInterviewScene(host: HTMLElement) {
  const root = document.createElement('section')
  root.className = 'interview-scene garden-scene'
  root.hidden = true
  root.dataset.gardenPhase = 'rift'
  root.dataset.riftKind = 'backtrack'
  root.setAttribute('aria-label', '第四幕：另一条时间线')
  root.innerHTML = `
    <div class="garden-frame interview-frame">
      <img class="garden-background" src="/assets/garden/rewind-cosmos-v1.png" alt="彩色银河与地球，暖灯基地静立于月面" />
      <div class="garden-shade" aria-hidden="true"></div>
      <div class="garden-rift is-visible">
        <div class="garden-rift-inner">
          <button type="button" class="garden-rift-back interview-back">返回入口</button>
          <button type="button" class="interview-context-link">查看上下文</button>
          <button type="button" class="interview-tag">个人标签</button>
          <div class="garden-rift-body">
            <div class="garden-rift-play is-backtrack interview-play">
              <header class="garden-location interview-location">
                <span>回溯</span>
                <small>第四幕 · 另一条时间线</small>
              </header>
              <section class="interview-timeline" hidden aria-label="玩家人生时间线" aria-live="polite"></section>
              <article class="interview-log interview-crt" hidden aria-label="现在的我与另一个我的对话记录" aria-live="polite">
                <div class="interview-scroll">
                  <div class="interview-body" role="log" aria-live="polite" aria-relevant="additions text"></div>
                </div>
              </article>
              <div class="interview-dialogue-progress" aria-hidden="true"></div>
              <button type="button" class="interview-history-toggle" aria-expanded="false" hidden>回看对话</button>
              <section class="interview-dialogue-actors" aria-label="月面上的两个自己"></section>
              <div class="interview-compose interview-crt" hidden></div>
              <aside class="interview-context interview-crt" hidden>
                <h2>对话上下文</h2>
                <pre class="interview-context-body"></pre>
                <button type="button" class="interview-context-close">收起上下文</button>
              </aside>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
  host.append(root)
  const body = root.querySelector<HTMLElement>('.interview-body')!
  const compose = root.querySelector<HTMLElement>('.interview-compose')!
  const timeline = root.querySelector<HTMLElement>('.interview-timeline')!
  const log = root.querySelector<HTMLElement>('.interview-log')!
  const contextPanel = root.querySelector<HTMLElement>('.interview-context')!
  const contextBody = root.querySelector<HTMLElement>('.interview-context-body')!
  const contextLink = root.querySelector<HTMLButtonElement>('.interview-context-link')!
  const locationSubtitle = root.querySelector<HTMLElement>('.interview-location small')!
  const dialogueProgress = root.querySelector<HTMLElement>('.interview-dialogue-progress')!
  const historyToggle = root.querySelector<HTMLButtonElement>('.interview-history-toggle')!
  let state = emptyInterview([])
  let candidate: InterviewCandidate | null = DEMO_CANDIDATES[0]
  let beat: 'timeline' | 'talk' = 'timeline'
  let ctx: InterviewContext | null = null
  let personaPosts: PersonaPost[] = []
  let transcript: TalkLine[] = []
  let altTimeline: AltLine[] = []
  let memoryTimeline: MemoryTimelineItem[] = []
  let revealed = 0
  let pending = false
  let generation = 0
  let revealTimer = 0
  let holdTimer = 0
  let rapidTimer = 0
  let held = false
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  let timelineButton: HTMLButtonElement | null = null
  let timelineNote: HTMLElement | null = null
  let historyOpen = false
  const encounter = createInterviewEncounter(root, () => {
    if (root.hidden || beat !== 'talk') return
    log.hidden = false
    renderTalk()
  })

  function persist() { writeSave(state) }

  function contextPayload() {
    return {
      planted: ctx?.planted ?? [],
      events: ctx ? readLifeEvents(ctx.profile) : [],
      eventTalks: readEventTalks(),
      altTimeline,
      transcript,
      personalTag: personalTagPayload(),
    }
  }

  function persistContext() {
    const payload = contextPayload()
    writeInterviewContext(payload)
    contextBody.textContent = formatInterviewContext(payload)
    void fetch('/api/life/context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => { /* keep the local copy */ })
  }

  function openingLine() {
    const node = focusInterviewNode(state) ?? state.nodes[0]
    return node
      ? `从「${node.title}」那一年说起也行。你刚才讲过的，我都还记得。当时你最先想到的是什么？`
      : OPENING_QUESTION
  }

  function stopRapidReveal() {
    window.clearTimeout(holdTimer)
    window.clearTimeout(rapidTimer)
    holdTimer = 0
    rapidTimer = 0
  }

  function renderDialogueArrival() {
    log.hidden = true
    delete root.dataset.speaker
    dialogueProgress.textContent = '平行回声 · 接入中'
    compose.hidden = false
    compose.replaceChildren()
    const controls = document.createElement('div')
    controls.className = 'interview-arrival-controls'
    const arrivalStatus = p('interview-arrival-status', '舱门正在打开……')
    arrivalStatus.setAttribute('role', 'status')
    const skip = document.createElement('button')
    skip.type = 'button'
    skip.className = 'interview-arrival-skip'
    skip.textContent = '跳过相遇动画'
    skip.addEventListener('click', encounter.finish)
    controls.append(arrivalStatus, skip)
    compose.append(controls)
    skip.focus({ preventScroll: true })
  }

  function finishReveal() {
    window.clearTimeout(revealTimer)
    revealTimer = 0
    if (!pending) return
    pending = false
    renderTimeline()
  }

  function revealNext() {
    if (root.hidden || beat !== 'timeline') return
    if (pending) {
      finishReveal()
      return
    }
    if (revealed >= memoryTimeline.length) {
      startTalk()
      return
    }
    revealed += 1
    pending = true
    renderTimeline()
    revealTimer = window.setTimeout(finishReveal, reduced.matches ? 100 : 920)
  }

  function beginRapidReveal() {
    stopRapidReveal()
    held = false
    holdTimer = window.setTimeout(() => {
      held = true
      const advance = () => {
        if (revealed >= memoryTimeline.length) {
          if (pending) finishReveal()
          stopRapidReveal()
          return
        }
        if (pending) finishReveal()
        else revealNext()
        rapidTimer = window.setTimeout(advance, 190)
      }
      advance()
    }, 520)
  }

  function nodeClass(item: MemoryTimelineItem, active: boolean) {
    return `interview-memory-node is-${item.kind}${active ? ' is-revealing' : ''}`
  }

  function drawMemoryTimeline() {
    timeline.replaceChildren()
    const heading = document.createElement('header')
    heading.className = 'interview-memory-heading'
    heading.innerHTML = `<span>${Math.min(revealed, memoryTimeline.length)} / ${memoryTimeline.length}</span>`
    timeline.append(heading)

    const viewport = document.createElement('div')
    viewport.className = 'interview-memory-viewport'
    const track = document.createElement('div')
    track.className = 'interview-memory-track'
    viewport.append(track)
    timeline.append(viewport)

    const start = document.createElement('button')
    start.type = 'button'
    start.className = 'interview-memory-node is-start is-visible'
    start.innerHTML = '<strong>重大事件</strong>'
    start.setAttribute('aria-label', '重大事件 · 时间线起点')
    track.append(start)

    const renderAtSize = () => {
      const width = viewport.clientWidth
      const height = viewport.clientHeight
      const layout = memoryTimelineLayout(memoryTimeline.length + 1, width, height)
      track.style.width = `${layout.width}px`
      track.style.height = `${layout.height}px`
      track.style.setProperty('--memory-node-max', `${layout.nodeMaxWidth}px`)
      track.style.setProperty('--memory-node-min', `${layout.nodeMinWidth}px`)
      track.style.setProperty('--memory-node-font', `${layout.nodeFontSize}px`)
      track.style.setProperty('--memory-meta-font', `${layout.metaFontSize}px`)
      track.style.setProperty('--memory-node-pad-x', `${layout.paddingX}px`)
      track.style.setProperty('--memory-node-pad-y', `${layout.paddingY}px`)
      track.style.setProperty('--memory-node-lines', `${layout.rows === 1 ? 4 : 2}`)
      const all = [start, ...Array.from(track.querySelectorAll<HTMLElement>('.interview-memory-node:not(.is-start)'))]
      all.forEach((node, index) => {
        const point = layout.points[index]
        node.style.left = `${point.x}px`
        node.style.top = `${point.y}px`
      })
      const hint = track.querySelector<HTMLElement>('.interview-memory-next-signal')
      const hintPoint = layout.points[Math.min(revealed + 1, layout.points.length - 1)]
      if (hint && hintPoint) {
        hint.style.left = `${hintPoint.x}px`
        hint.style.top = `${hintPoint.y}px`
      }
      Array.from(track.querySelectorAll<HTMLElement>('.interview-memory-link')).forEach((link, index) => {
        const from = layout.points[index]
        const to = layout.points[index + 1]
        if (!from || !to) return
        const dx = to.x - from.x
        const dy = to.y - from.y
        const length = Math.hypot(dx, dy)
        const unitX = dx / length
        const unitY = dy / length
        const edgeInset = (node: HTMLElement, directionX: number, directionY: number) => {
          const halfWidth = Math.max(1, node.offsetWidth / 2)
          const halfHeight = Math.max(1, node.offsetHeight / 2)
          return 1 / Math.max(Math.abs(directionX) / halfWidth, Math.abs(directionY) / halfHeight) + 7
        }
        const fromInset = edgeInset(all[index], unitX, unitY)
        const toInset = edgeInset(all[index + 1], -unitX, -unitY)
        const visibleLength = Math.max(0, length - fromInset - toInset)
        link.style.left = `${from.x + unitX * fromInset}px`
        link.style.top = `${from.y + unitY * fromInset}px`
        link.style.width = `${visibleLength}px`
        link.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`
        link.hidden = visibleLength < 4
      })
    }

    for (let index = 0; index < revealed; index += 1) {
      const item = memoryTimeline[index]
      const active = pending && index === revealed - 1
      const link = document.createElement('i')
      link.className = `interview-memory-link${active ? ' is-drawing' : ''}`
      link.setAttribute('aria-hidden', 'true')
      track.append(link)
      const node = document.createElement('button')
      node.type = 'button'
      node.className = nodeClass(item, active)
      const age = document.createElement('small')
      age.textContent = item.title
      const content = document.createElement('strong')
      content.textContent = item.detail
      node.append(age, content)
      node.setAttribute('aria-label', `${item.title} · ${item.detail}`)
      node.addEventListener('click', () => {
        const wasFocused = node.classList.contains('is-focused')
        track.querySelectorAll('.is-focused').forEach(el => el.classList.remove('is-focused'))
        timeline.querySelector('.interview-memory-detail')?.remove()
        if (wasFocused) return
        node.classList.add('is-focused')
        const detail = document.createElement('aside')
        detail.className = 'interview-memory-detail'
        detail.append(p('', item.title), p('', item.detail))
        const close = document.createElement('button')
        close.type = 'button'
        close.textContent = '收起'
        close.onclick = () => { detail.remove(); node.classList.remove('is-focused'); node.focus() }
        detail.append(close)
        timeline.append(detail)
      })
      track.append(node)
    }

    if (revealed < memoryTimeline.length) {
      const hint = document.createElement('i')
      hint.className = 'interview-memory-next-signal'
      hint.setAttribute('aria-hidden', 'true')
      track.append(hint)
    }

    requestAnimationFrame(() => {
      if (root.hidden || beat !== 'timeline' || !viewport.isConnected) return
      renderAtSize()
    })
  }

  function renderTimeline() {
    beat = 'timeline'
    root.dataset.beat = 'timeline'
    delete root.dataset.speaker
    historyToggle.hidden = true
    locationSubtitle.textContent = '第四幕 · 另一条时间线'
    timeline.hidden = false
    log.hidden = true
    contextPanel.hidden = true
    drawMemoryTimeline()
    compose.hidden = false
    if (!timelineButton?.isConnected) {
      compose.replaceChildren()
      timelineButton = document.createElement('button')
      timelineButton.type = 'button'
      timelineButton.className = 'interview-timeline-next'
      timelineButton.addEventListener('click', () => {
        if (held) { held = false; return }
        revealNext()
      })
      timelineButton.addEventListener('pointerdown', beginRapidReveal)
      timelineNote = document.createElement('small')
      timelineNote.className = 'interview-timeline-note'
      compose.append(timelineButton, timelineNote)
    }
    const next = timelineButton
    if (pending) next.textContent = '再次点击，立即完成'
    else if (revealed === 0) next.textContent = '点击一下，显影下一段回忆'
    else if (revealed < memoryTimeline.length) next.textContent = revealed === memoryTimeline.length - 1 ? '生成最后一段回声' : '继续显影下一段'
    else next.textContent = '聆听另一个我的回应'
    const note = timelineNote!
    note.textContent = revealed === 0
      ? '每次点击，显影对照人生的一个节点'
      : pending
        ? '正在显影……'
        : revealed < memoryTimeline.length
          ? '已显影的对照会留在星图中 · 长按可快速回放'
          : '这是公开检索对照的另一条人生，不是匹配分数。'
    root.dataset.memoryComplete = String(!pending && revealed === memoryTimeline.length)
  }

  function startTalk() {
    stopRapidReveal()
    window.clearTimeout(revealTimer)
    pending = false
    beat = 'talk'
    root.dataset.beat = 'talk'
    locationSubtitle.textContent = '第四幕 · 与另一个我对话'
    timeline.hidden = true
    historyOpen = false
    root.dataset.dialogueHistory = 'false'
    historyToggle.textContent = '回看对话'
    historyToggle.setAttribute('aria-expanded', 'false')
    transcript = [{ who: 'other', text: openingLine() }]
    persistContext()
    body.replaceChildren()
    renderDialogueArrival()
    encounter.start()
  }

  function renderTalk(status?: string) {
    body.replaceChildren()
    const lastYou = transcript.reduce((last, line, index) => line.who === 'you' ? index : last, -1)
    const lastOther = pending ? -1 : transcript.reduce((last, line, index) => line.who === 'other' ? index : last, -1)
    transcript.forEach((line, index) => {
      const turn = document.createElement('section')
      const fresh = index === transcript.length - 1 && !pending
      const speaker = line.who === 'you' ? '现在的我' : '另一个我'
      const anchored = index === lastYou || index === lastOther
      turn.className = `interview-turn is-${line.who}${fresh ? ' is-fresh' : ''}${anchored ? ' is-recent is-anchored' : ''}`
      turn.dataset.speaker = line.who === 'you' ? 'player' : 'llm-npc'
      turn.setAttribute('aria-label', `${speaker}说：${line.text}`)
      const name = p('interview-name', speaker)
      turn.append(name)
      const text = p('interview-line', line.text)
      // Exceptionally long replies stay fully readable by keyboard as well as touch.
      if (anchored) text.tabIndex = 0
      turn.append(text)
      body.append(turn)
    })
    if (pending) {
      const waiting = document.createElement('section')
      waiting.className = 'interview-turn is-other is-pending is-fresh is-anchored is-recent'
      waiting.dataset.speaker = 'llm-npc'
      waiting.setAttribute('aria-label', '另一个我正在生成回应')
      const name = p('interview-name', '另一个我')
      waiting.append(name, p('interview-line', status || '正在沿着这条时间线组织回应…'))
      body.append(waiting)
    } else if (status) body.append(p('interview-status', status))
    const round = Math.min(INTERVIEW_ROUND_LIMIT, talkRounds(transcript) + (talkLimitReached(talkRounds(transcript)) ? 0 : 1))
    dialogueProgress.textContent = `${String(Math.max(1, round)).padStart(2, '0')} / ${String(INTERVIEW_ROUND_LIMIT).padStart(2, '0')} · 对话中`
    historyToggle.hidden = transcript.length < 2
    encounter.speaking(pending ? 'other' : (transcript.at(-1)?.who ?? 'other'), pending)
    const scroll = root.querySelector<HTMLElement>('.interview-scroll')
    if (scroll) requestAnimationFrame(() => { scroll.scrollTop = scroll.scrollHeight })
    compose.hidden = false
    compose.replaceChildren()
    const form = document.createElement('form')
    form.className = 'interview-form'
    const input = document.createElement('input')
    input.className = 'interview-input'
    input.type = 'text'
    input.maxLength = 200
    input.placeholder = '把当时的想法告诉他…'
    input.setAttribute('aria-label', '回答')
    input.disabled = pending || talkLimitReached(talkRounds(transcript))
    input.addEventListener('input', () => { if (!pending) encounter.speaking('you') })
    const actions = document.createElement('div')
    actions.className = 'interview-actions'
    const send = document.createElement('button')
    send.type = 'submit'
    send.textContent = pending ? '正在听…' : '告诉他'
    send.disabled = pending || talkLimitReached(talkRounds(transcript))
    const finish = document.createElement('button')
    finish.type = 'button'
    finish.textContent = '结束对话'
    actions.append(send, finish)
    form.append(input, actions)
    form.addEventListener('submit', event => {
      event.preventDefault()
      void onReply(input.value)
    })
    finish.addEventListener('click', () => finishTalk())
    compose.append(form)
    if (!pending && !input.disabled) input.focus()
  }

  function currentNode() {
    return focusInterviewNode(state)
  }

  async function onReply(raw: string) {
    const text = raw.trim()
    if (!text || pending || talkLimitReached(talkRounds(transcript))) return
    const ticket = generation
    const node = currentNode()
    if (!node) return
    transcript.push({ who: 'you', text })
    const agency = AGENCY_WORDS.find(word => text.includes(word))
    if (agency) state = markAgency(state, node.id, agency)
    else {
      const slot = nextMissingSlot(node) ?? 'choice'
      if (slot === 'agency') state = markAgency(state, node.id, '两者兼有')
      else state = applyUtterance(state, node.id, slot, text)
    }
    persist()
    persistContext()
    const next = currentNode()
    const missing = next ? nextMissingSlot(next) : null
    const shifted = Boolean(next && node.id !== next.id)
    const fallback = cannedReply(missing, text)
    if (!liveEnabled()) {
      transcript.push({ who: 'other', text: fallback })
      persistContext()
      renderTalk()
      if (talkLimitReached(talkRounds(transcript))) finishTalk()
      return
    }
    pending = true
    renderTalk('他正在根据这条时间线想下一句…')
    try {
      const response = await fetch('/api/life/dialogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author: candidate?.author ?? '另一个我',
          missingSlot: missing ?? 'choice',
          message: text,
          lastYou: text,
          previous: { age: node.age, title: node.title },
          shifted,
          persona: { posts: personaPosts },
          node: { age: next?.age, title: next?.title },
          planted: ctx?.planted ?? [],
          events: ctx ? readLifeEvents(ctx.profile) : [],
          eventTalks: readEventTalks(),
          altTimeline,
          transcript,
          round: talkRounds(transcript),
          path: (ctx?.planted ?? []).map(item => `${item.age}岁 · ${item.label || item.choiceId}`).join(' → '),
          personalTag: personalTagPayload(),
        }),
      })
      const payload = await response.json() as { ok?: boolean, reply?: string }
      if (root.hidden || generation !== ticket) return
      const reply = payload.ok && payload.reply?.trim() ? payload.reply.trim() : fallback
      transcript.push({ who: 'other', text: reply })
    } catch {
      if (root.hidden || generation !== ticket) return
      transcript.push({ who: 'other', text: fallback })
      pending = false
      persistContext()
      renderTalk('模型暂时没接上，先用这一句继续。')
      if (talkLimitReached(talkRounds(transcript))) finishTalk()
      return
    }
    pending = false
    persistContext()
    renderTalk()
    if (talkLimitReached(talkRounds(transcript))) finishTalk()
  }

  async function finishTalk() {
    const events = ctx ? readLifeEvents(ctx.profile) : []
    state = {
      ...state,
      synthesis: fallbackSynthesis({
        state,
        planted: ctx?.planted ?? [],
        profile: ctx?.profile,
        events,
      }),
      report: state.report === 'none' ? 'partial' : state.report,
    }
    persist()
    persistContext()
    if (liveEnabled()) {
      void fetch('/api/life/synthesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planted: ctx?.planted ?? [],
          events,
          eventTalks: readEventTalks(),
          transcript,
          nodes: state.nodes,
          path: (ctx?.planted ?? []).map(item => `${item.age}岁 · ${item.label || item.choiceId}`).join(' → '),
          personalTag: personalTagPayload(),
        }),
      }).then(async response => {
        const payload = await response.json() as { ok?: boolean, synthesis?: typeof state.synthesis }
        if (payload.ok && payload.synthesis) {
          state = { ...state, synthesis: payload.synthesis }
          persist()
        }
      }).catch(() => { /* keep the local synthesis */ })
    }
    hide()
    root.dispatchEvent(new CustomEvent('life-backtest:interview-done', { bubbles: true }))
  }

  async function show(next: InterviewContext) {
    const ticket = ++generation
    ctx = next
    const saved = readSave()
    const nodes = buildNodes(next.planted, next.profile, next.currentAge)
    const origin = parseTarget(next.profile.lifeEvent).age
    state = saved && saved.nodes.length === nodes.length ? saved : emptyInterview(nodes, origin)
    candidate = DEMO_CANDIDATES[0]
    personaPosts = []
    transcript = []
    pending = false
    revealed = 0
    window.clearTimeout(revealTimer)
    stopRapidReveal()
    encounter.stop()
    memoryTimeline = buildOtherLifeTimeline(next.actualPlanted ?? next.planted, next.profile, next.currentAge)
    altTimeline = buildAltTimeline(next.planted, next.profile, next.currentAge)
    persistContext()
    root.hidden = false
    renderTimeline()
    if (liveEnabled()) {
      const extras = extraElderAges(next.currentAge, origin ?? 0)
        .filter(age => !altTimeline.some(line => line.age === age))
        .map(age => ({ age, same: false, choice: '把这条路走得更远', text: `${age}岁 · 把这条路走得更远` }))
      void hydrateAltTimeline([...altTimeline, ...extras], next.planted, journeyContext({
        selectedAge: origin ?? next.currentAge ?? 18,
        currentAge: next.currentAge,
        target: parseTarget(next.profile.lifeEvent),
        profile: next.profile,
        planted: next.planted,
      })).then(lines => {
        if (ticket !== generation || beat !== 'timeline') return
        altTimeline = lines.filter(line => !extras.some(item => item.age === line.age))
        memoryTimeline = mergeOtherLifeNodes(memoryTimeline, lines.map(line => ({
          age: line.age,
          label: line.choice,
          source: 'zhihu',
        })))
        persistContext()
        renderTimeline()
      })
    }
    if (!liveEnabled()) return
    const journey = journeyContext({
      selectedAge: origin ?? next.currentAge ?? 18,
      currentAge: next.currentAge,
      target: parseTarget(next.profile.lifeEvent),
      profile: next.profile,
      planted: next.planted,
    })
    void fetch('/api/life/candidates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planted: next.planted,
        profile: next.profile,
        currentAge: next.currentAge,
        queries: candidateQueries(journey),
      }),
    }).then(async response => {
      if (!response.ok) return
      const payload = await response.json() as { items?: InterviewCandidate[] }
      if (payload.items?.[0]) candidate = payload.items[0]
    }).catch(() => { /* keep the silent demo persona */ })
  }

  function hide() {
    generation += 1
    window.clearTimeout(revealTimer)
    stopRapidReveal()
    encounter.stop()
    pending = false
    root.hidden = true
    persist()
  }

  function toggleContext(open?: boolean) {
    contextPanel.hidden = open === undefined ? !contextPanel.hidden : !open
    if (!contextPanel.hidden) contextBody.textContent = formatInterviewContext(contextPayload())
  }

  root.querySelector('.interview-back')!.addEventListener('click', () => {
    hide()
    root.dispatchEvent(new CustomEvent('life-backtest:interview-back', { bubbles: true }))
  })
  contextLink.addEventListener('click', () => toggleContext(true))
  historyToggle.addEventListener('click', () => {
    historyOpen = !historyOpen
    root.dataset.dialogueHistory = String(historyOpen)
    historyToggle.textContent = historyOpen ? '回到人物对话' : '回看对话'
    historyToggle.setAttribute('aria-expanded', String(historyOpen))
    const scroll = root.querySelector<HTMLElement>('.interview-scroll')!
    requestAnimationFrame(() => { scroll.scrollTop = scroll.scrollHeight })
  })
  root.querySelector('.interview-context-close')!.addEventListener('click', () => toggleContext(false))
  root.querySelector('.interview-tag')!.addEventListener('click', () => openPersonalTag())
  window.addEventListener('pointerup', stopRapidReveal)
  window.addEventListener('pointercancel', stopRapidReveal)
  window.addEventListener('blur', stopRapidReveal)
  const timelineResize = new ResizeObserver(() => {
    if (!root.hidden && beat === 'timeline') drawMemoryTimeline()
  })
  timelineResize.observe(root.querySelector('.interview-frame')!)

  return {
    element: root,
    show,
    hide,
    get beat() { return beat },
    get candidate() { return candidate },
  }
}

function p(className: string, text: string) {
  const node = document.createElement('p')
  if (className) node.className = className
  node.textContent = text
  return node
}
