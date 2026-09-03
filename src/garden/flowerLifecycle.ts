// Zero-based indices into the approved sixteen-pose lifecycle atlas.
export const FLOWER_ENDPOINTS = [0, 5, 7, 10, 12, 13, 15, 15] as const
export const FLOWER_POSES = ['种子落定', '破壳', '发芽', '长叶', '结苞', '含苞', '花苞舒展', '微微开放', '渐开', '半开', '盛放', '花瓣低垂', '初落', '渐落', '残瓣', '结籽']
// Hold visible poses; bud opening and the first complete bloom get extra time.
const HOLD = [.6, .32, .4, .4, .4, .52, .42, .46, .4, .4, .6, .42, .46, .46, .46, .6]
export function flowerEndpoint(chapter: number) { return FLOWER_ENDPOINTS[Math.max(0, Math.min(7, Math.trunc(chapter)))] }
export function flowerDuration(chapter: number) {
  return HOLD.slice(0, flowerEndpoint(chapter) + 1).reduce((sum, seconds) => sum + seconds, 0)
}
export function flowerPoseAt(chapter: number, elapsed: number) {
  const end = flowerEndpoint(chapter)
  let remaining = Math.max(0, elapsed)
  for (let pose = 0; pose <= end; pose++) {
    if (remaining < HOLD[pose] || pose === end) {
      // Brief blending only between adjacent poses; no scale transforms or skipped stages.
      const mix = pose < end ? Math.max(0, Math.min(1, (remaining - HOLD[pose] + .12) / .12)) : 0
      return { pose, next: Math.min(end, pose + 1), mix }
    }
    remaining -= HOLD[pose]
  }
  return { pose: end, next: end, mix: 0 }
}
