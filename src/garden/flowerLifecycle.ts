// Zero-based indices into each row of the 8 × 16 lifecycle atlas. Every choice
// now grows into its own complete flower; age still selects the story chapter,
// but no longer substitutes a generic age-shaped plant.
export const FLOWER_ENDPOINTS = [15, 15, 15, 15, 15, 15, 15, 15] as const
export const FLOWER_POSES = [
  '种子落定', '破壳', '发芽', '第一片叶', '第二片叶', '短茎', '长茎', '花苞形成',
  '花苞膨胀', '花瓣初开', '三分之一开放', '半开', '四分之三开放', '完全盛放',
  '轻微呼吸', '稳定盛放',
]
// Every authored pose remains visible, but the complete sequence now resolves
// in roughly 1.5 seconds so repeated planting keeps a brisk game rhythm.
const HOLD = [.07, .06, .07, .07, .07, .08, .08, .09, .09, .09, .1, .1, .1, .12, .1, .16]
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
      const mixWindow = Math.min(.055, HOLD[pose])
      const mix = pose < end ? Math.max(0, Math.min(1, (remaining - HOLD[pose] + mixWindow) / mixWindow)) : 0
      return { pose, next: Math.min(end, pose + 1), mix }
    }
    remaining -= HOLD[pose]
  }
  return { pose: end, next: end, mix: 0 }
}
