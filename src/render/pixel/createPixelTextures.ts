import * as THREE from 'three'

type DrawTexture = (ctx: CanvasRenderingContext2D, width: number, height: number) => void

const GRAYS = ['#000000', '#171717', '#303030', '#555555', '#858585', '#b8b8b8', '#ececec']
const BAYER_4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
]

function hash(x: number, y: number, seed = 0) {
  const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453
  return value - Math.floor(value)
}

function quantizedGray(value: number, x: number, y: number) {
  const threshold = (BAYER_4[(y & 3) * 4 + (x & 3)] + 0.5) / 16 - 0.5
  const level = Math.max(0, Math.min(GRAYS.length - 1, Math.floor(value * (GRAYS.length - 1) + threshold)))
  return GRAYS[level]
}

export function canvasTexture(width: number, height: number, draw: DrawTexture) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  draw(ctx, width, height)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  return texture
}

export function createMoonTexture() {
  return canvasTexture(256, 256, (ctx, width, height) => {
    const cx = width / 2
    const cy = height / 2
    const radius = width * 0.455
    const craters = [
      [0.25, -0.31, 0.12], [-0.28, -0.16, 0.17], [0.12, 0.13, 0.2],
      [-0.36, 0.32, 0.1], [0.38, 0.3, 0.15], [-0.02, -0.47, 0.07],
    ]

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const nx = (x + 0.5 - cx) / radius
        const ny = (y + 0.5 - cy) / radius
        const distance = nx * nx + ny * ny
        if (distance >= 1) continue
        const nz = Math.sqrt(1 - distance)
        const diffuse = Math.max(0, nx * -0.28 + ny * -0.42 + nz * 0.86)
        const continents = hash(Math.floor(x / 10), Math.floor(y / 10), 8) * 0.35
          + hash(Math.floor(x / 4), Math.floor(y / 4), 19) * 0.16
        let light = 0.16 + diffuse * 0.68 + (continents - 0.26) * 0.23

        craters.forEach(([craterX, craterY, craterRadius]) => {
          const dx = nx - craterX
          const dy = ny - craterY
          const craterDistance = Math.sqrt(dx * dx + dy * dy) / craterRadius
          if (craterDistance < 1) light -= (1 - craterDistance) * 0.26
          if (craterDistance > 0.78 && craterDistance < 1.12 && dy < 0) light += 0.11
        })

        light *= 0.78 + nz * 0.22
        ctx.fillStyle = quantizedGray(Math.max(0.04, Math.min(0.98, light)), x, y)
        ctx.fillRect(x, y, 1, 1)
      }
    }
  })
}

export function createBoyTexture(frame = 0) {
  return canvasTexture(48, 80, (ctx) => {
    const ink = '#090909'
    const hair = '#151515'
    const coat = '#393939'
    const coatDark = '#242424'
    const rim = '#b9b9b6'
    const breath = frame === 1 ? 1 : 0
    const wind = frame === 2 ? 1 : frame === 3 ? -1 : 0

    // Back-facing head: compact, asymmetric and deliberately anonymous.
    ctx.fillStyle = hair
    ctx.fillRect(18 + wind, 7 + breath, 13, 3)
    ctx.fillRect(15 + wind, 10 + breath, 20, 11)
    ctx.fillRect(17 + wind, 21 + breath, 16, 5)
    ctx.fillRect(14 + wind, 13 + breath, 3, 7)
    ctx.fillRect(34 + wind, 13 + breath, 3, 6)
    ctx.fillStyle = ink
    ctx.fillRect(16 + wind, 9 + breath, 4, 4)
    ctx.fillRect(30 + wind, 9 + breath, 4, 5)
    ctx.fillRect(21 + wind, 5 + breath, 5, 3)
    ctx.fillStyle = rim
    ctx.fillRect(35 + wind, 12 + breath, 2, 8)
    ctx.fillRect(31 + wind, 8 + breath, 3, 2)
    ctx.fillStyle = '#252525'
    ctx.fillRect(21, 25 + breath, 8, 4)

    // The one-pixel black gutters separate arms from the coat, preventing the
    // character from collapsing into a single rectangular block at game size.
    ctx.fillStyle = coat
    ctx.fillRect(16, 29 + breath, 18, 25)
    ctx.fillRect(13, 31 + breath, 3, 21)
    ctx.fillRect(34, 31 + breath, 3, 21)
    ctx.fillStyle = coatDark
    ctx.fillRect(16, 30 + breath, 5, 23)
    ctx.fillRect(24, 30 + breath, 2, 24)
    ctx.fillRect(31, 31 + breath, 3, 22)
    ctx.fillStyle = '#656565'
    ctx.fillRect(33, 30 + breath, 1, 23)
    ctx.fillRect(18, 29 + breath, 13, 2)
    ctx.fillStyle = ink
    ctx.fillRect(15, 53 + breath, 7, 3)
    ctx.fillRect(28, 53 + breath, 7, 3)
    ctx.fillStyle = '#797979'
    ctx.fillRect(13, 51 + breath, 3, 4)
    ctx.fillRect(35, 51 + breath, 3, 4)

    // Separated legs and low-profile shoes; feet stay anchored in the scene.
    ctx.fillStyle = '#242424'
    ctx.fillRect(17, 55, 7, 17)
    ctx.fillRect(27, 55, 7, 17)
    ctx.fillStyle = '#4c4c4c'
    ctx.fillRect(22, 57, 2, 13)
    ctx.fillRect(32, 57, 2, 13)
    ctx.fillStyle = ink
    ctx.fillRect(14, 71, 11, 4)
    ctx.fillRect(27, 71, 12, 4)
    ctx.fillStyle = rim
    ctx.fillRect(15, 71, 8, 1)
    ctx.fillRect(29, 71, 8, 1)
  })
}

export function createBoatTexture() {
  return canvasTexture(72, 36, (ctx) => {
    const ink = '#070707'
    const hull = '#303030'
    const silver = '#9b9b98'
    ctx.fillStyle = hull
    ctx.fillRect(9, 20, 53, 5)
    ctx.fillRect(15, 25, 41, 3)
    ctx.fillRect(22, 28, 27, 2)
    ctx.fillStyle = ink
    ctx.fillRect(12, 23, 47, 4)
    ctx.fillRect(26, 14, 2, 7)
    ctx.fillRect(39, 12, 2, 9)
    ctx.fillStyle = '#555555'
    ctx.fillRect(28, 15, 12, 6)
    ctx.fillStyle = silver
    ctx.fillRect(8, 19, 55, 2)
    ctx.fillRect(28, 14, 9, 1)
    ctx.fillRect(39, 9, 1, 4)
    ctx.fillRect(18, 27, 34, 1)
    ctx.fillRect(31, 16, 3, 2)
  })
}

export function createCloudTexture(seed: number) {
  return canvasTexture(192, 64, (ctx, width, height) => {
    for (let y = 8; y < height - 8; y += 2) {
      for (let x = 4; x < width - 4; x += 2) {
        const ridge = Math.sin(x * 0.055 + seed) * 6 + Math.sin(x * 0.12 + seed * 3) * 3
        const center = 34 + ridge
        const thickness = 7 + hash(Math.floor(x / 12), seed, 4) * 10
        const inside = Math.abs(y - center) < thickness
        if (!inside) continue
        const edge = Math.abs(y - center) / thickness
        const density = (1 - edge) * 0.62 + hash(x, y, seed) * 0.22
        if (density < (BAYER_4[((y / 2) & 3) * 4 + ((x / 2) & 3)] + 1) / 22) continue
        ctx.fillStyle = density > 0.6 ? '#787878' : '#3d3d3d'
        ctx.fillRect(x, y, 2, 2)
      }
    }
  })
}

export function createDistantCoastTexture() {
  return canvasTexture(384, 112, (ctx, width, height) => {
    ctx.fillStyle = '#090909'
    ctx.beginPath()
    ctx.moveTo(0, height)
    ctx.lineTo(0, 52)
    ctx.lineTo(35, 28)
    ctx.lineTo(66, 45)
    ctx.lineTo(103, 20)
    ctx.lineTo(146, 66)
    ctx.lineTo(178, 75)
    ctx.lineTo(205, 80)
    ctx.lineTo(239, 72)
    ctx.lineTo(278, 47)
    ctx.lineTo(315, 63)
    ctx.lineTo(350, 25)
    ctx.lineTo(width, 48)
    ctx.lineTo(width, height)
    ctx.fill()

    for (let y = 26; y < 86; y += 3) {
      for (let x = 5; x < width - 5; x += 3) {
        const edgeDistance = Math.min(x, width - x)
        const probability = Math.max(0, 1 - edgeDistance / 175) * 0.52
        if (hash(x, y, 31) > probability) continue
        ctx.fillStyle = hash(x, y, 41) > 0.55 ? '#333333' : '#1d1d1d'
        ctx.fillRect(x, y, 2, 2)
      }
    }
  })
}

export function createPortalTexture() {
  return canvasTexture(192, 192, (ctx, width, height) => {
    const center = width / 2
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        const distance = Math.hypot(x - center, y - center) / center
        if (distance < 0.7) {
          ctx.fillStyle = '#000000'
          ctx.fillRect(x, y, 2, 2)
        } else if (distance < 0.93) {
          const glow = 1 - Math.abs(distance - 0.81) / 0.12
          ctx.fillStyle = quantizedGray(0.16 + glow * 0.68, x / 2, y / 2)
          ctx.fillRect(x, y, 2, 2)
        }
      }
    }
  })
}

export function createBranchGateTexture(index: number) {
  return canvasTexture(64, 104, (ctx, width, height) => {
    const left = 9
    const right = width - 9
    const top = 12 + index * 2
    ctx.strokeStyle = index === 1 ? '#d7d7d7' : '#888888'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(left, height - 5)
    ctx.lineTo(left, 37)
    ctx.quadraticCurveTo(width / 2, top, right, 37)
    ctx.lineTo(right, height - 5)
    ctx.stroke()
    ctx.fillStyle = '#050505'
    ctx.fillRect(left + 3, 38, right - left - 6, height - 43)
    for (let y = 42; y < height - 8; y += 5) {
      const light = index === 0 ? y / height : index === 1 ? 1 - y / height : 0.35
      if (hash(index, y, 61) > 0.7) continue
      ctx.fillStyle = quantizedGray(0.14 + light * 0.36, index, y)
      ctx.fillRect(left + 7, y, right - left - 14, 2)
    }
  })
}
