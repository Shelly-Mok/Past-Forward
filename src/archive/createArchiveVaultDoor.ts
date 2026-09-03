import * as THREE from 'three'

const STAGE_WIDTH = 1672
const STAGE_HEIGHT = 941
const RENDER_SCALE = 0.5
const DOOR_CENTER = { x: 892, y: 441 }
const DOOR_RADIUS = 91
const DOOR_PIVOT_X = DOOR_CENTER.x - DOOR_RADIUS

type DoorMaterial = THREE.Material & { opacity: number }

export type ArchiveVaultDoor = {
  setState(angleDegrees: number, opacity: number): void
}

export function createArchiveVaultDoor(canvas: HTMLCanvasElement): ArchiveVaultDoor {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(1)
  renderer.setSize(
    Math.round(STAGE_WIDTH * RENDER_SCALE),
    Math.round(STAGE_HEIGHT * RENDER_SCALE),
    false,
  )
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.setClearColor(0x000000, 0)

  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(
    -STAGE_WIDTH / 2,
    STAGE_WIDTH / 2,
    STAGE_HEIGHT / 2,
    -STAGE_HEIGHT / 2,
    0.1,
    1000,
  )
  camera.position.set(0, 0, 420)
  camera.lookAt(0, 0, 0)

  scene.add(new THREE.AmbientLight(0x8c8c88, 1.45))
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.2)
  keyLight.position.set(160, 230, 320)
  scene.add(keyLight)
  const edgeLight = new THREE.DirectionalLight(0x8a8a86, 1.1)
  edgeLight.position.set(-220, -80, 180)
  scene.add(edgeLight)

  const pivot = new THREE.Group()
  pivot.position.set(
    DOOR_PIVOT_X - STAGE_WIDTH / 2,
    STAGE_HEIGHT / 2 - DOOR_CENTER.y,
    0,
  )
  scene.add(pivot)

  const frontCanvas = document.createElement('canvas')
  frontCanvas.width = 192
  frontCanvas.height = 192
  const frontContext = frontCanvas.getContext('2d')!
  frontContext.imageSmoothingEnabled = false
  frontContext.fillStyle = '#161616'
  frontContext.fillRect(0, 0, 192, 192)

  const frontTexture = new THREE.CanvasTexture(frontCanvas)
  frontTexture.colorSpace = THREE.SRGBColorSpace
  frontTexture.minFilter = THREE.NearestFilter
  frontTexture.magFilter = THREE.NearestFilter
  frontTexture.generateMipmaps = false

  const sideMaterial = new THREE.MeshStandardMaterial({
    color: 0x242422,
    roughness: 0.88,
    metalness: 0.72,
    flatShading: true,
    transparent: true,
  })
  const frontMaterial = new THREE.MeshBasicMaterial({
    map: frontTexture,
    color: 0xd0d0cc,
    transparent: true,
  })
  const backMaterial = new THREE.MeshBasicMaterial({
    map: frontTexture,
    color: 0x777772,
    transparent: true,
  })

  const doorGeometry = new THREE.CylinderGeometry(
    DOOR_RADIUS,
    DOOR_RADIUS,
    30,
    32,
    1,
    false,
  )
  doorGeometry.rotateX(Math.PI / 2)
  const door = new THREE.Mesh(doorGeometry, [sideMaterial, frontMaterial, backMaterial])
  door.position.x = DOOR_CENTER.x - DOOR_PIVOT_X
  door.scale.y = 1.055
  pivot.add(door)

  const doorMaterials: DoorMaterial[] = [sideMaterial, frontMaterial, backMaterial]

  const source = new Image()
  source.decoding = 'async'
  source.src = '/assets/archive-walk-clean-v1.png'
  source.addEventListener('load', () => {
    frontContext.clearRect(0, 0, 192, 192)
    frontContext.drawImage(source, 801, 347, 182, 190, 0, 0, 192, 192)
    frontTexture.needsUpdate = true
    renderer.render(scene, camera)
  })

  function setOpacity(materials: DoorMaterial[], opacity: number) {
    materials.forEach((material) => {
      material.opacity = opacity
      material.visible = opacity > 0.001
    })
  }

  function setState(angleDegrees: number, opacity: number) {
    // The camera is outside the archive (+Z). A positive Y rotation keeps the
    // left edge fixed and sends the door's right edge into the corridor (-Z).
    pivot.rotation.y = THREE.MathUtils.degToRad(angleDegrees)
    pivot.position.z = 0
    const clampedOpacity = THREE.MathUtils.clamp(opacity, 0, 1)
    setOpacity(doorMaterials, clampedOpacity)
    renderer.render(scene, camera)
  }

  setState(0, 0)
  return { setState }
}
