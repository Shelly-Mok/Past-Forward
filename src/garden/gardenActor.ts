import { flowerDuration } from './flowerLifecycle'

export type GroundPoint = { x: number; y: number }
export type ActorPhase = 'idle' | 'turning' | 'walking' | 'kneeling' | 'planting' | 'rising' | 'observing' | 'touching' | 'greeting' | 'boarding'
export type ActorEvent =
  | { type: 'phase'; phase: ActorPhase }
  | { type: 'seed' | 'complete'; chapter: number; revisit: boolean }
  | { type: 'boarded' }
export const GARDEN_HOME = { x: 1380, y: 616 }
/** Planted flowers sit on the near lunar soil, below the ship-exit row. */
export const PLANTED_SOIL_Y = 776
export const GARDEN_SOIL = [568, 836, 1104, 1372].map(x => ({ x, y: PLANTED_SOIL_Y }))
export const CHOICE_DOOR = { x: 1146, y: 470 }
export const RAMP_FOOT = { x: 1216, y: 612 }
export const BOARDING_DOOR = { x: 1148, y: 504 }
/** Circular hatch on the archive ship; the rift opens from here. */
export const SHIP_HATCH = { x: CHOICE_DOOR.x / 1672 * 100, y: CHOICE_DOOR.y / 941 * 100 }
const RAMP_LANE_X = RAMP_FOOT.x

/** How many flowers stay on the front soil before spilling to the ship's right. */
export const FRONT_PAD_CAP = 6

export function choiceLane(index: number, count: number): 'front' | 'starboard' {
  return count > FRONT_PAD_CAP && index >= FRONT_PAD_CAP ? 'starboard' : 'front'
}

function frontPads(count: number): GroundPoint[] {
  const n = Math.max(1, count)
  const left = n > 3 ? 520 : 620
  const right = n > 3 ? 1140 : 1080
  return Array.from({ length: n }, (_, index) => {
    const t = n === 1 ? 0.5 : index / (n - 1)
    const arch = 1 - 4 * (t - 0.5) * (t - 0.5)
    return {
      x: Math.round(left + t * (right - left)),
      y: Math.round(640 - arch * 16),
    }
  })
}

/** Extra flowers sit on the far lunar shelf, right of the ship — smaller, nearer the horizon. */
function starboardPads(count: number): GroundPoint[] {
  const shelf = [
    { x: 1488, y: 598 },
    { x: 1564, y: 646 },
    { x: 1508, y: 696 },
    { x: 1576, y: 742 },
  ]
  return Array.from({ length: Math.max(1, count) }, (_, index) => {
    if (index < shelf.length) return shelf[index]
    return { x: 1508 + (index % 2) * 56, y: 742 + (index - 3) * 52 }
  })
}

/** Front soil arc first; overflow goes to the ship's starboard. */
export function choicePads(count: number): GroundPoint[] {
  const n = Math.max(1, count)
  if (n <= FRONT_PAD_CAP) return frontPads(n)
  return [...frontPads(FRONT_PAD_CAP), ...starboardPads(n - FRONT_PAD_CAP)]
}
export function soilForAge(age: number, currentAge: number | null = null): GroundPoint {
  const span = Math.max(40, currentAge ?? 80)
  const t = Math.max(0, Math.min(1, age / span))
  return { x: 520 + t * 860, y: PLANTED_SOIL_Y }
}

/** Keep planted flowers from stacking when adjacent years are both grown. */
export function spreadGroundPoints(points: GroundPoint[], minGap = 100): GroundPoint[] {
  if (points.length <= 1) return points.map(point => ({ ...point }))
  const next = points.map(point => ({ ...point }))
  const left = 500
  const right = 1400
  for (let i = 1; i < next.length; i++) {
    if (next[i].x < next[i - 1].x + minGap) next[i].x = next[i - 1].x + minGap
  }
  const overflow = next[next.length - 1].x - right
  if (overflow > 0) {
    for (const point of next) point.x -= overflow
    if (next[0].x < left) {
      const span = right - left
      next.forEach((point, index) => {
        point.x = Math.round(left + index * span / (next.length - 1))
      })
    }
  }
  return next
}
const distance = (a: GroundPoint, b: GroundPoint) => Math.hypot(a.x - b.x, a.y - b.y)

/** Soil to ramp foot, then up the stairs into the hatch. */
export function boardPath(from: GroundPoint): GroundPoint[] {
  const mid = { x: 1182, y: 556 }
  const points = [{ ...from }]
  if (from.y >= 705) points.push({ x: RAMP_FOOT.x, y: from.y })
  else if (from.x > 1280) points.push({ x: from.x, y: RAMP_FOOT.y })
  if (distance(points.at(-1)!, RAMP_FOOT) > 10) points.push({ ...RAMP_FOOT })
  points.push(mid, { ...BOARDING_DOOR })
  return points.filter((p, i) => !i || distance(points[i - 1], p) > .01)
}

/** Authored foreground lane: approach the ramp from the garden, not through the hull. */
export function gardenPath(from: GroundPoint, to: GroundPoint): GroundPoint[] {
  const points = [{ ...from }]
  const leavingHigh = from.y < 705 && to.y >= 705
  const enteringHigh = from.y >= 705 && to.y < 705
  if (leavingHigh && from.x > 1300) points.push({ x: from.x, y: to.y })
  else if (leavingHigh) points.push({ x: RAMP_LANE_X, y: 682 }, { x: RAMP_LANE_X, y: to.y })
  else if (enteringHigh) points.push({ x: RAMP_LANE_X, y: from.y }, { x: RAMP_LANE_X, y: 682 })
  points.push({ ...to })
  return points.filter((p, i) => !i || distance(points[i - 1], p) > .01)
}
export function pathLength(points: GroundPoint[]) {
  return points.slice(1).reduce((sum, p, i) => sum + distance(points[i], p), 0)
}
export function pointOnPath(points: GroundPoint[], amount: number): GroundPoint {
  let remaining = pathLength(points) * Math.max(0, Math.min(1, amount))
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], length = distance(a, b)
    if (remaining <= length) {
      const t = length ? remaining / length : 1
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
    }
    remaining -= length
  }
  return { ...points.at(-1)! }
}

export class GardenActor {
  position: GroundPoint = { ...GARDEN_HOME }
  phase: ActorPhase = 'idle'
  facing = -1
  elapsed = 0
  walkDistance = 0
  growthElapsed = 0
  chapter: number | null = null
  revisit = false
  private mission: 'plant' | 'board' = 'plant'
  private route: GroundPoint[] = []
  private travelSeconds = 0
  get busy() { return this.phase !== 'idle' && this.phase !== 'greeting' }
  get duration() {
    return this.phase === 'walking' ? this.travelSeconds : this.phase === 'observing' ? Math.max(.01, flowerDuration(this.chapter!) - .7) : ({ idle: Infinity, turning: .16, kneeling: .34, planting: .38, rising: .32, touching: .48, greeting: .7, boarding: 1.18 }[this.phase])
  }
  get progress() { return Math.min(1, this.elapsed / this.duration) }
  start(chapter: number, soil: GroundPoint, revisit: boolean) {
    if (this.busy) return false
    this.mission = 'plant'
    this.chapter = chapter; this.revisit = revisit; this.growthElapsed = 0
    // Stand on the lunar soil beside the mound, not inside the flower.
    const target = { x: soil.x - 62, y: soil.y + 6 }
    this.route = gardenPath(this.position, target)
    this.travelSeconds = Math.max(.12, pathLength(this.route) / 260)
    this.facing = this.route.length > 1 && this.route[1].x < this.position.x ? -1 : 1
    this.phase = 'turning'; this.elapsed = 0; this.walkDistance = 0
    return true
  }
  walkTo(_target: GroundPoint) {
    if (this.busy) return false
    this.mission = 'board'
    this.chapter = null
    this.revisit = true
    this.growthElapsed = 0
    if (distance(this.position, BOARDING_DOOR) < 14) {
      this.facing = -1
      this.phase = 'boarding'
      this.elapsed = 0
      return true
    }
    this.route = boardPath(this.position)
    this.travelSeconds = Math.max(.4, pathLength(this.route) / 118)
    this.facing = this.route.length > 1 && this.route[1].x < this.position.x ? -1 : 1
    this.phase = 'turning'
    this.elapsed = 0
    this.walkDistance = 0
    return true
  }
  cancel() { this.phase = 'idle'; this.elapsed = 0; this.chapter = null; this.growthElapsed = 0; this.mission = 'plant' }
  greet() { if (!this.busy) { this.phase = 'greeting'; this.elapsed = 0 } }
  lookAt(x: number) { if (!this.busy) this.facing = x < this.position.x ? -1 : 1 }
  advance(dt: number): ActorEvent[] {
    const events: ActorEvent[] = []
    let remaining = Math.max(0, Math.min(dt, .12))
    if (this.phase === 'idle') { this.elapsed += remaining; return events }
    while (remaining > 0 && this.phase !== 'idle') {
      const used = Math.min(remaining, this.duration - this.elapsed)
      this.elapsed += used; remaining -= used
      if (['planting', 'rising', 'observing'].includes(this.phase)) this.growthElapsed += used
      if (this.phase === 'walking') {
        const t = this.progress
        // Ease only at endpoints; constant middle speed keeps the step cadence legible.
        const eased = t < .1 ? 5 * t * t / .9 : t > .9 ? 1 - 5 * (1 - t) ** 2 / .9 : (t - .05) / .9
        const next = pointOnPath(this.route, eased)
        if (Math.abs(next.x - this.position.x) > .05) this.facing = next.x < this.position.x ? -1 : 1
        this.walkDistance += distance(this.position, next)
        this.position = next
      }
      if (this.elapsed + .000001 < this.duration) break
      const previous = this.phase
      let completed: ActorEvent | undefined
      if (previous === 'turning') this.phase = 'walking'
      else if (previous === 'walking') {
        if (this.mission === 'board') this.phase = 'boarding'
        else { this.facing = 1; this.phase = this.revisit ? 'touching' : 'kneeling' }
      }
      else if (previous === 'kneeling') {
        this.phase = 'planting'
        events.push({ type: 'seed', chapter: this.chapter!, revisit: false })
      } else if (previous === 'planting') this.phase = 'rising'
      else if (previous === 'rising' && flowerDuration(this.chapter!) > .7) this.phase = 'observing'
      else {
        this.phase = 'idle'
        if (previous === 'boarding') events.push({ type: 'boarded' })
        else if (previous !== 'greeting') completed = { type: 'complete', chapter: this.chapter!, revisit: this.revisit }
      }
      this.elapsed = 0
      events.push({ type: 'phase', phase: this.phase })
      if (completed) events.push(completed)
    }
    return events
  }
}
