export type PortalWalkDirection = 'left' | 'away'

type PortalWaypoint = {
  x: number
  y: number
  scale: number
  direction: PortalWalkDirection
}

export type PortalRoutePoint = PortalWaypoint & {
  distance: number
}

// The route is deliberately slower than the arrival walk. The player first
// clears the chair and desk, then follows the right platform's diagonal seam
// toward the centre of the open vault.
export const PORTAL_WALK_SECONDS = 7.4
/** Hold-to-slide is a little quicker than the authored 7.4s walk. */
export const PORTAL_HOLD_SPEED = 1.22
/** One W tap on the open vault walk. Matches the 3.6 steps/sec cadence used while holding. */
export const PORTAL_STEP_RATE = 3.6
export const PORTAL_STEPS_PER_TAP = 3
export const PORTAL_TAP_PROGRESS = PORTAL_STEPS_PER_TAP / (PORTAL_WALK_SECONDS * PORTAL_STEP_RATE)

const PORTAL_ROUTE: PortalWaypoint[] = [
  { x: 1370, y: 602, scale: 0.78, direction: 'left' },
  { x: 1308, y: 614, scale: 0.79, direction: 'left' },
  { x: 1232, y: 611, scale: 0.78, direction: 'left' },
  { x: 1150, y: 598, scale: 0.76, direction: 'left' },
  { x: 1076, y: 578, scale: 0.73, direction: 'left' },
  { x: 1008, y: 561, scale: 0.70, direction: 'away' },
  { x: 946, y: 550, scale: 0.67, direction: 'away' },
  { x: 897, y: 543, scale: 0.64, direction: 'away' },
]

const SEGMENTS = PORTAL_ROUTE.slice(0, -1).map((from, index) => {
  const to = PORTAL_ROUTE[index + 1]
  return { from, to, length: Math.hypot(to.x - from.x, to.y - from.y) }
})

const ROUTE_LENGTH = SEGMENTS.reduce((total, segment) => total + segment.length, 0)
const clamp = (value: number) => Math.min(1, Math.max(0, value))
const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount

export function portalRoutePoint(progress: number): PortalRoutePoint {
  const distance = clamp(progress) * ROUTE_LENGTH
  let covered = 0

  for (const segment of SEGMENTS) {
    const end = covered + segment.length
    if (distance <= end) {
      const local = segment.length ? (distance - covered) / segment.length : 0
      return {
        x: lerp(segment.from.x, segment.to.x, local),
        y: lerp(segment.from.y, segment.to.y, local),
        scale: lerp(segment.from.scale, segment.to.scale, local),
        direction: local < 0.52 ? segment.from.direction : segment.to.direction,
        distance,
      }
    }
    covered = end
  }

  const last = PORTAL_ROUTE[PORTAL_ROUTE.length - 1]
  return { ...last, distance: ROUTE_LENGTH }
}
