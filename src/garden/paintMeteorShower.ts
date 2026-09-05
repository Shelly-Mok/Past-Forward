const WIDTH = 320
const HEIGHT = 180
const GRAYS = ['#121210', '#262622', '#45453f', '#6e6e66', '#9a9a90', '#c4c4b8', '#ecece1', '#fff']

export const LIFE_STREAK = { x1: 292, y1: 22, x2: 48, y2: 152 }

const FIELD: Array<{ x1: number; y1: number; x2: number; y2: number; width: number; tone: number }> = [
  { x1: 268, y1: 8, x2: 198, y2: 52, width: 1.1, tone: 0.42 },
  { x1: 304, y1: 36, x2: 214, y2: 88, width: 1.3, tone: 0.55 },
  { x1: 246, y1: 4, x2: 176, y2: 46, width: 1, tone: 0.32 },
  { x1: 312, y1: 58, x2: 236, y2: 102, width: 1.2, tone: 0.48 },
  { x1: 188, y1: 10, x2: 132, y2: 44, width: 1, tone: 0.3 },
  { x1: 276, y1: 70, x2: 198, y2: 116, width: 1.15, tone: 0.4 },
  { x1: 154, y1: 6, x2: 102, y2: 38, width: 0.9, tone: 0.28 },
  { x1: 300, y1: 86, x2: 228, y2: 128, width: 1.1, tone: 0.36 },
  { x1: 220, y1: 16, x2: 164, y2: 50, width: 1, tone: 0.34 },
  { x1: 258, y1: 96, x2: 190, y2: 138, width: 1.05, tone: 0.38 },
  { x1: 124, y1: 18, x2: 78, y2: 46, width: 0.85, tone: 0.26 },
  { x1: 286, y1: 48, x2: 230, y2: 80, width: 0.95, tone: 0.44 },
  { x1: 168, y1: 28, x2: 122, y2: 56, width: 0.9, tone: 0.3 },
  { x1: 240, y1: 64, x2: 186, y2: 96, width: 1, tone: 0.4 },
]

function hash(x: number, y: number) {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return value - Math.floor(value)
}

function tone(value: number) {
  const level = Math.max(0, Math.min(GRAYS.length - 1, Math.floor(value * (GRAYS.length - 1))))
  return GRAYS[level]
}

function plot(ctx: CanvasRenderingContext2D, x: number, y: number, value: number) {
  const px = Math.round(x)
  const py = Math.round(y)
  if (px < 0 || py < 0 || px >= WIDTH || py >= HEIGHT || value <= 0.04) return
  ctx.fillStyle = tone(Math.min(1, value))
  ctx.fillRect(px, py, 1, 1)
}

function streak(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  brightness: number,
) {
  const steps = Math.max(8, Math.round(Math.hypot(x2 - x1, y2 - y1)))
  const ux = (x2 - x1) / steps
  const uy = (y2 - y1) / steps
  const px = -uy
  const py = ux
  for (let index = 0; index <= steps; index++) {
    const along = index / steps
    const fade = along ** 1.65
    const spread = width * (0.15 + 0.85 * along)
    const x = x1 + ux * index
    const y = y1 + uy * index
    for (let side = -2; side <= 2; side++) {
      const distance = Math.abs(side)
      if (distance > spread + 0.6) continue
      const grain = hash(Math.floor(x + side * 3), Math.floor(y + index)) * 0.22
      const value = brightness * fade * (1 - distance / (spread + 0.8)) - grain
      if (value < 0.08 && hash(index, side + 4) > fade) continue
      plot(ctx, x + px * side * 0.85, y + py * side * 0.85, value)
    }
  }
  plot(ctx, x2, y2, Math.min(1, brightness + 0.2))
  plot(ctx, x2 + 1, y2, brightness * 0.85)
  plot(ctx, x2 - 1, y2, brightness * 0.7)
  plot(ctx, x2, y2 + 1, brightness * 0.7)
  plot(ctx, x2, y2 - 1, brightness * 0.85)
}

export function lifePoint(t: number) {
  return {
    x: (LIFE_STREAK.x1 + (LIFE_STREAK.x2 - LIFE_STREAK.x1) * t) / WIDTH * 100,
    y: (LIFE_STREAK.y1 + (LIFE_STREAK.y2 - LIFE_STREAK.y1) * t) / HEIGHT * 100,
  }
}

/** Pixel meteor shower for the backtrack sky. Parallel falling streaks, not a line fan. */
export function paintMeteorShower(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  canvas.width = WIDTH
  canvas.height = HEIGHT
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, WIDTH, HEIGHT)
  for (const item of FIELD) streak(ctx, item.x1, item.y1, item.x2, item.y2, item.width, item.tone)
  streak(ctx, LIFE_STREAK.x1, LIFE_STREAK.y1, LIFE_STREAK.x2, LIFE_STREAK.y2, 2.3, 0.92)
}
