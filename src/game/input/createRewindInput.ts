import type { GamePhase } from '../simulation/gameState'

interface Handlers {
  getPhase: () => GamePhase
  hitTestPlanet: (clientX: number, clientY: number) => boolean
  onArm: () => void
  onBegin: () => void
  onProgress: (progress: number) => void
  onRelease: () => void
}

export function createRewindInput(canvas: HTMLCanvasElement, handlers: Handlers) {
  let active = false
  let armCandidate = false
  let keyboardActive = false
  let startY = 0
  let progress = 0

  const beginPull = (clientY: number) => {
    active = true
    startY = clientY
    progress = 0
    canvas.classList.add('is-pulling')
    handlers.onBegin()
  }

  const pointerDown = (event: PointerEvent) => {
    if (!handlers.hitTestPlanet(event.clientX, event.clientY)) return
    canvas.setPointerCapture(event.pointerId)
    if (handlers.getPhase() === 'idle') {
      armCandidate = true
      startY = event.clientY
      return
    }
    if (handlers.getPhase() === 'armed') beginPull(event.clientY)
  }

  const pointerMove = (event: PointerEvent) => {
    if (!active) return
    const distance = Math.abs(event.clientY - startY)
    progress = Math.max(progress, distance / Math.max(innerHeight * 0.38, 220))
    handlers.onProgress(Math.min(progress, 1))
  }

  const release = () => {
    if (armCandidate) {
      armCandidate = false
      canvas.classList.add('is-armed')
      handlers.onArm()
      return
    }
    if (!active && !keyboardActive) return
    active = false
    keyboardActive = false
    canvas.classList.remove('is-pulling')
    handlers.onRelease()
  }

  const keyDown = (event: KeyboardEvent) => {
    if (event.code === 'Enter' && handlers.getPhase() === 'idle') {
      event.preventDefault()
      canvas.classList.add('is-armed')
      handlers.onArm()
      return
    }
    if (event.code !== 'Space' || event.repeat || handlers.getPhase() !== 'armed') return
    event.preventDefault()
    keyboardActive = true
    progress = 0
    canvas.classList.add('is-pulling')
    handlers.onBegin()
  }

  const keyUp = (event: KeyboardEvent) => {
    if (event.code === 'Space') {
      event.preventDefault()
      release()
    }
  }

  canvas.addEventListener('pointerdown', pointerDown)
  canvas.addEventListener('pointermove', pointerMove)
  canvas.addEventListener('pointerup', release)
  canvas.addEventListener('pointercancel', release)
  window.addEventListener('keydown', keyDown)
  window.addEventListener('keyup', keyUp)

  return {
    update(delta: number) {
      if (!active && !keyboardActive) return
      progress = Math.min(1, progress + delta * 0.15)
      handlers.onProgress(progress)
    },
    destroy() {
      canvas.removeEventListener('pointerdown', pointerDown)
      canvas.removeEventListener('pointermove', pointerMove)
      canvas.removeEventListener('pointerup', release)
      canvas.removeEventListener('pointercancel', release)
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
    },
  }
}
