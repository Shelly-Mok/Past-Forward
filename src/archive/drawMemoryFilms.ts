export type MemoryFilmPhase =
  | 'arrival'
  | 'walking'
  | 'questioning'
  | 'ready'
  | 'sitting'
  | 'audit'
  | 'unlocking'
  | 'opening'
  | 'portal'
  | 'portal-walking'
  | 'portal-arrived'

type ScreenReel = {
  row: number
  label: string
  title: string
  offset: number
  corners: [[number, number], [number, number], [number, number], [number, number]]
}

const ATLAS_WIDTH = 1672
const ATLAS_HEIGHT = 941
const STORY_COLUMNS = 4
const STORY_ROWS = 4
const FILM_COLUMNS = 4
const FILM_ROWS = 3
const LIFE_AGES = [18, 24, 31, 42]
const FEATURED_TV_FRAME = { x: 500, y: 100, width: 160, height: 160 }

const SCREEN_REELS: ScreenReel[] = [
  { row: 0, label: 'SIM-A', title: '离开', offset: 0, corners: [[127, 80], [318, 120], [321, 261], [125, 221]] },
  { row: 1, label: 'B', title: '留下', offset: 1.1, corners: [[413, 73], [445, 79], [446, 149], [412, 143]] },
  { row: 2, label: 'SIM-C', title: '远行', offset: 2.2, corners: [[541, 135], [626, 144], [623, 222], [540, 219]] },
  { row: 3, label: 'SIM-D', title: '相遇', offset: 3.1, corners: [[355, 373], [431, 375], [431, 470], [354, 468]] },
]

const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount

function pointBetween(from: [number, number], to: [number, number], amount: number): [number, number] {
  return [lerp(from[0], to[0], amount), lerp(from[1], to[1], amount)]
}

function edgeLength(from: [number, number], to: [number, number]) {
  return Math.hypot(to[0] - from[0], to[1] - from[1])
}

function screenMetrics(reel: ScreenReel) {
  const [topLeft, topRight, bottomRight, bottomLeft] = reel.corners
  const xs = reel.corners.map(([x]) => x)
  const ys = reel.corners.map(([, y]) => y)
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: (edgeLength(topLeft, topRight) + edgeLength(bottomLeft, bottomRight)) / 2,
    height: (edgeLength(topLeft, bottomLeft) + edgeLength(topRight, bottomRight)) / 2,
    boundsWidth: Math.max(...xs) - Math.min(...xs),
    boundsHeight: Math.max(...ys) - Math.min(...ys),
  }
}

function drawImageToScreenQuad(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  sourceX: number,
  sourceY: number,
  sourceWidth: number,
  sourceHeight: number,
  reel: ScreenReel,
) {
  const [topLeft, topRight, bottomRight, bottomLeft] = reel.corners
  const { width } = screenMetrics(reel)
  const slices = Math.max(20, Math.ceil(width))
  const sourceSliceWidth = sourceWidth / slices

  for (let index = 0; index < slices; index++) {
    const start = index / slices
    const end = (index + 1) / slices
    const middle = (start + end) / 2
    const topY = lerp(topLeft[1], topRight[1], middle)
    const bottomY = lerp(bottomLeft[1], bottomRight[1], middle)
    const startX = (lerp(topLeft[0], topRight[0], start) + lerp(bottomLeft[0], bottomRight[0], start)) / 2
    const endX = (lerp(topLeft[0], topRight[0], end) + lerp(bottomLeft[0], bottomRight[0], end)) / 2

    ctx.drawImage(
      image,
      sourceX + index * sourceSliceWidth,
      sourceY,
      sourceSliceWidth + 0.5,
      sourceHeight,
      startX,
      topY,
      endX - startX + 0.8,
      bottomY - topY,
    )
  }
}

function screenPath(ctx: CanvasRenderingContext2D, reel: ScreenReel) {
  const [topLeft, topRight, bottomRight, bottomLeft] = reel.corners
  const radius = screenMetrics(reel).width > 100 ? 4 : 2
  ctx.beginPath()
  ctx.moveTo(topLeft[0] + radius, topLeft[1])
  ctx.lineTo(topRight[0] - radius, topRight[1])
  ctx.quadraticCurveTo(topRight[0], topRight[1], topRight[0], topRight[1] + radius)
  ctx.lineTo(bottomRight[0], bottomRight[1] - radius)
  ctx.quadraticCurveTo(bottomRight[0], bottomRight[1], bottomRight[0] - radius, bottomRight[1])
  ctx.lineTo(bottomLeft[0] + radius, bottomLeft[1])
  ctx.quadraticCurveTo(bottomLeft[0], bottomLeft[1], bottomLeft[0], bottomLeft[1] - radius)
  ctx.lineTo(topLeft[0], topLeft[1] + radius)
  ctx.quadraticCurveTo(topLeft[0], topLeft[1], topLeft[0] + radius, topLeft[1])
  ctx.closePath()
}

function prepareScreenGlass(ctx: CanvasRenderingContext2D, reel: ScreenReel) {
  const { x, y, boundsWidth, boundsHeight } = screenMetrics(reel)
  ctx.save()
  screenPath(ctx, reel)
  ctx.clip()
  ctx.globalAlpha = 1
  ctx.fillStyle = '#020202'
  ctx.fillRect(x - 2, y - 2, boundsWidth + 4, boundsHeight + 4)
  ctx.restore()
}

function drawCoverCrop(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  sourceX: number,
  sourceY: number,
  sourceWidth: number,
  sourceHeight: number,
  reel: ScreenReel,
  motion: number,
  alpha = 1,
  motionStrength = 1,
) {
  const { width, height } = screenMetrics(reel)
  const targetAspect = width / height
  const sourceAspect = sourceWidth / sourceHeight
  let cropWidth = sourceWidth
  let cropHeight = sourceHeight

  if (sourceAspect > targetAspect) cropWidth = sourceHeight * targetAspect
  else cropHeight = sourceWidth / targetAspect

  const zoom = 1 + motion * 0.045 * motionStrength
  cropWidth /= zoom
  cropHeight /= zoom
  const remainingX = sourceWidth - cropWidth
  const remainingY = sourceHeight - cropHeight
  const panX = 0.5 + Math.sin((motion + reel.row * 0.19) * Math.PI) * 0.12 * motionStrength
  const panY = 0.48 + Math.cos((motion + reel.row * 0.13) * Math.PI) * 0.05 * motionStrength
  const cropX = sourceX + remainingX * panX
  const cropY = sourceY + remainingY * panY

  ctx.save()
  screenPath(ctx, reel)
  ctx.clip()
  ctx.globalAlpha = alpha * 0.9
  ctx.filter = 'brightness(1.46) contrast(1.12)'
  drawImageToScreenQuad(ctx, image, cropX, cropY, cropWidth, cropHeight, reel)
  ctx.restore()
}

function drawFilmFrame(
  ctx: CanvasRenderingContext2D,
  film: HTMLImageElement,
  reel: ScreenReel,
  stage: number,
  motionFrame: number,
  motion: number,
  alpha = 1,
) {
  const cellWidth = ATLAS_WIDTH / FILM_COLUMNS
  const cellHeight = ATLAS_HEIGHT / FILM_ROWS
  drawCoverCrop(
    ctx,
    film,
    stage * cellWidth + 3,
    motionFrame * cellHeight + 3,
    cellWidth - 6,
    cellHeight - 6,
    reel,
    motion,
    alpha,
  )
}

function drawStoryFrame(
  ctx: CanvasRenderingContext2D,
  atlas: HTMLImageElement,
  reel: ScreenReel,
  stage: number,
  motion: number,
  alpha = 1,
  motionStrength = 1,
) {
  const cellWidth = ATLAS_WIDTH / STORY_COLUMNS
  const cellHeight = ATLAS_HEIGHT / STORY_ROWS
  drawCoverCrop(
    ctx,
    atlas,
    stage * cellWidth + 3,
    reel.row * cellHeight + 3,
    cellWidth - 6,
    cellHeight - 6,
    reel,
    motion,
    alpha,
    motionStrength,
  )
}

function drawScreenChrome(
  ctx: CanvasRenderingContext2D,
  reel: ScreenReel,
  _age: number,
  frameClock: number,
) {
  const [topLeft, topRight, bottomRight, bottomLeft] = reel.corners
  const { height } = screenMetrics(reel)
  ctx.save()
  screenPath(ctx, reel)
  ctx.clip()

  ctx.globalAlpha = 0.12
  ctx.fillStyle = '#f1f1ec'
  const scanlineStep = Math.max(2 / height, 0.032)
  const scanlineThickness = Math.max(0.75 / height, 0.007)
  for (let amount = scanlineStep; amount < 1; amount += scanlineStep) {
    const nextAmount = Math.min(1, amount + scanlineThickness)
    const left = pointBetween(topLeft, bottomLeft, amount)
    const right = pointBetween(topRight, bottomRight, amount)
    const nextRight = pointBetween(topRight, bottomRight, nextAmount)
    const nextLeft = pointBetween(topLeft, bottomLeft, nextAmount)
    ctx.beginPath()
    ctx.moveTo(left[0], left[1])
    ctx.lineTo(right[0], right[1])
    ctx.lineTo(nextRight[0], nextRight[1])
    ctx.lineTo(nextLeft[0], nextLeft[1])
    ctx.closePath()
    ctx.fill()
  }

  if (frameClock % 17 === 0) {
    ctx.globalAlpha = 0.18
    ctx.fillStyle = '#fff'
    const tearStart = 0.6
    const tearEnd = Math.min(1, tearStart + 2 / height)
    const left = pointBetween(topLeft, bottomLeft, tearStart)
    const right = pointBetween(topRight, bottomRight, tearStart)
    const nextRight = pointBetween(topRight, bottomRight, tearEnd)
    const nextLeft = pointBetween(topLeft, bottomLeft, tearEnd)
    ctx.beginPath()
    ctx.moveTo(left[0], left[1])
    ctx.lineTo(right[0], right[1])
    ctx.lineTo(nextRight[0], nextRight[1])
    ctx.lineTo(nextLeft[0], nextLeft[1])
    ctx.closePath()
    ctx.fill()
  }

  ctx.restore()
}

function drawPrimaryFilm(
  ctx: CanvasRenderingContext2D,
  film: HTMLImageElement,
  reel: ScreenReel,
  elapsed: number,
  reducedMotion: boolean,
) {
  const frameDuration = 0.72
  const localTime = reducedMotion ? 0 : elapsed
  const absoluteFrame = Math.floor(localTime / frameDuration) % 12
  const stage = Math.floor(absoluteFrame / 3)
  const motionFrame = absoluteFrame % 3
  const frameProgress = (localTime % frameDuration) / frameDuration
  const nextAbsolute = (absoluteFrame + 1) % 12
  const nextStage = Math.floor(nextAbsolute / 3)
  const nextMotionFrame = nextAbsolute % 3

  prepareScreenGlass(ctx, reel)
  drawFilmFrame(ctx, film, reel, stage, motionFrame, frameProgress)
  if (!reducedMotion && frameProgress > 0.78) {
    const transition = (frameProgress - 0.78) / 0.22
    drawFilmFrame(ctx, film, reel, nextStage, nextMotionFrame, 0, transition)
  }
  drawScreenChrome(ctx, reel, LIFE_AGES[stage], Math.floor(localTime * 12))
}

function drawParallelStory(
  ctx: CanvasRenderingContext2D,
  atlas: HTMLImageElement,
  reel: ScreenReel,
  elapsed: number,
  reducedMotion: boolean,
) {
  const frameDuration = 0.72 + reel.row * 0.035
  const localTime = reducedMotion ? reel.offset : elapsed + reel.offset
  const absoluteFrame = Math.floor(localTime / frameDuration) % 12
  const stage = Math.floor(absoluteFrame / 3)
  const motionFrame = absoluteFrame % 3
  const frameProgress = (localTime % frameDuration) / frameDuration
  const motion = (motionFrame + frameProgress) / 3
  const nextAbsolute = (absoluteFrame + 1) % 12
  const nextStage = Math.floor(nextAbsolute / 3)
  const nextMotionFrame = nextAbsolute % 3

  prepareScreenGlass(ctx, reel)
  drawStoryFrame(ctx, atlas, reel, stage, motion, 1, 2.15)
  if (!reducedMotion && frameProgress > 0.78) {
    const transition = (frameProgress - 0.78) / 0.22
    drawStoryFrame(ctx, atlas, reel, nextStage, nextMotionFrame / 3, transition, 2.15)
  }
  drawScreenChrome(ctx, reel, LIFE_AGES[stage], Math.floor(localTime * 12))
}

function drawFeaturedTvFrame(ctx: CanvasRenderingContext2D, frame: HTMLImageElement) {
  if (!frame.complete || !frame.naturalWidth) return
  ctx.save()
  ctx.imageSmoothingEnabled = false
  ctx.globalAlpha = 0.98
  ctx.drawImage(
    frame,
    FEATURED_TV_FRAME.x,
    FEATURED_TV_FRAME.y,
    FEATURED_TV_FRAME.width,
    FEATURED_TV_FRAME.height,
  )
  ctx.restore()
}

export function drawMemoryFilmWall(
  ctx: CanvasRenderingContext2D,
  storyAtlas: HTMLImageElement,
  leaveFilm: HTMLImageElement,
  tvFrame: HTMLImageElement,
  elapsed: number,
  phase: MemoryFilmPhase,
  reducedMotion: boolean,
) {
  ctx.clearRect(0, 0, ATLAS_WIDTH, ATLAS_HEIGHT)
  if (!['sitting', 'audit', 'unlocking', 'opening', 'portal'].includes(phase)) return
  if (!storyAtlas.complete || !storyAtlas.naturalWidth || !leaveFilm.complete || !leaveFilm.naturalWidth) return

  ctx.save()
  ctx.imageSmoothingEnabled = false
  ctx.globalCompositeOperation = 'source-over'
  drawPrimaryFilm(ctx, leaveFilm, SCREEN_REELS[0], elapsed, reducedMotion)
  SCREEN_REELS.slice(1).forEach((reel) => drawParallelStory(ctx, storyAtlas, reel, elapsed, reducedMotion))
  drawFeaturedTvFrame(ctx, tvFrame)
  ctx.restore()
}
