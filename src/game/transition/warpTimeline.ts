export type WarpPhase = 'returning' | 'accelerating' | 'splitting' | 'crossing' | 'arrived'

export interface WarpSample {
  elapsed: number
  phase: WarpPhase
  returnProgress: number
  travelProgress: number
  velocity: number
  splitPulse: number
  crossingProgress: number
  arrivalProgress: number
  complete: boolean
}

export const WARP_DURATION_SECONDS = 6.8

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))

const smoothstep = (start: number, end: number, value: number) => {
  const amount = clamp((value - start) / (end - start))
  return amount * amount * (3 - 2 * amount)
}

const pulse = (start: number, peakStart: number, peakEnd: number, end: number, value: number) => {
  const enter = smoothstep(start, peakStart, value)
  const leave = 1 - smoothstep(peakEnd, end, value)
  return Math.min(enter, leave)
}

export function sampleWarpTimeline(elapsedSeconds: number): WarpSample {
  const elapsed = clamp(elapsedSeconds, 0, WARP_DURATION_SECONDS)
  const returnProgress = smoothstep(0, 1.35, elapsed)
  const travelProgress = smoothstep(0.82, 5.72, elapsed)
  const velocity = pulse(0.92, 2.35, 4.65, 5.88, elapsed)
  const splitPulse = pulse(2.72, 3.18, 4.18, 4.76, elapsed)
  const crossingProgress = smoothstep(4.12, 5.82, elapsed)
  const arrivalProgress = smoothstep(5.35, WARP_DURATION_SECONDS, elapsed)

  const phase: WarpPhase = elapsed < 1.35
    ? 'returning'
    : elapsed < 2.72
      ? 'accelerating'
      : elapsed < 4.12
        ? 'splitting'
        : elapsed < 5.82
          ? 'crossing'
          : 'arrived'

  return {
    elapsed,
    phase,
    returnProgress,
    travelProgress,
    velocity,
    splitPulse,
    crossingProgress,
    arrivalProgress,
    complete: elapsed >= WARP_DURATION_SECONDS,
  }
}
