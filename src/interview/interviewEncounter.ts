import './interviewEncounter.css'

type Point = { x: number, y: number }
type Phase = 'idle' | 'opening' | 'threshold' | 'disembark' | 'grounded' | 'manifest' | 'settle' | 'ready'
type Speaker = 'you' | 'other'

const ART = { width: 1672, height: 941 }
// Coordinates measured against rewind-cosmos-v1, shared by the hatch and walking route.
const HATCH = { x: 1207, y: 591, width: 80, height: 98 }
const asset = (frame: number) => `/assets/player/walk-v2/${String(frame).padStart(2, '0')}.png`
const clamp = (n: number) => Math.max(0, Math.min(1, n))
const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })

export function createInterviewEncounter(root: HTMLElement, onReady: () => void) {
  const stage = root.querySelector<HTMLElement>('.interview-dialogue-actors')!
  const background = root.querySelector<HTMLImageElement>('.garden-background')!
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  stage.innerHTML = `
    <div class="interview-hatch">
      <div class="interview-hatch-interior"></div>
      <img class="interview-cabin-person" src="${asset(9)}" alt="" />
      <i class="interview-hatch-panel is-left"></i><i class="interview-hatch-panel is-right"></i>
      <i class="interview-hatch-rim"></i>
    </div>
    <div class="interview-projection"><i class="interview-projection-beam"></i><i class="interview-projection-pixels"></i><i class="interview-projection-ring"></i></div>
    <figure class="interview-dialogue-actor is-other" data-motion="rest">
      <i class="interview-contact-shadow"></i>
      <span class="interview-person"><img src="${asset(9)}" alt="" /></span>
      <button type="button" class="interview-actor-react" aria-label="轻触另一个我"></button>
    </figure>
    <figure class="interview-dialogue-actor is-you" data-motion="rest">
      <i class="interview-contact-shadow"></i>
      <span class="interview-person"><img src="${asset(9)}" alt="" /></span>
      <button type="button" class="interview-actor-react" aria-label="轻触现在的我"></button>
    </figure>`
  stage.removeAttribute('aria-hidden')
  const hatch = stage.querySelector<HTMLElement>('.interview-hatch')!
  const cabin = stage.querySelector<HTMLImageElement>('.interview-cabin-person')!
  const panels = Array.from(stage.querySelectorAll<HTMLElement>('.interview-hatch-panel'))
  const projection = stage.querySelector<HTMLElement>('.interview-projection')!
  const actors = {
    you: stage.querySelector<HTMLElement>('.is-you')!,
    other: stage.querySelector<HTMLElement>('.is-other')!,
  }
  const sprites = {
    you: actors.you.querySelector<HTMLImageElement>('img')!,
    other: actors.other.querySelector<HTMLImageElement>('img')!,
  }
  let active = false
  let ready = false
  let elapsed = 0
  let last = 0
  let raf = 0
  let phase: Phase = 'idle'
  let scale = 1
  let imageX = 0
  let size = 94
  let feetY = 790
  let player: Point = { x: 970, y: feetY }
  let other: Point = { x: 760, y: feetY }
  let speaker: Speaker = 'other'
  let thinking = false
  let idleAt = 0
  let idleStep = 0
  const reactionUntil = { you: 0, other: 0 }

  for (let frame = 1; frame <= 12; frame++) { const image = new Image(); image.src = asset(frame) }
  const map = (point: Point) => ({ x: imageX + point.x * scale, y: point.y * scale })
  const place = (el: HTMLElement, point: Point) => {
    el.style.left = `${Math.round(point.x)}px`
    el.style.top = `${Math.round(point.y)}px`
  }
  const frame = (el: HTMLImageElement, n: number) => {
    if (el.dataset.frame !== String(n)) { el.dataset.frame = String(n); el.src = asset(n) }
  }
  function setPhase(next: Phase) {
    if (phase === next) return
    phase = next
    root.dataset.dialoguePhase = phase
    const status = root.querySelector('.interview-arrival-status')
    if (status) status.textContent = next === 'opening' ? '舱门正在打开……'
      : next === 'threshold' || next === 'disembark' ? '沿着舷梯，走向这一次相遇……'
        : next === 'manifest' || next === 'settle' ? '另一个时间里的我，正在回应……' : '站定，等待另一个自己的到来。'
  }
  function layout() {
    if (!active) return
    const w = stage.clientWidth, h = stage.clientHeight
    const mobile = w <= 700
    scale = Math.max(w / ART.width, h / ART.height)
    imageX = mobile ? Math.max(w - ART.width * scale, Math.min(0, w * .77 - 1247 * scale)) : (w - ART.width * scale) / 2
    Object.assign(background.style, { width: `${ART.width * scale}px`, height: `${ART.height * scale}px`, left: `${imageX}px`, top: '0px', transform: 'none', minWidth: '0' })
    size = mobile ? Math.min(76, Math.max(60, w * .18)) : Math.max(58, Math.min(108, w * .063))
    feetY = h * (mobile ? .815 : .839)
    player = { x: w * (mobile ? .72 : .60), y: feetY }
    other = { x: w * (mobile ? .27 : .43), y: feetY }
    root.style.setProperty('--encounter-you-x', `${player.x}px`)
    root.style.setProperty('--encounter-other-x', `${other.x}px`)
    root.style.setProperty('--encounter-bubble-inset', `${Math.min(64, w * .04)}px`)
    root.style.setProperty('--encounter-bubble-bottom', `${feetY - size * .88 - 24}px`)
    root.style.setProperty('--encounter-feet-y', `${feetY}px`)
    stage.style.setProperty('--person-size', `${size}px`)
    const origin = map(HATCH)
    place(hatch, origin)
    Object.assign(hatch.style, { width: `${HATCH.width * scale}px`, height: `${HATCH.height * scale}px` })
    cabin.style.width = `${size * .76}px`
    panels.forEach((panel, i) => {
      panel.style.backgroundSize = `${ART.width * scale}px ${ART.height * scale}px`
      panel.style.backgroundPosition = `${-(HATCH.x + i * HATCH.width / 2) * scale}px ${-HATCH.y * scale}px`
    })
    place(projection, other)
    place(actors.other, other)
    if (ready) place(actors.you, player)
    else paintArrival()
  }
  function paintArrival() {
    const opening = clamp(elapsed / 740)
    hatch.style.setProperty('--hatch-open', String(opening))
    const inside = elapsed >= 480 && elapsed < 1120
    cabin.style.opacity = inside ? '1' : '0'
    cabin.style.transform = `translateX(-50%) scale(${.86 + .14 * clamp((elapsed - 680) / 400)})`
    const walking = elapsed >= 1120 && elapsed < 3600
    actors.you.style.visibility = elapsed < 1120 ? 'hidden' : 'visible'
    const threshold = map({ x: 1247, y: 687 })
    const stairTop = map({ x: 1253, y: 702 })
    const stairEnd = map({ x: 1300, y: 763 })
    const foreground = { x: stairEnd.x - 28 * scale, y: feetY }
    let point = threshold
    if (elapsed < 1390) point = lerp(threshold, stairTop, clamp((elapsed - 1120) / 270))
    else if (elapsed < 1930) point = lerp(stairTop, stairEnd, clamp((elapsed - 1390) / 540))
    else if (elapsed < 2120) point = lerp(stairEnd, foreground, clamp((elapsed - 1930) / 190))
    else point = lerp(foreground, player, clamp((elapsed - 2120) / 1480))
    place(actors.you, point)
    const spriteScale = elapsed < 1930 ? .76 + .24 * clamp((elapsed - 1120) / 810) : 1
    actors.you.style.setProperty('--walk-scale', String(spriteScale))
    actors.you.dataset.facing = elapsed < 1930 ? 'right' : 'left'
    frame(sprites.you, walking ? 7 + Math.floor((elapsed - 1120) / 110) % 6 : 9)
    actors.you.dataset.motion = walking ? 'walk' : 'rest'
    const reveal = clamp((elapsed - 3830) / 1000)
    stage.style.setProperty('--projection-progress', String(reveal))
    if (elapsed < 740) setPhase('opening')
    else if (elapsed < 1120) setPhase('threshold')
    else if (elapsed < 3600) setPhase('disembark')
    else if (elapsed < 3830) setPhase('grounded')
    else if (elapsed < 4830) setPhase('manifest')
    else if (elapsed < 5150) setPhase('settle')
    else finish()
  }
  function react(who: Speaker, motion = 'nod') {
    if (!ready || reduced.matches) return
    actors[who].dataset.motion = motion
    reactionUntil[who] = elapsed + (motion === 'look' ? 1000 : 720)
    if (motion === 'look') frame(sprites[who], 1)
    else if (motion === 'shift') frame(sprites[who], 10)
    else frame(sprites[who], 9)
  }
  function paintIdle() {
    for (const who of ['you', 'other'] as const) {
      if (reactionUntil[who] && elapsed >= reactionUntil[who]) {
        reactionUntil[who] = 0
        actors[who].dataset.motion = 'rest'
        frame(sprites[who], 9)
      }
    }
    if (elapsed >= idleAt) {
      const who = idleStep % 2 ? 'other' : 'you'
      if (!reactionUntil[who]) react(who, ['shift', 'nod', 'look', 'listen'][idleStep % 4])
      idleStep++
      idleAt = elapsed + 3400 + (idleStep % 3) * 850
    }
  }
  function tick(now: number) {
    if (!active) return
    if (!document.hidden) {
      elapsed += Math.min(80, Math.max(0, now - last))
      if (ready) paintIdle()
      else paintArrival()
    }
    last = now
    raf = requestAnimationFrame(tick)
  }
  function finish() {
    if (!active || ready) return
    ready = true
    setPhase('ready')
    hatch.style.setProperty('--hatch-open', '1')
    cabin.style.opacity = '0'
    actors.you.style.visibility = 'visible'
    actors.you.style.setProperty('--walk-scale', '1')
    actors.you.dataset.facing = 'left'
    actors.you.dataset.motion = 'rest'
    stage.style.setProperty('--projection-progress', '1')
    frame(sprites.you, 9)
    place(actors.you, player)
    idleAt = elapsed + 2500
    onReady()
  }
  function start() {
    stop()
    active = true
    ready = false
    elapsed = 0
    idleStep = 0
    last = performance.now()
    layout()
    if (reduced.matches) finish()
    else raf = requestAnimationFrame(tick)
  }
  function stop() {
    active = false
    ready = false
    cancelAnimationFrame(raf)
    setPhase('idle')
    reactionUntil.you = reactionUntil.other = 0
    Object.values(actors).forEach(actor => { actor.dataset.motion = 'rest' })
    background.removeAttribute('style')
  }
  function speaking(who: Speaker, pending = false) {
    const changed = who !== speaker || pending !== thinking
    speaker = who
    thinking = pending
    root.dataset.speaker = who
    root.dataset.thinking = String(pending)
    if (changed) react(who, pending ? 'listen' : 'nod')
  }
  for (const who of ['you', 'other'] as const) {
    const button = actors[who].querySelector<HTMLButtonElement>('button')!
    button.addEventListener('pointerenter', () => react(who, 'listen'))
    button.addEventListener('click', () => react(who, who === 'you' ? 'nod' : 'greet'))
  }
  root.addEventListener('keydown', event => {
    if (!active || ready || event.code !== 'Space' || (event.target as HTMLElement).closest('input,textarea,button')) return
    event.preventDefault()
    finish()
  })
  const observer = new ResizeObserver(layout)
  observer.observe(root.querySelector('.interview-frame')!)
  reduced.addEventListener('change', () => {
    if (!active) return
    if (reduced.matches) { finish(); cancelAnimationFrame(raf) }
    else { last = performance.now(); raf = requestAnimationFrame(tick) }
  })
  return { start, stop, finish, speaking }
}
