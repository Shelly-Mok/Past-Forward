import type { RiftKind } from './riftContent'

const SIZE = 64
const GRAYS = ['#050505', '#121210', '#262622', '#45453f', '#6e6e66', '#a3a399', '#d8d8cc', '#f3f3ea']
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

export type WorldLook = {
  radius: number
  well: number
  wellX: number
  wellY: number
  lightX: number
  lightY: number
  ring: number
  ringTilt: number
  seed: number
}

export const RIFT_WORLD_LOOK: Record<RiftKind, WorldLook> = {
  backtrack: { radius: 18, well: 7.2, wellX: -1, wellY: 1, lightX: -0.42, lightY: -0.38, ring: 27, ringTilt: 0.38, seed: 11 },
  forward: { radius: 20, well: 5.6, wellX: 2, wellY: 0, lightX: 0.46, lightY: -0.28, ring: 30, ringTilt: -0.22, seed: 23 },
  foresight: { radius: 17, well: 4.8, wellX: -3, wellY: -1, lightX: 0.62, lightY: -0.46, ring: 24, ringTilt: 0.16, seed: 37 },
  end: { radius: 19, well: 3.6, wellX: 0, wellY: 2, lightX: -0.18, lightY: -0.52, ring: 31, ringTilt: 0.08, seed: 41 },
}

function hash(x: number, y: number, seed: number) {
  const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453
  return value - Math.floor(value)
}

function gray(value: number, x: number, y: number) {
  const dither = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16 - 0.5
  const level = Math.max(0, Math.min(GRAYS.length - 1, Math.floor(value * (GRAYS.length - 1) + dither)))
  return GRAYS[level]
}

function cratersFor(seed: number): Array<[number, number, number]> {
  return [
    [hash(2, 1, seed) * 1.2 - 0.55, hash(3, 2, seed) * 1.1 - 0.6, 0.18 + hash(4, 1, seed) * 0.1],
    [hash(5, 4, seed) * 1.1 - 0.5, hash(6, 3, seed) * 1.2 - 0.45, 0.12 + hash(7, 2, seed) * 0.08],
    [hash(8, 5, seed) * 0.9 - 0.4, hash(1, 8, seed) * 0.9 - 0.35, 0.09 + hash(2, 9, seed) * 0.06],
  ]
}

function drawRing(ctx: CanvasRenderingContext2D, look: WorldLook, front: boolean) {
  const cx = SIZE / 2
  const cy = SIZE / 2 + 1
  const rx = look.ring
  const ry = Math.max(3.2, look.ring * 0.22)
  const steps = 148
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const isFront = sin > 0.04
    if (isFront !== front) continue
    const x = Math.round(cx + rx * cos)
    const y = Math.round(cy + ry * sin + cos * look.ringTilt * 5)
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) continue
    const lit = 0.42 + (front ? 0.28 : 0.08) + Math.max(0, -sin) * 0.12
    ctx.fillStyle = gray(lit, x, y)
    ctx.fillRect(x, y, 1, 1)
    if (i % 4 === 0) {
      ctx.fillStyle = gray(lit * 0.72, x, y + 1)
      ctx.fillRect(x, y + 1, 1, 1)
    }
  }
}

/** Little-Prince planet with a dark well. Pixelated, not a smooth CSS orb. */
export function paintRiftWorld(canvas: HTMLCanvasElement, kind: RiftKind, lookOverride?: Partial<WorldLook>) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  canvas.width = SIZE
  canvas.height = SIZE
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, SIZE, SIZE)
  const look = { ...RIFT_WORLD_LOOK[kind], ...lookOverride }
  const cx = SIZE / 2
  const cy = SIZE / 2 + 1
  const craters = cratersFor(look.seed)
  drawRing(ctx, look, false)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const nx = (x + 0.5 - cx) / look.radius
      const ny = (y + 0.5 - cy) / look.radius
      const distance = nx * nx + ny * ny
      if (distance >= 1) continue
      const nz = Math.sqrt(1 - distance)
      const diffuse = Math.max(0, nx * look.lightX + ny * look.lightY + nz * 0.84)
      const grain = hash(Math.floor(x / 3), Math.floor(y / 3), look.seed) * 0.18
        + hash(x, y, look.seed + 4) * 0.06
      let light = 0.14 + diffuse * 0.72 + (grain - 0.12)
      craters.forEach(([craterX, craterY, craterRadius]) => {
        const craterDistance = Math.hypot(nx - craterX, ny - craterY) / craterRadius
        if (craterDistance < 1) light -= (1 - craterDistance) * 0.28
        if (craterDistance > 0.72 && craterDistance < 1.14 && ny - craterY < 0) light += 0.1
      })
      const wellX = (x + 0.5 - (cx + look.wellX)) / look.well
      const wellY = (y + 0.5 - (cy + look.wellY)) / look.well
      const well = wellX * wellX + wellY * wellY
      if (well < 1) {
        const depth = (1 - Math.sqrt(well)) ** 1.35
        light = light * (1 - depth) + 0.02 * depth
        if (well > 0.55 && well < 0.92) light += 0.12
      }
      light *= 0.78 + nz * 0.24
      if (distance > 0.82) light *= 0.72
      ctx.fillStyle = gray(Math.max(0.03, Math.min(0.97, light)), x, y)
      ctx.fillRect(x, y, 1, 1)
    }
  }
  drawRing(ctx, look, true)
}
