import './garden.css'
import type { ArchiveProfile } from '../archive/archiveInterview'
import { ageValue, chapterForAge, chapterLabel, chapterNodes, FLOWER_NAMES, GARDEN_SAVE_KEY, restoreGardenState, type GardenState } from './gardenState'
import { GardenActor, GARDEN_SOIL } from './gardenActor'
import { flowerEndpoint, flowerPoseAt, FLOWER_POSES } from './flowerLifecycle'

function read(key: string, session = false): string | null {
  try { return (session ? sessionStorage : localStorage).getItem(key) } catch { return null }
}
export function readArchiveProfile(): ArchiveProfile | undefined {
  try { return JSON.parse(read('life-backtest.archive-profile', true) ?? 'null') ?? undefined } catch { return undefined }
}

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
      <header class="garden-location"><span>月面人生花园</span><small>第三幕 · 时间回声</small></header>
      <nav class="garden-signals" aria-label="人生内容接口">
        <span>与你相近的人生信号 <small>待接入</small></span>
        <div><button type="button" data-signal="同代 · 相近选择"><i>◇</i>同代 · 相近选择</button><button type="button" data-signal="同代 · 不同取舍"><i>◇</i>同代 · 不同取舍</button><button type="button" data-signal="跨代 · 相似困境"><i>◇</i>跨代 · 相似困境</button></div>
      </nav>
      <article class="garden-copy" aria-live="polite">
        <small>零点小姐 · 时间回声</small>
        <p class="garden-age"></p><h1 tabindex="-1"></h1><p class="garden-note"></p>
        <div class="garden-copy-actions"><button type="button" data-action="enter">种下这一段时光 <span>↗</span></button><button type="button" data-action="profile">登记资料</button></div>
        <button type="button" class="garden-replay" data-action="replay" hidden>重看这一章的生长 ↻</button>
        <button type="button" class="garden-locate" data-action="target" hidden>确认回溯年龄 →</button>
      </article>
      <nav class="garden-flowers" aria-label="年龄章节"></nav>
      <footer class="garden-timeline"><div class="garden-timeline-caption"><span></span><div><button type="button" data-action="chapters">40岁以后的时光 →</button><button type="button" data-action="origin">回到回溯起点 ↖</button></div></div><div class="garden-time-controls"><button type="button" data-action="previous" aria-label="更早的年龄">‹</button><div class="garden-nodes" aria-label="具体年龄"></div><button type="button" data-action="next" aria-label="更晚的年龄">›</button></div></footer>
      <div class="garden-bottom"><button type="button" data-action="restart"><kbd>R</kbd> 重新进入画面</button><span><a href="/" class="garden-from-shore">从第一幕重新体验 ↗</a> · 人生内容待接入</span></div>
      <aside class="garden-panel" aria-label="时间档案" hidden>
        <button type="button" class="garden-panel-close" aria-label="关闭时间档案">×</button>
        <small class="garden-panel-kicker"></small><h2 class="garden-panel-title"></h2><p class="garden-panel-copy"></p>
        <dl class="garden-profile"></dl>
        <form class="garden-form" hidden><label></label><input type="text" maxlength="500" autocomplete="off" /><button type="submit">记录</button><output aria-live="polite"></output></form>
        <div class="garden-records"></div>
      </aside>
      <p class="garden-asset-error" hidden>月面素材未能完整加载，请刷新重试。你的登记资料仍会保留。</p>
    </div>`
  host.append(root)
  const find = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!
  const frame = find<HTMLElement>('.garden-frame')
  const panel = find<HTMLElement>('.garden-panel')
  const form = find<HTMLFormElement>('.garden-form')
  const input = form.querySelector('input')!
  const output = form.querySelector('output')!
  const flowerNav = find<HTMLElement>('.garden-flowers')
  const nodes = find<HTMLElement>('.garden-nodes')
  const player = find<HTMLCanvasElement>('.garden-player').getContext('2d')!
  const sprite = new Image()
  sprite.src = '/assets/player/player-walk-sheet-v2.png'
  const actionSprite = new Image()
  actionSprite.src = '/assets/player/player-plant-sheet-v1.png'
  const flowers = new Image()
  flowers.src = '/assets/garden/flower-lifecycle-v1.png'
  let state: GardenState = restoreGardenState(read(GARDEN_SAVE_KEY), readArchiveProfile())
  let active = false
  let planting: number | null = null
  let actor = new GardenActor()
  let actorFrame = 0
  let previousActorTime = 0
  let lastDraw = 0
  let lastStep = 0
  let meteorTimer = 0
  let panelMode: 'profile' | 'target' | 'memory' | 'signal' = 'memory'
  let returnFocus: HTMLElement | null = null
  let sound: AudioContext | undefined
  let assetsReady = false
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches
  const portrait = () => matchMedia('(max-aspect-ratio: 1/1)').matches
  const groundFlowers = Array.from({ length: 8 }, () => {
    const canvas = document.createElement('canvas'); canvas.width = 112; canvas.height = 124; return canvas
  })
  const flowerDrawKeys = new WeakMap<HTMLCanvasElement, string>()

  const ready = Promise.allSettled([
    find<HTMLImageElement>('.garden-background').decode(), sprite.decode(), flowers.decode(), actionSprite.decode(),
  ]).then(results => {
    assetsReady = results.every(r => r.status === 'fulfilled')
    find<HTMLElement>('.garden-asset-error').hidden = assetsReady
    groundFlowers.forEach((canvas, chapter) => drawFlower(canvas, chapter))
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
  function drawPlayer() {
    player.clearRect(0, 0, 1672, 941)
    if (!sprite.naturalWidth) return
    player.imageSmoothingEnabled = false
    // On narrow screens the larger chapter controls live below the scene;
    // keep a matching planted flower in the world where the player's hand reaches.
    if (portrait()) {
      const start = chapterForAge(state.selectedAge) < 4 ? 0 : 4
      for (let slot = 0; slot < 4; slot++) {
        const chapter = start + slot
        const growing = planting === chapter && !actor.revisit && actor.growthElapsed > 0
        if (!state.planted.includes(chapter) && !growing) continue
        const width = 85, height = 85
        drawFlower(groundFlowers[chapter], chapter)
        player.save()
        player.drawImage(groundFlowers[chapter], GARDEN_SOIL[slot].x - width / 2, GARDEN_SOIL[slot].y - height, width, height)
        player.restore()
      }
    }
    const { x, y } = actor.position
    const size = 92 + (y - 616) * .05
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
    player.fillStyle = '#050505a8'
    player.beginPath(); player.ellipse(x, y + 1, size * .2, size * .042, -.12, 0, Math.PI * 2); player.fill()
    player.save(); player.translate(Math.round(x), Math.round(y)); player.scale(actor.facing, 1)
    // Shared foot anchor and scale. The character changes pose, never stretches to fake a crouch.
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
          if (!revisiting && !state.planted.includes(event.chapter)) { state.planted.push(event.chapter); save() }
          planting = null; render(); cue(revisiting ? 260 : 348)
          if (revisiting) openPanel('memory')
          else find<HTMLElement>('.garden-note').textContent = '这一段时光，我们就从这里开始吧。你想先看看哪一年？'
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
  function drawFlower(canvas: HTMLCanvasElement, chapter: number) {
    const playing = planting === chapter && !actor.revisit
    const sample = playing ? flowerPoseAt(chapter, actor.growthElapsed) : { pose: flowerEndpoint(chapter), next: flowerEndpoint(chapter), mix: 0 }
    const mix = reduced() ? 0 : Math.round(sample.mix * 8) / 8
    const key = `${sample.pose}:${sample.next}:${mix}`
    canvas.dataset.pose = String(sample.pose)
    if (!flowers.naturalWidth || flowerDrawKeys.get(canvas) === key) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.imageSmoothingEnabled = false
    ctx.save()
    // Normalized ground baseline stays fixed. Blend only adjacent authored poses,
    // never stretch a finished flower from zero size or fade through empty space.
    ctx.globalAlpha = 1 - mix
    ctx.drawImage(flowers, sample.pose * 128, 0, 128, 128, 0, 0, canvas.width, canvas.height)
    if (mix > 0) {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = mix
      ctx.drawImage(flowers, sample.next * 128, 0, 128, 128, 0, 0, canvas.width, canvas.height)
    }
    ctx.restore(); flowerDrawKeys.set(canvas, key)
  }
  function updateFlowerFrames() {
    flowerNav.querySelectorAll<HTMLButtonElement>('.garden-flower').forEach(button => {
      const chapter = Number(button.dataset.chapter)
      const canvas = button.querySelector('canvas')!
      drawFlower(canvas, chapter)
      button.dataset.flowerFrame = String(Number(canvas.dataset.pose) + 1)
      const growing = planting === chapter && !actor.revisit && ['planting', 'rising', 'observing'].includes(actor.phase)
      button.classList.toggle('is-growing', growing)
      if (growing) button.querySelector('small')!.textContent = FLOWER_POSES[Number(canvas.dataset.pose)]
    })
  }
  function renderFlowers() {
    const chapter = chapterForAge(state.selectedAge)
    const start = chapter < 4 ? 0 : 4
    flowerNav.replaceChildren()
    for (let slot = 0; slot < 4; slot++) {
      const index = start + slot
      const button = document.createElement('button')
      button.type = 'button'; button.className = 'garden-flower'; button.dataset.chapter = String(index)
      button.style.setProperty('--slot', String(slot))
      button.style.left = `${GARDEN_SOIL[slot].x / 1672 * 100}%`
      button.style.top = `${(GARDEN_SOIL[slot].y + 9) / 941 * 100}%`
      button.setAttribute('aria-label', `${chapterLabel(index)} · ${FLOWER_NAMES[index]}`)
      button.setAttribute('aria-pressed', String(index === chapter))
      button.dataset.planted = String(state.planted.includes(index))
      button.classList.toggle('is-planting', planting === index && actor.phase === 'planting')
      button.classList.toggle('is-rising', planting === index && actor.phase === 'rising')
      button.disabled = actor.busy || !assetsReady
      const ring = document.createElement('span'); ring.className = 'garden-flower-ring'
      const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128; canvas.setAttribute('aria-hidden', 'true')
      ring.append(canvas)
      const age = document.createElement('span'); age.className = 'garden-flower-age'; age.textContent = chapterLabel(index)
      const label = document.createElement('small'); label.textContent = planting === index ? (actor.phase === 'walking' || actor.phase === 'turning' ? '正在走近' : actor.revisit ? '轻触时光' : '亲手种下') : state.planted.includes(index) ? '触碰 · 查看时光' : `${FLOWER_NAMES[index]} · 点击走近`
      button.append(ring, age, label)
      button.addEventListener('click', () => activateChapter(index))
      button.addEventListener('pointerenter', () => actor.lookAt(GARDEN_SOIL[slot].x))
      flowerNav.append(button); drawFlower(canvas, index)
    }
    updateFlowerFrames()
  }
  function render() {
    const focusedBefore = document.activeElement instanceof HTMLElement && root.contains(document.activeElement) ? document.activeElement : null
    const chapter = chapterForAge(state.selectedAge)
    const future = state.currentAge !== null && state.selectedAge > state.currentAge
    root.dataset.age = String(state.selectedAge); root.dataset.chapter = String(chapter)
    root.dataset.currentAge = state.currentAge === null ? '' : String(state.currentAge)
    root.dataset.targetAge = state.target.age === null ? '' : String(state.target.age)
    find<HTMLElement>('.garden-age').textContent = `${state.currentAge === null ? '未读取现实年龄' : `现在 ${state.currentAge} 岁`} · ${future ? '探索' : '回看'} ${state.selectedAge} 岁`
    find<HTMLElement>('h1').textContent = state.target.age === null ? '先找到，你想回去的那一刻。' : `你的${state.selectedAge}岁，想从哪里开始？`
    find<HTMLElement>('.garden-note').textContent = state.target.age === null
      ? (state.target.raw ? `你留下的起点是“${state.target.raw}”。告诉我那时几岁，就能找到这段时光。` : '档案还没有带来回溯起点。你可以先浏览，也可以查看登记资料。')
      : future ? '这是尚未发生的时光，只作为探索入口，不是未来的预言。' : '把光标停在花上，听听这段时光。准备好后，再将它种下。'
    find<HTMLElement>('[data-action="enter"]').textContent = actor.busy ? (actor.phase === 'walking' || actor.phase === 'turning' ? '正在走近这段岁月…' : actor.phase === 'observing' ? '等待花朵慢慢生长…' : '正在种下时光…') : state.planted.includes(chapter) ? '走近 · 打开这段岁月 ↗' : '走近 · 种下这段时光 ↗'
    find<HTMLButtonElement>('[data-action="enter"]').disabled = actor.busy || !assetsReady
    root.querySelectorAll<HTMLButtonElement>('[data-signal]').forEach(button => { button.disabled = actor.busy })
    if (actor.busy) find<HTMLElement>('.garden-note').textContent = actor.phase === 'walking' || actor.phase === 'turning' ? '慢慢走过去吧。那段岁月，就在那里。' : actor.revisit ? '轻轻触碰，听听它留下的回声。' : actor.phase === 'observing' ? '不用着急。看它从种子，一点点走到这一段岁月。' : '把这颗种子放下，让这一段时光留在这里。'
    find<HTMLElement>('[data-action="replay"]').hidden = !state.planted.includes(chapter)
    root.dataset.actorPhase = actor.phase
    for (const action of ['profile', 'target', 'origin', 'chapters', 'replay']) find<HTMLButtonElement>(`[data-action="${action}"]`).disabled = actor.busy
    find<HTMLElement>('[data-action="chapters"]').textContent = chapter < 4 ? '40岁以后的时光 →' : '← 回看0—40岁'
    find<HTMLElement>('[data-action="target"]').hidden = state.target.age !== null
    find<HTMLElement>('.garden-timeline-caption > span').textContent = `${chapterLabel(chapter)} · 人生节点`
    const values = chapterNodes(chapter, state.target.age, state.selectedAge)
    nodes.replaceChildren()
    for (const value of values) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = String(value)
      button.setAttribute('aria-label', `${value}岁`); button.setAttribute('aria-pressed', String(value === state.selectedAge))
      button.className = 'garden-node'
      button.disabled = actor.busy
      if (value === state.target.age) button.title = '你的回溯起点'
      button.addEventListener('click', () => selectAge(value))
      nodes.append(button)
    }
    find<HTMLButtonElement>('[data-action="previous"]').disabled = actor.busy || state.selectedAge === 0
    find<HTMLButtonElement>('[data-action="next"]').disabled = actor.busy || state.selectedAge === 100
    renderFlowers()
    if (focusedBefore && !focusedBefore.isConnected) root.focus({ preventScroll: true })
  }
  function cancelPlanting() {
    actor.cancel(); planting = null
  }
  function selectAge(age: number) {
    if (!active || actor.busy || ageValue(age) === null) return
    cancelPlanting(); closePanel(false)
    state.selectedAge = age; save(); render()
    cue(220 + chapterForAge(age) * 18)
    frame.classList.remove('is-time-moving'); void frame.offsetWidth; frame.classList.add('is-time-moving')
    clearTimeout(meteorTimer); meteorTimer = window.setTimeout(() => frame.classList.remove('is-time-moving'), 2000)
  }
  function activateChapter(chapter: number, replay = false) {
    if (!active || actor.busy || root.inert || !assetsReady) return
    if (chapterForAge(state.selectedAge) !== chapter) {
      state.selectedAge = state.target.age !== null && chapterForAge(state.target.age) === chapter ? state.target.age : chapter * 10
      closePanel(false)
    }
    const start = chapter < 4 ? 0 : 4
    actor.start(chapter, GARDEN_SOIL[chapter - start], state.planted.includes(chapter) && !replay)
    planting = chapter; lastStep = 0; cue(150); save(); render()
  }
  function moveTime(direction: number) {
    const chapter = chapterForAge(state.selectedAge)
    const values = chapterNodes(chapter, state.target.age, state.selectedAge)
    const next = direction > 0 ? values.find(v => v > state.selectedAge) : values.toReversed().find(v => v < state.selectedAge)
    selectAge(next ?? Math.max(0, Math.min(100, state.selectedAge + direction)))
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
      copy.textContent = '这里会收到队友内容系统传来的人生经历。目前尚未连接，不会编造人物、匹配结果或原文。'
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
    // No autofocus into editable text: carried movement repeats cannot type into the new field.
    find<HTMLButtonElement>('.garden-panel-close').focus({ preventScroll: true })
  }
  function renderRecords() {
    const records = find<HTMLElement>('.garden-records'); records.replaceChildren()
    for (const record of state.records.filter(r => r.age === state.selectedAge).slice(-3)) {
      const line = document.createElement('p'); line.textContent = `${record.age}岁 · ${record.text}`; records.append(line)
    }
  }
  function getContext() {
    return structuredClone({ profile: state.profile, currentAge: state.currentAge, target: state.target,
      selectedAge: state.selectedAge, chapter: chapterForAge(state.selectedAge),
      mode: state.currentAge !== null && state.selectedAge > state.currentAge ? 'future-exploration' : 'rewind',
      records: state.records.filter(r => r.age <= state.selectedAge) })
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
    if (event.key === 'Escape') { closePanel(); return }
    if (!panel.hidden) return
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); moveTime(event.key === 'ArrowLeft' ? -1 : 1) }
    if (event.code === 'KeyR' && !event.repeat) { event.preventDefault(); restart() }
  })
  root.tabIndex = -1
  root.querySelectorAll<HTMLButtonElement>('[data-signal]').forEach(b => b.addEventListener('click', () => openPanel('signal', b.dataset.signal)))
  root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(b => b.addEventListener('click', () => {
    switch (b.dataset.action) {
      case 'enter': activateChapter(chapterForAge(state.selectedAge)); break
      case 'replay': activateChapter(chapterForAge(state.selectedAge), true); break
      case 'profile': openPanel('profile'); break
      case 'target': openPanel('target'); break
      case 'previous': moveTime(-1); break
      case 'next': moveTime(1); break
      case 'chapters': selectAge(state.selectedAge < 40 ? 40 : 0); break
      case 'origin': if (state.target.age === null) openPanel('target'); else selectAge(state.target.age); break
      case 'restart': restart(); break
    }
  }))
  find<HTMLButtonElement>('.garden-panel-close').addEventListener('click', () => closePanel())
  find<HTMLButtonElement>('.garden-player-hit').addEventListener('click', () => {
    if (actor.busy) return
    actor.greet(); cue(220)
    find<HTMLElement>('.garden-note').textContent = '不着急。选一段你想靠近的时光，我会陪你走过去。'
  })
  document.addEventListener('visibilitychange', () => { previousActorTime = 0 })
  function restart() { cancelPlanting(); closePanel(false); render(); drawPlayer(); root.focus({ preventScroll: true }); cue(174) }
  return {
    element: root, ready,
    show(profile?: ArchiveProfile) {
      state = restoreGardenState(read(GARDEN_SAVE_KEY), profile ?? readArchiveProfile())
      cancelAnimationFrame(actorFrame); actor = new GardenActor(); previousActorTime = 0; lastDraw = 0; planting = null
      active = true; root.hidden = false; closePanel(false); save(); render(); drawPlayer()
      actorFrame = requestAnimationFrame(animateActor)
      root.focus({ preventScroll: true })
    },
    hide() { active = false; cancelAnimationFrame(actorFrame); cancelPlanting(); clearTimeout(meteorTimer); root.hidden = true; void sound?.suspend() },
    getContext,
  }
}
