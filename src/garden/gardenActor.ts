import { flowerDuration } from './flowerLifecycle'

export type GroundPoint = { x: number; y: number }
export type ActorPhase = 'idle' | 'turning' | 'walking' | 'kneeling' | 'planting' | 'rising' | 'observing' | 'touching' | 'greeting' | 'boarding'
export type ActorEvent =
  | { type: 'phase'; phase: ActorPhase }
  | { type: 'seed' | 'complete'; chapter: number; revisit: boolean }
  | { type: 'boarded' }
export const GARDEN_HOME = { x: 1380, y: 616 }
export const GARDEN_SOIL = [568, 836, 1104, 1372].map(x => ({ x, y: 730 }))
export const CHOICE_DOOR = { x: 1372, y: 528 }
export const BOARDING_DOOR = { x: 1364, y: 548 }
/** Circular hatch on the archive ship; the rift opens from here. */
export const SHIP_HATCH = { x: CHOICE_DOOR.x / 1672 * 100, y: CHOICE_DOOR.y / 941 * 100 }

/** Landing arc to the right of the archive hatch. Count follows the year's choices. */
export function choicePads(count: number): GroundPoint[] {
  const n = Math.max(1, count)
  const span = 130 + n * 40
  return Array.from({ length: n }, (_, index) => {
    const t = n === 1 ? 0 : index / (n - 1) - 0.5
    return {
      x: Math.round(1524 + t * span),
      y: Math.round(710 - (1 - 4 * t * t) * 28),
    }
  })
}
export function soilForAge(age: number): GroundPoint {
  const band = age >= 80 ? 2 : age >= 40 ? 1 : 0
  const start = [0, 40, 80][band]
  const span = [40, 40, 20][band]
  const t = Math.max(0, Math.min(1, (age - start) / span))
  return { x: 520 + t * 860, y: 730 }
}
const distance = (a: GroundPoint, b: GroundPoint) => Math.hypot(a.x - b.x, a.y - b.y)

/** Authored foreground lane: never cut through the archive cabin or ramp. */
export function gardenPath(from: GroundPoint, to: GroundPoint): GroundPoint[] {
  const points = [{ ...from }]
  const leavingHigh = from.y < 705 && to.y >= 705
  const enteringHigh = from.y >= 705 && to.y < 705
  if (leavingHigh) points.push({ x: 1380, y: 682 }, { x: 1345, y: 730 })
  else if (enteringHigh) points.push({ x: 1345, y: 730 }, { x: 1380, y: 682 })
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
    return this.phase === 'walking' ? this.travelSeconds : this.phase === 'observing' ? Math.max(.01, flowerDuration(this.chapter!) - 1.46) : ({ idle: Infinity, turning: .28, kneeling: .66, planting: .8, rising: .66, touching: .75, greeting: .7, boarding: 1.18 }[this.phase])
  }
  get progress() { return Math.min(1, this.elapsed / this.duration) }
  start(chapter: number, soil: GroundPoint, revisit: boolean) {
    if (this.busy) return false
    this.mission = 'plant'
    this.chapter = chapter; this.revisit = revisit; this.growthElapsed = 0
    // Stand beside the chapter's halo, never inside the flower silhouette.
    // The hand places its seed at the near edge of this patch of soil.
    const target = { x: soil.x - 62, y: soil.y }
    this.route = gardenPath(this.position, target)
    this.travelSeconds = Math.max(.15, pathLength(this.route) / 154)
    this.facing = this.route.length > 1 && this.route[1].x < this.position.x ? -1 : 1
    this.phase = 'turning'; this.elapsed = 0; this.walkDistance = 0
    return true
  }
  walkTo(target: GroundPoint) {
    if (this.busy) return false
    this.mission = 'board'
    this.chapter = null
    this.revisit = true
    this.growthElapsed = 0
    if (distance(this.position, target) < 14) {
      this.facing = 1
      this.phase = 'boarding'
      this.elapsed = 0
      return true
    }
    this.route = gardenPath(this.position, target)
    this.travelSeconds = Math.max(.15, pathLength(this.route) / 154)
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
      else if (previous === 'rising' && flowerDuration(this.chapter!) > 1.46) this.phase = 'observing'
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
