import type { BranchId, GameState } from '../game/simulation/gameState'

const branchNames: Record<BranchId, string> = {
  remain: '留下，继续现在的生活', leave: '离开，去一个陌生地方', pause: '暂停，不立刻作出决定',
}

export function createHud(host: HTMLElement) {
  host.innerHTML = `
    <div class="pixel-membrane" aria-hidden="true"></div>
    <div class="identity"><strong>人生回测</strong><span>LIFE BACKTEST</span></div>
    <div class="prototype-mark">SIMULATION PROTOTYPE<br>未接入真人数据</div>
    <div class="year-readout" aria-live="polite"><span class="year">2026</span><span class="direction">TIME / REVERSE</span></div>
    <div class="rewind-hint"><p>点击海面上的月亮</p><small>ENTER / 听见回声</small><div class="progress-track"><div class="progress-fill"></div></div></div>
    <section class="branch-menu" aria-label="选择人生分支"><p>走向一个出口</p><div class="branch-options">
      <button class="branch-option" data-branch="remain"><b>01 / 近岸</b><span>留下</span></button>
      <button class="branch-option" data-branch="leave"><b>02 / 远行</b><span>出走</span></button>
      <button class="branch-option" data-branch="pause"><b>03 / 停泊</b><span>暂停</span></button>
    </div></section>
    <section class="entered-state" aria-live="polite"><p>SIMULATED PATH / 尚未接入真实知乎证据</p><h1></h1><button class="reset-button">返回 2026</button></section>
  `

  const year = host.querySelector<HTMLElement>('.year')!
  const yearReadout = host.querySelector<HTMLElement>('.year-readout')!
  const hint = host.querySelector<HTMLElement>('.rewind-hint')!
  const progress = host.querySelector<HTMLElement>('.progress-fill')!
  const branchMenu = host.querySelector<HTMLElement>('.branch-menu')!
  const entered = host.querySelector<HTMLElement>('.entered-state')!
  const enteredTitle = entered.querySelector<HTMLElement>('h1')!
  const hintCopy = hint.querySelector<HTMLElement>('p')!
  const hintKey = hint.querySelector<HTMLElement>('small')!

  return {
    bind(handlers: { onSelectBranch: (branch: BranchId) => void; onReset: () => void }) {
      host.querySelectorAll<HTMLButtonElement>('[data-branch]').forEach((button) =>
        button.addEventListener('click', () => handlers.onSelectBranch(button.dataset.branch as BranchId)))
      host.querySelector<HTMLButtonElement>('.reset-button')!.addEventListener('click', handlers.onReset)
    },
    render(state: Readonly<GameState>) {
      host.dataset.phase = state.phase
      year.textContent = String(state.year)
      yearReadout.classList.toggle('is-visible', state.phase === 'pulling' || state.phase === 'threshold')
      hint.classList.toggle('is-hidden', state.phase === 'branched' || state.phase === 'entered')
      if (state.phase === 'idle') {
        hintCopy.textContent = '点击海面上的月亮'
        hintKey.textContent = 'ENTER / 听见回声'
      } else if (state.phase === 'armed') {
        hintCopy.textContent = '按住月亮 · 把它慢慢拉近'
        hintKey.textContent = 'DRAG / 靠近那段记忆'
      } else if (state.phase === 'threshold') {
        hintCopy.textContent = '松开 · 回到改变发生之前'
        hintKey.textContent = '2014 / 记忆临界点'
      } else {
        hintCopy.textContent = '继续向后'
        hintKey.textContent = 'TIME / REVERSE'
      }
      progress.style.setProperty('--progress', String(state.rewind))
      branchMenu.classList.toggle('is-visible', state.phase === 'branched')
      entered.classList.toggle('is-visible', state.phase === 'entered')
      enteredTitle.textContent = state.selectedBranch ? branchNames[state.selectedBranch] : ''
    },
  }
}
