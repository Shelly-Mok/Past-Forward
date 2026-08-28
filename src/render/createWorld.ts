import * as THREE from 'three'
import type { GameState } from '../game/simulation/gameState'
import {
  createBoatTexture,
  createBoyTexture,
  createBranchGateTexture,
  createCloudTexture,
  createDistantCoastTexture,
  createMoonTexture,
  createPortalTexture,
} from './pixel/createPixelTextures'

function makeSprite(texture: THREE.Texture, width: number, height: number, opacity = 1) {
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity, depthWrite: false })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(width, height, 1)
  return sprite
}

function seededRandom(seed: number) {
  return () => {
    let value = (seed += 0x6d2b79f5)
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export function createWorld(host: HTMLElement) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#020304')
  const camera = new THREE.OrthographicCamera(-8, 8, 5, -5, 0.1, 40)
  camera.position.z = 10
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.setPixelRatio(1)
  renderer.domElement.tabIndex = 0
  renderer.domElement.setAttribute('aria-label', '海边月亮场景，按回车连接月亮')
  host.appendChild(renderer.domElement)

  const boyTextures = [0, 1, 2, 3].map((frame) => createBoyTexture(frame))
  const textures = [
    createMoonTexture(), ...boyTextures, createBoatTexture(), createCloudTexture(3), createCloudTexture(7),
    createDistantCoastTexture(), createPortalTexture(),
    createBranchGateTexture(0), createBranchGateTexture(1), createBranchGateTexture(2),
  ]
  const [
    moonTexture, boyTexture, , , , boatTexture, cloudTextureA, cloudTextureB, coastTexture, portalTexture,
    gateTextureA, gateTextureB, gateTextureC,
  ] = textures

  const starGeometry = new THREE.BufferGeometry()
  const rng = seededRandom(8126)
  const starPositions: number[] = []
  for (let i = 0; i < 175; i += 1) starPositions.push((rng() - 0.5) * 18, -0.7 + rng() * 6.2, -2)
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3))
  const starMaterial = new THREE.PointsMaterial({ color: '#8b8b87', size: 0.025, transparent: true, opacity: 0.45 })
  const stars = new THREE.Points(starGeometry, starMaterial)
  scene.add(stars)

  const distantCoast = makeSprite(coastTexture, 18.4, 5.35, 0.74)
  distantCoast.position.set(0, -1.02, -1.25)
  scene.add(distantCoast)

  const moon = makeSprite(moonTexture, 1.68, 1.68)
  moon.position.set(2.72, 2.22, 0)
  scene.add(moon)
  const moonMaterial = moon.material as THREE.SpriteMaterial
  const portal = makeSprite(portalTexture, 2.55, 2.55, 0)
  const portalMaterial = portal.material as THREE.SpriteMaterial
  portal.position.set(2.72, 2.22, 0.1)
  scene.add(portal)

  const cloudA = makeSprite(cloudTextureA, 4.4, 1.3, 0.42)
  const cloudB = makeSprite(cloudTextureB, 3.6, 1.05, 0.25)
  cloudA.position.set(-2.6, 1.65, 1)
  cloudB.position.set(3.2, 2.75, 1.1)
  scene.add(cloudA, cloudB)

  const sea = new THREE.Mesh(new THREE.PlaneGeometry(24, 4.1), new THREE.MeshBasicMaterial({ color: '#07090a' }))
  sea.position.set(0, -3.82, 0.3)
  scene.add(sea)
  const horizonMaterial = new THREE.LineBasicMaterial({ color: '#777773', transparent: true, opacity: 0.62 })
  const horizon = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-12, -1.78, 0.8), new THREE.Vector3(12, -1.78, 0.8),
  ]), horizonMaterial)
  scene.add(horizon)

  const boat = makeSprite(boatTexture, 1.02, 0.51, 0.88)
  boat.position.set(1.05, -1.5, 1.08)
  scene.add(boat)

  const waves: {
    line: THREE.Line
    material: THREE.LineBasicMaterial
    speed: number
    frequency: number
    amplitude: number
    phase: number
  }[] = []
  for (let row = 0; row < 16; row += 1) {
    const points: THREE.Vector3[] = []
    const y = -1.94 - row * 0.205
    for (let x = -12; x <= 12; x += 0.22) {
      points.push(new THREE.Vector3(x, y, 0.85 + row * 0.002))
    }
    const material = new THREE.LineBasicMaterial({
      color: row < 5 ? '#787875' : row < 11 ? '#50504e' : '#3a3b3a',
      transparent: true,
      opacity: 0.31 - row * 0.009,
    })
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material)
    waves.push({
      line,
      material,
      speed: 0.44 + row * 0.018,
      frequency: 1.45 + row * 0.045,
      amplitude: 0.014 + row * 0.0018,
      phase: row * 0.82,
    })
    scene.add(line)
  }

  const reflection: THREE.Mesh[] = []
  for (let row = 0; row < 15; row += 1) {
    const width = 0.22 + (row % 4) * 0.17 + row * 0.035
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(width, 0.018 + (row % 3) * 0.009), new THREE.MeshBasicMaterial({ color: '#c9c9c4', transparent: true, opacity: 0.24 - row * 0.008 }))
    strip.position.set(2.72 + Math.sin(row * 2.1) * 0.18, -1.92 - row * 0.16, 1)
    reflection.push(strip)
    scene.add(strip)
  }

  const shoreShape = new THREE.Shape()
  shoreShape.moveTo(-12, -3.5)
  shoreShape.lineTo(-7.2, -3.08)
  shoreShape.lineTo(-5.5, -2.72)
  shoreShape.lineTo(-4.2, -2.66)
  shoreShape.lineTo(-3.35, -2.52)
  shoreShape.lineTo(-2.2, -2.68)
  shoreShape.lineTo(-1.2, -2.9)
  shoreShape.lineTo(-12, -5.4)
  shoreShape.closePath()
  const shore = new THREE.Mesh(new THREE.ShapeGeometry(shoreShape), new THREE.MeshBasicMaterial({ color: '#111314' }))
  shore.position.z = 1.25
  scene.add(shore)
  const shoreLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-12, -3.5, 1.3), new THREE.Vector3(-7.2, -3.08, 1.3),
    new THREE.Vector3(-5.5, -2.72, 1.3), new THREE.Vector3(-4.2, -2.66, 1.3),
    new THREE.Vector3(-3.35, -2.52, 1.3), new THREE.Vector3(-2.2, -2.68, 1.3),
    new THREE.Vector3(-1.2, -2.9, 1.3),
  ]), new THREE.LineBasicMaterial({ color: '#6d6d69', transparent: true, opacity: 0.7 }))
  scene.add(shoreLine)

  const boy = makeSprite(boyTexture, 0.72, 1.34)
  boy.position.set(-3.2, -2.08, 2)
  scene.add(boy)
  const boyMaterial = boy.material as THREE.SpriteMaterial
  let activeBoyFrame = 0

  const gates = [gateTextureA, gateTextureB, gateTextureC].map((texture, index) => {
    const gate = makeSprite(texture, 1.12, 1.82, 0)
    gate.position.set((index - 1) * 2.75, -1.56, 2.1)
    scene.add(gate)
    return gate
  })

  const branchMaterials: THREE.LineBasicMaterial[] = []
  for (let branch = 0; branch < 3; branch += 1) {
    const direction = branch - 1
    const material = new THREE.LineBasicMaterial({ color: '#b9b9b4', transparent: true, opacity: 0 })
    const points = [new THREE.Vector3(0.4, 0.2, 1.5), new THREE.Vector3(direction * 0.9, -0.1 - branch * 0.12, 1.5), new THREE.Vector3(direction * 2.5, 0.4 - branch * 0.62, 1.5)]
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material))
    branchMaterials.push(material)
  }

  let halfWidth = 8
  let moonStartX = 2.72
  let boyX = -3.2
  const resize = () => {
    const width = host.clientWidth
    const height = host.clientHeight
    const aspect = width / height
    halfWidth = aspect * 5
    camera.left = -halfWidth
    camera.right = halfWidth
    camera.top = 5
    camera.bottom = -5
    camera.updateProjectionMatrix()
    const renderWidth = width < 720 ? 320 : 384
    const renderHeight = Math.max(180, Math.round(renderWidth / aspect))
    renderer.setSize(renderWidth, renderHeight, false)
    moonStartX = aspect < 1 ? 1.2 : Math.min(3.05, halfWidth * 0.34)
    boyX = aspect < 1 ? -1.55 : -Math.min(3.45, halfWidth * 0.38)
  }
  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(host)
  resize()
  return {
    canvas: renderer.domElement,
    hitTestPlanet(clientX: number, clientY: number) {
      const bounds = renderer.domElement.getBoundingClientRect()
      const projected = moon.position.clone().project(camera)
      const centerX = bounds.left + (projected.x + 1) * 0.5 * bounds.width
      const centerY = bounds.top + (1 - projected.y) * 0.5 * bounds.height
      const radius = (moon.scale.x * 0.5 / (camera.right - camera.left)) * bounds.width
      return Math.hypot(clientX - centerX, clientY - centerY) <= radius * 1.18
    },
    update(state: GameState, time: number) {
      const eased = 1 - Math.pow(1 - state.rewind, 3)
      const armed = state.phase === 'armed' || state.phase === 'pulling' || state.phase === 'threshold'
      const branched = state.phase === 'branched' || state.phase === 'entered'
      const moonSize = THREE.MathUtils.lerp(1.68, Math.max(8.2, halfWidth * 0.88), eased)
      moon.position.set(
        THREE.MathUtils.lerp(moonStartX, 0.65, eased),
        THREE.MathUtils.lerp(2.22 + Math.sin(time * 0.18) * 0.008, 0.8, eased),
        0,
      )
      moon.scale.set(moonSize, moonSize, 1)
      portal.position.copy(moon.position)
      portal.scale.setScalar(moonSize * 1.2)
      const portalProgress = THREE.MathUtils.smoothstep(state.rewind, 0.62, 0.96)
      portalMaterial.opacity = armed ? 0.1 + Math.sin(time * 2.1) * 0.035 + portalProgress * 0.9 : portalProgress
      moonMaterial.opacity = 1 - portalProgress * 0.92
      boy.position.x = boyX + Math.sin(time * 0.42) * 0.004
      boy.position.y = -2.08 + Math.sin(time * 0.82) * 0.008
      const idleSequence = [0, 0, 1, 0, 0, 2, 0, 3]
      const nextBoyFrame = idleSequence[Math.floor(time * 2) % idleSequence.length]
      if (nextBoyFrame !== activeBoyFrame) {
        activeBoyFrame = nextBoyFrame
        boyMaterial.map = boyTextures[activeBoyFrame]
        boyMaterial.needsUpdate = true
      }
      const cloudSpan = halfWidth * 2 + 6
      cloudA.position.x = -halfWidth - 2 + THREE.MathUtils.euclideanModulo(time * 0.055, cloudSpan) - eased * 1.8
      cloudB.position.x = halfWidth + 2 - THREE.MathUtils.euclideanModulo(time * 0.038, cloudSpan) + eased * 2.3
      stars.position.x = -eased * 0.55
      starMaterial.opacity = 0.45 * (1 - eased * 0.65)
      distantCoast.position.x = eased * 0.28
      distantCoast.scale.x = 18.4 + eased * 0.65
      const steppedTime = Math.floor(time * 12) / 12
      waves.forEach(({ line, material, speed, frequency, amplitude, phase }, index) => {
        const positions = line.geometry.getAttribute('position') as THREE.BufferAttribute
        for (let point = 0; point < positions.count; point += 1) {
          const x = positions.getX(point)
          const primary = Math.sin(x * frequency - steppedTime * speed + phase) * amplitude
          const interference = Math.sin(x * 0.48 + steppedTime * speed * 0.54 + phase * 1.7) * amplitude * 0.42
          positions.setY(point, -1.94 - index * 0.205 + primary + interference)
        }
        positions.needsUpdate = true
        material.opacity = (0.31 - index * 0.009) + state.rewind * 0.05
      })
      boat.position.x = 1.05 + Math.sin(steppedTime * 0.19) * 0.055
      boat.position.y = -1.5 + Math.sin(steppedTime * 0.92) * 0.022
      boat.rotation.z = Math.sin(steppedTime * 0.71) * 0.018
      reflection.forEach((strip, index) => {
        strip.position.x = moon.position.x + Math.sin(time * 0.45 + index * 1.7) * (0.08 + index * 0.012)
        strip.scale.x = 1 + eased * (2.2 + index * 0.03)
        const material = strip.material as THREE.MeshBasicMaterial
        material.opacity = (0.24 - index * 0.008) * (1 + state.rewind * 0.8)
      })
      const branchAlpha = branched ? 0.58 : THREE.MathUtils.smoothstep(state.rewind, 0.84, 1) * 0.08
      branchMaterials.forEach((material) => { material.opacity = branchAlpha })
      gates.forEach((gate, index) => {
        const material = gate.material as THREE.SpriteMaterial
        material.opacity = branched ? 0.86 : 0
        gate.position.y = -1.56 + Math.sin(time * 0.7 + index) * 0.008
      })
      renderer.render(scene, camera)
    },
    destroy() {
      resizeObserver.disconnect()
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points || object instanceof THREE.Sprite) {
          object.geometry?.dispose()
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach((material) => material.dispose())
        }
      })
      textures.forEach((texture) => texture.dispose())
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
