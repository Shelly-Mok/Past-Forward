export type ArchiveDoorPhase = 'audit' | 'unlocking' | 'opening' | 'portal'

export const ARCHIVE_MEMORY_REEL_SECONDS = 8.8
export const ARCHIVE_DOOR_UNLOCK_SECONDS = 1.05
export const ARCHIVE_DOOR_OPEN_SECONDS = 5.6

export type ArchiveDoorSample = {
  phase: ArchiveDoorPhase
  phaseProgress: number
  sealProgress: number
  swingProgress: number
  settleProgress: number
  doorAngle: number
  doorDepth: number
  portalLight: number
  finalBlend: number
}

const clamp = (value: number) => Math.min(1, Math.max(0, value))
const smoothstep = (start: number, end: number, value: number) => {
  const amount = clamp((value - start) / (end - start))
  return amount * amount * (3 - 2 * amount)
}

function openingMotion(progress: number) {
  // One uninterrupted, restrained motion: the door remains a rigid object and
  // simply swings inward around its left edge.
  const swingProgress = smoothstep(0.06, 0.94, progress)
  const settleProgress = smoothstep(0.82, 1, progress)

  return {
    sealProgress: 0,
    swingProgress,
    settleProgress,
    doorAngle: swingProgress * 75,
    doorDepth: 0,
    portalLight: smoothstep(0, 0.055, progress),
    finalBlend: 0,
  }
}

function sample(phase: ArchiveDoorPhase, phaseProgress: number): ArchiveDoorSample {
  const motion = phase === 'opening' || phase === 'portal'
    ? openingMotion(phase === 'portal' ? 1 : phaseProgress)
    : openingMotion(0)

  return { phase, phaseProgress, ...motion }
}

export function sampleArchiveDoorTimeline(
  elapsedSeconds: number,
  reducedMotion = false,
): ArchiveDoorSample {
  const speed = reducedMotion ? 10 : 1
  const elapsed = Math.max(0, elapsedSeconds) * speed

  if (elapsed < ARCHIVE_MEMORY_REEL_SECONDS) {
    return sample('audit', clamp(elapsed / ARCHIVE_MEMORY_REEL_SECONDS))
  }

  const unlockElapsed = elapsed - ARCHIVE_MEMORY_REEL_SECONDS
  if (unlockElapsed < ARCHIVE_DOOR_UNLOCK_SECONDS) {
    return sample('unlocking', clamp(unlockElapsed / ARCHIVE_DOOR_UNLOCK_SECONDS))
  }

  const openingElapsed = unlockElapsed - ARCHIVE_DOOR_UNLOCK_SECONDS
  if (openingElapsed < ARCHIVE_DOOR_OPEN_SECONDS) {
    return sample('opening', clamp(openingElapsed / ARCHIVE_DOOR_OPEN_SECONDS))
  }

  return sample('portal', 1)
}
