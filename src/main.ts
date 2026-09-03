import './style.css'
import { createArchiveScene } from './archive/createArchiveScene'
import { createGardenScene, readArchiveProfile } from './garden/createGardenScene'
import type { ArchiveProfile } from './archive/archiveInterview'
import { projectedDragProgress, resolveMoonRelease } from './game/input/moonDrag'
import { sampleWarpTimeline, type WarpSample } from './game/transition/warpTimeline'
import { createWarpField } from './render/createWarpField'

const STAGE_WIDTH = 1672
const STAGE_HEIGHT = 941
const PIXEL_FPS = 12

const SHORE_MOON = { x: 1148, y: 172, size: 220 }
const SPACE_MOON = {
  x: 836,
  y: 432,
  size: 560,
  cropX: 556,
  cropY: 152,
  cropSize: 560,
}
const DOCKED_MOON = { x: 1372, y: 710, size: 326 }
const DOCK_THRESHOLD = 0.78

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('Missing #app')

app.innerHTML = `
  <main class="opening-scene" aria-label="人生回测：从月下海岸前往宇宙">
    <section class="scene-frame" aria-label="向上滚动，靠近月亮">
      <canvas
        class="scene-canvas"
        width="${STAGE_WIDTH}"
        height="${STAGE_HEIGHT}"
        aria-label="黑白像素海岸。向上滚动时，月亮逐渐放大，海岸退入黑暗，星星开始显现。"
      ></canvas>
      <div class="warp-whiteout" aria-hidden="true"></div>
      <button class="moon-target" type="button" aria-label="观察月亮"></button>
      <div class="life-copy-sequence" aria-hidden="true">
        <svg class="moon-copy-orbit" viewBox="0 0 400 400" focusable="false" aria-hidden="true">
          <defs>
            <path id="moon-copy-arc" d="M 42 224 A 166 166 0 0 1 358 224" />
          </defs>
          <text>
            <textPath href="#moon-copy-arc" startOffset="50%" text-anchor="middle">
              那些没有走过的路 · 仍在时间的另一侧延伸
            </textPath>
          </text>
        </svg>
        <div class="moon-copy-core" aria-hidden="true">人生回测</div>

        <article class="life-copy-pair life-copy-pair--one">
          <div class="life-copy-card life-copy-card--left">
            <span class="life-copy-tag">已发生</span>
            <strong>你走过的人生</strong>
            <small>每一次选择，都留下了现在的你</small>
          </div>
          <div class="life-copy-card life-copy-card--right">
            <span class="life-copy-tag">未发生</span>
            <strong>你没走的人生</strong>
            <small>每一次错过，也留下另一种可能</small>
          </div>
        </article>

        <article class="life-copy-pair life-copy-pair--two">
          <div class="life-copy-card life-copy-card--left">
            <span class="life-copy-tag">你得到的</span>
            <strong>熟悉、关系与确定</strong>
            <small>那些被你留在身边的东西</small>
          </div>
          <div class="life-copy-card life-copy-card--right">
            <span class="life-copy-tag">你错过的</span>
            <strong>远方、机会与另一个自己</strong>
            <small>那些从未真正消失的可能</small>
          </div>
        </article>

        <article class="life-copy-pair life-copy-pair--three">
          <div class="life-copy-card life-copy-card--left">
            <span class="life-copy-tag">回到过去</span>
            <strong>回到选择之前</strong>
            <small>带着今天的记忆</small>
          </div>
          <div class="life-copy-card life-copy-card--right">
            <span class="life-copy-tag">进入平行</span>
            <strong>走向另一种后来</strong>
            <small>看看你最终会成为谁</small>
          </div>
        </article>
      </div>
      <div class="scroll-hint" aria-live="polite">
        <span class="scroll-arrow" aria-hidden="true"></span>
        <span class="scroll-mouse" aria-hidden="true"><i></i></span>
        <span class="scroll-copy">向上滚动，靠近月亮</span>
      </div>
      <div class="drag-hint" aria-live="polite">
        <span class="drag-gesture" aria-hidden="true"><i></i></span>
        <span>按住月球，拖向右下方</span>
      </div>
      <div class="backtest-entry" aria-hidden="true">
        <h1>人生回测</h1>
        <button class="start-backtest" type="button" tabindex="-1">
          <span>开始回测</span><i aria-hidden="true"></i>
        </button>
      </div>
    </section>
  </main>
  <section class="archive-scene" aria-label="时间档案局：走向审查席" aria-hidden="true" data-phase="arrival" data-screens="0">
    <div class="archive-frame">
      <div class="archive-world" aria-hidden="true">
        <img class="archive-background" src="/assets/archive-walk-clean-v1.png" alt="" />
        <i class="archive-checkpoint-light archive-checkpoint-light--age" data-checkpoint="age"></i>
        <i class="archive-checkpoint-light archive-checkpoint-light--gender" data-checkpoint="gender"></i>
        <i class="archive-checkpoint-light archive-checkpoint-light--family" data-checkpoint="family"></i>
        <i class="archive-checkpoint-light archive-checkpoint-light--status" data-checkpoint="status"></i>
        <div class="archive-screen archive-screen--large"><i></i></div>
        <div class="archive-screen archive-screen--upper"><i></i></div>
        <div class="archive-screen archive-screen--middle"><i></i></div>
        <canvas class="archive-character-layer" width="${STAGE_WIDTH}" height="${STAGE_HEIGHT}"></canvas>
        <img class="archive-seated-state" src="/concepts/archive-zoned-seated-memories-v2.png" alt="" />
        <canvas class="archive-memory-layer" width="${STAGE_WIDTH}" height="${STAGE_HEIGHT}"></canvas>
        <div class="archive-vault-rig" aria-hidden="true">
          <img class="archive-vault-portal-state" src="/assets/archive-vault-open-v1.png" alt="" />
          <canvas class="archive-vault-door-3d" width="836" height="471"></canvas>
        </div>
      </div>
      <div class="archive-white-entry" aria-hidden="true"></div>
      <div class="archive-vignette" aria-hidden="true"></div>
      <div class="archive-location" aria-hidden="true"><span>月面档案局</span><small>CHRONOLOGY ARCHIVE · 00</small></div>
      <div class="archive-control-hint" aria-live="polite"><kbd>W / ↑</kbd><span>向前</span></div>
      <button class="archive-forward-control" type="button" tabindex="-1"><span>按住向前</span></button>
      <div class="archive-distance" aria-hidden="true"><i></i><span>审查席</span></div>
      <aside class="archive-interview" role="dialog" aria-modal="true" aria-labelledby="archive-question" aria-hidden="true">
        <header>
          <span>零点小姐 · 登记讯号</span>
          <b class="archive-interview-count">01 / 05</b>
        </header>
        <small class="archive-interview-checkpoint">左侧 · 第一盏灯</small>
        <p id="archive-question">先告诉我，你现在几岁？</p>
        <span class="archive-interview-note">这会决定回测从哪一段人生开始比对。</span>
        <form class="archive-interview-form" novalidate>
          <div class="archive-interview-options" aria-label="快捷回答"></div>
          <label>
            <span class="sr-only">回答零点小姐的问题</span>
            <input class="archive-interview-input" type="text" maxlength="80" autocomplete="off" />
          </label>
          <button type="submit"><span>记录</span><kbd>ENTER</kbd></button>
          <output class="archive-interview-error" aria-live="polite"></output>
        </form>
        <nav class="archive-interview-actions" aria-label="修改本次登记">
          <button class="archive-interview-previous" type="button"><span aria-hidden="true">←</span> 上一问</button>
          <button class="archive-interview-reset" type="button">重置到入口</button>
        </nav>
      </aside>
      <article class="archive-audit-copy" aria-live="polite">
        <small class="archive-audit-speaker">零点小姐 · 平行人生审查</small>
        <p class="archive-audit-message">晚上好。先看看那些没有发生的人生。</p>
        <span class="archive-audit-note">模拟影像并非预言 · 尚未接入真实知乎档案</span>
      </article>
    </div>
  </section>
`

const scene = document.querySelector<HTMLElement>('.opening-scene')!
const canvas = document.querySelector<HTMLCanvasElement>('.scene-canvas')!
const frame = document.querySelector<HTMLElement>('.scene-frame')!
const moonTarget = document.querySelector<HTMLButtonElement>('.moon-target')!
const lifeCopySequence = document.querySelector<HTMLElement>('.life-copy-sequence')!
const backtestEntry = document.querySelector<HTMLElement>('.backtest-entry')!
const startBacktest = document.querySelector<HTMLButtonElement>('.start-backtest')!
const archiveSceneElement = document.querySelector<HTMLElement>('.archive-scene')!
const archiveScene = createArchiveScene(archiveSceneElement)
const gardenScene = createGardenScene(app)
const gardenWhiteout = document.createElement('div')
gardenWhiteout.className = 'garden-whiteout'
gardenWhiteout.hidden = true
gardenWhiteout.setAttribute('aria-hidden', 'true')
app.append(gardenWhiteout)
let gardenTransitionStarted = false
let pageLeaving = false
const displayCtx = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D
if (!displayCtx) throw new Error('Canvas 2D is unavailable')
displayCtx.imageSmoothingEnabled = false

const ambientCanvas = document.createElement('canvas')
ambientCanvas.width = STAGE_WIDTH
ambientCanvas.height = STAGE_HEIGHT
const ambientCtx = ambientCanvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D
if (!ambientCtx) throw new Error('Ambient canvas is unavailable')
ambientCtx.imageSmoothingEnabled = false

const starCanvas = document.createElement('canvas')
starCanvas.width = STAGE_WIDTH
starCanvas.height = STAGE_HEIGHT
const starCtx = starCanvas.getContext('2d') as CanvasRenderingContext2D
if (!starCtx) throw new Error('Star canvas is unavailable')
starCtx.imageSmoothingEnabled = false

const galaxyCanvas = document.createElement('canvas')
galaxyCanvas.width = STAGE_WIDTH
galaxyCanvas.height = STAGE_HEIGHT
const galaxyCtx = galaxyCanvas.getContext('2d') as CanvasRenderingContext2D
if (!galaxyCtx) throw new Error('Galaxy canvas is unavailable')
galaxyCtx.imageSmoothingEnabled = false

const moonSpriteCanvas = document.createElement('canvas')
moonSpriteCanvas.width = SPACE_MOON.cropSize
moonSpriteCanvas.height = SPACE_MOON.cropSize
const moonSpriteCtx = moonSpriteCanvas.getContext('2d') as CanvasRenderingContext2D
if (!moonSpriteCtx) throw new Error('Moon sprite canvas is unavailable')
moonSpriteCtx.imageSmoothingEnabled = false

const warpField = createWarpField(STAGE_WIDTH, STAGE_HEIGHT)
const moonDissolveMasks: HTMLCanvasElement[] = []

function makePolygon(points: Array<[number, number]>) {
  const path = new Path2D()
  points.forEach(([x, y], index) => index === 0 ? path.moveTo(x, y) : path.lineTo(x, y))
  path.closePath()
  return path
}

const cloudLeftMask = makePolygon([
  [0, 82], [340, 76], [780, 185], [835, 284], [610, 321], [270, 284], [0, 242],
])
const cloudRightMask = makePolygon([
  [1230, 128], [1672, 84], [1672, 390], [1420, 361], [1230, 292],
])
const boatMask = makePolygon([
  [912, 473], [935, 482], [944, 482], [944, 470], [965, 470], [965, 482],
  [992, 481], [1002, 491], [993, 505], [969, 511], [938, 508], [919, 500],
])
const boyMask = makePolygon([
  [686, 617], [701, 617], [713, 628], [716, 646], [710, 662], [718, 675],
  [720, 713], [714, 726], [712, 745], [719, 753], [715, 760], [699, 760],
  [694, 748], [692, 760], [675, 760], [670, 754], [676, 744], [676, 725],
  [669, 716], [669, 678], [676, 663], [676, 646], [680, 630],
])
const moonMask = makePolygon([
  [1044, 58], [1260, 58], [1260, 280], [1044, 280],
])

const master = new Image()
master.decoding = 'async'
const space = new Image()
space.decoding = 'async'

let animationFrame = 0
let startedAt = 0
let previousTick = 0
let lastPixelFrame = -1
let moonObserved = false
let assetsLoaded = 0
let ready = false
let targetProgress = 0
let displayProgress = 0
let copySequencePlaying = false
let copySequencePlayed = false
let copySequenceTimer = 0
let dragEnabled = false
let moonDragging = false
let moonDocked = false
let portalReady = false
let dragTarget = 0
let dragDisplay = 0
let dragStartX = 0
let dragStartY = 0
let dragStartProgress = 0
let activePointerId: number | null = null
let audioContext: AudioContext | null = null
let warpActive = false
let warpComplete = false
let warpStartedAt = 0
let warpSample: WarpSample = sampleWarpTimeline(0)
let hiddenAt = 0
let openingRuntimeActive = true
let archiveEntryTimer = 0
let warpAudio: {
  drone: OscillatorNode
  overtone: OscillatorNode
  noise: AudioBufferSourceNode
  gain: GainNode
  noiseGain: GainNode
  filter: BiquadFilterNode
} | null = null

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))
const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount
const smoothstep = (start: number, end: number, value: number) => {
  const amount = clamp((value - start) / (end - start))
  return amount * amount * (3 - 2 * amount)
}

function enterArchive(entry: 'warp' | 'debug') {
  if (!openingRuntimeActive) return

  openingRuntimeActive = false
  cancelAnimationFrame(animationFrame)
  scene.setAttribute('aria-hidden', 'true')
  scene.classList.add('is-handing-off')
  archiveScene.show({ entry })

  if (entry === 'debug') {
    scene.style.display = 'none'
    return
  }

  // Keep the completed white point behind the archive's white entry layer
  // until the corridor has fully materialised. This prevents a black frame
  // between the space crossing and the chronology archive.
  archiveEntryTimer = window.setTimeout(() => {
    archiveEntryTimer = 0
    scene.style.display = 'none'
  }, 1320)
}

function showGarden(profile?: ArchiveProfile) {
  openingRuntimeActive = false
  cancelAnimationFrame(animationFrame)
  scene.style.display = 'none'
  scene.setAttribute('aria-hidden', 'true')
  archiveScene.hide()
  gardenScene.show(profile)
  const url = new URL(window.location.href)
  url.searchParams.delete('debug')
  url.searchParams.set('scene', 'garden')
  history.replaceState(null, '', url)
}

archiveSceneElement.addEventListener('life-backtest:archive-door-arrived', async event => {
  if (gardenTransitionStarted) return
  gardenTransitionStarted = true
  const profile = (event as CustomEvent<{ profile: ArchiveProfile }>).detail.profile
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const delay = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms))
  // Freeze the one live walker on the threshold; retain the last archive frame under the fade.
  archiveScene.pause()
  archiveSceneElement.inert = true
  gardenWhiteout.hidden = false
  gardenWhiteout.dataset.phase = 'entering'
  void gardenWhiteout.offsetWidth
  gardenWhiteout.classList.add('is-white')
  await delay(reduced ? 220 : 950)
  if (pageLeaving) return
  gardenWhiteout.dataset.phase = 'white'
  // Decode the next scene before revealing it, but never trap the player behind a failed asset.
  await Promise.race([gardenScene.ready, delay(8000)])
  if (pageLeaving) return
  gardenScene.element.inert = true
  showGarden(profile)
  await delay(reduced ? 120 : 550)
  if (pageLeaving) return
  gardenWhiteout.dataset.phase = 'revealing'
  gardenWhiteout.classList.add('is-revealing')
  await delay(reduced ? 270 : 1150)
  if (pageLeaving) return
  gardenWhiteout.hidden = true
  gardenWhiteout.dataset.phase = 'complete'
  gardenScene.element.inert = false
  gardenScene.element.focus({ preventScroll: true })
})

function resetCopySequence() {
  if (copySequenceTimer) window.clearTimeout(copySequenceTimer)
  copySequenceTimer = 0
  copySequencePlaying = false
  copySequencePlayed = false
  dragEnabled = false
  moonDragging = false
  moonDocked = false
  portalReady = false
  warpActive = false
  warpComplete = false
  warpStartedAt = 0
  warpSample = sampleWarpTimeline(0)
  dragTarget = 0
  dragDisplay = 0
  lifeCopySequence.setAttribute('aria-hidden', 'true')
  moonTarget.setAttribute('aria-label', '观察月亮')
  moonTarget.removeAttribute('aria-hidden')
  backtestEntry.setAttribute('aria-hidden', 'true')
  startBacktest.disabled = false
  startBacktest.tabIndex = -1
  scene.classList.remove(
    'is-copy-playing',
    'is-copy-complete',
    'is-drag-enabled',
    'is-moon-dragging',
    'is-moon-returning',
    'is-moon-docked',
    'is-portal-ready',
    'is-warping',
    'is-warp-complete',
    'is-start-selected',
  )
}

function startCopySequence() {
  if (copySequencePlaying || copySequencePlayed) return

  copySequencePlaying = true
  copySequencePlayed = true
  lifeCopySequence.setAttribute('aria-hidden', 'false')
  scene.classList.remove('is-copy-complete')
  scene.classList.add('is-copy-playing')

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  copySequenceTimer = window.setTimeout(() => {
    copySequenceTimer = 0
    copySequencePlaying = false
    dragEnabled = true
    moonTarget.setAttribute('aria-label', '按住月球，拖向右下方')
    scene.classList.remove('is-copy-playing')
    scene.classList.add('is-copy-complete', 'is-drag-enabled')
  }, reducedMotion ? 1800 : 5000)
}

function syncCopySequence(progress: number) {
  if (progress >= 0.985) startCopySequence()
  else if (progress < 0.9 && (copySequencePlaying || copySequencePlayed)) resetCopySequence()
}

function cameraDistanceCurve(progress: number) {
  if (progress < 0.25) return lerp(0, 0.1, smoothstep(0, 0.25, progress))
  if (progress < 0.7) return lerp(0.1, 0.58, smoothstep(0.25, 0.7, progress))
  return lerp(0.58, 1, smoothstep(0.7, 1, progress))
}

function seededNoise(x: number, y: number, seed = 0) {
  const value = Math.sin(x * 127.1 + y * 311.7 + seed * 73.9) * 43758.5453
  return value - Math.floor(value)
}

function prepareGalaxyLayer() {
  const pixel = 2
  const bayer = [
    0, 8, 2, 10,
    12, 4, 14, 6,
    3, 11, 1, 9,
    15, 7, 13, 5,
  ]

  galaxyCtx.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
  for (let y = 0; y < STAGE_HEIGHT; y += pixel) {
    for (let x = 0; x < STAGE_WIDTH; x += pixel) {
      const t = x / STAGE_WIDTH
      const centerY = 850 - x * 0.49 + Math.sin(t * Math.PI * 2.2) * 22
      const centerWeight = Math.sin(Math.PI * clamp(t, 0.02, 0.98))
      const width = 34 + centerWeight * 76
      const distance = Math.abs(y - centerY)
      if (distance > width * 1.72) continue

      const core = Math.max(0, 1 - distance / width)
      const haze = Math.max(0, 1 - distance / (width * 1.72)) * 0.34
      const knots = seededNoise(Math.floor(x / 18), Math.floor(y / 14), 29)
      const dust = seededNoise(Math.floor(x / 5), Math.floor(y / 5), 71)
      let intensity = (core * 0.7 + haze) * (0.48 + knots * 0.54) + dust * 0.12
      intensity *= 0.32 + centerWeight * 0.82

      const threshold = (bayer[((y / pixel) & 3) * 4 + ((x / pixel) & 3)] + 0.5) / 16
      if (intensity < threshold * 0.92) continue

      const level = intensity > 0.86 ? 214 : intensity > 0.62 ? 154 : intensity > 0.4 ? 96 : 52
      galaxyCtx.fillStyle = `rgb(${level}, ${level}, ${level})`
      galaxyCtx.fillRect(x, y, pixel, pixel)
    }
  }

  // A few irregular bright knots keep the band astronomical rather than
  // reading as a smooth decorative stripe.
  for (let index = 0; index < 230; index += 1) {
    const x = Math.floor(seededNoise(index, 1, 91) * STAGE_WIDTH / 2) * 2
    const centerY = 850 - x * 0.49 + Math.sin((x / STAGE_WIDTH) * Math.PI * 2.2) * 22
    const y = Math.round(centerY + (seededNoise(index, 2, 43) - 0.5) * 250)
    const brightness = seededNoise(index, 3, 17) > 0.78 ? '#d8d8d4' : '#858582'
    galaxyCtx.fillStyle = brightness
    galaxyCtx.fillRect(x, y, index % 11 === 0 ? 4 : 2, 2)
  }
}

function playCue(frequency: number, duration: number, volume = 0.025) {
  audioContext ??= new AudioContext()
  if (audioContext.state === 'suspended') void audioContext.resume()
  const oscillator = audioContext.createOscillator()
  const gain = audioContext.createGain()
  const now = audioContext.currentTime
  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(frequency, now)
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(28, frequency * 0.72), now + duration)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.025)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
  oscillator.connect(gain).connect(audioContext.destination)
  oscillator.start(now)
  oscillator.stop(now + duration + 0.02)
}

function prepareMoonDissolveMasks() {
  if (moonDissolveMasks.length) return
  const size = 128
  const steps = 16

  for (let step = 0; step < steps; step += 1) {
    const mask = document.createElement('canvas')
    mask.width = size
    mask.height = size
    const ctx = mask.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    const threshold = step / (steps - 1)

    for (let y = 0; y < size; y += 4) {
      for (let x = 0; x < size; x += 4) {
        const distance = Math.hypot(x + 2 - size / 2, y + 2 - size / 2)
        if (distance > size * 0.49) continue
        const edgeBias = Math.max(0, (distance / (size * 0.49) - 0.55) * 0.34)
        const noise = seededNoise(x / 4, y / 4, 118)
        if (noise > threshold + edgeBias) continue
        ctx.fillStyle = '#000'
        ctx.fillRect(x, y, 4, 4)
      }
    }

    moonDissolveMasks.push(mask)
  }
}

function prepareMoonSprite() {
  const size = SPACE_MOON.cropSize
  const center = size / 2
  moonSpriteCtx.clearRect(0, 0, size, size)
  moonSpriteCtx.drawImage(
    space,
    SPACE_MOON.cropX,
    SPACE_MOON.cropY,
    size,
    size,
    0,
    0,
    size,
    size,
  )

  const image = moonSpriteCtx.getImageData(0, 0, size, size)
  const { data } = image

  for (let index = 0; index < data.length; index += 4) {
    const pixel = index / 4
    const x = pixel % size
    const y = Math.floor(pixel / size)
    const distance = Math.hypot(x - center, y - center) / center
    const light = Math.max(data[index], data[index + 1], data[index + 2])
    let alpha = 0

    if (distance <= 0.59) {
      // The physical lunar body stays opaque, so the galaxy never cuts
      // through the craters as it did with screen-only compositing.
      alpha = 255
    } else if (distance <= 0.7) {
      const radialBody = clamp((0.7 - distance) / 0.11)
      const authoredEdge = clamp((light - 5) / 34)
      alpha = Math.max(radialBody, authoredEdge) * 255
    } else if (distance <= 0.84) {
      // Only bright pixels from the source survive outside the body. This
      // preserves its native silver halo while leaving the Milky Way intact.
      const halo = clamp((light - 4) / 82)
      const radialFade = clamp((0.84 - distance) / 0.14)
      alpha = halo * radialFade * 178
    }

    // Quantized alpha keeps the edge in the authored pixel register.
    data[index + 3] = Math.round(clamp(alpha, 0, 255) / 17) * 17
  }

  moonSpriteCtx.putImageData(image, 0, 0)
}

function startWarpAudio() {
  audioContext ??= new AudioContext()
  if (audioContext.state === 'suspended') void audioContext.resume()
  if (warpAudio) return

  const drone = audioContext.createOscillator()
  const overtone = audioContext.createOscillator()
  const noise = audioContext.createBufferSource()
  const gain = audioContext.createGain()
  const noiseGain = audioContext.createGain()
  const filter = audioContext.createBiquadFilter()
  const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 2, audioContext.sampleRate)
  const samples = buffer.getChannelData(0)
  let seed = 8126
  for (let index = 0; index < samples.length; index += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0
    samples[index] = ((seed / 4294967296) * 2 - 1) * 0.7
  }

  drone.type = 'sine'
  drone.frequency.value = 34
  overtone.type = 'triangle'
  overtone.frequency.value = 68
  noise.buffer = buffer
  noise.loop = true
  filter.type = 'lowpass'
  filter.frequency.value = 120
  filter.Q.value = 2.2
  gain.gain.value = 0.0001
  noiseGain.gain.value = 0.0001

  drone.connect(filter)
  overtone.connect(filter)
  noise.connect(noiseGain).connect(filter)
  filter.connect(gain).connect(audioContext.destination)
  drone.start()
  overtone.start()
  noise.start()
  warpAudio = { drone, overtone, noise, gain, noiseGain, filter }
}

function updateWarpAudio(sample: WarpSample) {
  if (!audioContext || !warpAudio) return
  const now = audioContext.currentTime
  const audible = 1 - sample.arrivalProgress
  const intensity = Math.max(0.08, sample.velocity)
  warpAudio.gain.gain.setTargetAtTime((0.008 + intensity * 0.034) * audible, now, 0.08)
  warpAudio.noiseGain.gain.setTargetAtTime((0.004 + sample.velocity * 0.026) * audible, now, 0.1)
  warpAudio.drone.frequency.setTargetAtTime(34 + sample.velocity * 38, now, 0.08)
  warpAudio.overtone.frequency.setTargetAtTime(68 - sample.crossingProgress * 24, now, 0.1)
  warpAudio.filter.frequency.setTargetAtTime(120 + sample.velocity * 620, now, 0.1)
}

function finishWarpAudio() {
  if (!audioContext || !warpAudio) return
  const nodes = warpAudio
  const now = audioContext.currentTime
  nodes.gain.gain.setTargetAtTime(0.0001, now, 0.08)
  window.setTimeout(() => {
    nodes.drone.stop()
    nodes.overtone.stop()
    nodes.noise.stop()
  }, 520)
  warpAudio = null
}

function drawMoonDissolve(x: number, y: number, size: number, progress: number) {
  if (progress <= 0 || !moonDissolveMasks.length) return
  const index = Math.min(
    moonDissolveMasks.length - 1,
    Math.floor(progress * moonDissolveMasks.length),
  )
  displayCtx.save()
  displayCtx.globalCompositeOperation = 'source-over'
  displayCtx.globalAlpha = 1
  displayCtx.drawImage(moonDissolveMasks[index], x - size / 2, y - size / 2, size, size)
  displayCtx.restore()
}

function drawArrivalPoint(progress: number) {
  if (progress <= 0) return
  const centerX = STAGE_WIDTH / 2
  const centerY = STAGE_HEIGHT * 0.459
  const stepped = Math.round(progress * 10) / 10

  displayCtx.save()
  displayCtx.globalCompositeOperation = 'screen'
  displayCtx.globalAlpha = stepped

  const branchOffsets = [-116, 0, 132]
  branchOffsets.forEach((offset, branch) => {
    const segments = 13
    for (let index = 0; index < segments; index += 1) {
      const t = index / (segments - 1)
      const converge = t * t
      const x = lerp(centerX + offset, centerX, converge)
      const y = lerp(centerY + (branch - 1) * 62, centerY, t)
      displayCtx.globalAlpha = stepped * (0.08 + t * 0.28)
      displayCtx.fillStyle = branch === 1 ? '#a9a9a5' : '#595957'
      displayCtx.fillRect(Math.round(x / 2) * 2, Math.round(y / 2) * 2, 2, 2)
    }
  })

  displayCtx.globalAlpha = stepped
  displayCtx.fillStyle = '#ecece8'
  const pointSize = stepped > 0.72 ? 6 : 4
  displayCtx.fillRect(
    Math.round(centerX - pointSize / 2),
    Math.round(centerY - pointSize / 2),
    pointSize,
    pointSize,
  )
  displayCtx.restore()
}

function drawShiftedRegion(path: Path2D, shiftX: number, shiftY = 0, alpha = 1) {
  ambientCtx.save()
  ambientCtx.clip(path)
  ambientCtx.globalAlpha = alpha
  ambientCtx.drawImage(master, shiftX, shiftY, STAGE_WIDTH, STAGE_HEIGHT)
  ambientCtx.restore()
}

function eraseObject(path: Path2D, sourceOffsetX: number) {
  ambientCtx.save()
  ambientCtx.clip(path)
  ambientCtx.drawImage(master, -sourceOffsetX, 0, STAGE_WIDTH, STAGE_HEIGHT)
  ambientCtx.restore()
}

function drawMovingObject(
  path: Path2D,
  pivotX: number,
  pivotY: number,
  offsetX: number,
  offsetY: number,
  rotation = 0,
) {
  ambientCtx.save()
  ambientCtx.translate(pivotX + offsetX, pivotY + offsetY)
  ambientCtx.rotate(rotation)
  ambientCtx.translate(-pivotX, -pivotY)
  ambientCtx.clip(path)
  ambientCtx.drawImage(master, 0, 0)
  ambientCtx.restore()
}

function drawWaveBand(y: number, height: number, shiftX: number, startX = 0, endX = STAGE_WIDTH) {
  ambientCtx.save()
  ambientCtx.beginPath()
  ambientCtx.rect(startX, y, endX - startX, height)
  ambientCtx.clip()
  ambientCtx.drawImage(master, shiftX, 0, STAGE_WIDTH, STAGE_HEIGHT)
  ambientCtx.restore()
}

function renderAmbient(timeSeconds: number) {
  const stepped = Math.floor(timeSeconds * PIXEL_FPS) / PIXEL_FPS
  ambientCtx.globalAlpha = 1
  ambientCtx.globalCompositeOperation = 'source-over'
  ambientCtx.drawImage(master, 0, 0)

  const cloudLeftShift = Math.round(Math.sin(stepped * 0.12) * 2)
  const cloudRightShift = Math.round(Math.sin(stepped * 0.09) * -2)
  drawShiftedRegion(cloudLeftMask, cloudLeftShift)
  drawShiftedRegion(cloudRightMask, cloudRightShift)

  drawWaveBand(469, 35, Math.round(Math.sin(stepped * 0.62) * 1), 350)
  drawWaveBand(504, 46, Math.round(Math.sin(stepped * 0.73) * -2), 380)
  drawWaveBand(550, 52, Math.round(Math.sin(stepped * 0.86) * 2), 410, 1560)
  drawWaveBand(602, 53, Math.round(Math.sin(stepped * 0.98) * -2), 450, 1450)

  ambientCtx.save()
  ambientCtx.globalCompositeOperation = 'screen'
  ambientCtx.globalAlpha = Math.abs(Math.sin(stepped * 1.7)) * 0.055
  ambientCtx.beginPath()
  ambientCtx.moveTo(1030, 456)
  ambientCtx.lineTo(1252, 456)
  ambientCtx.lineTo(1310, 724)
  ambientCtx.lineTo(960, 724)
  ambientCtx.closePath()
  ambientCtx.clip()
  ambientCtx.drawImage(master, Math.round(Math.sin(stepped * 1.23) * 2), 0)
  ambientCtx.restore()

  ambientCtx.save()
  ambientCtx.globalCompositeOperation = 'screen'
  ambientCtx.globalAlpha = moonObserved ? 0.05 : Math.abs(Math.sin(stepped * 0.72)) * 0.025
  ambientCtx.clip(moonMask)
  ambientCtx.drawImage(master, 0, 0)
  ambientCtx.restore()

  eraseObject(boatMask, 116)
  const boatX = Math.round(Math.sin(stepped * 0.31) * 1)
  const boatY = Math.round(Math.sin(stepped * 1.05) * 2)
  const boatRotation = Math.sin(stepped * 0.77) * 0.0035
  drawMovingObject(boatMask, 958, 501, boatX, boatY, boatRotation)

  ambientCtx.save()
  ambientCtx.clip(boyMask)
  ambientCtx.drawImage(master, 0, 0)
  ambientCtx.restore()
}

function prepareSpaceLayers() {
  starCtx.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
  starCtx.drawImage(space, 0, 0, STAGE_WIDTH, STAGE_HEIGHT)
  const image = starCtx.getImageData(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
  const { data } = image

  for (let index = 0; index < data.length; index += 4) {
    const pixel = index / 4
    const x = pixel % STAGE_WIDTH
    const y = Math.floor(pixel / STAGE_WIDTH)
    const distance = Math.hypot(x - SPACE_MOON.x, y - SPACE_MOON.y)
    const brightness = Math.max(data[index], data[index + 1], data[index + 2])

    if (distance < 292 || brightness < 7) data[index + 3] = 0
  }

  starCtx.putImageData(image, 0, 0)

  // The source frame contains the centered moon. Re-seed the stars hidden
  // behind it so moving the moon never leaves a circular cut-out in space.
  for (let index = 0; index < 72; index += 1) {
    const angle = seededNoise(index, 4, 12) * Math.PI * 2
    const radius = Math.sqrt(seededNoise(index, 8, 38)) * 282
    const x = Math.round((SPACE_MOON.x + Math.cos(angle) * radius) / 2) * 2
    const y = Math.round((SPACE_MOON.y + Math.sin(angle) * radius) / 2) * 2
    const light = seededNoise(index, 9, 66) > 0.82 ? '#d8d8d4' : '#777774'
    starCtx.fillStyle = light
    starCtx.fillRect(x, y, index % 19 === 0 ? 4 : 2, 2)
  }
}

function composeScene(timeSeconds: number) {
  const cameraProgress = cameraDistanceCurve(displayProgress)
  const approachMoonX = lerp(SHORE_MOON.x, SPACE_MOON.x, cameraProgress)
  const approachMoonY = lerp(SHORE_MOON.y, SPACE_MOON.y, cameraProgress)
  const approachMoonSize = lerp(SHORE_MOON.size, SPACE_MOON.size, cameraProgress)
  const activeWarp = warpActive ? warpSample : null
  const dockCurve = smoothstep(0, 1, dragDisplay) * (1 - (activeWarp?.returnProgress ?? 0))
  const crossing = activeWarp?.crossingProgress ?? 0
  const moonWarpScale = 1 + crossing * crossing * 1.52
  const moonJitter = activeWarp && activeWarp.velocity > 0.88
    ? Math.round(Math.sin(activeWarp.elapsed * 31) * 1.2)
    : 0
  const moonX = lerp(approachMoonX, DOCKED_MOON.x, dockCurve) + moonJitter
  const moonY = lerp(approachMoonY, DOCKED_MOON.y, dockCurve)
  const moonSize = lerp(approachMoonSize, DOCKED_MOON.size, dockCurve) * moonWarpScale
  const shoreScale = moonSize / SHORE_MOON.size
  const shoreAlpha = 1 - smoothstep(0.4, 0.88, displayProgress)
  const starProgress = smoothstep(0.44, 0.9, displayProgress)
  const starScale = lerp(0.58, 1, starProgress)
  const moonOverlayAlpha = smoothstep(0.32, 0.8, displayProgress) * (1 - smoothstep(0.76, 1, crossing))
  const galaxyReveal = smoothstep(0.03, 0.94, dragDisplay)
  const galaxyWarpScale = activeWarp ? 1 + activeWarp.travelProgress * 2.25 : 1
  const galaxyAlpha = galaxyReveal * (1 - crossing * 0.9)

  displayCtx.globalAlpha = 1
  displayCtx.globalCompositeOperation = 'source-over'
  displayCtx.fillStyle = '#000'
  displayCtx.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)

  if (shoreAlpha > 0) {
    displayCtx.save()
    displayCtx.globalAlpha = shoreAlpha
    displayCtx.translate(moonX, moonY)
    displayCtx.scale(shoreScale, shoreScale)
    displayCtx.translate(-SHORE_MOON.x, -SHORE_MOON.y)
    displayCtx.drawImage(ambientCanvas, 0, 0)
    displayCtx.restore()
  }

  if (galaxyAlpha > 0) {
    const galaxyStep = Math.round(galaxyAlpha * 18) / 18
    displayCtx.save()
    displayCtx.globalCompositeOperation = 'screen'
    displayCtx.globalAlpha = galaxyStep * 0.9
    displayCtx.translate(STAGE_WIDTH / 2, STAGE_HEIGHT * 0.459)
    displayCtx.scale(galaxyWarpScale, galaxyWarpScale)
    displayCtx.rotate((activeWarp?.splitPulse ?? 0) * -0.012)
    displayCtx.translate(-STAGE_WIDTH / 2, -STAGE_HEIGHT * 0.459)
    displayCtx.drawImage(galaxyCanvas, 0, 0)
    displayCtx.restore()

    if (activeWarp && activeWarp.splitPulse > 0.04) {
      displayCtx.save()
      displayCtx.globalCompositeOperation = 'screen'
      displayCtx.globalAlpha = galaxyStep * activeWarp.splitPulse * 0.12
      displayCtx.translate(STAGE_WIDTH / 2 - 16, STAGE_HEIGHT * 0.459 + 8)
      displayCtx.scale(galaxyWarpScale * 1.025, galaxyWarpScale * 0.98)
      displayCtx.translate(-STAGE_WIDTH / 2, -STAGE_HEIGHT * 0.459)
      displayCtx.drawImage(galaxyCanvas, 0, 0)
      displayCtx.restore()
    }
  }

  if (starProgress > 0) {
    const twinkle = 0.94 + Math.sin(Math.floor(timeSeconds * PIXEL_FPS) * 0.21) * 0.06
    displayCtx.save()
    displayCtx.globalCompositeOperation = 'screen'
    displayCtx.globalAlpha = starProgress * twinkle * (1 - crossing * 0.92)
    displayCtx.translate(approachMoonX, approachMoonY)
    displayCtx.scale(starScale, starScale)
    displayCtx.translate(-SPACE_MOON.x, -SPACE_MOON.y)
    displayCtx.drawImage(starCanvas, 0, 0)
    displayCtx.restore()
  }

  if (activeWarp) warpField.draw(displayCtx, activeWarp, 'back')

  if (moonOverlayAlpha > 0) {
    if (activeWarp && activeWarp.splitPulse > 0.08) {
      const echoOffset = Math.round(6 + activeWarp.splitPulse * 15)
      displayCtx.save()
      displayCtx.globalCompositeOperation = 'screen'
      displayCtx.globalAlpha = activeWarp.splitPulse * 0.11
      displayCtx.drawImage(
        moonSpriteCanvas,
        moonX - moonSize / 2 - echoOffset,
        moonY - moonSize / 2 + 2,
        moonSize,
        moonSize,
      )
      displayCtx.globalAlpha = activeWarp.splitPulse * 0.075
      displayCtx.drawImage(
        moonSpriteCanvas,
        moonX - moonSize / 2 + echoOffset,
        moonY - moonSize / 2 - 2,
        moonSize,
        moonSize,
      )
      displayCtx.restore()
    }

    displayCtx.save()
    displayCtx.globalCompositeOperation = 'source-over'
    displayCtx.globalAlpha = moonOverlayAlpha
    displayCtx.drawImage(
      moonSpriteCanvas,
      moonX - moonSize / 2,
      moonY - moonSize / 2,
      moonSize,
      moonSize,
    )
    displayCtx.restore()

    if (activeWarp) drawMoonDissolve(moonX, moonY, moonSize, crossing)
  }

  if (activeWarp) {
    warpField.draw(displayCtx, activeWarp, 'front')
    drawArrivalPoint(activeWarp.arrivalProgress)
  }

  scene.style.setProperty('--rewind-progress', displayProgress.toFixed(4))
  scene.style.setProperty('--moon-drag-progress', dragDisplay.toFixed(4))
  scene.style.setProperty('--warp-progress', (activeWarp?.travelProgress ?? 0).toFixed(4))
  scene.style.setProperty('--arrival-progress', (activeWarp?.arrivalProgress ?? 0).toFixed(4))
  scene.classList.toggle('has-progress', targetProgress > 0.006 || displayProgress > 0.006)
  scene.dataset.transition = activeWarp
    ? `warp-${activeWarp.phase}`
    : displayProgress < 0.02
      ? 'shore'
      : displayProgress > 0.98
        ? 'space'
        : 'approach'

  syncCopySequence(displayProgress)

  if (!warpActive) {
    moonTarget.style.left = `${((moonX - moonSize / 2) / STAGE_WIDTH) * 100}%`
    moonTarget.style.top = `${((moonY - moonSize / 2) / STAGE_HEIGHT) * 100}%`
    moonTarget.style.width = `${(moonSize / STAGE_WIDTH) * 100}%`
  }
}

function tick(now: number) {
  if (!startedAt) startedAt = now
  const deltaSeconds = previousTick ? Math.min((now - previousTick) / 1000, 0.05) : 0
  previousTick = now
  const timeSeconds = (now - startedAt) / 1000
  const pixelFrame = Math.floor(timeSeconds * PIXEL_FPS)

  if (pixelFrame !== lastPixelFrame) {
    lastPixelFrame = pixelFrame
    renderAmbient(timeSeconds)
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    displayProgress = targetProgress
    dragDisplay = dragTarget
  } else {
    const follow = 1 - Math.exp(-deltaSeconds * 9)
    displayProgress = lerp(displayProgress, targetProgress, follow)
    if (Math.abs(targetProgress - displayProgress) < 0.0002) displayProgress = targetProgress

    const dragFollow = 1 - Math.exp(-deltaSeconds * (moonDragging ? 18 : 8.5))
    dragDisplay = lerp(dragDisplay, dragTarget, dragFollow)
    if (Math.abs(dragTarget - dragDisplay) < 0.0005) dragDisplay = dragTarget
  }

  if (!moonDragging && !moonDocked && dragTarget === 0 && dragDisplay < 0.002) {
    dragDisplay = 0
    scene.classList.remove('is-moon-returning')
  }

  if (moonDocked && !portalReady && dragDisplay > 0.992) {
    portalReady = true
    backtestEntry.setAttribute('aria-hidden', 'false')
    startBacktest.tabIndex = 0
    scene.classList.add('is-portal-ready')
    playCue(92, 0.72, 0.03)
  }

  if (warpActive) {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const elapsed = Math.max(0, (now - warpStartedAt) / 1000) * (reducedMotion ? 4.5 : 1)
    warpSample = sampleWarpTimeline(elapsed)
    updateWarpAudio(warpSample)

    if (warpSample.complete && !warpComplete) {
      warpComplete = true
      scene.classList.add('is-warp-complete')
      finishWarpAudio()
      window.dispatchEvent(new CustomEvent('life-backtest:warp-complete', {
        detail: { destination: 'lunar-chronology-archive' },
      }))
      enterArchive('warp')
    }
  }

  composeScene(timeSeconds)
  if (openingRuntimeActive) animationFrame = requestAnimationFrame(tick)
}

function markAssetLoaded() {
  assetsLoaded += 1
  if (assetsLoaded !== 2) return

  prepareSpaceLayers()
  prepareGalaxyLayer()
  prepareMoonSprite()
  prepareMoonDissolveMasks()
  renderAmbient(0)
  composeScene(0)
  ready = true
  scene.classList.add('is-ready')
  if (openingRuntimeActive) animationFrame = requestAnimationFrame(tick)
}

function changeProgress(delta: number) {
  if (!ready || dragEnabled || moonDocked) return
  targetProgress = clamp(targetProgress + delta)
}

function handleWheel(event: WheelEvent) {
  event.preventDefault()
  const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE
    ? 16
    : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
      ? window.innerHeight
      : 1
  const pixelDelta = event.deltaY * unit
  const scrollDistance = pixelDelta < 0 ? 1400 : 1050
  changeProgress(-pixelDelta / scrollDistance)
}

function handleKeyboard(event: KeyboardEvent) {
  if (dragEnabled || moonDocked) return
  if (event.key === 'ArrowUp' || event.key === 'PageUp') {
    event.preventDefault()
    changeProgress(0.12)
  }
  if (event.key === 'ArrowDown' || event.key === 'PageDown') {
    event.preventDefault()
    changeProgress(-0.12)
  }
}

master.addEventListener('load', markAssetLoaded, { once: true })
space.addEventListener('load', markAssetLoaded, { once: true })
master.src = '/assets/opening-shore-master.png'
space.src = '/assets/opening-space-moon.png'

window.addEventListener('wheel', handleWheel, { passive: false })
window.addEventListener('keydown', handleKeyboard)

moonTarget.addEventListener('pointerenter', () => {
  moonObserved = true
  scene.dataset.moon = 'near'
})

const requestedScene = new URLSearchParams(window.location.search)
if (requestedScene.get('scene') === 'garden' || requestedScene.get('debug') === 'garden') showGarden(readArchiveProfile())
else if (requestedScene.get('debug') === 'archive' || requestedScene.get('scene') === 'archive') enterArchive('debug')
moonTarget.addEventListener('pointerleave', () => {
  moonObserved = false
  delete scene.dataset.moon
})

function beginMoonDrag(event: PointerEvent) {
  if (!dragEnabled || moonDocked || displayProgress < 0.98) return
  event.preventDefault()
  activePointerId = event.pointerId
  moonTarget.setPointerCapture(event.pointerId)
  moonDragging = true
  dragStartX = event.clientX
  dragStartY = event.clientY
  dragStartProgress = dragTarget
  scene.classList.remove('is-moon-returning')
  scene.classList.add('is-moon-dragging')
  playCue(54, 0.24, 0.022)
}

function moveMoonDrag(event: PointerEvent) {
  if (!moonDragging || event.pointerId !== activePointerId) return
  event.preventDefault()
  const bounds = frame.getBoundingClientRect()
  const routeX = ((DOCKED_MOON.x - SPACE_MOON.x) / STAGE_WIDTH) * bounds.width
  const routeY = ((DOCKED_MOON.y - SPACE_MOON.y) / STAGE_HEIGHT) * bounds.height
  const pointerX = event.clientX - dragStartX
  const pointerY = event.clientY - dragStartY
  dragTarget = projectedDragProgress(
    dragStartProgress,
    pointerX,
    pointerY,
    routeX,
    routeY,
  )
}

function finishMoonDrag(event: PointerEvent) {
  if (!moonDragging || event.pointerId !== activePointerId) return
  event.preventDefault()
  moonDragging = false
  scene.classList.remove('is-moon-dragging')

  if (moonTarget.hasPointerCapture(event.pointerId)) moonTarget.releasePointerCapture(event.pointerId)
  activePointerId = null

  if (resolveMoonRelease(dragTarget, DOCK_THRESHOLD) === 'dock') {
    dockMoon()
  } else {
    dragTarget = 0
    scene.classList.add('is-moon-returning')
    playCue(44, 0.34, 0.014)
  }
}

function dockMoon() {
  dragTarget = 1
  moonDocked = true
  dragEnabled = false
  scene.classList.remove('is-drag-enabled', 'is-moon-returning')
  scene.classList.add('is-moon-docked')
  moonTarget.setAttribute('aria-label', '月球已停泊在回测入口旁')
}

moonTarget.addEventListener('pointerdown', beginMoonDrag)
moonTarget.addEventListener('pointermove', moveMoonDrag)
moonTarget.addEventListener('pointerup', finishMoonDrag)
moonTarget.addEventListener('pointercancel', finishMoonDrag)
moonTarget.addEventListener('click', (event) => {
  if (event.detail !== 0 || !dragEnabled || moonDocked || displayProgress < 0.98) return
  dockMoon()
  playCue(54, 0.24, 0.022)
})
moonTarget.addEventListener('keydown', (event) => {
  if ((event.key !== 'Enter' && event.key !== ' ') || !dragEnabled || moonDocked || displayProgress < 0.98) return
  event.preventDefault()
  dockMoon()
  playCue(54, 0.24, 0.022)
})

startBacktest.addEventListener('click', () => {
  if (!portalReady || warpActive) return
  warpActive = true
  warpComplete = false
  warpStartedAt = performance.now()
  warpSample = sampleWarpTimeline(0)
  startBacktest.disabled = true
  startBacktest.tabIndex = -1
  backtestEntry.setAttribute('aria-hidden', 'true')
  moonTarget.setAttribute('aria-hidden', 'true')
  scene.classList.add('is-start-selected', 'is-warping')
  startWarpAudio()
  window.dispatchEvent(new CustomEvent('life-backtest:start'))
  playCue(128, 0.42, 0.025)
})

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenAt = performance.now()
    cancelAnimationFrame(animationFrame)
    return
  }
  if (warpActive && hiddenAt) warpStartedAt += performance.now() - hiddenAt
  hiddenAt = 0
  if (!openingRuntimeActive) return
  startedAt = performance.now()
  previousTick = 0
  lastPixelFrame = -1
  animationFrame = requestAnimationFrame(tick)
})

window.addEventListener('pagehide', () => {
  pageLeaving = true
  if (archiveEntryTimer) window.clearTimeout(archiveEntryTimer)
})
