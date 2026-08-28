import type { WarpSample } from '../game/transition/warpTimeline'

interface WarpParticle {
  angle: number
  radius: number
  speed: number
  layer: 0 | 1 | 2
  branch: -1 | 0 | 1
  brightness: number
  size: number
  phase: number
}

type WarpPass = 'back' | 'front'

const PALETTE = ['#343434', '#565656', '#858582', '#b8b8b4', '#e3e3df']

function seededRandom(seed: number) {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let result = value
    result = Math.imul(result ^ (result >>> 15), result | 1)
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61)
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296
  }
}

function pixelLine(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  size: number,
  segments: number,
) {
  for (let index = 0; index <= segments; index += 1) {
    const t = index / Math.max(1, segments)
    const x = Math.round((fromX + (toX - fromX) * t) / 2) * 2
    const y = Math.round((fromY + (toY - fromY) * t) / 2) * 2
    ctx.fillRect(x, y, size, size)
  }
}

export function createWarpField(width: number, height: number, count = 420) {
  const random = seededRandom(20260825)
  const maximumRadius = Math.hypot(width / 2, height / 2) * 1.12
  const particles: WarpParticle[] = Array.from({ length: count }, (_, index) => {
    const layerRoll = random()
    const layer: 0 | 1 | 2 = layerRoll < 0.48 ? 0 : layerRoll < 0.83 ? 1 : 2
    const branchRoll = random()
    const branch: -1 | 0 | 1 = branchRoll < 0.27 ? -1 : branchRoll > 0.73 ? 1 : 0
    return {
      angle: random() * Math.PI * 2,
      radius: 14 + Math.sqrt(random()) * maximumRadius,
      speed: (0.36 + random() * 0.48) * (layer === 0 ? 0.42 : layer === 1 ? 0.82 : 1.35),
      layer,
      branch,
      brightness: Math.min(PALETTE.length - 1, Math.floor(random() * 3.7) + (layer === 2 ? 1 : 0)),
      size: layer === 0 ? 2 : layer === 1 ? (index % 5 === 0 ? 3 : 2) : (index % 7 === 0 ? 4 : 2),
      phase: random() * maximumRadius,
    }
  })

  return {
    draw(ctx: CanvasRenderingContext2D, sample: WarpSample, pass: WarpPass) {
      if (sample.travelProgress <= 0 || sample.arrivalProgress >= 0.98) return

      const centerX = width / 2
      const centerY = height * 0.459
      const fadeAtArrival = 1 - sample.arrivalProgress
      const steppedVelocity = Math.round(sample.velocity * 12) / 12

      ctx.save()
      ctx.globalCompositeOperation = 'screen'

      particles.forEach((particle, index) => {
        const isFront = particle.layer === 2
        if ((pass === 'front') !== isFront) return

        const travel = sample.travelProgress * maximumRadius * 4.25 * particle.speed
        const radius = 8 + ((particle.radius + particle.phase + travel) % maximumRadius)
        const perspective = radius / maximumRadius
        const branchBend = particle.branch * sample.splitPulse * (0.035 + perspective * 0.16)
        const quietDrift = Math.sin(index * 1.73 + sample.elapsed * 0.32) * 0.004
        const angle = particle.angle + branchBend + quietDrift
        const stretchX = 1.05
        const stretchY = 0.92
        const x = centerX + Math.cos(angle) * radius * stretchX
        const y = centerY + Math.sin(angle) * radius * stretchY

        const layerStrength = particle.layer === 0 ? 0.36 : particle.layer === 1 ? 0.68 : 1
        const alpha = (0.16 + perspective * 0.72) * layerStrength * fadeAtArrival
        ctx.globalAlpha = alpha
        ctx.fillStyle = PALETTE[particle.brightness]

        const streakStrength = Math.max(0, steppedVelocity - (particle.layer === 0 ? 0.72 : particle.layer === 1 ? 0.38 : 0.12))
        const streakLength = streakStrength * (particle.layer === 2 ? 58 : 26) * (0.3 + perspective)
        if (streakLength < 2.4 || index % 10 < (particle.layer === 2 ? 2 : 7)) {
          const pointSize = particle.size + (perspective > 0.86 && index % 23 === 0 ? 2 : 0)
          ctx.fillRect(Math.round(x / 2) * 2, Math.round(y / 2) * 2, pointSize, pointSize)
        } else {
          const previousRadius = Math.max(3, radius - streakLength)
          const previousX = centerX + Math.cos(angle) * previousRadius * stretchX
          const previousY = centerY + Math.sin(angle) * previousRadius * stretchY
          const segments = Math.min(12, Math.max(2, Math.round(streakLength / 6)))
          pixelLine(ctx, previousX, previousY, x, y, particle.size, segments)
        }

        if (sample.splitPulse > 0.08 && particle.branch !== 0 && index % 5 === 0) {
          const echoAngle = angle - particle.branch * (0.026 + perspective * 0.08)
          const echoX = centerX + Math.cos(echoAngle) * radius * stretchX
          const echoY = centerY + Math.sin(echoAngle) * radius * stretchY
          ctx.globalAlpha = alpha * sample.splitPulse * 0.22
          ctx.fillStyle = particle.branch < 0 ? '#4b4b4a' : '#747471'
          ctx.fillRect(Math.round(echoX / 2) * 2, Math.round(echoY / 2) * 2, particle.size, particle.size)
        }
      })

      ctx.restore()
    },
  }
}
