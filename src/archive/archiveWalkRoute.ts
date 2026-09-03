export type WalkDirection = 'away' | 'right'

type WalkWaypoint = {
  x: number
  y: number
  scale: number
  direction: WalkDirection
}

export type WalkRoutePoint = WalkWaypoint & {
  distance: number
}

export const WALK_SECONDS = 8.8

// Follow the bridge first, round the near corner of the desk, then track its
// front edge toward the chair. Extra points around the corner prevent the
// character from reading as a sprite translated across a single horizontal.
const WALK_ROUTE: WalkWaypoint[] = [
  { x: 570, y: 785, scale: 1.18, direction: 'away' },
  { x: 735, y: 700, scale: 1.04, direction: 'away' },
  { x: 900, y: 582, scale: 0.82, direction: 'away' },
  { x: 980, y: 568, scale: 0.78, direction: 'right' },
  { x: 1072, y: 590, scale: 0.77, direction: 'right' },
  { x: 1140, y: 608, scale: 0.79, direction: 'right' },
  { x: 1248, y: 622, scale: 0.80, direction: 'right' },
  { x: 1342, y: 615, scale: 0.79, direction: 'right' },
  { x: 1370, y: 602, scale: 0.78, direction: 'right' },
]

const ROUTE_SEGMENTS = WALK_ROUTE.slice(0, -1).map((from, index) => {
  const to = WALK_ROUTE[index + 1]
  return {
    from,
    to,
    length: Math.hypot(to.x - from.x, to.y - from.y),
  }
})

const ROUTE_LENGTH = ROUTE_SEGMENTS.reduce((total, segment) => total + segment.length, 0)

const clamp = (value: number) => Math.min(1, Math.max(0, value))
const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount

export function routePoint(progress: number): WalkRoutePoint {
  const distance = clamp(progress) * ROUTE_LENGTH
  let covered = 0

  for (const segment of ROUTE_SEGMENTS) {
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

  const last = WALK_ROUTE[WALK_ROUTE.length - 1]
  return { ...last, distance: ROUTE_LENGTH }
}
