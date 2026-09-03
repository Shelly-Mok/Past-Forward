import { drawMemoryFilmWall } from './drawMemoryFilms'
import { sampleArchiveDoorTimeline, type ArchiveDoorPhase } from './archiveDoorTimeline'
import { createArchiveVaultDoor } from './createArchiveVaultDoor'
import { portalRoutePoint, PORTAL_WALK_SECONDS } from './archivePortalRoute'
import { routePoint, WALK_SECONDS } from './archiveWalkRoute'
import {
  ARCHIVE_QUESTIONS,
  archiveAnswerError,
  nextArchiveQuestion,
  normalizeArchiveAnswer,
  previousArchiveQuestion,
  type ArchiveProfile,
  type ArchiveQuestion,
} from './archiveInterview'
import { ArchiveMovementGate } from './archiveMovementGate'

type ArchivePhase =
  | 'arrival'
  | 'walking'
  | 'questioning'
  | 'ready'
  | 'sitting'
  | 'portal-walking'
  | 'portal-arrived'
  | ArchiveDoorPhase
type ArchiveEntry = 'warp' | 'debug'

const STAGE_WIDTH = 1672
const STAGE_HEIGHT = 941
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))

function drawFallbackWalker(
  ctx: CanvasRenderingContext2D,
  progress: number,
  walking: boolean,
) {
  const point = routePoint(progress)
  const step = walking ? Math.floor(point.distance / 10) % 4 : 0
  const bob = walking ? (step === 1 || step === 3 ? -2 : 0) : 0
  const stride = walking ? (step === 1 ? 3 : step === 3 ? -3 : 0) : 0
  const unit = Math.max(1, Math.round(point.scale * 2))
  const x = Math.round(point.x / unit) * unit
  const y = Math.round((point.y + bob * point.scale) / unit) * unit

  ctx.save()
  ctx.translate(x, y)
  ctx.scale(point.scale, point.scale)
  ctx.imageSmoothingEnabled = false

  // The shadow stays attached to the walkway and compresses with perspective.
  ctx.globalAlpha = 0.55
  ctx.fillStyle = '#050505'
  ctx.fillRect(-20, 7, 42, 7)
  ctx.fillStyle = '#4e4e4c'
  ctx.fillRect(-12, 8, 25, 2)
  ctx.globalAlpha = 1

  if (point.direction === 'away') {
    // Anonymous back-facing head, with asymmetric hair and a silver rim.
    ctx.fillStyle = '#111110'
    ctx.fillRect(-11, -70, 22, 4)
    ctx.fillRect(-15, -66, 30, 17)
    ctx.fillRect(-12, -49, 24, 5)
    ctx.fillRect(-17, -63, 4, 10)
    ctx.fillRect(14, -62, 4, 9)
    ctx.fillStyle = '#a4a49f'
    ctx.fillRect(14, -61, 3, 9)
    ctx.fillRect(7, -67, 5, 2)
    ctx.fillStyle = '#292927'
    ctx.fillRect(-6, -44, 12, 4)

    // Arms are separated from the coat by black gutters so the silhouette
    // cannot collapse back into the rectangular placeholder the user rejected.
    const armSwing = stride > 0 ? 2 : stride < 0 ? -2 : 0
    ctx.fillStyle = '#3b3b39'
    ctx.fillRect(-14, -40, 28, 30)
    ctx.fillRect(-19, -37 + armSwing, 4, 25)
    ctx.fillRect(16, -37 - armSwing, 4, 25)
    ctx.fillStyle = '#20201f'
    ctx.fillRect(-14, -38, 6, 27)
    ctx.fillRect(-2, -39, 4, 30)
    ctx.fillRect(10, -37, 4, 26)
    ctx.fillStyle = '#777773'
    ctx.fillRect(13, -37, 2, 25)
    ctx.fillRect(-10, -40, 20, 2)
    ctx.fillStyle = '#9a9a95'
    ctx.fillRect(-20, -14 + armSwing, 5, 4)
    ctx.fillRect(16, -14 - armSwing, 5, 4)

    ctx.fillStyle = '#070707'
    ctx.fillRect(-13, -11, 11, 4)
    ctx.fillRect(3, -11, 11, 4)
    ctx.fillStyle = '#292928'
    ctx.fillRect(-10 + stride, -7, 8, 18)
    ctx.fillRect(4 - stride, -7, 8, 18)
    ctx.fillStyle = '#090909'
    ctx.fillRect(-13 + stride, 8, 13, 5)
    ctx.fillRect(3 - stride, 8, 14, 5)
    ctx.fillStyle = '#a3a39e'
    ctx.fillRect(-11 + stride, 8, 8, 1)
    ctx.fillRect(5 - stride, 8, 9, 1)
  } else {
    ctx.fillStyle = '#111110'
    ctx.fillRect(-9, -69, 20, 5)
    ctx.fillRect(-12, -64, 24, 16)
    ctx.fillRect(-7, -72, 15, 4)
    ctx.fillStyle = '#aaa9a4'
    ctx.fillRect(10, -59, 4, 9)
    ctx.fillRect(7, -63, 5, 2)
    ctx.fillStyle = '#282826'
    ctx.fillRect(-3, -48, 10, 5)

    ctx.fillStyle = '#3b3b39'
    ctx.fillRect(-12, -42, 25, 31)
    ctx.fillRect(12, -38 - Math.abs(stride), 5, 24)
    ctx.fillStyle = '#1f1f1e'
    ctx.fillRect(-12, -40, 6, 28)
    ctx.fillRect(7, -39, 5, 27)
    ctx.fillStyle = '#83837f'
    ctx.fillRect(12, -37 - Math.abs(stride), 2, 22)
    ctx.fillRect(-7, -42, 17, 2)
    ctx.fillStyle = '#9d9d98'
    ctx.fillRect(15, -16 - Math.abs(stride), 5, 4)

    ctx.fillStyle = '#090909'
    ctx.fillRect(-9, -12, 9, 4)
    ctx.fillRect(3, -12, 10, 4)
    ctx.fillStyle = '#292928'
    ctx.fillRect(-7 - stride, -8, 8, 19)
    ctx.fillRect(4 + stride, -8, 8, 19)
    ctx.fillStyle = '#080808'
    ctx.fillRect(-10 - stride, 8, 13, 5)
    ctx.fillRect(3 + stride, 8, 15, 5)
  }

  ctx.restore()
}

function drawWalker(
  ctx: CanvasRenderingContext2D,
  sprite: HTMLImageElement,
  progress: number,
  walking: boolean,
) {
  if (!sprite.complete || !sprite.naturalWidth) {
    drawFallbackWalker(ctx, progress, walking)
    return
  }

  const point = routePoint(progress)
  const frame = walking ? Math.floor(point.distance / 10) % 6 : 0
  const row = point.direction === 'away' ? 0 : 1
  const sourceSize = 128
  const drawSize = Math.round(94 * point.scale)
  const x = Math.round(point.x)
  const y = Math.round(point.y)

  ctx.save()
  ctx.imageSmoothingEnabled = false
  ctx.globalAlpha = 0.58
  ctx.fillStyle = '#030303'
  ctx.fillRect(
    Math.round(x - drawSize * 0.22),
    Math.round(y - drawSize * 0.025),
    Math.round(drawSize * 0.46),
    Math.max(2, Math.round(drawSize * 0.06)),
  )
  ctx.globalAlpha = 1
  ctx.drawImage(
    sprite,
    frame * sourceSize,
    row * sourceSize,
    sourceSize,
    sourceSize,
    Math.round(x - drawSize / 2),
    Math.round(y - drawSize),
    drawSize,
    drawSize,
  )
  ctx.restore()
}

function drawPortalWalker(
  ctx: CanvasRenderingContext2D,
  sprite: HTMLImageElement,
  progress: number,
  walking: boolean,
) {
  const point = portalRoutePoint(progress)
  const drawSize = Math.round(94 * point.scale)
  const x = Math.round(point.x)
  const y = Math.round(point.y)

  ctx.save()
  ctx.imageSmoothingEnabled = false
  ctx.globalAlpha = 0.58
  ctx.fillStyle = '#030303'
  ctx.fillRect(
    Math.round(x - drawSize * 0.22),
    Math.round(y - drawSize * 0.025),
    Math.round(drawSize * 0.46),
    Math.max(2, Math.round(drawSize * 0.06)),
  )
  ctx.globalAlpha = 1

  if (!sprite.complete || !sprite.naturalWidth) {
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(x - Math.round(drawSize * 0.12), y - Math.round(drawSize * 0.78), Math.round(drawSize * 0.24), Math.round(drawSize * 0.22))
    ctx.fillStyle = '#292928'
    ctx.fillRect(x - Math.round(drawSize * 0.17), y - Math.round(drawSize * 0.56), Math.round(drawSize * 0.34), Math.round(drawSize * 0.42))
    ctx.restore()
    return
  }

  const frame = walking ? Math.floor(point.distance / 8) % 6 : 0
  const row = point.direction === 'away' ? 0 : 1
  const sourceSize = 128
  ctx.translate(x, y)
  if (point.direction === 'left') ctx.scale(-1, 1)
  ctx.drawImage(
    sprite,
    frame * sourceSize,
    row * sourceSize,
    sourceSize,
    sourceSize,
    Math.round(-drawSize / 2),
    -drawSize,
    drawSize,
    drawSize,
  )
  ctx.restore()
}

type MemoryScene = 'station' | 'city' | 'office' | 'sea' | 'home' | 'crossroads'

type MemoryReel = {
  x: number
  y: number
  width: number
  height: number
  label: string
  title: string
  offset: number
  scenes: MemoryScene[]
}

const MEMORY_REELS: MemoryReel[] = [
  { x: 127, y: 91, width: 189, height: 156, label: 'SIM-A', title: '离开', offset: 0, scenes: ['station', 'city', 'office', 'sea'] },
  { x: 416, y: 105, width: 29, height: 54, label: 'B', title: '留下', offset: 1.3, scenes: ['home', 'office', 'city', 'home'] },
  { x: 541, y: 158, width: 85, height: 78, label: 'SIM-C', title: '远行', offset: 2.4, scenes: ['crossroads', 'station', 'city', 'sea'] },
  { x: 356, y: 374, width: 76, height: 81, label: 'SIM-D', title: '相遇', offset: 3.2, scenes: ['home', 'crossroads', 'office', 'home'] },
]

function drawMemoryPerson(
  ctx: CanvasRenderingContext2D,
  x: number,
  floorY: number,
  unit: number,
  stride = 0,
) {
  const px = Math.round(x)
  const py = Math.round(floorY)
  ctx.fillStyle = '#e0e0db'
  ctx.fillRect(px - unit, py - unit * 9, unit * 2, unit * 2)
  ctx.fillStyle = '#a4a49f'
  ctx.fillRect(px - unit, py - unit * 7, unit * 2, unit * 4)
  ctx.fillStyle = '#d0d0cb'
  ctx.fillRect(px - unit * 2, py - unit * 7, unit, unit * 4)
  ctx.fillStyle = '#858581'
  ctx.fillRect(px + unit, py - unit * 7, unit, unit * 4)
  ctx.fillStyle = '#c2c2bd'
  ctx.fillRect(px - unit - stride, py - unit * 3, unit, unit * 3)
  ctx.fillRect(px + stride, py - unit * 3, unit, unit * 3)
}

function drawStationMemory(ctx: CanvasRenderingContext2D, width: number, height: number, time: number) {
  const unit = Math.max(1, Math.floor(Math.min(width, height) / 25))
  const trainWidth = Math.round(width * 0.78)
  const travel = (time * width * 0.16) % (width + trainWidth)
  const trainX = Math.round(width - travel)
  ctx.fillStyle = '#242422'
  ctx.fillRect(0, Math.round(height * 0.2), width, Math.round(height * 0.5))
  ctx.fillStyle = '#8d8d88'
  ctx.fillRect(trainX, Math.round(height * 0.31), trainWidth, Math.round(height * 0.27))
  ctx.fillStyle = '#d3d3ce'
  for (let x = trainX + unit * 3; x < trainX + trainWidth - unit * 3; x += unit * 6) {
    ctx.fillRect(x, Math.round(height * 0.36), unit * 3, unit * 3)
  }
  ctx.fillStyle = '#5e5e5a'
  ctx.fillRect(0, Math.round(height * 0.73), width, unit)
  ctx.fillRect(0, Math.round(height * 0.83), width, unit)
  drawMemoryPerson(ctx, width * 0.3, height * 0.78, unit, Math.floor(time * 4) % 2 ? 1 : -1)
}

function drawCityMemory(ctx: CanvasRenderingContext2D, width: number, height: number, time: number) {
  const unit = Math.max(1, Math.floor(Math.min(width, height) / 24))
  const skyline = [0.42, 0.68, 0.5, 0.8, 0.6, 0.46]
  skyline.forEach((ratio, index) => {
    const buildingWidth = Math.ceil(width / skyline.length) + 1
    const buildingHeight = Math.round(height * ratio)
    const x = index * buildingWidth
    const y = height - buildingHeight
    ctx.fillStyle = index % 2 ? '#30302e' : '#1c1c1b'
    ctx.fillRect(x, y, buildingWidth, buildingHeight)
    ctx.fillStyle = '#9b9b96'
    for (let windowY = y + unit * 2; windowY < height - unit * 3; windowY += unit * 4) {
      for (let windowX = x + unit; windowX < x + buildingWidth - unit; windowX += unit * 3) {
        if ((Math.floor(windowX / unit) + Math.floor(windowY / unit) + Math.floor(time * 3)) % 4 === 0) {
          ctx.fillRect(windowX, windowY, unit, unit)
        }
      }
    }
  })
  const walkX = ((time * width * 0.12) % (width * 1.25)) - width * 0.12
  drawMemoryPerson(ctx, walkX, height * 0.95, unit, Math.floor(time * 5) % 2 ? 1 : -1)
}

function drawOfficeMemory(ctx: CanvasRenderingContext2D, width: number, height: number, time: number) {
  const unit = Math.max(1, Math.floor(Math.min(width, height) / 25))
  ctx.fillStyle = '#2e2e2c'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#111110'
  ctx.fillRect(Math.round(width * 0.08), Math.round(height * 0.12), Math.round(width * 0.46), Math.round(height * 0.34))
  ctx.fillStyle = '#8f8f8b'
  for (let y = unit * 4; y < height * 0.4; y += unit * 4) {
    for (let x = unit * 4; x < width * 0.5; x += unit * 5) {
      if ((x + y + Math.floor(time * 5)) % 3) ctx.fillRect(x, y, unit, unit)
    }
  }
  const deskY = Math.round(height * 0.73)
  ctx.fillStyle = '#b0b0ab'
  ctx.fillRect(Math.round(width * 0.38), deskY, Math.round(width * 0.52), unit * 2)
  ctx.fillStyle = '#686865'
  ctx.fillRect(Math.round(width * 0.72), Math.round(height * 0.5), Math.round(width * 0.14), Math.round(height * 0.16))
  drawMemoryPerson(ctx, width * 0.55, deskY + unit * 4, unit, Math.floor(time * 7) % 2)
  ctx.fillStyle = Math.floor(time * 8) % 5 === 0 ? '#efefea' : '#9a9a96'
  ctx.fillRect(Math.round(width * 0.76), Math.round(height * 0.53), Math.round(width * 0.08), unit)
}

function drawSeaMemory(ctx: CanvasRenderingContext2D, width: number, height: number, time: number) {
  const unit = Math.max(1, Math.floor(Math.min(width, height) / 25))
  const horizon = Math.round(height * 0.52)
  ctx.fillStyle = '#181817'
  ctx.fillRect(0, 0, width, horizon)
  ctx.fillStyle = '#3e3e3b'
  ctx.fillRect(0, horizon, width, height - horizon)
  ctx.fillStyle = '#b7b7b2'
  for (let row = 0; row < 4; row++) {
    const waveY = horizon + unit * (row * 3 + 2)
    const shift = Math.round((time * (row + 1) * unit * 1.3) % (unit * 6))
    for (let x = -unit * 6 + shift; x < width; x += unit * 8) ctx.fillRect(x, waveY, unit * 4, unit)
  }
  drawMemoryPerson(ctx, width * 0.42, height * 0.9, unit)
  drawMemoryPerson(ctx, width * 0.62, height * 0.91, Math.max(1, unit - 1))
}

function drawHomeMemory(ctx: CanvasRenderingContext2D, width: number, height: number, time: number) {
  const unit = Math.max(1, Math.floor(Math.min(width, height) / 25))
  ctx.fillStyle = '#292927'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#10100f'
  ctx.fillRect(Math.round(width * 0.1), Math.round(height * 0.12), Math.round(width * 0.38), Math.round(height * 0.42))
  ctx.fillStyle = Math.floor(time * 2) % 3 === 0 ? '#d7d7d2' : '#9b9b96'
  ctx.fillRect(Math.round(width * 0.14), Math.round(height * 0.17), Math.round(width * 0.3), unit * 2)
  ctx.fillStyle = '#a5a5a0'
  ctx.fillRect(Math.round(width * 0.2), Math.round(height * 0.72), Math.round(width * 0.62), unit * 2)
  drawMemoryPerson(ctx, width * 0.38, height * 0.84, unit)
  drawMemoryPerson(ctx, width * 0.65, height * 0.84, unit)
}

function drawCrossroadsMemory(ctx: CanvasRenderingContext2D, width: number, height: number, time: number) {
  const unit = Math.max(1, Math.floor(Math.min(width, height) / 25))
  ctx.fillStyle = '#171716'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#4d4d4a'
  ctx.beginPath()
  ctx.moveTo(width * 0.42, height)
  ctx.lineTo(width * 0.5, height * 0.42)
  ctx.lineTo(width * 0.58, height)
  ctx.fill()
  ctx.fillStyle = '#777773'
  ctx.beginPath()
  ctx.moveTo(width * 0.47, height * 0.52)
  ctx.lineTo(width * 0.1, height * 0.14)
  ctx.lineTo(width * 0.2, height * 0.08)
  ctx.lineTo(width * 0.53, height * 0.47)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(width * 0.53, height * 0.52)
  ctx.lineTo(width * 0.8, height * 0.1)
  ctx.lineTo(width * 0.9, height * 0.17)
  ctx.lineTo(width * 0.57, height * 0.56)
  ctx.fill()
  const drift = Math.sin(time * 2) * unit
  drawMemoryPerson(ctx, width * 0.5 + drift, height * 0.82, unit)
}

function drawMemoryReel(
  ctx: CanvasRenderingContext2D,
  reel: MemoryReel,
  elapsed: number,
  index: number,
  reducedMotion: boolean,
) {
  const localTime = reducedMotion ? reel.offset : elapsed + reel.offset
  const segmentDuration = 1.85 + index * 0.11
  const segment = Math.floor(localTime / segmentDuration) % reel.scenes.length
  const segmentProgress = (localTime % segmentDuration) / segmentDuration
  const ages = [18, 24, 31, 42]

  ctx.save()
  ctx.beginPath()
  ctx.rect(reel.x, reel.y, reel.width, reel.height)
  ctx.clip()
  ctx.translate(reel.x, reel.y)
  ctx.fillStyle = '#030303'
  ctx.fillRect(0, 0, reel.width, reel.height)
  ctx.globalAlpha = Math.floor(localTime * 13 + index * 2) % 9 === 0 ? 0.72 : 0.94

  const scene = reel.scenes[segment]
  if (scene === 'station') drawStationMemory(ctx, reel.width, reel.height, localTime)
  if (scene === 'city') drawCityMemory(ctx, reel.width, reel.height, localTime)
  if (scene === 'office') drawOfficeMemory(ctx, reel.width, reel.height, localTime)
  if (scene === 'sea') drawSeaMemory(ctx, reel.width, reel.height, localTime)
  if (scene === 'home') drawHomeMemory(ctx, reel.width, reel.height, localTime)
  if (scene === 'crossroads') drawCrossroadsMemory(ctx, reel.width, reel.height, localTime)

  if (!reducedMotion && segmentProgress < 0.11) {
    const dissolve = 1 - segmentProgress / 0.11
    const size = Math.max(2, Math.floor(reel.height / 16))
    ctx.globalAlpha = dissolve * 0.72
    ctx.fillStyle = '#efefea'
    for (let y = 0; y < reel.height; y += size) {
      for (let x = 0; x < reel.width; x += size) {
        if ((x / size + y / size + segment + index) % 3 === 0) ctx.fillRect(x, y, size, size)
      }
    }
  }

  ctx.globalAlpha = 0.2
  ctx.fillStyle = '#f0f0eb'
  for (let y = 1; y < reel.height; y += 4) ctx.fillRect(0, y, reel.width, 1)
  ctx.globalAlpha = 0.78
  const fontSize = Math.max(5, Math.floor(reel.height * 0.075))
  ctx.fillStyle = 'rgba(2, 2, 2, 0.82)'
  ctx.fillRect(0, 0, reel.width, fontSize + 6)
  ctx.fillStyle = '#f0f0eb'
  ctx.font = `${fontSize}px "Noto Sans SC", monospace`
  ctx.textBaseline = 'top'
  const title = reel.width >= 70 ? ` · ${reel.title}` : ''
  ctx.fillText(`${reel.label} · ${ages[segment]}${title}`, 3, 3)
  ctx.restore()
}

/** @deprecated Kept only as a non-shipping comparison renderer. */
export function drawMemoryWall(
  ctx: CanvasRenderingContext2D,
  elapsed: number,
  phase: ArchivePhase,
  reducedMotion: boolean,
) {
  ctx.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
  if (phase !== 'sitting' && phase !== 'audit') return
  ctx.save()
  ctx.imageSmoothingEnabled = false
  ctx.globalCompositeOperation = 'screen'
  MEMORY_REELS.forEach((reel, index) => drawMemoryReel(ctx, reel, elapsed, index, reducedMotion))
  ctx.restore()
}

function createArchiveAudio() {
  let context: AudioContext | null = null
  let hum: OscillatorNode | null = null
  let humGain: GainNode | null = null

  function unlock() {
    context ??= new AudioContext()
    if (context.state === 'suspended') void context.resume()
    if (!hum) {
      hum = context.createOscillator()
      humGain = context.createGain()
      hum.type = 'sine'
      hum.frequency.value = 38
      humGain.gain.value = 0.0001
      hum.connect(humGain).connect(context.destination)
      hum.start()
    }
    const now = context.currentTime
    humGain?.gain.setTargetAtTime(0.008, now, 0.5)
  }

  function cue(frequency: number, duration: number, volume: number) {
    unlock()
    if (!context) return
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const now = context.currentTime
    oscillator.type = 'triangle'
    oscillator.frequency.setValueAtTime(frequency, now)
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(32, frequency * 0.68), now + duration)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.018)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start(now)
    oscillator.stop(now + duration + 0.03)
  }

  return {
    unlock,
    step(step: number) { cue(step % 2 ? 68 : 61, 0.11, 0.012) },
    wake(index: number) { cue(106 + index * 29, 0.26, 0.009) },
    question(index: number) { cue(132 + index * 17, 0.34, 0.012) },
    record(index: number) { cue(226 + index * 13, 0.2, 0.01) },
    rewind() { cue(248, 0.34, 0.014) },
    sit() { cue(54, 0.42, 0.018) },
    audit() { cue(148, 0.78, 0.017) },
    doorUnlock() { cue(82, 0.92, 0.022) },
    doorOpen() { cue(46, 4.7, 0.018) },
    doorSettle() { cue(32, 0.82, 0.036) },
    portal() { cue(196, 1.1, 0.018) },
    reelCut(index: number) { cue(index % 2 ? 188 : 164, 0.08, 0.0045) },
  }
}

export function createArchiveScene(scene: HTMLElement) {
  const canvas = scene.querySelector<HTMLCanvasElement>('.archive-character-layer')!
  const context = canvas.getContext('2d')!
  const memoryCanvas = scene.querySelector<HTMLCanvasElement>('.archive-memory-layer')!
  const memoryContext = memoryCanvas.getContext('2d')!
  const vaultDoor = createArchiveVaultDoor(
    scene.querySelector<HTMLCanvasElement>('.archive-vault-door-3d')!,
  )
  const storyAtlas = new Image()
  storyAtlas.decoding = 'async'
  storyAtlas.src = '/assets/memories/parallel-life-atlas-v1.png'
  const leaveFilm = new Image()
  leaveFilm.decoding = 'async'
  leaveFilm.src = '/assets/memories/leave-life-film-v1.png'
  const tvFrame = new Image()
  tvFrame.decoding = 'async'
  tvFrame.src = '/assets/archive-tv-bezel-v1.png'
  const hint = scene.querySelector<HTMLElement>('.archive-control-hint')!
  const hintKey = hint.querySelector<HTMLElement>('kbd')!
  const hintCopy = hint.querySelector<HTMLElement>('span')!
  const moveButton = scene.querySelector<HTMLButtonElement>('.archive-forward-control')!
  const interview = scene.querySelector<HTMLElement>('.archive-interview')!
  const interviewCount = interview.querySelector<HTMLElement>('.archive-interview-count')!
  const interviewCheckpoint = interview.querySelector<HTMLElement>('.archive-interview-checkpoint')!
  const interviewPrompt = interview.querySelector<HTMLElement>('#archive-question')!
  const interviewNote = interview.querySelector<HTMLElement>('.archive-interview-note')!
  const interviewForm = interview.querySelector<HTMLFormElement>('.archive-interview-form')!
  const interviewOptions = interview.querySelector<HTMLElement>('.archive-interview-options')!
  const interviewInput = interview.querySelector<HTMLInputElement>('.archive-interview-input')!
  const interviewError = interview.querySelector<HTMLOutputElement>('.archive-interview-error')!
  const previousQuestionButton = interview.querySelector<HTMLButtonElement>('.archive-interview-previous')!
  const resetInterviewButton = interview.querySelector<HTMLButtonElement>('.archive-interview-reset')!
  const auditSpeaker = scene.querySelector<HTMLElement>('.archive-audit-speaker')!
  const auditMessage = scene.querySelector<HTMLElement>('.archive-audit-message')!
  const auditNote = scene.querySelector<HTMLElement>('.archive-audit-note')!
  const checkpointLights = Array.from(scene.querySelectorAll<HTMLElement>('.archive-checkpoint-light'))
  const playerSprite = new Image()
  playerSprite.decoding = 'async'
  playerSprite.src = '/assets/player/player-walk-sheet-v2.png'
  const audio = createArchiveAudio()
  const forceFullMotion = new URLSearchParams(window.location.search).has('fullMotion')
  const forceFastMotion = new URLSearchParams(window.location.search).has('fastMotion')
  const reducedMotion = forceFastMotion
    || (window.matchMedia('(prefers-reduced-motion: reduce)').matches && !forceFullMotion)
  const held = new Set<string>()
  const movementGate = new ArchiveMovementGate()
  let phase: ArchivePhase = 'arrival'
  let progress = 0
  let active = false
  let readyAt = 0
  let previousFrame = 0
  let animationFrame = 0
  let elapsed = 0
  let lastStep = -1
  let wakeCount = 0
  let sitTimer = 0
  let answerTimer = 0
  let memoryElapsed = 0
  let doorElapsed = 0
  let portalProgress = 0
  let lastMemoryCut = -1
  let doorSettleCuePlayed = false
  let profile: ArchiveProfile = {}
  let activeQuestion: ArchiveQuestion | null = null

  context.imageSmoothingEnabled = false
  memoryContext.imageSmoothingEnabled = false

  function isForwardHeld() {
    return held.has('KeyW') || held.has('ArrowUp') || held.has('PointerForward')
  }

  function setHint(nextKey: string, copy: string) {
    hintKey.textContent = nextKey
    hintCopy.textContent = copy
  }

  function setPhase(next: ArchivePhase) {
    phase = next
    scene.dataset.phase = next
    if (next === 'arrival' || next === 'walking') setHint('W / ↑', '向前')
    if (next === 'questioning') setHint('···', '回答零点小姐')
    if (next === 'ready') setHint('E / 空格', '落座')
    if (next === 'sitting') setHint('···', '正在建立审查连接')
    if (next === 'audit') setHint('···', '正在读取平行人生')
    if (next === 'unlocking') setHint('···', '时间锁正在解封')
    if (next === 'opening') setHint('···', '档案门正在开启')
    if (next === 'portal' || next === 'portal-walking') setHint('W / ↑', '沿平台前往正门 · R 重新进入')
    if (next === 'portal-arrived') setHint('R', '重新进入')
  }

  function setAuditCopy(speaker: string, message: string, note: string) {
    auditSpeaker.textContent = speaker
    auditMessage.textContent = message
    auditNote.textContent = note
  }

  function syncDoorPhase(next: ArchiveDoorPhase) {
    if (phase === next) return
    setPhase(next)

    if (next === 'unlocking') {
      scene.classList.add('is-door-unlocking')
      setAuditCopy(
        '零点小姐 · 时间通道',
        '这一段人生已经看完了。请稍等，档案门正在解锁。',
        '请留在座位上 · 时间坐标正在校准',
      )
      audio.doorUnlock()
    }

    if (next === 'opening') {
      scene.classList.add('is-door-opening')
      setAuditCopy(
        '零点小姐 · 时间通道',
        '门正在打开。再等一会儿。',
        '机械锁已解除 · 通道正在建立',
      )
      audio.doorOpen()
    }

    if (next === 'portal') {
      scene.classList.add('is-portal-open')
      setAuditCopy(
        '零点小姐 · 时间通道',
        '门已经打开了。准备好以后，就往前走吧。',
        '不用害怕 · 你只是去看看另一种可能',
      )
      audio.portal()
      scene.dispatchEvent(new CustomEvent('life-backtest:archive-portal-ready', {
        detail: { profile: { ...profile } },
      }))
    }
  }

  function advancePortalWalk(amount: number) {
    if (!active || (phase !== 'portal' && phase !== 'portal-walking')) return
    if (phase === 'portal') {
      scene.classList.add('is-portal-walking')
      setPhase('portal-walking')
      setAuditCopy(
        '零点小姐 · 时间通道',
        '沿着平台慢慢走过来，到门口就好。',
        '按住 W / ↑ 前往正门 · R 重新进入',
      )
    }
    portalProgress = clamp(portalProgress + amount)
    scene.style.setProperty('--portal-walk-progress', portalProgress.toFixed(4))
    if (portalProgress < 1) return

    held.clear()
    scene.classList.remove('is-portal-walking')
    scene.classList.add('is-portal-arrived')
    setPhase('portal-arrived')
    setAuditCopy(
      '零点小姐 · 时间通道',
      '慢慢往前吧。你的时光，正在另一侧等你。',
      '正在前往月面 · 登记资料已随你同行',
    )
    scene.dispatchEvent(new CustomEvent('life-backtest:archive-door-arrived', {
      detail: { profile: { ...profile } },
    }))
  }

  function saveProfile() {
    try {
      sessionStorage.setItem('life-backtest.archive-profile', JSON.stringify(profile))
    } catch {
      // The scene still works when storage is disabled; answers remain in memory.
    }
  }

  function syncCheckpointLights() {
    checkpointLights.forEach((light) => {
      const id = light.dataset.checkpoint
      light.classList.toggle('is-active', activeQuestion?.id === id)
      light.classList.toggle('is-recorded', Boolean(id && profile[id as keyof ArchiveProfile]))
    })
  }

  function openQuestion(question: ArchiveQuestion) {
    activeQuestion = question
    movementGate.captureHeldKeys(held)
    held.clear()
    setPhase('questioning')
    scene.classList.add('is-interviewing')
    scene.dataset.question = question.id
    interview.setAttribute('aria-hidden', 'false')
    const questionIndex = ARCHIVE_QUESTIONS.indexOf(question)
    interviewCount.textContent = `${String(questionIndex + 1).padStart(2, '0')} / 05`
    previousQuestionButton.disabled = questionIndex === 0
    interviewCheckpoint.textContent = question.checkpoint
    interviewPrompt.textContent = question.prompt
    interviewNote.textContent = question.note
    interviewInput.value = profile[question.id] ?? ''
    interviewInput.placeholder = question.placeholder
    interviewInput.inputMode = question.inputMode
    interviewInput.setAttribute('aria-label', question.prompt)
    interviewError.textContent = ''
    interview.classList.remove('is-confirmed', 'has-error')
    interviewOptions.replaceChildren()

    question.options?.forEach((option) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = option
      button.addEventListener('click', () => {
        interviewInput.value = option
        interviewInput.focus({ preventScroll: true })
      })
      interviewOptions.append(button)
    })
    interviewOptions.hidden = !question.options?.length
    syncCheckpointLights()
    audio.question(questionIndex)
    requestAnimationFrame(() => interviewInput.focus({ preventScroll: true }))
  }

  function closeQuestion() {
    const completedQuestion = activeQuestion
    activeQuestion = null
    scene.classList.remove('is-interviewing')
    delete scene.dataset.question
    interview.setAttribute('aria-hidden', 'true')
    interview.classList.remove('is-confirmed', 'has-error')
    syncCheckpointLights()
    readyAt = performance.now() + 180

    if (progress >= 1) {
      setPhase('ready')
      audio.wake(4)
    } else {
      setPhase('arrival')
    }

    if (completedQuestion) {
      scene.dispatchEvent(new CustomEvent('life-backtest:archive-answer', {
        detail: { question: completedQuestion.id, profile: { ...profile } },
      }))
      if (completedQuestion.id === 'rewind') {
        scene.dispatchEvent(new CustomEvent('life-backtest:archive-profile-ready', {
          detail: { profile: { ...profile } },
        }))
      }
    }
  }

  function submitQuestion() {
    if (!activeQuestion) return
    const error = archiveAnswerError(activeQuestion, interviewInput.value)
    if (error) {
      interviewError.textContent = error
      interview.classList.add('has-error')
      audio.question(0)
      interviewInput.focus({ preventScroll: true })
      return
    }

    const questionIndex = ARCHIVE_QUESTIONS.indexOf(activeQuestion)
    profile[activeQuestion.id] = normalizeArchiveAnswer(activeQuestion, interviewInput.value)
    saveProfile()
    syncCheckpointLights()
    interviewError.textContent = '已写入本次回测档案。'
    interview.classList.remove('has-error')
    interview.classList.add('is-confirmed')
    interviewInput.blur()
    audio.record(questionIndex)
    window.clearTimeout(answerTimer)
    answerTimer = window.setTimeout(closeQuestion, reducedMotion ? 80 : 420)
  }

  function returnToPreviousQuestion() {
    if (!activeQuestion) return
    const previousQuestion = previousArchiveQuestion(activeQuestion.id)
    if (!previousQuestion) return

    held.clear()
    movementGate.reset()
    progress = previousQuestion.progress
    const screenCount = progress >= 0.72 ? 3 : progress >= 0.48 ? 2 : progress >= 0.24 ? 1 : 0
    wakeCount = screenCount
    scene.dataset.screens = String(screenCount)
    scene.style.setProperty('--walk-progress', progress.toFixed(4))
    scene.classList.add('is-answer-rewinding')
    audio.rewind()
    openQuestion(previousQuestion)
    window.setTimeout(() => scene.classList.remove('is-answer-rewinding'), reducedMotion ? 40 : 280)
  }

  function resetInterview() {
    audio.rewind()
    reset()
    scene.classList.add('is-answer-rewinding')
    window.setTimeout(() => scene.classList.remove('is-answer-rewinding'), reducedMotion ? 40 : 280)
  }

  function advanceTo(targetProgress: number) {
    const target = clamp(targetProgress)
    const question = nextArchiveQuestion(progress, target, profile)
    if (question) {
      progress = question.progress
      openQuestion(question)
      return true
    }
    progress = target
    return false
  }

  function wakeScreens() {
    const nextWakeCount = progress >= 0.72 ? 3 : progress >= 0.48 ? 2 : progress >= 0.24 ? 1 : 0
    if (nextWakeCount > wakeCount) {
      audio.wake(nextWakeCount)
      wakeCount = nextWakeCount
    }
    scene.dataset.screens = String(nextWakeCount)
  }

  function nudgeForward(amount: number) {
    if (!active || performance.now() < readyAt) return
    if (phase === 'portal' || phase === 'portal-walking') {
      advancePortalWalk(amount * 0.52)
      return
    }
    if (phase !== 'arrival' && phase !== 'walking') return
    const stoppedForQuestion = advanceTo(progress + amount)
    if (stoppedForQuestion) {
      wakeScreens()
      scene.style.setProperty('--walk-progress', progress.toFixed(4))
      return
    }
    setPhase(progress >= 1 ? 'ready' : 'walking')
    if (progress >= 1) {
      held.clear()
      audio.wake(4)
    }
    wakeScreens()
    scene.style.setProperty('--walk-progress', progress.toFixed(4))
  }

  function enterAudit() {
    if (!active || phase !== 'ready') return
    const missingQuestion = ARCHIVE_QUESTIONS.find((question) => !profile[question.id])
    if (missingQuestion) {
      progress = missingQuestion.progress
      scene.style.setProperty('--walk-progress', progress.toFixed(4))
      openQuestion(missingQuestion)
      return
    }
    setPhase('sitting')
    held.clear()
    audio.sit()
    memoryElapsed = 0
    doorElapsed = 0
    portalProgress = 0
    lastMemoryCut = -1
    doorSettleCuePlayed = false
    scene.classList.add('is-seating')
    window.clearTimeout(sitTimer)
    sitTimer = window.setTimeout(() => {
      if (!active) return
      setPhase('audit')
      doorElapsed = 0
      scene.classList.add('is-auditing')
      setAuditCopy(
        '零点小姐 · 平行人生审查',
        '晚上好。先看看那些没有发生的人生。',
        '模拟影像并非预言 · 尚未接入真实知乎档案',
      )
      audio.audit()
      scene.dispatchEvent(new CustomEvent('life-backtest:archive-audit-ready'))
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 120 : 1450)
  }

  function reset() {
    window.clearTimeout(sitTimer)
    window.clearTimeout(answerTimer)
    progress = 0
    elapsed = 0
    lastStep = -1
    wakeCount = 0
    memoryElapsed = 0
    doorElapsed = 0
    lastMemoryCut = -1
    doorSettleCuePlayed = false
    profile = {}
    activeQuestion = null
    movementGate.reset()
    try {
      sessionStorage.removeItem('life-backtest.archive-profile')
    } catch {
      // Ignore storage restrictions; the in-memory profile is already clear.
    }
    readyAt = performance.now() + (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 150 : 1050)
    held.clear()
    scene.classList.remove(
      'is-seating',
      'is-auditing',
      'is-interviewing',
      'is-answer-rewinding',
      'is-door-unlocking',
      'is-door-opening',
      'is-door-settling',
      'is-portal-open',
      'is-portal-walking',
      'is-portal-arrived',
    )
    delete scene.dataset.question
    interview.setAttribute('aria-hidden', 'true')
    interview.classList.remove('is-confirmed', 'has-error')
    interviewError.textContent = ''
    scene.dataset.screens = '0'
    scene.style.setProperty('--walk-progress', '0')
    scene.style.setProperty('--door-progress', '0')
    scene.style.setProperty('--door-angle', '0deg')
    scene.style.setProperty('--door-depth', '0px')
    scene.style.setProperty('--door-portal-light', '0')
    scene.style.setProperty('--door-shadow', '0')
    scene.style.setProperty('--door-final-blend', '0')
    scene.style.setProperty('--door-model-opacity', '1')
    scene.style.setProperty('--portal-walk-progress', '0')
    vaultDoor.setState(0, 0)
    memoryContext.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
    setAuditCopy(
      '零点小姐 · 平行人生审查',
      '晚上好。先看看那些没有发生的人生。',
      '模拟影像并非预言 · 尚未接入真实知乎档案',
    )
    syncCheckpointLights()
    setPhase('arrival')
  }

  function render(now: number) {
    if (!active) return
    const timelineDelta = previousFrame ? Math.min((now - previousFrame) / 1000, 0.5) : 0
    const movementDelta = Math.min(timelineDelta, 0.05)
    previousFrame = now
    elapsed += timelineDelta

    if (['sitting', 'audit', 'unlocking', 'opening', 'portal'].includes(phase)) {
      if (!reducedMotion) memoryElapsed += timelineDelta
      const memoryCut = Math.floor(memoryElapsed / 1.85)
      if (phase === 'audit' && memoryCut !== lastMemoryCut) {
        lastMemoryCut = memoryCut
        if (!reducedMotion) audio.reelCut(memoryCut)
      }
    }

    if (phase === 'audit' || phase === 'unlocking' || phase === 'opening') {
      doorElapsed += timelineDelta
      const doorSample = sampleArchiveDoorTimeline(doorElapsed, reducedMotion)
      scene.style.setProperty('--door-progress', doorSample.phaseProgress.toFixed(4))
      scene.style.setProperty('--door-angle', `${(-doorSample.doorAngle).toFixed(2)}deg`)
      scene.style.setProperty('--door-depth', `${doorSample.doorDepth.toFixed(2)}px`)
      scene.style.setProperty('--door-portal-light', doorSample.portalLight.toFixed(4))
      scene.style.setProperty('--door-shadow', doorSample.swingProgress.toFixed(4))
      scene.style.setProperty('--door-final-blend', doorSample.finalBlend.toFixed(4))
      scene.style.setProperty('--door-model-opacity', (1 - doorSample.finalBlend).toFixed(4))
      vaultDoor.setState(doorSample.doorAngle, 1 - doorSample.finalBlend)
      if (doorSample.phase === 'opening' && doorSample.settleProgress >= 0.08 && !doorSettleCuePlayed) {
        doorSettleCuePlayed = true
        scene.classList.add('is-door-settling')
        audio.doorSettle()
      }
      syncDoorPhase(doorSample.phase)
    }

    const canWalk = now >= readyAt && (phase === 'arrival' || phase === 'walking')
    const walking = canWalk && isForwardHeld()
    if (walking) {
      if (phase !== 'walking') setPhase('walking')
      const stoppedForQuestion = advanceTo(progress + movementDelta / WALK_SECONDS)
      const step = Math.floor(elapsed * 4.4)
      if (!stoppedForQuestion && step !== lastStep) {
        lastStep = step
        audio.step(step)
      }
      if (!stoppedForQuestion && progress >= 1) {
        progress = 1
        held.clear()
        setPhase('ready')
        audio.wake(4)
      }
    } else if (phase === 'walking') {
      setPhase('arrival')
    }

    const canWalkToPortal = phase === 'portal' || phase === 'portal-walking'
    const walkingToPortal = canWalkToPortal && isForwardHeld()
    if (walkingToPortal) {
      advancePortalWalk(movementDelta / PORTAL_WALK_SECONDS)
      const step = Math.floor(elapsed * 3.6)
      if (step !== lastStep) {
        lastStep = step
        audio.step(step)
      }
    }

    wakeScreens()
    scene.style.setProperty('--walk-progress', progress.toFixed(4))
    context.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
    if (!['sitting', 'audit', 'unlocking', 'opening', 'portal', 'portal-walking', 'portal-arrived'].includes(phase)) {
      drawWalker(context, playerSprite, progress, walking)
    }
    if (phase === 'portal-walking' || phase === 'portal-arrived') {
      drawPortalWalker(context, playerSprite, portalProgress, walkingToPortal)
    }
    drawMemoryFilmWall(memoryContext, storyAtlas, leaveFilm, tvFrame, memoryElapsed, phase, reducedMotion)
    animationFrame = requestAnimationFrame(render)
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (!active) return
    if (activeQuestion) {
      if (movementGate.blocksTextInput(event.code)) {
        event.preventDefault()
        event.stopPropagation()
      }
      return
    }
    if (event.code === 'KeyW' || event.code === 'ArrowUp') {
      event.preventDefault()
      audio.unlock()
      held.add(event.code)
      if (!event.repeat) nudgeForward(0.025)
    }
    if ((event.code === 'KeyE' || event.code === 'Space') && phase === 'ready') {
      event.preventDefault()
      enterAudit()
    }
    if (event.code === 'KeyR' && (phase === 'portal' || phase === 'portal-walking' || phase === 'portal-arrived')) {
      event.preventDefault()
      reset()
    }
  }

  function handleKeyUp(event: KeyboardEvent) {
    held.delete(event.code)
    movementGate.release(event.code)
  }

  function pressForward(event: PointerEvent) {
    if (
      !active
      || phase === 'questioning'
      || phase === 'ready'
      || phase === 'sitting'
      || phase === 'audit'
      || phase === 'unlocking'
      || phase === 'opening'
      || phase === 'portal-arrived'
    ) return
    event.preventDefault()
    audio.unlock()
    moveButton.setPointerCapture(event.pointerId)
    held.add('PointerForward')
  }

  function releaseForward(event?: PointerEvent) {
    held.delete('PointerForward')
    if (event && moveButton.hasPointerCapture(event.pointerId)) moveButton.releasePointerCapture(event.pointerId)
  }

  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  window.addEventListener('blur', () => held.clear())
  moveButton.addEventListener('pointerdown', pressForward)
  moveButton.addEventListener('pointerup', releaseForward)
  moveButton.addEventListener('pointercancel', releaseForward)
  moveButton.addEventListener('click', () => {
    if (phase === 'ready') enterAudit()
    if (phase === 'arrival' || phase === 'walking') nudgeForward(0.08)
    if (phase === 'portal' || phase === 'portal-walking') nudgeForward(0.08)
  })
  interviewForm.addEventListener('submit', (event) => {
    event.preventDefault()
    submitQuestion()
  })
  previousQuestionButton.addEventListener('click', returnToPreviousQuestion)
  resetInterviewButton.addEventListener('click', resetInterview)

  return {
    show(options: { entry?: ArchiveEntry } = {}) {
      if (active) return
      active = true
      reset()
      scene.dataset.entry = options.entry ?? 'warp'
      scene.inert = false
      scene.removeAttribute('aria-hidden')
      scene.classList.add('is-active')
      moveButton.tabIndex = 0
      previousFrame = performance.now()
      animationFrame = requestAnimationFrame(render)
    },
    pause() {
      active = false
      held.clear()
      cancelAnimationFrame(animationFrame)
    },
    hide() {
      active = false
      held.clear()
      window.clearTimeout(sitTimer)
      window.clearTimeout(answerTimer)
      cancelAnimationFrame(animationFrame)
      scene.inert = true
      scene.setAttribute('aria-hidden', 'true')
      scene.classList.remove('is-active')
      moveButton.tabIndex = -1
    },
  }
}
