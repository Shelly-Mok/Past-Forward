export type GamePhase = 'idle' | 'armed' | 'pulling' | 'threshold' | 'branched' | 'entered'
export type BranchId = 'remain' | 'leave' | 'pause'

export interface GameState {
  phase: GamePhase
  rewind: number
  year: number
  selectedBranch: BranchId | null
}

const START_YEAR = 2026
const YEARS_BACK = 12
const BRANCH_THRESHOLD = 0.76

export function createGameState(onChange: (state: Readonly<GameState>) => void = () => undefined) {
  let state: GameState = { phase: 'idle', rewind: 0, year: START_YEAR, selectedBranch: null }
  const publish = (next: GameState) => { state = next; onChange({ ...state }) }

  return {
    getState: () => ({ ...state }),
    armPlanet() {
      if (state.phase === 'idle') publish({ ...state, phase: 'armed' })
    },
    beginRewind() {
      if (state.phase === 'armed' || state.phase === 'pulling') publish({ ...state, phase: 'pulling' })
    },
    setRewind(value: number) {
      if (state.phase !== 'pulling' && state.phase !== 'threshold') return
      const rewind = Math.max(0, Math.min(1, value))
      publish({
        ...state,
        rewind,
        phase: rewind >= BRANCH_THRESHOLD ? 'threshold' : 'pulling',
        year: Math.round(START_YEAR - YEARS_BACK * rewind),
      })
    },
    releaseRewind() {
      if (state.phase === 'threshold') publish({ ...state, phase: 'branched', rewind: 1, year: 2014 })
      else if (state.phase === 'pulling') publish({ ...state, phase: 'armed', rewind: 0, year: START_YEAR })
    },
    selectBranch(selectedBranch: BranchId) {
      if (state.phase === 'branched') publish({ ...state, phase: 'entered', selectedBranch })
    },
    reset() { publish({ phase: 'idle', rewind: 0, year: START_YEAR, selectedBranch: null }) },
  }
}
