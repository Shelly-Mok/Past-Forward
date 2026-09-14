import type { GroundPoint } from './gardenActor'

export type FlowerPalette = {
  flower: string
  plant: string
  mineral: string
}

export type LifePatch = {
  age: number
  choiceId: string
  flowerKind: number
  seed: number
  root: GroundPoint
  palette: FlowerPalette
  lobes: Array<{ x: number; y: number; rx: number; ry: number; points: number; phase: number; color: number }>
  veins: Array<Array<GroundPoint>>
  flecks: Array<{ x: number; y: number; size: number; color: number; threshold: number }>
}

export type LifeConnection = {
  from: LifePatch
  to: LifePatch
  seed: number
  activationThreshold: number
  points: GroundPoint[]
  color: string
}

export type StarCluster = {
  id: string
  x: number
  y: number
  radiusX: number
  radiusY: number
  angle: number
  activationThreshold: number
  palette: readonly string[]
  points: Array<{ x: number; y: number; size: number; color: number; dust: boolean; threshold: number }>
}

export type StagedEnvironmentProgress = {
  shipFeet: number
  shipRamp: number
  shipHull: number
  shipDetails: number
  earthOcean: number
  earthLand: number
  earthComplete: number
  galaxy: number
}

export const FLOWER_LIFE_PALETTES: readonly FlowerPalette[] = [
  { flower: '#e8e3d2', plant: '#75945f', mineral: '#b49a58' },
  { flower: '#aeb6b2', plant: '#617b68', mineral: '#577f87' },
  { flower: '#6253c7', plant: '#405d9c', mineral: '#4c8992' },
  { flower: '#89738f', plant: '#66775c', mineral: '#8b7458' },
  { flower: '#d55d51', plant: '#bf714a', mineral: '#8e493e' },
  { flower: '#cbdfe5', plant: '#66979a', mineral: '#779fb3' },
  { flower: '#83bfd5', plant: '#4f899d', mineral: '#537b70' },
  { flower: '#913e48', plant: '#425f48', mineral: '#8d684b' },
] as const

export function getFlowerPalette(flowerKind: number): FlowerPalette {
  const slot = ((Math.trunc(flowerKind) % FLOWER_LIFE_PALETTES.length) + FLOWER_LIFE_PALETTES.length) % FLOWER_LIFE_PALETTES.length
  return FLOWER_LIFE_PALETTES[slot]
}

export function getLifePatchSeed(age: number, choiceId: string): number {
  let hash = 2166136261 ^ Math.trunc(age)
  for (let index = 0; index < choiceId.length; index++) {
    hash = Math.imul(hash ^ choiceId.charCodeAt(index), 16777619)
  }
  return hash >>> 0
}

function randomFor(seed: number) {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let next = value
    next = Math.imul(next ^ next >>> 15, next | 1)
    next ^= next + Math.imul(next ^ next >>> 7, next | 61)
    return ((next ^ next >>> 14) >>> 0) / 4294967296
  }
}

export function buildLifePatch(
  age: number,
  choiceId: string,
  flowerKind: number,
  root: GroundPoint,
): LifePatch {
  const seed = getLifePatchSeed(age, choiceId)
  const random = randomFor(seed)
  const lobeCount = 3 + Math.floor(random() * 4)
  const lobes = Array.from({ length: lobeCount }, (_, index) => {
    const direction = index % 2 ? 1 : -1
    return {
      x: Math.round(root.x + direction * (18 + random() * 76) + (random() - .5) * 36),
      y: Math.round(root.y + 4 + (random() - .5) * 26),
      rx: Math.round(50 + random() * 82),
      ry: Math.round(11 + random() * 23),
      points: 7 + Math.floor(random() * 5),
      phase: random() * Math.PI * 2,
      color: Math.floor(random() * 3),
    }
  })
  const veinCount = 2 + Math.floor(random() * 3)
  const veins = Array.from({ length: veinCount }, (_, index) => {
    const direction = index % 2 ? 1 : -1
    const length = 42 + random() * 100
    const segments = 3 + Math.floor(random() * 4)
    return Array.from({ length: segments }, (__, pointIndex) => {
      const t = pointIndex / Math.max(1, segments - 1)
      return {
        x: Math.round(root.x + direction * length * t + (random() - .5) * 15),
        y: Math.round(root.y + 5 + Math.sin(t * Math.PI) * (6 + random() * 10) + (random() - .5) * 7),
      }
    })
  })
  const flecks = Array.from({ length: 32 }, () => ({
    x: Math.round(root.x + (random() - .5) * 252),
    y: Math.round(root.y + (random() - .5) * 62),
    size: random() > .76 ? 4 : 2,
    color: Math.floor(random() * 3),
    threshold: .35 + random() * .55,
  }))
  return { age, choiceId, flowerKind, seed, root: { ...root }, palette: getFlowerPalette(flowerKind), lobes, veins, flecks }
}

export function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return value < edge0 ? 0 : 1
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

export function calculateVitality(completed: number, total: number, pending = 0): number {
  const safeTotal = Math.max(1, Math.trunc(total))
  return Math.max(0, Math.min(1, (Math.max(0, completed) + Math.max(0, Math.min(1, pending))) / safeTotal))
}

export function environmentProgress(vitality: number) {
  return {
    ship: smoothstep(.60, .95, vitality),
    earth: smoothstep(.80, 1, vitality),
    galaxy: smoothstep(.82, 1, vitality),
  }
}

export function stagedEnvironmentProgress(vitality: number): StagedEnvironmentProgress {
  return {
    shipFeet: smoothstep(.60, .72, vitality),
    shipRamp: smoothstep(.70, .86, vitality),
    shipHull: smoothstep(.84, .96, vitality),
    shipDetails: smoothstep(.94, 1, vitality),
    earthOcean: smoothstep(.80, .88, vitality),
    earthLand: smoothstep(.88, .96, vitality),
    earthComplete: smoothstep(.94, 1, vitality),
    galaxy: smoothstep(.82, 1, vitality),
  }
}

function hexRgb(color: string) {
  const value = color.replace('#', '')
  const expanded = value.length === 3 ? value.split('').map(char => char + char).join('') : value
  return [0, 2, 4].map(index => Number.parseInt(expanded.slice(index, index + 2), 16))
}

export function mixPaletteColor(first: string, second: string, amount = .5): string {
  const a = hexRgb(first)
  const b = hexRgb(second)
  const t = Math.max(0, Math.min(1, amount))
  const values = a.map((value, index) => Math.round(value + (b[index] - value) * t))
  return `#${values.map(value => value.toString(16).padStart(2, '0')).join('')}`
}

export function buildLifeConnections(patches: LifePatch[], vitality: number): LifeConnection[] {
  if (vitality < .35 || patches.length < 2) return []
  const sorted = [...patches].sort((a, b) => a.root.x - b.root.x || a.root.y - b.root.y)
  const candidates: Array<[LifePatch, LifePatch]> = []
  for (let index = 1; index < sorted.length; index++) {
    const from = sorted[index - 1]
    const to = sorted[index]
    if (Math.hypot(to.root.x - from.root.x, to.root.y - from.root.y) <= 390) candidates.push([from, to])
  }
  return candidates.flatMap(([from, to], index) => {
    const activationThreshold = Math.min(.68, .35 + index * .045)
    if (vitality < activationThreshold) return []
    const seed = getLifePatchSeed(from.age + to.age, `${from.choiceId}:${to.choiceId}`)
    const random = randomFor(seed)
    const segments = 6 + Math.floor(random() * 4)
    const points = Array.from({ length: segments }, (_, pointIndex) => {
      const t = pointIndex / (segments - 1)
      const bend = Math.sin(t * Math.PI) * (random() - .5) * 28
      return {
        x: Math.round(from.root.x + (to.root.x - from.root.x) * t + (random() - .5) * 15),
        y: Math.round(from.root.y + (to.root.y - from.root.y) * t + bend + (random() - .5) * 7),
      }
    })
    return [{
      from,
      to,
      seed,
      activationThreshold,
      points,
      color: mixPaletteColor(from.palette.mineral, to.palette.plant, .5),
    }]
  })
}

export function drawLifeConnections(ctx: CanvasRenderingContext2D, connections: LifeConnection[], vitality: number, highlights = false) {
  ctx.save()
  ctx.imageSmoothingEnabled = false
  for (const connection of connections) {
    const reveal = smoothstep(connection.activationThreshold, Math.min(1, connection.activationThreshold + .16), vitality)
    const points = connection.points.slice(0, Math.max(2, Math.ceil(connection.points.length * reveal)))
    ctx.beginPath()
    points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y))
    ctx.strokeStyle = highlights ? mixPaletteColor(connection.color, '#e5e4d6', .28) : connection.color
    ctx.globalAlpha = (highlights ? .22 : .48) * reveal
    ctx.lineWidth = highlights ? 1 : 3
    ctx.setLineDash(highlights ? [2, 7] : [8, 5, 2, 6])
    ctx.stroke()
    points.slice(1, -1).forEach((point, index) => {
      if (index % 2 !== 0) return
      ctx.fillStyle = index % 4 ? connection.from.palette.plant : connection.to.palette.mineral
      ctx.globalAlpha = (highlights ? .2 : .42) * reveal
      ctx.fillRect(point.x + (index % 3) * 2, point.y - 2, highlights ? 1 : 3, highlights ? 1 : 2)
    })
  }
  ctx.restore()
}

function terrainTopAt(x: number) {
  const ridge = [
    { x: 20, y: 908 }, { x: 190, y: 808 }, { x: 390, y: 680 }, { x: 590, y: 606 },
    { x: 820, y: 558 }, { x: 1080, y: 535 }, { x: 1360, y: 540 }, { x: 1672, y: 566 },
  ]
  for (let index = 1; index < ridge.length; index++) {
    const from = ridge[index - 1]
    const to = ridge[index]
    if (x <= to.x) {
      const t = Math.max(0, Math.min(1, (x - from.x) / (to.x - from.x)))
      return from.y + (to.y - from.y) * t
    }
  }
  return ridge[ridge.length - 1].y
}

function traceTerrain(ctx: CanvasRenderingContext2D) {
  ctx.beginPath()
  ctx.moveTo(20, 908)
  ctx.lineTo(190, 808)
  ctx.lineTo(390, 680)
  ctx.lineTo(590, 606)
  ctx.lineTo(820, 558)
  ctx.lineTo(1080, 535)
  ctx.lineTo(1360, 540)
  ctx.lineTo(1672, 566)
  ctx.lineTo(1672, 941)
  ctx.lineTo(0, 941)
  ctx.closePath()
}

function traceShipHull(ctx: CanvasRenderingContext2D) {
  ctx.beginPath()
  ctx.moveTo(810, 565)
  ctx.lineTo(817, 404)
  ctx.lineTo(855, 378)
  ctx.lineTo(936, 354)
  ctx.lineTo(1033, 350)
  ctx.lineTo(1145, 377)
  ctx.lineTo(1237, 416)
  ctx.lineTo(1262, 542)
  ctx.lineTo(1221, 566)
  ctx.lineTo(867, 574)
  ctx.closePath()
}

/** Removes colour belonging to the sky or ground from the spacecraft. The
 * authored craft is restored later by its own palette, so the three visual
 * systems never bleed into one another. */
export function clearShipOverlay(ctx: CanvasRenderingContext2D) {
  ctx.save()
  ctx.globalCompositeOperation = 'destination-out'
  traceShipHull(ctx)
  ctx.fill()
  const legs = [
    [{ x: 853, y: 532 }, { x: 835, y: 645 }],
    [{ x: 888, y: 538 }, { x: 868, y: 641 }],
    [{ x: 1177, y: 531 }, { x: 1193, y: 645 }],
    [{ x: 1210, y: 528 }, { x: 1234, y: 637 }],
  ]
  ctx.lineWidth = 28
  ctx.lineCap = 'round'
  for (const [from, to] of legs) {
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
  }
  ctx.restore()
}

function clearCosmosOcclusions(ctx: CanvasRenderingContext2D) {
  ctx.save()
  ctx.globalCompositeOperation = 'destination-out'
  traceTerrain(ctx)
  ctx.fill()
  traceShipHull(ctx)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(264, 141, 112, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

type SurfaceRegion = {
  centerX: number
  centerY: number
  rx: number
  ry: number
  phase: number
  points: number
}

function surfaceRegionFor(patch: LifePatch, reveal: number): SurfaceRegion {
  const amount = smoothstep(.08, 1, reveal)
  const random = randomFor(patch.seed ^ 0x91e10da5)
  const reach = .26 + amount * .74
  const horizonBias = Math.max(-.08, Math.min(1, (patch.root.x - 520) / 620))
  const centerX = patch.root.x - 55 + horizonBias * 235 + (random() - .5) * 64
  return {
    centerX,
    centerY: Math.max(terrainTopAt(centerX) + 72, patch.root.y - 94 - random() * 48),
    rx: (255 + random() * 135) * reach,
    ry: (165 + random() * 85) * reach,
    phase: random() * Math.PI * 2,
    points: 13,
  }
}

function traceSurfaceRegion(ctx: CanvasRenderingContext2D, region: SurfaceRegion) {
  ctx.beginPath()
  for (let index = 0; index < region.points; index++) {
    const angle = index / region.points * Math.PI * 2
    const jag = .78 + .14 * Math.sin(angle * 3 + region.phase) + .07 * Math.sin(angle * 7 - region.phase)
    const x = Math.round(region.centerX + Math.cos(angle) * region.rx * jag)
    const y = Math.round(region.centerY + Math.sin(angle) * region.ry * jag)
    if (!index) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

/** Full-surface colour lives beneath the grayscale artwork and is revealed by
 * irregular, softly feathered regions. The grayscale image continues to carry
 * every rock, crevice and shadow, so this never paints over authored detail. */
export function drawPlanetSurfaceRegions(
  ctx: CanvasRenderingContext2D,
  entries: Array<{ patch: LifePatch; reveal: number }>,
) {
  if (!entries.length) return
  ctx.save()
  ctx.imageSmoothingEnabled = false
  traceTerrain(ctx)
  ctx.clip()
  const textureColors = ['#596b36', '#7d8439', '#9b7a39', '#99553b', '#39645d', '#4b5142']
  entries.forEach(({ patch, reveal }, entryIndex) => {
    const amount = smoothstep(.08, 1, reveal)
    if (amount <= 0) return
    const random = randomFor(patch.seed ^ 0x91e10da5)
    const region = surfaceRegionFor(patch, reveal)
    const { centerX, centerY, rx, ry } = region
    ctx.save()
    traceSurfaceRegion(ctx, region)
    ctx.save()
    ctx.shadowColor = terrainPatchColor(patch, entryIndex)
    ctx.shadowBlur = 4
    const regionColor = mixPaletteColor(terrainPatchColor(patch, entryIndex), entryIndex % 3 === 0 ? '#65723b' : '#75613d', .48)
    ctx.fillStyle = regionColor
    ctx.globalAlpha = (.18 + amount * .27) * Math.min(1, .74 + entries.length * .045)
    ctx.fill()
    ctx.restore()
    ctx.clip()

    // Mineral, soil and moss fragments stay inside the same reveal mask. Their
    // short, uneven marks retain the project's pixel texture at every scale.
    const fleckCount = 96
    for (let index = 0; index < fleckCount; index++) {
      const theta = random() * Math.PI * 2
      const radius = Math.sqrt(random())
      const x = Math.round(centerX + Math.cos(theta) * rx * radius)
      const y = Math.round(centerY + Math.sin(theta) * ry * radius)
      if (y < terrainTopAt(x) + 3 || random() > amount) continue
      const colorIndex = (index + patch.flowerKind) % textureColors.length
      ctx.fillStyle = index % 5 === 0 ? terrainPatchColor(patch, colorIndex) : textureColors[colorIndex]
      ctx.globalAlpha = .28 + amount * (index % 5 === 0 ? .56 : .42)
      const width = index % 7 === 0 ? 10 : index % 3 === 0 ? 6 : 2
      ctx.fillRect(x, y, width, index % 6 === 0 ? 2 : 1)
    }
    ctx.restore()
  })
  ctx.restore()
}

/** Adds new living structure above the restored rock colour. These are
 * low-growing mosses and lichens rather than flowers, and are clipped to the
 * same choice-driven surface regions. */
export function drawSurfaceGrowth(
  ctx: CanvasRenderingContext2D,
  entries: Array<{ patch: LifePatch; reveal: number }>,
) {
  if (!entries.length) return
  const moss = ['#536d25', '#75852e', '#9a8b34', '#3f6944', '#a45e36', '#b08a43']
  ctx.save()
  ctx.imageSmoothingEnabled = false
  traceTerrain(ctx)
  ctx.clip()
  entries.forEach(({ patch, reveal }, entryIndex) => {
    const amount = smoothstep(.16, 1, reveal)
    if (amount <= 0) return
    const region = surfaceRegionFor(patch, reveal)
    const random = randomFor(patch.seed ^ 0x4c495645)
    ctx.save()
    traceSurfaceRegion(ctx, region)
    ctx.clip()

    // Ground-hugging veins make separate colonies visibly connect to the
    // authored rock cracks without becoming another coloured halo.
    const veinCount = 7 + Math.round(amount * 9)
    for (let index = 0; index < veinCount; index++) {
      if (index / veinCount > amount) break
      const startX = Math.round(region.centerX + (random() - .5) * region.rx * 1.3)
      const startY = Math.max(terrainTopAt(startX) + 8, Math.round(region.centerY + (random() - .5) * region.ry * 1.2))
      const direction = random() > .5 ? 1 : -1
      const length = 20 + random() * (48 + amount * 54)
      ctx.beginPath()
      ctx.moveTo(startX, startY)
      for (let segment = 1; segment <= 4; segment++) {
        const t = segment / 4
        const x = Math.round(startX + direction * length * t)
        const y = Math.round(startY + Math.sin(t * Math.PI * 1.5) * (3 + random() * 5) + (random() - .5) * 4)
        ctx.lineTo(x, y)
      }
      ctx.strokeStyle = moss[(index + patch.flowerKind) % moss.length]
      ctx.globalAlpha = .34 + amount * .36
      ctx.lineWidth = index % 3 === 0 ? 2 : 1
      ctx.setLineDash(index % 2 ? [3, 3, 1, 4] : [6, 3])
      ctx.stroke()
    }
    ctx.setLineDash([])

    // Uneven multi-pixel colonies read as real moss/lichen growth instead of
    // a surface tint. Density increases continuously with the planted share.
    const colonyCount = 15 + Math.round(amount * 22)
    for (let index = 0; index < colonyCount; index++) {
      if (random() > amount) continue
      const theta = random() * Math.PI * 2
      const radius = Math.sqrt(random()) * .78
      const x = Math.round(region.centerX + Math.cos(theta) * region.rx * radius)
      const y = Math.round(region.centerY + Math.sin(theta) * region.ry * radius)
      if (y < terrainTopAt(x) + 6) continue
      const color = moss[(index + patch.flowerKind + entryIndex) % moss.length]
      const scale = random() > .86 ? 2 : 1
      const satellites = 3 + Math.round(random() * (2 + amount * 3))
      ctx.fillStyle = color
      ctx.globalAlpha = .52 + amount * .34
      for (let cell = 0; cell < satellites; cell++) {
        const cellX = x + Math.round((random() - .5) * 18)
        const cellY = y + Math.round((random() - .5) * 7)
        ctx.fillRect(cellX, cellY, (3 + Math.round(random() * 4)) * scale, (1 + Math.round(random())) * scale)
        if (cell % 2 === 0) ctx.fillRect(cellX + (random() > .5 ? 2 : -2), cellY - 2, 3, 2)
      }
      if (amount > .56 && index % 3 === 0) {
        const stem = 3 + Math.round(random() * 5)
        ctx.fillRect(x + 2, y - stem, 1, stem)
        ctx.fillRect(x - 1, y - stem + 1, 3, 2)
        ctx.fillRect(x + 2, y - stem - 1, 3, 2)
      }
    }
    ctx.restore()
  })
  ctx.restore()
}

const STAR_CLUSTER_SPECS = [
  ['garden-stars', 690, 310, 230, 108, -.28, .82, ['#416bb2', '#7658b8', '#d9d9e8', '#c8a36a'], 46],
  ['galaxy-near', 535, 365, 260, 72, -.34, .84, ['#263f83', '#7040a0', '#b05f9d', '#d7cfe2'], 68],
  ['galaxy-core', 850, 260, 330, 78, -.34, .87, ['#365caa', '#7752b5', '#b86da5', '#eee5dd'], 104],
  ['earth-stars', 345, 150, 210, 130, -.1, .89, ['#315b9a', '#6551a2', '#d5d9e8', '#d3a968'], 48],
  ['galaxy-right', 1200, 150, 360, 78, -.34, .91, ['#273d80', '#68419b', '#a45a9b', '#d8d5e2'], 96],
  ['ship-stars', 1040, 315, 320, 150, -.12, .93, ['#345c9c', '#624c9c', '#c8c4dc', '#d7ad70'], 62],
  ['deep-space', 1430, 245, 250, 195, -.18, .95, ['#284b88', '#654188', '#a16b9e', '#d3d5e2'], 68],
  ['far-left-stars', 170, 360, 210, 240, -.08, .975, ['#315b8d', '#63528e', '#d4d6df', '#b78e5c'], 62],
] as const

export function buildStarClusters(): StarCluster[] {
  return STAR_CLUSTER_SPECS.map(spec => {
    const [id, x, y, radiusX, radiusY, angle, activationThreshold, palette, count] = spec
    const random = randomFor(getLifePatchSeed(Math.round(x + y), id))
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const points = Array.from({ length: count }, (_, index) => {
      const theta = random() * Math.PI * 2
      const radius = Math.sqrt(random())
      const localX = Math.cos(theta) * radiusX * radius
      const localY = Math.sin(theta) * radiusY * radius
      return {
        x: Math.round(x + localX * cos - localY * sin),
        y: Math.round(y + localX * sin + localY * cos),
        size: random() > .88 ? 5 : random() > .46 ? 3 : 2,
        color: Math.floor(random() * palette.length),
        dust: index % 3 !== 0,
        threshold: activationThreshold + random() * Math.max(.012, 1 - activationThreshold),
      }
    })
    return { id, x, y, radiusX, radiusY, angle, activationThreshold, palette, points }
  })
}

export function drawStarClusters(ctx: CanvasRenderingContext2D, clusters: StarCluster[], vitality: number) {
  ctx.save()
  ctx.imageSmoothingEnabled = false
  const galaxy = stagedEnvironmentProgress(vitality).galaxy
  if (galaxy <= 0) {
    ctx.restore()
    return
  }

  // NASA's multi-wavelength galactic-centre imagery is used as the colour
  // logic: indigo space, violet/magenta dust, a pale silver core and sparse
  // warm stellar knots. Several translucent filaments avoid a flat purple bar.
  ctx.save()
  ctx.translate(900, 258)
  ctx.rotate(-.33)
  const bands = [
    { rx: 735, ry: 96, color: '#263d86', alpha: .42 },
    { rx: 680, ry: 61, color: '#7044a2', alpha: .58 },
    { rx: 610, ry: 32, color: '#b05d9d', alpha: .38 },
    { rx: 560, ry: 12, color: '#e5dfdf', alpha: .46 },
  ]
  for (const band of bands) {
    ctx.save()
    ctx.scale(band.rx, band.ry)
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
    gradient.addColorStop(0, band.color)
    gradient.addColorStop(.42, band.color)
    gradient.addColorStop(1, '#00000000')
    ctx.beginPath()
    ctx.arc(0, 0, galaxy, 0, Math.PI * 2)
    ctx.fillStyle = gradient
    ctx.globalAlpha = band.alpha * galaxy
    ctx.fill()
    ctx.restore()
  }
  ctx.restore()

  for (const cluster of clusters) {
    const reveal = smoothstep(cluster.activationThreshold, Math.min(1, cluster.activationThreshold + .07), vitality)
    if (reveal <= 0) continue
    // A hard-edged, irregular colour field sits over the authored luminance.
    // With CSS `mix-blend-mode: color`, only existing stars and Milky Way dust
    // receive hue; the surrounding black pixels remain black.
    ctx.save()
    ctx.translate(cluster.x, cluster.y)
    ctx.rotate(cluster.angle)
    ctx.beginPath()
    const polygonPoints = 14
    const phase = (getLifePatchSeed(Math.round(cluster.x), cluster.id) % 628) / 100
    for (let index = 0; index < polygonPoints; index++) {
      const angle = index / polygonPoints * Math.PI * 2
      const jag = .72 + .15 * Math.sin(angle * 3 + phase) + .08 * Math.sin(angle * 7 - phase)
      const x = Math.round(Math.cos(angle) * cluster.radiusX * jag * reveal)
      const y = Math.round(Math.sin(angle) * cluster.radiusY * jag * reveal)
      if (!index) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fillStyle = cluster.palette[cluster.id.length % cluster.palette.length]
    ctx.globalAlpha = .5 * reveal
    ctx.filter = 'blur(8px)'
    ctx.fill()
    ctx.filter = 'none'
    ctx.restore()
    for (const point of cluster.points) {
      if (vitality < point.threshold) continue
      ctx.fillStyle = cluster.palette[point.color % cluster.palette.length]
      ctx.globalAlpha = (point.dust ? .2 : .72) * reveal
      if (point.dust) ctx.fillRect(point.x, point.y, point.size + 5, point.size > 3 ? 2 : 1)
      else ctx.fillRect(point.x, point.y, point.size, point.size)
    }
  }
  clearCosmosOcclusions(ctx)
  ctx.restore()
}

/** Screen-blended stellar points are intentionally separate from the colour
 * layer: this lets the Milky Way tint authored dust while isolated stars can
 * still illuminate the surrounding deep sky. */
export function drawCosmosSparkles(ctx: CanvasRenderingContext2D, clusters: StarCluster[], vitality: number) {
  const galaxy = stagedEnvironmentProgress(vitality).galaxy
  if (galaxy <= 0) return
  ctx.save()
  ctx.imageSmoothingEnabled = false
  const skyRandom = randomFor(0x53544152)
  const skyPalette = ['#4f79bd', '#8065b6', '#bb79a9', '#e2e0e8', '#d0a267']
  for (let index = 0; index < 230; index++) {
    const x = Math.round(skyRandom() * 1672)
    const threshold = .82 + skyRandom() * .18
    const tone = skyRandom()
    const sizeRoll = skyRandom()
    if (vitality < threshold) continue
    const maxY = Math.max(40, terrainTopAt(x) - 18)
    const y = Math.round(18 + skyRandom() * (maxY - 18))
    const size = sizeRoll > .93 ? 3 : sizeRoll > .6 ? 2 : 1
    ctx.fillStyle = skyPalette[Math.floor(tone * skyPalette.length) % skyPalette.length]
    ctx.globalAlpha = (.32 + skyRandom() * .5) * galaxy
    ctx.fillRect(x, y, size, size)
    if (size === 3) {
      ctx.globalAlpha *= .34
      ctx.fillRect(x - 2, y + 1, 7, 1)
      ctx.fillRect(x + 1, y - 2, 1, 7)
    }
  }
  for (const cluster of clusters) {
    const reveal = smoothstep(cluster.activationThreshold, Math.min(1, cluster.activationThreshold + .07), vitality)
    if (reveal <= 0) continue
    for (const point of cluster.points) {
      if (vitality < point.threshold || point.dust) continue
      ctx.fillStyle = cluster.palette[point.color % cluster.palette.length]
      ctx.globalAlpha = .68 * reveal
      ctx.fillRect(point.x, point.y, point.size, point.size)
    }
  }
  clearCosmosOcclusions(ctx)
  ctx.restore()
}

function patchColor(patch: LifePatch, index: number) {
  return [patch.palette.flower, patch.palette.plant, patch.palette.mineral][index % 3]
}

function terrainPatchColor(patch: LifePatch, index: number) {
  const natural = ['#5c6750', '#756449', '#5a6b6d'][index % 3]
  return mixPaletteColor(patchColor(patch, index), natural, .42)
}

function drawLobe(ctx: CanvasRenderingContext2D, patch: LifePatch, lobe: LifePatch['lobes'][number], reveal: number) {
  const amount = smoothstep(0, 1, reveal)
  const rx = Math.max(2, lobe.rx * (.16 + amount * .84))
  const ry = Math.max(2, lobe.ry * (.18 + amount * .82))
  ctx.beginPath()
  for (let index = 0; index < lobe.points; index++) {
    const angle = index / lobe.points * Math.PI * 2
    const jag = .76 + .19 * Math.sin(angle * 3 + lobe.phase) + .09 * Math.sin(angle * 5 + lobe.phase * .7)
    const x = Math.round(patch.root.x + (lobe.x - patch.root.x) * amount + Math.cos(angle) * rx * jag)
    const y = Math.round(patch.root.y + (lobe.y - patch.root.y) * amount + Math.sin(angle) * ry * jag)
    if (!index) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  const color = terrainPatchColor(patch, lobe.color)
  ctx.fillStyle = color
  ctx.shadowColor = color
  ctx.shadowBlur = 3
  ctx.globalAlpha = .25 + amount * .31
  ctx.fill()
  ctx.shadowBlur = 0
}

export function drawLifePatch(ctx: CanvasRenderingContext2D, patch: LifePatch, revealProgress = 1) {
  const reveal = Math.max(0, Math.min(1, revealProgress))
  if (reveal <= 0) return
  ctx.save()
  ctx.imageSmoothingEnabled = false
  for (const lobe of patch.lobes) drawLobe(ctx, patch, lobe, reveal)
  const visibleVeins = Math.max(1, Math.ceil(patch.veins.length * smoothstep(.22, .82, reveal)))
  patch.veins.slice(0, visibleVeins).forEach((vein, veinIndex) => {
    const points = vein.slice(0, Math.max(2, Math.ceil(vein.length * reveal)))
    ctx.beginPath()
    points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y))
    ctx.strokeStyle = patchColor(patch, veinIndex + 1)
    ctx.globalAlpha = .42 + reveal * .34
    ctx.lineWidth = veinIndex % 2 ? 2 : 4
    ctx.setLineDash(veinIndex % 2 ? [5, 5] : [8, 4, 2, 5])
    ctx.stroke()
  })
  ctx.setLineDash([])
  patch.flecks.forEach(fleck => {
    if (fleck.threshold > reveal) return
    ctx.globalAlpha = .42 + reveal * .38
    ctx.fillStyle = patchColor(patch, fleck.color)
    ctx.fillRect(fleck.x, fleck.y, fleck.size, fleck.size)
  })
  ctx.restore()
}

/** Sparse highlights make the first awakening readable without turning the
 * whole patch into a glow. This is drawn on a separate screen-blended layer. */
export function drawLifeCracks(ctx: CanvasRenderingContext2D, patch: LifePatch, revealProgress = 1) {
  const reveal = Math.max(0, Math.min(1, revealProgress))
  if (reveal < .18) return
  ctx.save()
  ctx.imageSmoothingEnabled = false
  const visible = Math.max(1, Math.ceil(patch.veins.length * smoothstep(.18, .72, reveal)))
  patch.veins.slice(0, visible).forEach((vein, index) => {
    const points = vein.slice(0, Math.max(2, Math.ceil(vein.length * reveal)))
    ctx.beginPath()
    points.forEach((point, pointIndex) => pointIndex ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y))
    ctx.strokeStyle = index % 2 ? patch.palette.mineral : patch.palette.flower
    ctx.globalAlpha = (.16 + reveal * .22) * (index ? .72 : 1)
    ctx.lineWidth = index ? 1 : 2
    ctx.setLineDash(index ? [3, 6] : [7, 4, 2, 6])
    ctx.stroke()
  })
  ctx.setLineDash([])
  patch.flecks.forEach((fleck, index) => {
    if (fleck.threshold > reveal || index % 3) return
    ctx.fillStyle = index % 2 ? patch.palette.mineral : patch.palette.flower
    ctx.globalAlpha = .14 + reveal * .2
    ctx.fillRect(fleck.x, fleck.y, Math.min(3, fleck.size), 1)
  })
  ctx.restore()
}

function fillPolygon(ctx: CanvasRenderingContext2D, points: GroundPoint[], color: string, alpha: number) {
  ctx.beginPath()
  points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y))
  ctx.closePath()
  ctx.fillStyle = color
  ctx.globalAlpha = alpha
  ctx.fill()
}

export function drawEnvironmentColor(ctx: CanvasRenderingContext2D, vitality: number) {
  const progress = stagedEnvironmentProgress(vitality)
  ctx.save()
  ctx.imageSmoothingEnabled = false

  // Colour climbs from the soil through individual feet and the ramp before it
  // is allowed to reach the hull. The polygons follow authored ship panels.
  fillPolygon(ctx, [{ x: 835, y: 638 }, { x: 852, y: 542 }, { x: 878, y: 536 }, { x: 868, y: 640 }], '#597783', progress.shipFeet * .72)
  fillPolygon(ctx, [{ x: 1162, y: 639 }, { x: 1172, y: 533 }, { x: 1200, y: 532 }, { x: 1190, y: 642 }], '#98704c', progress.shipFeet * .68)
  fillPolygon(ctx, [{ x: 1090, y: 599 }, { x: 1178, y: 550 }, { x: 1214, y: 561 }, { x: 1120, y: 620 }], '#7f7160', progress.shipRamp * .68)
  fillPolygon(ctx, [{ x: 817, y: 553 }, { x: 826, y: 401 }, { x: 864, y: 379 }, { x: 968, y: 362 }, { x: 976, y: 555 }], '#3d6070', progress.shipHull * .78)
  fillPolygon(ctx, [{ x: 968, y: 362 }, { x: 1066, y: 357 }, { x: 1145, y: 378 }, { x: 1146, y: 555 }, { x: 974, y: 555 }], '#576771', progress.shipHull * .76)
  fillPolygon(ctx, [{ x: 1142, y: 379 }, { x: 1238, y: 416 }, { x: 1260, y: 540 }, { x: 1220, y: 560 }, { x: 1142, y: 554 }], '#425e69', progress.shipHull * .76)
  fillPolygon(ctx, [{ x: 860, y: 388 }, { x: 925, y: 367 }, { x: 946, y: 552 }, { x: 871, y: 560 }], '#35576a', progress.shipHull * .58)
  fillPolygon(ctx, [{ x: 944, y: 364 }, { x: 1013, y: 354 }, { x: 1027, y: 552 }, { x: 954, y: 553 }], '#6e6862', progress.shipHull * .55)
  fillPolygon(ctx, [{ x: 933, y: 400 }, { x: 1008, y: 376 }, { x: 1022, y: 424 }, { x: 948, y: 445 }], '#9a744f', progress.shipDetails * .42)
  fillPolygon(ctx, [{ x: 1086, y: 402 }, { x: 1123, y: 402 }, { x: 1132, y: 524 }, { x: 1094, y: 525 }], '#547a86', progress.shipDetails * .66)
  ctx.beginPath()
  ctx.arc(1138, 468, 66, 0, Math.PI * 2)
  ctx.fillStyle = '#354f59'
  ctx.globalAlpha = progress.shipHull * .52
  ctx.fill()
  ctx.beginPath()
  ctx.arc(1138, 468, 66, -.72, .66)
  ctx.strokeStyle = '#c18a48'
  ctx.globalAlpha = progress.shipDetails * .5
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(1138, 468, 66, 2.2, 3.9)
  ctx.stroke()
  ctx.fillStyle = '#d7a65b'
  ctx.globalAlpha = progress.shipDetails * .62
  ctx.fillRect(1100, 433, 4, 17)
  ctx.fillRect(1191, 446, 4, 16)

  // Earth is restored in irregular ocean and land fragments under a circular
  // clip; its original clouds, shade and rim remain visible above the colour.
  ctx.save()
  ctx.beginPath()
  ctx.arc(264, 141, 101, 0, Math.PI * 2)
  ctx.clip()
  fillPolygon(ctx, [{ x: 180, y: 98 }, { x: 232, y: 61 }, { x: 294, y: 76 }, { x: 317, y: 124 }, { x: 282, y: 158 }, { x: 215, y: 151 }, { x: 174, y: 128 }], '#4e8198', progress.earthOcean * .58)
  fillPolygon(ctx, [{ x: 235, y: 142 }, { x: 284, y: 119 }, { x: 337, y: 139 }, { x: 345, y: 184 }, { x: 301, y: 214 }, { x: 244, y: 191 }], '#547f92', progress.earthOcean * .52)
  fillPolygon(ctx, [{ x: 211, y: 91 }, { x: 249, y: 78 }, { x: 270, y: 103 }, { x: 252, y: 130 }, { x: 219, y: 122 }], '#73835e', progress.earthLand * .43)
  fillPolygon(ctx, [{ x: 277, y: 151 }, { x: 318, y: 139 }, { x: 337, y: 167 }, { x: 315, y: 195 }, { x: 284, y: 185 }], '#7c825e', progress.earthComplete * .38)
  ctx.restore()
  ctx.restore()
}

export function drawEnvironmentLight(ctx: CanvasRenderingContext2D, vitality: number) {
  const progress = stagedEnvironmentProgress(vitality)
  if (progress.shipDetails <= 0) return
  ctx.save()
  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = '#f2b85d'
  ctx.shadowColor = '#d37b2d'
  ctx.shadowBlur = 9
  ctx.globalAlpha = progress.shipDetails * .78
  ;[[877, 433, 4, 17], [945, 420, 4, 15], [1100, 433, 4, 18], [1191, 446, 4, 17], [1230, 473, 3, 14]].forEach(([x, y, width, height]) => ctx.fillRect(x, y, width, height))
  ctx.shadowBlur = 0
  ctx.strokeStyle = '#e4a24b'
  ctx.lineWidth = 2
  ctx.globalAlpha = progress.shipDetails * .64
  ctx.beginPath()
  ctx.arc(1138, 468, 66, -.72, .66)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(1138, 468, 66, 2.2, 3.9)
  ctx.stroke()
  ctx.restore()
}
