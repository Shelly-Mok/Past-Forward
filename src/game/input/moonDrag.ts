export type MoonRelease = 'dock' | 'return'

const clamp = (value: number) => Math.max(0, Math.min(1, value))

export function projectedDragProgress(
  startProgress: number,
  pointerX: number,
  pointerY: number,
  routeX: number,
  routeY: number,
) {
  const routeLengthSquared = routeX * routeX + routeY * routeY
  if (routeLengthSquared <= 0) return clamp(startProgress)
  const projected = (pointerX * routeX + pointerY * routeY) / routeLengthSquared
  return clamp(startProgress + projected)
}

export function resolveMoonRelease(progress: number, threshold = 0.78): MoonRelease {
  return progress >= threshold ? 'dock' : 'return'
}
