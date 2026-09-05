import './garden.css'
import type { ArchiveProfile } from '../archive/archiveInterview'
import { CAUSAL_LABELS, eraChoice, eraNodeForAge, FLOWER_KIND_NAMES, paintFlowerKind, paintNpcPortrait, signalPortraits, timelineFlowerPose, type EraChoice } from './gardenContent'
import { ageValue, chapterForAge, chapterLabel, GARDEN_SAVE_KEY, hasPlanted, isPresentAge, newGardenState, nextTimelineAge, restoreGardenState, shouldEnterCrossroads, timelineBand, timelineNodes, type GardenState } from './gardenState'
import { BOARDING_DOOR, CHOICE_DOOR, GARDEN_HOME, GardenActor, SHIP_HATCH, choicePads, soilForAge } from './gardenActor'
import { renderRiftView, type RiftView } from './gardenRift'
import { RIFT_HOLES, holeById, type RiftKind } from './riftContent'
import { liveEnabled, probeZhihuHealth } from '../zhihu/liveContent'
import { paintRiftWorld } from './paintRiftWorld'
import { flowerEndpoint, flowerPoseAt, FLOWER_POSES } from './flowerLifecycle'

function read(key: string, session = false): string | null {
  try { return (session ? sessionStorage : localStorage).getItem(key) } catch { return null }
}
export function readArchiveProfile(): ArchiveProfile | undefined {
  try { return JSON.parse(read('life-backtest.archive-profile', true) ?? 'null') ?? undefined } catch { return undefined }
}
export function writeArchiveProfile(profile: ArchiveProfile) {
  try { sessionStorage.setItem('life-backtest.archive-profile', JSON.stringify(profile)) } catch { /* In-memory garden still starts. */ }
}

type GardenPhase = 'era' | 'choices' | 'inspect' | 'npc' | 'crossroads' | 'rift'

export function createGardenScene(host: HTMLElement) {
  const root = document.createElement('section')
  root.className = 'garden-scene'
  root.setAttribute('aria-label', '第三幕：月面人生花园')
  root.hidden = true
  root.innerHTML = `
    <div class="garden-frame">
      <img class="garden-background" src="/assets/garden/moon-garden-clean-v1.png" alt="地球悬在星空里，月面档案室静立于远处" />
      <div class="garden-shade" aria-hidden="true"></div>
      <canvas class="garden-player" width="1672" height="941" aria-hidden="true"></canvas>
      <button class="garden-player-hit" type="button" aria-label="与主角打个招呼" title="与主角打个招呼"></button>
      <i class="garden-meteor" aria-hidden="true"></i>
      <div class="garden-sky-layer" aria-hidden="true">
        <i class="garden-hatch" hidden></i>
      </div>
      <header class="garden-location"><span>月面人生花园</span><small class="garden-location-note">第三幕 · 时间回声</small></header>
      <nav class="garden-signals" hidden aria-label="人生内容接口">
        <span class="garden-signals-kicker">与你相近的人生信号 <small>本地画像</small></span>
        <div class="garden-signals-body"></div>
      </nav>
      <article class="garden-copy" aria-live="polite">
        <small>零点小姐 · 时间回声</small>
        <p class="garden-age"></p><h1 tabindex="-1"></h1><p class="garden-note"></p>
        <ul class="garden-choice-stats" hidden></ul>
        <div class="garden-copy-actions"><button type="button" data-action="enter">查看这一年的选择 <span>↗</span></button><button type="button" data-action="profile">登记资料</button></div>
        <button type="button" class="garden-replay" data-action="replay" hidden>重看这一年的生长 ↻</button>
        <button type="button" class="garden-locate" data-action="target" hidden>确认回溯年龄 →</button>
      </article>
      <nav class="garden-choice-flowers" aria-label="飞船送来的选择"></nav>
      <nav class="garden-ground-flowers" aria-label="已种下的时光"></nav>
      <footer class="garden-timeline"><div class="garden-timeline-caption"><span></span><div><button type="button" data-action="chapters">40岁以后的时光 →</button><button type="button" data-action="origin">回到回溯起点 ↖</button></div></div><div class="garden-time-controls"><button type="button" data-action="previous" aria-label="更早的年龄">‹</button><div class="garden-nodes" aria-label="五年时间点"></div><button type="button" data-action="next" aria-label="更晚的年龄">›</button></div></footer>
      <div class="garden-bottom"><button type="button" data-action="restart"><kbd>R</kbd> 重新进入画面</button><span><a href="/" class="garden-from-shore">从第一幕重新体验 ↗</a> · <em class="garden-zhihu-status">选择骨架在本地，裂隙帖子可接知乎原文</em></span></div>
      <aside class="garden-panel" aria-label="时间档案" hidden>
        <button type="button" class="garden-panel-close" aria-label="关闭时间档案">×</button>
        <small class="garden-panel-kicker"></small><h2 class="garden-panel-title"></h2><p class="garden-panel-copy"></p>
        <dl class="garden-profile"></dl>
        <form class="garden-form" hidden><label></label><input type="text" maxlength="500" autocomplete="off" /><button type="submit">记录</button><output aria-live="polite"></output></form>
        <div class="garden-records"></div>
      </aside>
      <nav class="garden-holes" hidden aria-label="月面三岔口"></nav>
      <i class="garden-void" aria-hidden="true"></i>
      <p class="garden-asset-error" hidden>月面素材未能完整加载，请刷新重试。你的登记资料仍会保留。</p>
    </div>
    <aside class="garden-rift" hidden aria-label="裂隙回测">
      <div class="garden-rift-inner">
        <button type="button" class="garden-rift-back">返回三岔口</button>
        <div class="garden-rift-body"></div>
      </div>
    </aside>`
  host.append(root)
  const find = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!
  const frame = find<HTMLElement>('.garden-frame')
  const panel = find<HTMLElement>('.garden-panel')
  const form = find<HTMLFormElement>('.garden-form')
  const input = form.querySelector('input')!
  const output = form.querySelector('output')!
  const choiceNav = find<HTMLElement>('.garden-choice-flowers')
  const groundNav = find<HTMLElement>('.garden-ground-flowers')
  const holesNav = find<HTMLElement>('.garden-holes')
  const rift = find<HTMLElement>('.garden-rift')
  const riftBody = find<HTMLElement>('.garden-rift-body')
  const nodes = find<HTMLElement>('.garden-nodes')
  const hatch = find<HTMLElement>('.garden-hatch')
  const player = find<HTMLCanvasElement>('.garden-player').getContext('2d')!
  const sprite = new Image()
  sprite.src = '/assets/player/player-walk-sheet-v2.png'
  const actionSprite = new Image()
  actionSprite.src = '/assets/player/player-plant-sheet-v1.png'
  const flowers = new Image()
  flowers.src = '/assets/garden/flower-lifecycle-v1.png'
  let state: GardenState = restoreGardenState(read(GARDEN_SAVE_KEY), readArchiveProfile())
  let active = false
  let planting: { age: number; choiceId: string } | null = null
  let phase: GardenPhase = 'era'
  let inspected: string | null = null
  let selectedSignal: string | null = null
  let activatedAge: number | null = null
  let pendingHole: RiftKind | null = null
  let riftView: RiftView = { kind: 'backtrack', backtrackAge: null, altChoiceId: null, followSlot: null, age28Id: null, foreOpen: null }
  let flowerSetKey = ''
  let actor = new GardenActor()
  let actorFrame = 0
  let previousActorTime = 0
  let lastDraw = 0
  let lastStep = 0
  let meteorTimer = 0
  let shipTimer = 0
  let landTimer = 0
  let swallowTimer = 0
  let panelMode: 'profile' | 'target' | 'memory' | 'signal' = 'memory'
  let returnFocus: HTMLElement | null = null
  let sound: AudioContext | undefined
  let assetsReady = false
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches
  const portrait = () => matchMedia('(max-aspect-ratio: 1/1)').matches
  const flowerDrawKeys = new WeakMap<HTMLCanvasElement, string>()

  const ready = Promise.allSettled([
    find<HTMLImageElement>('.garden-background').decode(), sprite.decode(), flowers.decode(), actionSprite.decode(),
  ]).then(results => {
    assetsReady = results.every(r => r.status === 'fulfilled')
    find<HTMLElement>('.garden-asset-error').hidden = assetsReady
    if (active) { drawPlayer(); render() }
  })

  function save() {
    try { localStorage.setItem(GARDEN_SAVE_KEY, JSON.stringify(state)) } catch { /* Memory state remains usable. */ }
  }
  function cue(frequency = 280) {
    try {
      sound ??= new AudioContext()
      void sound.resume()
      const tone = sound.createOscillator(), gain = sound.createGain(), now = sound.currentTime
      tone.frequency.setValueAtTime(frequency, now)
      tone.frequency.exponentialRampToValueAtTime(frequency * 0.66, now + 0.38)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.014, now + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55)
      tone.connect(gain).connect(sound.destination); tone.start(); tone.stop(now + 0.6)
    } catch { /* Silent mode remains playable. */ }
  }
  function era() {
    return eraNodeForAge(state.selectedAge)
  }
  function drawPlayer() {
    player.clearRect(0, 0, 1672, 941)
    if (!sprite.naturalWidth) return
    player.imageSmoothingEnabled = false
    if (portrait()) {
      for (const item of visibleGround()) {
        const soil = soilForAge(item.age)
        const growing = planting?.age === item.age && planting.choiceId === item.choiceId && !actor.revisit && actor.growthElapsed > 0
        if (!hasPlanted(state.planted, item.age, item.choiceId) && !growing) continue
        const canvas = document.createElement('canvas')
        canvas.width = 112; canvas.height = 124
        drawFlower(canvas, item)
        player.drawImage(canvas, soil.x - 42, soil.y - 85, 85, 85)
      }
    }
    const { x, y } = actor.position
    const boarding = actor.phase === 'boarding'
    const board = boarding ? actor.progress * actor.progress : 0
    const size = (92 + (y - 616) * .05) * (1 - board * .62)
    const t = actor.progress
    let atlas = sprite, column = 2, row = 1
    if (actor.phase === 'walking') column = Math.floor(actor.walkDistance / 13) % 6
    else if (actionSprite.naturalWidth && ['kneeling', 'planting', 'rising', 'touching'].includes(actor.phase)) {
      atlas = actionSprite; row = 0
      column = actor.phase === 'kneeling' ? Math.min(2, Math.floor(t * 3))
        : actor.phase === 'planting' ? 3
          : actor.phase === 'rising' ? (t < .55 ? 4 : 5)
            : t < .4 ? 1 : t < .75 ? 2 : 1
    } else if (actor.phase === 'turning' && t < .45 || actor.phase === 'greeting') { row = 0; column = 2 }
    else if (actionSprite.naturalWidth) { atlas = actionSprite; row = 0; column = 0 }
    player.save()
    player.globalAlpha = boarding ? Math.max(0, 1 - board) : 1
    player.fillStyle = '#050505a8'
    player.beginPath(); player.ellipse(x, y + 1, size * .2, size * .042, -.12, 0, Math.PI * 2); player.fill()
    player.translate(Math.round(x), Math.round(y)); player.scale(actor.facing, 1)
    if (!reduced() && actor.phase === 'idle' && actor.elapsed % 4 > 2.7) {
      player.drawImage(atlas, column * 128, row * 128 + 86, 128, 42, -size / 2, -size * 42 / 128, size, size * 42 / 128)
      player.drawImage(atlas, column * 128, row * 128, 128, 86, -size / 2, -size - .65, size, size * 86 / 128)
    } else player.drawImage(atlas, column * 128, row * 128, 128, 128, -size / 2, -size, size, size)
    player.restore()
    if (actor.phase === 'planting') {
      player.fillStyle = '#c8c8b9'
      const seedY = y - 5 + Math.min(1, actor.progress * 3) * 5
      player.fillRect(Math.round(x + 22), Math.round(seedY), 2, 3)
    }
    const hit = find<HTMLButtonElement>('.garden-player-hit')
    hit.style.left = `${x / 1672 * 100}%`
    hit.style.top = portrait() ? `${(y - size * .45) / 941 * player.canvas.getBoundingClientRect().height}px` : `${(y - size * .45) / 941 * 100}%`
    hit.disabled = actor.busy
    root.dataset.actorX = x.toFixed(1); root.dataset.actorY = y.toFixed(1)
  }
  function animateActor(now: number) {
    if (!active) return
    const dt = previousActorTime ? Math.min(.1, (now - previousActorTime) / 1000) : 0
    previousActorTime = now
    if (!root.inert && !document.hidden && panel.hidden) {
      const events = actor.advance(dt)
      for (const event of events) {
        if (event.type === 'seed') cue(174)
        if (event.type === 'phase') { root.dataset.actorPhase = event.phase; render() }
        if (event.type === 'complete') {
          const revisiting = event.revisit
          if (planting && !revisiting && !hasPlanted(state.planted, planting.age, planting.choiceId)) {
            state.planted.push({ age: planting.age, choiceId: planting.choiceId }); save()
          }
          planting = null
          cue(revisiting ? 260 : 348)
          if (revisiting) {
            phase = 'npc'
            render()
          } else enterNextEra()
        }
        if (event.type === 'boarded') {
          cue(118)
          if (pendingHole) swallowIntoHole(pendingHole)
        }
      }
      const step = Math.floor(actor.walkDistance / 39)
      if (actor.phase === 'walking' && step !== lastStep) { footstep(); lastStep = step }
    }
    if (now - lastDraw > 1000 / 30) { drawPlayer(); updateFlowerFrames(); lastDraw = now }
    actorFrame = requestAnimationFrame(animateActor)
  }
  function footstep() {
    if (!sound || sound.state !== 'running') return
    const tone = sound.createOscillator(), gain = sound.createGain(), now = sound.currentTime
    tone.type = 'triangle'; tone.frequency.setValueAtTime(88, now)
    gain.gain.setValueAtTime(.011, now); gain.gain.exponentialRampToValueAtTime(.0001, now + .07)
    tone.connect(gain).connect(sound.destination); tone.start(); tone.stop(now + .08)
  }
  function padForChoice(age: number, choiceId: string) {
    const list = eraNodeForAge(age).choices
    const index = Math.max(0, list.findIndex(item => item.id === choiceId))
    return choicePads(list.length)[index]
  }
  function flowerSample(item: { age: number; choiceId: string; kind?: number }) {
    const chapter = chapterForAge(item.age)
    const growing = planting?.age === item.age && planting.choiceId === item.choiceId && !actor.revisit
    if (growing) return flowerPoseAt(chapter, actor.growthElapsed)
    return { pose: flowerEndpoint(chapter), next: flowerEndpoint(chapter), mix: 0 }
  }
  function drawFlower(canvas: HTMLCanvasElement, item: { age: number; choiceId: string; kind?: number }) {
    const growing = planting?.age === item.age && planting.choiceId === item.choiceId && !actor.revisit
    if (item.kind !== undefined && !hasPlanted(state.planted, item.age, item.choiceId) && !growing) {
      const key = `kind:${item.kind}`
      canvas.dataset.pose = String(item.kind)
      if (flowerDrawKeys.get(canvas) === key) return
      paintFlowerKind(canvas, item.kind)
      flowerDrawKeys.set(canvas, key)
      return
    }
    const sample = flowerSample(item)
    const mix = reduced() ? 0 : Math.round(sample.mix * 8) / 8
    const key = `${sample.pose}:${sample.next}:${mix}`
    canvas.dataset.pose = String(sample.pose)
    if (!flowers.naturalWidth || flowerDrawKeys.get(canvas) === key) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.imageSmoothingEnabled = false
    ctx.save()
    ctx.globalAlpha = 1 - mix
    ctx.drawImage(flowers, sample.pose * 128, 0, 128, 128, 0, 0, canvas.width, canvas.height)
    if (mix > 0) {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = mix
      ctx.drawImage(flowers, sample.next * 128, 0, 128, 128, 0, 0, canvas.width, canvas.height)
    }
    ctx.restore(); flowerDrawKeys.set(canvas, key)
  }
  function updateFlowerFrames() {
    root.querySelectorAll<HTMLButtonElement>('[data-flower-item]').forEach(button => {
      const canvas = button.querySelector('canvas')
      if (!canvas) return
      const age = Number(button.dataset.age)
      const choiceId = button.dataset.choice ?? ''
      const kind = button.dataset.kind === undefined ? undefined : Number(button.dataset.kind)
      drawFlower(canvas, { age, choiceId, kind })
      button.dataset.flowerFrame = String(Number(canvas.dataset.pose) + 1)
      const growing = planting?.age === age && planting.choiceId === choiceId && !actor.revisit && ['planting', 'rising', 'observing'].includes(actor.phase)
      button.classList.toggle('is-growing', growing)
      const label = button.querySelector('small')
      if (growing && label) label.textContent = FLOWER_POSES[Number(canvas.dataset.pose)]
    })
  }
  function visibleGround() {
    const band = timelineBand(state.selectedAge)
    const planted = state.planted.filter(item => timelineBand(item.age) === band && (state.currentAge === null || item.age <= state.currentAge))
    if (planting && timelineBand(planting.age) === band && !planted.some(item => item.age === planting!.age && item.choiceId === planting!.choiceId)) {
      return [...planted, planting]
    }
    return planted
  }
  function pickingBacktrackFlowers() {
    return phase === 'rift' && riftView.kind === 'backtrack'
  }
  function backtrackYears() {
    const planted = state.planted.filter(item => state.currentAge === null || item.age <= state.currentAge)
    if (planted.length) return planted
    const age = eraNodeForAge(state.currentAge ? Math.max(0, state.currentAge - 2) : 20).age
    return [{ age, choiceId: eraNodeForAge(age).choices[0].id }]
  }
  function echoTrail(age: number | null) {
    riftBody.querySelectorAll<HTMLElement>('.garden-rift-trail-star').forEach(node => {
      node.classList.toggle('is-echo', age !== null && node.dataset.age === String(age))
    })
  }
  function renderGroundFlowers() {
    groundNav.replaceChildren()
    const picking = pickingBacktrackFlowers()
    const items = picking ? backtrackYears() : visibleGround()
    for (const item of items) {
      const planted = hasPlanted(state.planted, item.age, item.choiceId)
      const growing = planting?.age === item.age && planting.choiceId === item.choiceId
      if (!picking && !planted && !growing) continue
      const soil = !picking && growing ? padForChoice(item.age, item.choiceId) : soilForAge(item.age)
      const choice = eraChoice(item.age, item.choiceId)
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'garden-ground-flower'
      button.dataset.flowerItem = 'ground'
      button.dataset.age = String(item.age)
      button.dataset.choice = item.choiceId
      button.dataset.chapter = String(chapterForAge(item.age))
      button.dataset.planted = String(planted || picking)
      button.style.left = `${soil.x / 1672 * 100}%`
      button.style.top = `${(soil.y + 9) / 941 * 100}%`
      button.setAttribute('aria-label', picking
        ? `回到 ${item.age}岁 · ${choice?.label ?? '已种下的花'}`
        : `${item.age}岁 · ${choice?.label ?? '已种下的花'}`)
      button.disabled = picking ? false : actor.busy || !assetsReady
      button.classList.toggle('is-planting', growing && actor.phase === 'planting')
      button.classList.toggle('is-rising', growing && actor.phase === 'rising')
      button.classList.toggle('is-rift-pick', picking)
      button.classList.toggle('is-rift-active', picking && riftView.backtrackAge === item.age)
      const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128
      const label = document.createElement('small')
      label.textContent = picking
        ? `${item.age}岁 · ${choice?.label ?? '种下的花'}`
        : growing ? (actor.revisit ? '轻触时光' : '亲手种下') : `${item.age}岁`
      button.append(canvas, label)
      button.addEventListener('click', () => {
        if (picking) {
          riftView = { ...riftView, backtrackAge: item.age, altChoiceId: null }
          render()
          return
        }
        if (choice) inspectOrPlant(choice, planted)
      })
      if (picking) {
        button.addEventListener('pointerenter', () => echoTrail(item.age))
        button.addEventListener('pointerleave', () => echoTrail(riftView.backtrackAge))
      }
      groundNav.append(button)
      drawFlower(canvas, item)
    }
  }
  function choiceHint(item: EraChoice) {
    return inspected === item.id
      ? (hasPlanted(state.planted, state.selectedAge, item.id) ? '再点一次 · 查看画像' : '再点一次 · 种到星球上')
      : `${FLOWER_KIND_NAMES[item.flowerKind]} · ${item.peer}%`
  }
  function syncChoiceFlower(button: HTMLButtonElement, item: EraChoice, index: number) {
    button.dataset.planted = String(hasPlanted(state.planted, state.selectedAge, item.id))
    button.style.setProperty('--slot', String(index))
    button.setAttribute('aria-pressed', String(inspected === item.id))
    button.disabled = actor.busy || !assetsReady
    const hint = button.querySelector('small')
    if (hint) hint.textContent = choiceHint(item)
  }
  function markFlowerLanded(button: HTMLButtonElement) {
    button.classList.add('is-landed')
  }
  function renderChoiceFlowers() {
    const showing = activatedAge === state.selectedAge && (phase === 'choices' || phase === 'inspect' || phase === 'npc')
    if (!showing) return
    const choices = era().choices
    const pads = choicePads(choices.length)
    const nextKey = `${state.selectedAge}:${choices.map(item => item.id).join(',')}`
    const existing = [...choiceNav.querySelectorAll<HTMLButtonElement>('.garden-choice-flower')]
    if (flowerSetKey === nextKey && existing.length === choices.length) {
      choices.forEach((item, index) => syncChoiceFlower(existing[index], item, index))
      return
    }
    flowerSetKey = nextKey
    choiceNav.replaceChildren()
    choices.forEach((item, index) => {
      const pad = pads[index]
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'garden-choice-flower'
      button.dataset.flowerItem = 'choice'
      button.dataset.age = String(state.selectedAge)
      button.dataset.choice = item.id
      button.dataset.kind = String(item.flowerKind)
      button.dataset.chapter = String(chapterForAge(state.selectedAge))
      button.style.setProperty('--door-x', String(CHOICE_DOOR.x / 1672 * 100))
      button.style.setProperty('--door-y', String(CHOICE_DOOR.y / 941 * 100))
      button.style.setProperty('--pad-x', String(pad.x / 1672 * 100))
      button.style.setProperty('--pad-y', String(pad.y / 941 * 100))
      button.style.setProperty('--slot', String(index))
      button.setAttribute('aria-label', `${FLOWER_KIND_NAMES[item.flowerKind]} · ${item.label}`)
      const halo = document.createElement('i')
      halo.className = 'garden-choice-halo'
      halo.setAttribute('aria-hidden', 'true')
      const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128
      const name = document.createElement('span'); name.textContent = item.label
      const hint = document.createElement('small')
      button.append(halo, canvas, name, hint)
      syncChoiceFlower(button, item, index)
      button.addEventListener('click', () => inspectOrPlant(item, hasPlanted(state.planted, state.selectedAge, item.id)))
      button.addEventListener('pointerenter', () => actor.lookAt(pad.x))
      button.addEventListener('animationend', event => {
        if (event.animationName === 'garden-flower-fly') markFlowerLanded(button)
      })
      if (root.classList.contains('is-ship-open') || reduced()) markFlowerLanded(button)
      choiceNav.append(button)
      drawFlower(canvas, { age: state.selectedAge, choiceId: item.id, kind: item.flowerKind })
    })
  }
  function renderNpcCard(item: ReturnType<typeof signalPortraits>[number]) {
    const card = document.createElement('article')
    card.className = 'garden-signal-card'
    card.dataset.signal = item.slot
    const head = document.createElement('header')
    const canvas = document.createElement('canvas')
    canvas.width = 96
    canvas.height = 96
    canvas.setAttribute('aria-hidden', 'true')
    paintNpcPortrait(canvas, `${item.slot}:${item.npc.name}`)
    const who = document.createElement('div')
    const name = document.createElement('strong')
    name.textContent = item.npc.name
    const slot = document.createElement('span')
    slot.textContent = item.slot
    const identity = document.createElement('p')
    identity.textContent = item.npc.identity
    who.append(name, slot, identity)
    const close = document.createElement('button')
    close.type = 'button'
    close.className = 'garden-signal-card-close'
    close.setAttribute('aria-label', '收起画像')
    close.textContent = '收起'
    close.disabled = actor.busy
    close.addEventListener('click', () => { selectedSignal = null; render() })
    head.append(canvas, who, close)
    const match = document.createElement('p')
    match.className = 'garden-signal-card-match'
    match.textContent = item.npc.match
    const chain = document.createElement('dl')
    chain.className = 'garden-signal-chain'
    const causal = item.npc.causal
    const values = [causal.background, causal.options, causal.choice, causal.cost, causal.reflection]
    CAUSAL_LABELS.forEach((label, index) => {
      const row = document.createElement('div')
      const term = document.createElement('dt')
      const detail = document.createElement('dd')
      term.textContent = label
      detail.textContent = values[index]
      row.append(term, detail)
      chain.append(row)
    })
    card.append(head, match, chain)
    return card
  }
  function renderSignals() {
    const signals = find<HTMLElement>('.garden-signals')
    const kicker = find<HTMLElement>('.garden-signals-kicker')
    const body = find<HTMLElement>('.garden-signals-body')
    const chosen = eraChoice(state.selectedAge, inspected ?? '')
    const showInspect = activatedAge === state.selectedAge && phase === 'inspect' && chosen
    const showNpc = activatedAge === state.selectedAge && phase === 'npc' && chosen
    const mode = showNpc ? 'npc' : showInspect ? 'inspect' : 'idle'
    root.dataset.signalMode = mode
    signals.hidden = mode === 'idle'
    if (mode === 'idle') {
      selectedSignal = null
      body.replaceChildren()
      return
    }
    body.replaceChildren()
    if (showInspect && chosen) {
      kicker.innerHTML = '这一年的选择回声 <small>本地占比</small>'
      const card = document.createElement('div')
      card.className = 'garden-signal-reason'
      card.innerHTML = `<strong>${chosen.peer}% 的同龄人选择「${chosen.label}」</strong><p>${chosen.reason}</p>`
      body.append(card)
      return
    }
    if (!chosen) return
    kicker.innerHTML = '与你相近的人生信号 <small>本地画像</small>'
    const portraits = signalPortraits(state.selectedAge, chosen.id)
    const opened = portraits.find(item => item.slot === selectedSignal)
    if (opened) {
      body.append(renderNpcCard(opened))
      return
    }
    const row = document.createElement('div')
    row.className = 'garden-signal-portraits'
    for (const item of portraits) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'garden-signal-npc'
      button.dataset.signal = item.slot
      button.disabled = actor.busy
      const canvas = document.createElement('canvas')
      canvas.width = 96
      canvas.height = 96
      canvas.setAttribute('aria-hidden', 'true')
      paintNpcPortrait(canvas, `${item.slot}:${item.npc.name}`)
      const name = document.createElement('strong')
      name.textContent = item.npc.name
      const label = document.createElement('span')
      label.textContent = item.slot
      button.append(canvas, name, label)
      button.addEventListener('click', () => {
        if (actor.busy) return
        selectedSignal = item.slot
        render()
      })
      row.append(button)
    }
    body.append(row)
  }
  function renderCopy() {
    const node = era()
    const future = state.currentAge !== null && state.selectedAge > state.currentAge
    const stats = find<HTMLElement>('.garden-choice-stats')
    find<HTMLElement>('.garden-age').textContent = `${state.currentAge === null ? '未读取现实年龄' : `现在 ${state.currentAge} 岁`} · ${future ? '探索' : '回看'} ${state.selectedAge} 岁`
    stats.replaceChildren()
    renderSignals()
    if (actor.busy) {
      find<HTMLElement>('h1').textContent = actor.revisit ? '轻轻触碰这一年。' : '把这一种选择，种到星球上。'
      find<HTMLElement>('.garden-note').textContent = actor.phase === 'walking' || actor.phase === 'turning'
        ? '慢慢走过去吧。那段岁月，就在那里。'
        : actor.revisit ? '轻轻触碰，听听它留下的回声。'
          : actor.phase === 'observing' ? '不用着急。看它从种子，一点点走到这一段岁月。'
            : '把这颗种子放下，让这一段时光留在这里。'
      stats.hidden = true
      return
    }
    if (phase === 'era' || activatedAge !== state.selectedAge) {
      find<HTMLElement>('h1').textContent = `${state.selectedAge}岁 · ${node.title}`
      find<HTMLElement>('.garden-note').textContent = state.target.age === null && state.target.raw
        ? `你留下的起点是“${state.target.raw}”。${node.era}`
        : node.era
      stats.hidden = true
      return
    }
    if (phase === 'choices') {
      find<HTMLElement>('h1').textContent = `${state.selectedAge}岁 · ${node.event}`
      find<HTMLElement>('.garden-note').textContent = '这一年，同龄人这样选。花会从档案舱门飞出来，点开一朵，看看它代表什么。'
      for (const item of node.choices) {
        const line = document.createElement('li')
        line.textContent = `${item.label} · ${item.peer}%`
        stats.append(line)
      }
      stats.hidden = false
      return
    }
    const chosen = eraChoice(state.selectedAge, inspected ?? '')
    if (phase === 'inspect' && chosen) {
      find<HTMLElement>('h1').textContent = `这朵花代表：${chosen.label}`
      find<HTMLElement>('.garden-note').textContent = '上面是这个时代里，多少人做了同样的选择，以及他们为什么这样选。再点一次，就把它种到星球上。'
      stats.hidden = true
      return
    }
    if (phase === 'npc' && chosen) {
      find<HTMLElement>('h1').textContent = '这一朵已经留下了。'
      find<HTMLElement>('.garden-note').textContent = selectedSignal
        ? '画像里是这条相近人生的五步因果。收起后，还可以看另外两格。'
        : '上面三格是和你相近的人生信号。点开一张画像，看 TA 的背景、选项、选择、代价和反思。'
      stats.hidden = true
    }
  }
  function render() {
    const focusedBefore = document.activeElement instanceof HTMLElement && root.contains(document.activeElement) ? document.activeElement : null
    const chapter = chapterForAge(state.selectedAge)
    const band = timelineBand(state.selectedAge)
    root.dataset.age = String(state.selectedAge)
    root.dataset.chapter = String(chapter)
    root.dataset.currentAge = state.currentAge === null ? '' : String(state.currentAge)
    root.dataset.targetAge = state.target.age === null ? '' : String(state.target.age)
    const loc = find<HTMLElement>('.garden-location')
    const holeMeta = holeById(phase === 'rift' ? riftView.kind : (pendingHole ?? 'backtrack'))
    if (phase === 'crossroads') {
      loc.querySelector('span')!.textContent = '月面三岔口'
      loc.querySelector('small')!.textContent = `第三幕 · 现年已抵达${state.currentAge === null ? '' : ` · ${state.currentAge} 岁`}`
    } else if (phase === 'rift') {
      loc.querySelector('span')!.textContent = holeMeta?.label ?? '裂隙'
      loc.querySelector('small')!.textContent = holeMeta?.kicker ?? '第三幕'
    } else {
      loc.querySelector('span')!.textContent = '月面人生花园'
      loc.querySelector('small')!.textContent = '第三幕 · 时间回声'
    }
    root.dataset.gardenPhase = phase === 'crossroads' || phase === 'rift' ? phase : (activatedAge === state.selectedAge ? phase : 'era')
    root.dataset.riftPick = pickingBacktrackFlowers() ? 'flowers' : ''
    root.dataset.pendingHole = pendingHole ?? ''
    root.dataset.reachedPresent = state.reachedPresent ? 'true' : ''
    root.dataset.actorPhase = actor.phase
    const plantedHere = state.planted.filter(item => item.age === state.selectedAge)
    find<HTMLButtonElement>('[data-action="enter"]').hidden = activatedAge === state.selectedAge && phase !== 'era'
    find<HTMLButtonElement>('[data-action="enter"]').disabled = actor.busy || !assetsReady
    find<HTMLElement>('[data-action="enter"]').textContent = actor.busy ? '正在走近这段岁月…' : '查看这一年的选择 ↗'
    find<HTMLElement>('.garden-signals').querySelectorAll<HTMLButtonElement>('button').forEach(button => { button.disabled = actor.busy })
    find<HTMLElement>('[data-action="replay"]').hidden = plantedHere.length === 0
    for (const action of ['profile', 'target', 'origin', 'chapters', 'replay']) find<HTMLButtonElement>(`[data-action="${action}"]`).disabled = actor.busy
    const values = timelineNodes(band, state.target.age, state.selectedAge, state.currentAge)
    const laterBand = band === 0 ? 1 : band === 1 ? 2 : 0
    const laterNodes = timelineNodes(laterBand, state.target.age, state.selectedAge, state.currentAge)
    find<HTMLButtonElement>('[data-action="chapters"]').hidden = band === 0 && laterNodes.length === 0
    find<HTMLElement>('[data-action="chapters"]').textContent = band === 0 ? '40岁以后的时光 →' : band === 1 && laterNodes.length ? '80岁以后的时光 →' : '← 回看0—40岁'
    find<HTMLElement>('[data-action="target"]').hidden = state.target.age !== null
    find<HTMLElement>('.garden-timeline-caption > span').textContent = `${chapterLabel(chapter)} · 每五年一个节点`
    nodes.replaceChildren()
    for (const value of values) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'garden-node'
      button.dataset.age = String(value)
      button.setAttribute('aria-label', `${value}岁`)
      button.setAttribute('aria-pressed', String(value === state.selectedAge && activatedAge === value))
      button.disabled = actor.busy
      if (value === state.target.age) button.title = '你的回溯起点'
      const canvas = document.createElement('canvas')
      canvas.width = 64; canvas.height = 64
      canvas.setAttribute('aria-hidden', 'true')
      const pose = timelineFlowerPose(value)
      if (flowers.naturalWidth) {
        const ctx = canvas.getContext('2d')!
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(flowers, pose * 128, 0, 128, 128, 0, 0, 64, 64)
      }
      const label = document.createElement('span')
      label.textContent = String(value)
      button.append(canvas, label)
      button.addEventListener('click', () => activateAge(value))
      nodes.append(button)
    }
    find<HTMLButtonElement>('[data-action="previous"]').disabled = actor.busy || state.selectedAge === (values[0] ?? 0)
    find<HTMLButtonElement>('[data-action="next"]').disabled = actor.busy || state.selectedAge === (values.at(-1) ?? 100)
    renderCopy()
    renderChoiceFlowers()
    renderGroundFlowers()
    renderHoles()
    renderRift()
    if (pickingBacktrackFlowers()) echoTrail(riftView.backtrackAge)
    updateFlowerFrames()
    if (focusedBefore && !focusedBefore.isConnected) root.focus({ preventScroll: true })
  }
  function lastChoiceId() {
    return state.planted.at(-1)?.choiceId ?? null
  }
  function renderHoles() {
    holesNav.hidden = phase !== 'crossroads'
    holesNav.replaceChildren()
    if (phase !== 'crossroads') return
    for (const hole of RIFT_HOLES) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'garden-hole'
      button.dataset.hole = hole.id
      button.style.left = `${hole.x}%`
      button.style.top = `${hole.y}%`
      button.setAttribute('aria-label', `${hole.label} · ${hole.hint}`)
      button.setAttribute('aria-pressed', String(pendingHole === hole.id))
      button.disabled = actor.busy || !assetsReady
      const world = document.createElement('canvas')
      world.className = 'garden-hole-world'
      world.setAttribute('aria-hidden', 'true')
      paintRiftWorld(world, hole.id)
      const title = document.createElement('strong')
      title.textContent = hole.label
      const hint = document.createElement('small')
      hint.textContent = hole.hint
      button.append(world, title, hint)
      button.addEventListener('click', () => enterHole(hole.id))
      holesNav.append(button)
    }
  }
  function riftContext() {
    return {
      planted: state.planted,
      currentAge: state.currentAge,
      profileAge: state.profile.age ?? '',
      lastChoiceId: lastChoiceId(),
      view: riftView,
    }
  }
  function renderRift() {
    rift.hidden = phase !== 'rift'
    if (phase !== 'rift') return
    renderRiftView(riftBody, riftContext(), {
      back: () => returnToCrossroads(),
      open: kind => openRift(kind),
      setBacktrack: age => { riftView = { ...riftView, backtrackAge: age, altChoiceId: null }; render() },
      setAlt: id => {
        riftView = { ...riftView, altChoiceId: id }
        render()
        if (id && riftView.backtrackAge !== null) {
          root.dispatchEvent(new CustomEvent('life-backtest:garden-rift-choice', {
            bubbles: true,
            detail: { kind: 'backtrack', age: riftView.backtrackAge, choiceId: id, source: liveEnabled() ? 'zhihu' : 'demo', ...getContext() },
          }))
        }
      },
      setFollow: slot => { riftView = { ...riftView, followSlot: slot, age28Id: slot ? riftView.age28Id : null }; render() },
      setAge28: id => { riftView = { ...riftView, age28Id: id }; render() },
      setForeOpen: key => { riftView = { ...riftView, foreOpen: key }; render() },
      toShore: () => { window.location.href = '/' },
    })
  }
  function resetRiftView(kind: RiftKind): RiftView {
    return { kind, backtrackAge: null, altChoiceId: null, followSlot: null, age28Id: null, foreOpen: null }
  }
  function beginCrossroads() {
    hideShip()
    closePanel(false)
    cancelPlanting()
    clearTimeout(swallowTimer)
    root.classList.remove('is-swallowing')
    rift.classList.remove('is-visible')
    inspected = null
    selectedSignal = null
    activatedAge = null
    pendingHole = null
    riftView = resetRiftView('backtrack')
    state.reachedPresent = true
    save()
    phase = 'crossroads'
    cue(132)
    render()
  }
  function enterHole(kind: RiftKind) {
    if (phase !== 'crossroads' || actor.busy || !assetsReady) return
    pendingHole = kind
    riftView = resetRiftView(kind)
    render()
    if (reduced()) {
      openRift(kind)
      return
    }
    actor.walkTo(BOARDING_DOOR)
    render()
  }
  function swallowIntoHole(kind: RiftKind) {
    root.style.setProperty('--swallow-x', `${SHIP_HATCH.x.toFixed(2)}%`)
    root.style.setProperty('--swallow-y', `${SHIP_HATCH.y.toFixed(2)}%`)
    root.classList.add('is-swallowing')
    cue(86)
    clearTimeout(swallowTimer)
    swallowTimer = window.setTimeout(() => {
      openRift(kind)
      swallowTimer = window.setTimeout(() => root.classList.remove('is-swallowing'), 780)
    }, 1180)
  }
  function openRift(kind: RiftKind) {
    pendingHole = kind
    riftView = { ...riftView, kind }
    phase = 'rift'
    actor.cancel()
    actor.position = { ...GARDEN_HOME }
    actor.facing = -1
    render()
    requestAnimationFrame(() => rift.classList.add('is-visible'))
    root.dispatchEvent(new CustomEvent('life-backtest:garden-rift-open', {
      bubbles: true,
      detail: { kind, ...getContext() },
    }))
    find<HTMLButtonElement>('.garden-rift-back').focus({ preventScroll: true })
  }
  function returnToCrossroads() {
    pendingHole = null
    riftView = resetRiftView('backtrack')
    phase = 'crossroads'
    actor.cancel()
    actor.position = { ...GARDEN_HOME }
    actor.facing = -1
    root.classList.remove('is-swallowing')
    rift.classList.remove('is-visible')
    render()
    holesNav.querySelector<HTMLButtonElement>('.garden-hole')?.focus({ preventScroll: true })
  }
  function hideShip() {
    clearTimeout(shipTimer)
    clearTimeout(landTimer)
    root.classList.remove('is-ship-out', 'is-ship-open')
    hatch.hidden = true
    flowerSetKey = ''
    choiceNav.replaceChildren()
  }
  function launchShip() {
    clearTimeout(shipTimer)
    clearTimeout(landTimer)
    hatch.hidden = false
    root.classList.remove('is-ship-out', 'is-ship-open')
    flowerSetKey = ''
    choiceNav.replaceChildren()
    void root.offsetWidth
    root.classList.add('is-ship-out')
    cue(198)
    render()
    const land = () => choiceNav.querySelectorAll<HTMLButtonElement>('.garden-choice-flower').forEach(markFlowerLanded)
    const open = () => {
      root.classList.add('is-ship-open')
      if (reduced()) land()
      else landTimer = window.setTimeout(land, 1680)
    }
    if (reduced()) open()
    else shipTimer = window.setTimeout(open, 320)
  }
  function cancelPlanting() {
    actor.cancel(); planting = null
  }
  function selectAge(age: number, activate = false) {
    if (!active || actor.busy || ageValue(age) === null) return
    if (phase === 'crossroads' || phase === 'rift') return
    if (state.currentAge !== null && age > state.currentAge) return
    if (isPresentAge(age, state.currentAge)) {
      cancelPlanting(); closePanel(false)
      inspected = null
      selectedSignal = null
      hideShip()
      beginCrossroads()
      return
    }
    cancelPlanting(); closePanel(false)
    state.selectedAge = age; save()
    inspected = null
    selectedSignal = null
    if (activate) {
      activatedAge = age
      phase = 'choices'
      launchShip()
    } else {
      activatedAge = null
      phase = 'era'
      hideShip()
      render()
    }
    cue(220 + chapterForAge(age) * 18)
    frame.classList.remove('is-time-moving'); void frame.offsetWidth; frame.classList.add('is-time-moving')
    clearTimeout(meteorTimer); meteorTimer = window.setTimeout(() => frame.classList.remove('is-time-moving'), 2000)
  }
  function activateAge(age: number) {
    selectAge(age, true)
  }
  function enterNextEra() {
    const next = nextTimelineAge(state.selectedAge, state.target.age, state.currentAge)
    if (shouldEnterCrossroads(state.selectedAge, state.currentAge, next)) {
      beginCrossroads()
      return
    }
    if (next === null) {
      activatedAge = null
      phase = 'era'
      hideShip()
      render()
      return
    }
    selectAge(next, false)
  }
  function inspectOrPlant(choice: EraChoice, planted: boolean, replay = false) {
    if (!active || actor.busy || root.inert || !assetsReady) return
    if (phase === 'crossroads' || phase === 'rift') return
    if (activatedAge !== state.selectedAge) activateAge(state.selectedAge)
    if (!replay && inspected !== choice.id) {
      inspected = choice.id
      selectedSignal = null
      phase = 'inspect'
      cue(240)
      render()
      return
    }
    phase = planted && !replay ? 'npc' : 'choices'
    const soil = padForChoice(state.selectedAge, choice.id)
    actor.start(chapterForAge(state.selectedAge), soil, planted && !replay)
    planting = { age: state.selectedAge, choiceId: choice.id }
    lastStep = 0
    cue(150)
    save()
    render()
  }
  function moveTime(direction: number) {
    const band = timelineBand(state.selectedAge)
    const values = timelineNodes(band, state.target.age, state.selectedAge, state.currentAge)
    const next = direction > 0 ? values.find(v => v > state.selectedAge) : values.toReversed().find(v => v < state.selectedAge)
    selectAge(next ?? Math.max(0, Math.min(100, state.selectedAge + direction * 5)))
  }
  function closePanel(restoreFocus = true) {
    panel.hidden = true; root.classList.remove('has-panel')
    if (restoreFocus) {
      const destination = returnFocus?.isConnected && root.contains(returnFocus) && !panel.contains(returnFocus) ? returnFocus : root
      destination.focus({ preventScroll: true })
    }
  }
  function openPanel(mode: typeof panelMode, signal = '') {
    if (actor.busy) return
    panelMode = mode
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    panel.hidden = false; root.classList.add('has-panel'); output.textContent = ''
    find<HTMLElement>('.garden-profile').replaceChildren(); find<HTMLElement>('.garden-records').replaceChildren()
    form.hidden = mode === 'profile' || mode === 'signal'
    const heading = find<HTMLElement>('.garden-panel-title'), copy = find<HTMLElement>('.garden-panel-copy')
    find<HTMLElement>('.garden-panel-kicker').textContent = mode === 'profile' ? '从第二幕带来的登记' : '零点小姐 · 时间档案'
    if (mode === 'profile') {
      heading.textContent = '你留下的起点'
      copy.textContent = '现实资料与回看年龄分别记录，不会互相覆盖。'
      const labels = { age: '现在的年龄', gender: '性别', family: '当前家庭情况', status: '当前学习／就业状态', rewind: '原始回溯目标' }
      for (const key of Object.keys(labels) as (keyof typeof labels)[]) {
        const term = document.createElement('dt'), value = document.createElement('dd')
        term.textContent = labels[key]; value.textContent = state.profile[key] || '尚未登记'
        find<HTMLElement>('.garden-profile').append(term, value)
      }
    } else if (mode === 'signal') {
      heading.textContent = signal
      copy.textContent = liveEnabled()
        ? '相近经历会从知乎公开搜索回填。没有结果时保持空白，不会编造人物或匹配分数。'
        : '这里会收到知乎原文。当前未接通接口，不会编造人物、匹配结果或原文。'
    } else if (mode === 'target') {
      heading.textContent = state.target.raw ? `“${state.target.raw}”，那时几岁？` : '你想回到几岁？'
      copy.textContent = state.target.kind === 'year' ? '只有当前年龄，还不能准确换算年份。请确认那一年你的年龄。' : '只补充这一个时间点，不需要重新填写登记。'
      form.querySelector('label')!.textContent = '确认回溯年龄（0—100）'
      input.setAttribute('aria-label', '确认回溯年龄'); input.inputMode = 'numeric'; input.value = ''
      input.placeholder = '例如：18'
    } else {
      heading.textContent = `${state.selectedAge}岁 · 时间档案`
      copy.textContent = '这一页已经为你留好。时代背景、人生问题和相近经历，将由内容系统接入。你也可以先记下一件想回看的事。'
      form.querySelector('label')!.textContent = '留给这一岁的记录'
      input.setAttribute('aria-label', '留给这一岁的记录'); input.inputMode = 'text'; input.placeholder = '例如：那时有一个一直没有做的选择'
      input.value = state.records.findLast(r => r.age === state.selectedAge)?.text ?? ''
      renderRecords()
      root.dispatchEvent(new CustomEvent('life-backtest:garden-node-request', { bubbles: true, detail: getContext() }))
    }
    find<HTMLButtonElement>('.garden-panel-close').focus({ preventScroll: true })
  }
  function renderRecords() {
    const records = find<HTMLElement>('.garden-records'); records.replaceChildren()
    for (const record of state.records.filter(r => r.age === state.selectedAge).slice(-3)) {
      const line = document.createElement('p'); line.textContent = `${record.age}岁 · ${record.text}`; records.append(line)
    }
  }
  function getContext() {
    return structuredClone({
      profile: state.profile, currentAge: state.currentAge, target: state.target,
      selectedAge: state.selectedAge, chapter: chapterForAge(state.selectedAge),
      mode: state.currentAge !== null && state.selectedAge > state.currentAge ? 'future-exploration' : 'rewind',
      records: state.records.filter(r => r.age <= state.selectedAge),
      planted: state.planted,
      reachedPresent: state.reachedPresent,
    })
  }
  form.addEventListener('submit', event => {
    event.preventDefault()
    if (panelMode === 'target') {
      const age = ageValue(input.value.trim())
      if (age === null) { output.textContent = '请输入0到100之间的完整年龄。'; return }
      state.target.age = age; state.selectedAge = age; save(); closePanel(); render(); cue()
    } else {
      const text = input.value.trim()
      if (!text) { output.textContent = '先写下一句话，再记录。'; return }
      state.records.push({ age: state.selectedAge, text, recordedAt: new Date().toISOString() })
      state.records = state.records.slice(-100); save(); renderRecords(); output.textContent = '已记录在这一岁，仅保存在本机。'; cue()
    }
  })
  window.addEventListener('keydown', event => {
    if (!active || root.inert) return
    if (event.target instanceof HTMLInputElement && event.repeat && ['KeyW', 'ArrowUp'].includes(event.code)) event.preventDefault()
    if (event.isComposing || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
    if (event.key === 'Escape') {
      if (phase === 'rift') {
        if (riftView.altChoiceId) { riftView = { ...riftView, altChoiceId: null }; render(); return }
        if (riftView.backtrackAge !== null) { riftView = { ...riftView, backtrackAge: null, altChoiceId: null }; render(); return }
        if (riftView.followSlot) { riftView = { ...riftView, followSlot: null, age28Id: null }; render(); return }
        if (riftView.foreOpen) { riftView = { ...riftView, foreOpen: null }; render(); return }
        returnToCrossroads(); return
      }
      closePanel(); return
    }
    if (!panel.hidden) return
    if (phase === 'rift') {
      if (event.code === 'KeyR' && !event.repeat) { event.preventDefault(); returnToCrossroads() }
      return
    }
    if (phase === 'crossroads') {
      if (event.code === 'KeyR' && !event.repeat) { event.preventDefault(); restart() }
      return
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); moveTime(event.key === 'ArrowLeft' ? -1 : 1) }
    if (event.code === 'KeyR' && !event.repeat) { event.preventDefault(); restart() }
  })
  root.tabIndex = -1
  root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(b => b.addEventListener('click', () => {
    switch (b.dataset.action) {
      case 'enter': activateAge(state.selectedAge); break
      case 'replay': {
        const planted = state.planted.find(item => item.age === state.selectedAge)
        const choice = planted ? eraChoice(planted.age, planted.choiceId) : undefined
        if (choice) { inspected = choice.id; inspectOrPlant(choice, true, true) }
        break
      }
      case 'profile': openPanel('profile'); break
      case 'target': openPanel('target'); break
      case 'previous': moveTime(-1); break
      case 'next': moveTime(1); break
      case 'chapters': {
        const later = timelineNodes(state.selectedAge < 40 ? 1 : 2, state.target.age, state.selectedAge, state.currentAge)
        if (state.selectedAge < 40 && later.length) selectAge(40)
        else if (state.selectedAge < 80 && later.length) selectAge(80)
        else selectAge(0)
        break
      }
      case 'origin': if (state.target.age === null) openPanel('target'); else selectAge(state.target.age); break
      case 'restart': restart(); break
    }
  }))
  find<HTMLButtonElement>('.garden-rift-back').addEventListener('click', () => returnToCrossroads())
  find<HTMLButtonElement>('.garden-panel-close').addEventListener('click', () => closePanel())
  find<HTMLButtonElement>('.garden-player-hit').addEventListener('click', () => {
    if (actor.busy) return
    actor.greet(); cue(220)
    find<HTMLElement>('.garden-note').textContent = '不着急。先点时间线上的一年，再看看从舱门飞出来的花。'
  })
  document.addEventListener('visibilitychange', () => { previousActorTime = 0 })
  function restart() {
    cancelPlanting(); closePanel(false); inspected = null; selectedSignal = null; activatedAge = null
    pendingHole = null
    root.classList.remove('is-swallowing')
    rift.classList.remove('is-visible')
    clearTimeout(swallowTimer)
    if (state.reachedPresent && state.currentAge !== null) {
      actor.cancel()
      actor.position = { ...GARDEN_HOME }
      beginCrossroads()
      drawPlayer()
      root.focus({ preventScroll: true })
      return
    }
    phase = 'era'; hideShip(); render(); drawPlayer(); root.focus({ preventScroll: true }); cue(174)
  }
  return {
    element: root, ready,
    show(profile?: ArchiveProfile, arrival: 'resume' | 'begin' = 'resume') {
      const incoming = profile ?? readArchiveProfile()
      state = arrival === 'begin' ? newGardenState(incoming) : restoreGardenState(read(GARDEN_SAVE_KEY), incoming)
      cancelAnimationFrame(actorFrame); actor = new GardenActor(); previousActorTime = 0; lastDraw = 0
      planting = null; inspected = null; selectedSignal = null; activatedAge = null; pendingHole = null
      riftView = resetRiftView('backtrack')
      phase = 'era'
      active = true; root.hidden = false; closePanel(false); hideShip(); save()
      if (arrival === 'resume' && state.reachedPresent && state.currentAge !== null) beginCrossroads()
      else render()
      drawPlayer()
      actorFrame = requestAnimationFrame(animateActor)
      root.focus({ preventScroll: true })
      void probeZhihuHealth().then(health => {
        if (!root.isConnected) return
        const note = find<HTMLElement>('.garden-location-note')
        const status = find<HTMLElement>('.garden-zhihu-status')
        if (health?.zhihu?.cli && health.zhihu.authConfigured) {
          note.textContent = '第三幕 · 时间回声 · 知乎已接通'
          status.textContent = '裂隙帖子检索知乎原文；本地画像不会冒充真实用户'
        } else if (liveEnabled()) {
          note.textContent = '第三幕 · 时间回声 · 知乎未接通'
          status.textContent = '接口未就绪，裂隙页回退本地演示帖'
        }
      })
    },
    hide() { active = false; cancelAnimationFrame(actorFrame); cancelPlanting(); clearTimeout(meteorTimer); clearTimeout(shipTimer); clearTimeout(landTimer); clearTimeout(swallowTimer); root.classList.remove('is-swallowing'); rift.classList.remove('is-visible'); root.hidden = true; void sound?.suspend() },
    getContext,
  }
}
