import type { GamePhase } from '../game/simulation/gameState'

export function createAudioSystem() {
  let context: AudioContext | null = null
  let drone: OscillatorNode | null = null
  let overtone: OscillatorNode | null = null
  let gain: GainNode | null = null
  let filter: BiquadFilterNode | null = null

  const ensureContext = () => {
    if (context) return context
    context = new AudioContext()
    drone = context.createOscillator(); overtone = context.createOscillator()
    gain = context.createGain(); filter = context.createBiquadFilter()
    drone.type = 'sine'; drone.frequency.value = 36
    overtone.type = 'triangle'; overtone.frequency.value = 73
    filter.type = 'lowpass'; filter.frequency.value = 160; filter.Q.value = 2.4
    gain.gain.value = 0
    drone.connect(filter); overtone.connect(filter); filter.connect(gain).connect(context.destination)
    drone.start(); overtone.start()
    return context
  }

  return {
    unlock() {
      const audio = ensureContext()
      if (audio.state === 'suspended') void audio.resume()
    },
    setRewind(progress: number, phase: GamePhase) {
      if (!context || !gain || !drone || !overtone || !filter) return
      const now = context.currentTime
      const audible = phase === 'pulling' || phase === 'threshold'
      gain.gain.cancelScheduledValues(now)
      gain.gain.linearRampToValueAtTime(audible ? 0.012 + progress * 0.034 : 0, now + 0.1)
      drone.frequency.linearRampToValueAtTime(36 + progress * 42, now + 0.1)
      overtone.frequency.linearRampToValueAtTime(73 - progress * 25, now + 0.1)
      filter.frequency.linearRampToValueAtTime(150 + progress * 260, now + 0.1)
    },
    destroy() { drone?.stop(); overtone?.stop(); void context?.close() },
  }
}
