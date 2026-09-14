import './garden.css'
import { readLifeEvents, type ArchiveProfile } from '../archive/archiveInterview'
import { eraChoice, eraNodeForAge, isOwnChoice, OWN_CHOICE_ID, npcFace, paintFlowerKind, signalPortraits, timelineFlowerPose, withOwnChoice, type EraChoice, type EraNode } from './gardenContent'
import { EVENT_MARK_ID, eventEraFallback, eventMarkChoice, eventMarkPortraits, eventPlantedLabel, eventYearChoices, eventYearMemoryVisible, lifeEventAtAge, type EventYearPayload } from './gardenEventYear'
import { ageValue, chapterForAge, chapterLabel, cleanProfile, eventAgesFor, eventTalkAt, forkAges, GARDEN_SAVE_KEY, hasPlanted, interviewTrail, lineIdeal, linePlanted, newGardenState, nextTimelineAge, resetYearChoice, restoreGardenState, shouldEnterCrossroads, timelineBand, timelineNodes, upsertPlanted, type GardenState } from './gardenState'
import { BOARDING_DOOR, CHOICE_DOOR, GARDEN_HOME, GardenActor, choiceLane, choicePads, soilForAge, spreadGroundPoints } from './gardenActor'
import { readInterviewSave } from '../interview/interviewState'
import { renderRiftView, type RiftView } from './gardenRift'
import { prevAgentState, resolveForkAge } from './anotherMe'
import { RIFT_HOLES, choicePostFor, holeById, holeHintFor, type RiftKind } from './riftContent'
import { liveEnabled, loadEventYear, loadLifeNode, loadLivePortraits, type LivePortrait } from '../zhihu/liveContent'
import { explainAuthored, journeyContext } from '../zhihu/recommend'
import { paintRiftWorld } from './paintRiftWorld'
import { eraHeading, EVENT_NOTE_COPY, EVENT_TALK_HINT, EVENT_TALK_READY, EVENT_TALK_START, eventTalkActionLabel, eventTalkLaunchVisible, IDEAL_NOTE, MATCH_HONESTY, NOTE_IS_NOT_CHOICE, NPC_KIND_NOTE, portraitQuote, PRESENT_ADVANCE, unfinishedEventTalk } from './gardenCopy'
import { personalTagPayload, readPersonalTag, upsertPersonalEventNote } from '../outlook/personalTag'
import { readEventTalk, readEventTalks, writeEventTalk } from './eventTalkSave'
import { flowerEndpoint, flowerPoseAt, FLOWER_POSES } from './flowerLifecycle'
import { buildLifeConnections, buildLifePatch, buildStarClusters, calculateVitality, clearShipOverlay, drawCosmosSparkles, drawEnvironmentColor, drawEnvironmentLight, drawLifeConnections, drawLifeCracks, drawLifePatch, drawPlanetSurfaceRegions, drawStarClusters, drawSurfaceGrowth } from './gardenLifeColor'

function read(key: string, session = false): string | null {
  try { return (session ? sessionStorage : localStorage).getItem(key) } catch { return null }
}
export function readArchiveProfile(): ArchiveProfile | undefined {
  try {
    const session = JSON.parse(read('life-backtest.archive-profile', true) ?? 'null')
    if (session && typeof session === 'object') return cleanProfile(session)
    const local = JSON.parse(read('life-backtest.archive-profile') ?? 'null')
    return local && typeof local === 'object' ? cleanProfile(local) : undefined
  } catch { return undefined }
}
export function writeArchiveProfile(profile: ArchiveProfile) {
  const safe = JSON.stringify(cleanProfile(profile))
  try { sessionStorage.setItem('life-backtest.archive-profile', safe) } catch { /* Session can still start from local. */ }
  try { localStorage.setItem('life-backtest.archive-profile', safe) } catch { /* In-memory garden still starts. */ }
}

type GardenPhase = 'era' | 'choices' | 'inspect' | 'ideal' | 'awakening' | 'npc' | 'launch' | 'crossroads' | 'rift'
type LaunchBeat = 'board' | 'voyage'
const FLIGHT_CLASSES = [
  'is-swallowing', 'is-taking-off', 'is-in-flight', 'is-departing', 'is-boarding', 'is-launching',
] as const
const FLOWER_COLORS = ['#f3e8b5', '#b8bdc9', '#7770e8', '#9b78aa', '#ef6d5f', '#bde8f2', '#83d8ff', '#a51f35'] as const
const FLOWER_FRAMES_PER_KIND = 16

export function createGardenScene(host: HTMLElement) {
  const root = document.createElement('section')
  root.className = 'garden-scene'
  root.setAttribute('aria-label', '第三幕：月面人生花园')
  root.hidden = true
  root.innerHTML = `
    <div class="garden-frame">
      <i class="garden-earth-sky" aria-hidden="true"></i>
      <img class="garden-earth" src="/assets/garden/moon-garden-clean-v1.png" alt="" aria-hidden="true" />
      <img class="garden-background" src="/assets/garden/moon-garden-clean-v1.png" alt="地球悬在星空里，月面档案室静立于远处" />
      <i class="garden-cosmos-atmosphere" aria-hidden="true"></i>
      <canvas class="garden-cosmos-color" width="1672" height="941" aria-hidden="true"></canvas>
      <canvas class="garden-cosmos-stars" width="1672" height="941" aria-hidden="true"></canvas>
      <canvas class="garden-life-color" width="1672" height="941" aria-hidden="true"></canvas>
      <canvas class="garden-life-growth" width="1672" height="941" aria-hidden="true"></canvas>
      <canvas class="garden-life-light" width="1672" height="941" aria-hidden="true"></canvas>
      <i class="garden-planet-rim" aria-hidden="true"></i>
      <i class="garden-ship-contact" aria-hidden="true"></i>
      <i class="garden-ship-ambient" aria-hidden="true"><b></b><b></b><b></b></i>
      <i class="garden-vitality-wash" aria-hidden="true"></i>
      <i class="garden-awakening-wave" aria-hidden="true"></i>
      <div class="garden-shade" aria-hidden="true"></div>
      <i class="garden-galaxy" hidden aria-hidden="true"></i>
      <i class="garden-space-palette" aria-hidden="true"></i>
      <i class="garden-earth-palette" aria-hidden="true"></i>
      <i class="garden-warp" hidden aria-hidden="true"></i>
      <canvas class="garden-player" width="1672" height="941" aria-hidden="true"></canvas>
      <button class="garden-player-hit" type="button" aria-label="与主角打个招呼" title="与主角打个招呼"></button>
      <i class="garden-meteor" aria-hidden="true"></i>
      <div class="garden-sky-layer" aria-hidden="true">
        <i class="garden-hatch" hidden></i>
      </div>
      <aside class="garden-transit" hidden>
        <header class="garden-transit-copy">
          <p class="garden-transit-kicker">◇ 启航 · 前往三岔口</p>
          <p>过去已经写下。</p>
          <p>从这里开始，没有人知道答案。</p>
        </header>
        <p class="garden-transit-center">—— 一个新的节点正在形成 ——</p>
      </aside>
      <header class="garden-location"><span>月面人生花园</span><small class="garden-location-note">第三幕 · 时间回声</small><div class="garden-vitality-meter" role="progressbar" aria-label="星球生命力" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><small>星球生命力</small><b>0%</b><i aria-hidden="true"><em></em></i></div><p class="garden-crossroads-note" hidden></p></header>
      <nav class="garden-signals" hidden aria-label="人生内容接口">
        <span class="garden-signals-kicker">与你相近的人生信号</span>
        <div class="garden-signals-body"></div>
      </nav>
      <article class="garden-copy" aria-live="polite">
        <small>零点小姐 · 时间回声</small>
        <p class="garden-age"></p><h1 tabindex="-1"></h1><p class="garden-note"></p>
        <ul class="garden-choice-stats" hidden></ul>
        <div class="garden-copy-actions"><button type="button" data-action="enter">查看这一年的选择 <span>↗</span></button><button type="button" class="garden-reset-year" data-action="reset-year" hidden>重置当年选择</button><button type="button" data-action="memory" hidden>记下这一岁</button><button type="button" data-action="event-talk" hidden>打开这一年的对话</button><button type="button" data-action="advance" hidden>进入下一个时间点 →</button></div>
        <button type="button" class="garden-leave-parallel" data-action="leave-parallel" hidden>离开平行宇宙 · 回三岔口</button>
        <button type="button" class="garden-locate" data-action="target" hidden>确认回溯年龄 →</button>
      </article>
      <nav class="garden-choice-flowers" aria-label="飞船送来的选择"></nav>
      <nav class="garden-ground-flowers" aria-label="已种下的时光"></nav>
      <p class="garden-awakening-copy" aria-live="polite" hidden><small>生命回应了你的选择</small><strong>花园正在苏醒</strong></p>
      <footer class="garden-timeline"><div class="garden-timeline-caption"><span></span><div><button type="button" data-action="chapters">40岁以后的时光 →</button><button type="button" data-action="origin">回到回溯起点 ↖</button></div></div><div class="garden-time-controls"><button type="button" data-action="previous" aria-label="更早的年龄">‹</button><div class="garden-nodes" aria-label="五年时间点"></div><button type="button" data-action="next" aria-label="更晚的年龄">›</button></div></footer>
      <div class="garden-bottom"><button type="button" data-action="restart"><kbd>R</kbd> 重新进入画面</button><div class="garden-bottom-links"><a href="/" class="garden-from-shore">从第一幕重新体验 ↗</a></div></div>
      <aside class="garden-panel" aria-label="时间档案" hidden>
        <button type="button" class="garden-panel-close" aria-label="关闭时间档案">×</button>
        <small class="garden-panel-kicker"></small><h2 class="garden-panel-title"></h2><p class="garden-panel-copy"></p>
        <dl class="garden-profile"></dl>
        <nav class="garden-fork-ages" hidden aria-label="平行宇宙起点"></nav>
        <form class="garden-form" hidden><label></label><input type="text" maxlength="500" autocomplete="off" /><button type="submit">记录</button><output aria-live="polite"></output></form>
        <div class="garden-records"></div>
      </aside>
      <aside class="garden-event-talk" hidden aria-label="重大事件回看">
        <button type="button" class="garden-event-talk-close" aria-label="收起对话">×</button>
        <small class="garden-event-talk-kicker">全部选择已经种下 · 回看这一年</small>
        <h2 class="garden-event-talk-title"></h2>
        <p class="garden-event-talk-lead">以这件事之前的选择为背景，对照整条时间线。我会披露同一节点当时考虑什么、得到什么、失去什么。</p>
        <p class="garden-event-talk-ready"></p>
        <div class="garden-event-talk-log" aria-live="polite"></div>
        <button type="button" class="garden-event-talk-start">开始这一年的对话</button>
        <form class="garden-event-talk-form">
          <label>
            <span class="sr-only">接着问这一年</span>
            <input type="text" maxlength="400" autocomplete="off" aria-label="接着问这一年" placeholder="还可以接着问" />
          </label>
          <button type="submit">发送</button>
        </form>
      </aside>
      <img class="garden-orbit-sky" src="/assets/garden/orbit-ship-idle.png" alt="" hidden aria-hidden="true" />
      <img class="garden-orbit-ship" src="/assets/garden/orbit-ship-thrust.png" alt="" hidden aria-hidden="true" />
      <i class="garden-orbit-ship-palette" aria-hidden="true"></i>
      <nav class="garden-holes" hidden aria-label="回溯入口"></nav>
      <i class="garden-void" aria-hidden="true"></i>
      <p class="garden-asset-error" hidden>月面素材未能完整加载，请刷新重试。你的登记资料仍会保留。</p>
    </div>
    <aside class="garden-rift" hidden aria-label="裂隙回测">
      <div class="garden-rift-inner">
        <button type="button" class="garden-rift-back">返回入口</button>
        <div class="garden-rift-body"></div>
      </div>
    </aside>`
  host.append(root)
  const find = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!
  const frame = find<HTMLElement>('.garden-frame')
  const panel = find<HTMLElement>('.garden-panel')
  const eventTalk = find<HTMLElement>('.garden-event-talk')
  const eventTalkTitle = find<HTMLElement>('.garden-event-talk-title')
  const eventTalkLead = find<HTMLElement>('.garden-event-talk-lead')
  const eventTalkReady = find<HTMLElement>('.garden-event-talk-ready')
  const eventTalkLog = find<HTMLElement>('.garden-event-talk-log')
  const eventTalkStart = find<HTMLButtonElement>('.garden-event-talk-start')
  const eventTalkForm = find<HTMLFormElement>('.garden-event-talk-form')
  const eventTalkInput = eventTalkForm.querySelector('input')!
  const form = find<HTMLFormElement>('.garden-form')
  const input = form.querySelector('input')!
  const output = form.querySelector('output')!
  const choiceNav = find<HTMLElement>('.garden-choice-flowers')
  const groundNav = find<HTMLElement>('.garden-ground-flowers')
  const holesNav = find<HTMLElement>('.garden-holes')
  const rift = find<HTMLElement>('.garden-rift')
  const riftBody = find<HTMLElement>('.garden-rift-body')
  const nodes = find<HTMLElement>('.garden-nodes')
  const hatch = find<HTMLElement>('.garden-hatch')
  const player = find<HTMLCanvasElement>('.garden-player').getContext('2d')!
  const lifeCanvas = find<HTMLCanvasElement>('.garden-life-color')
  const lifeColor = lifeCanvas.getContext('2d')!
  const growthCanvas = find<HTMLCanvasElement>('.garden-life-growth')
  const lifeGrowth = growthCanvas.getContext('2d')!
  const cosmosCanvas = find<HTMLCanvasElement>('.garden-cosmos-color')
  const cosmosColor = cosmosCanvas.getContext('2d')!
  const cosmosStarsCanvas = find<HTMLCanvasElement>('.garden-cosmos-stars')
  const cosmosStars = cosmosStarsCanvas.getContext('2d')!
  const lifeLightCanvas = find<HTMLCanvasElement>('.garden-life-light')
  const lifeLight = lifeLightCanvas.getContext('2d')!
  const sprite = new Image()
  sprite.src = '/assets/player/player-walk-sheet-v2.png'
  const actionSprite = new Image()
  actionSprite.src = '/assets/player/player-plant-sheet-v1.png'
  const flowers = new Image()
  flowers.src = '/assets/garden/flower-lifecycle-kinds-v2.png'
  const kinds = new Image()
  kinds.src = '/assets/garden/flower-kinds-v1.png'
  let state: GardenState = restoreGardenState(read(GARDEN_SAVE_KEY), readArchiveProfile())
  let active = false
  let planting: { age: number; choiceId: string } | null = null
  let phase: GardenPhase = 'era'
  let inspected: string | null = null
  let selectedSignal: string | null = null
  let activatedAge: number | null = null
  const liveNodes = new Map<number, EraNode>()
  const eventYearLive = new Map<number, EventYearPayload>()
  const livePortraits = new Map<string, LivePortrait[]>()
  const ownDrafts = new Map<number, string>()
  let liveRequest = 0
  let pendingHole: RiftKind | null = null
  let departing = false
  let launching = false
  let riftView: RiftView = { kind: 'backtrack', backtrackAge: null, altChoiceId: null, followSlot: null, age28Id: null, foreOpen: null, agentChapter: 'appear', agentReply: null, evidenceOpen: false, walkIndex: 0, walkPicks: {} }
  let flowerSetKey = ''
  let actor = new GardenActor()
  let actorFrame = 0
  let previousActorTime = 0
  let lastDraw = 0
  let lastStep = 0
  let meteorTimer = 0
  let shipTimer = 0
  let landTimer = 0
  let swallowTimer = 0
  let awakeningTimer = 0
  let eventTalkCue: { age: number, text: string } | null = null
  const openedEventTalkAges = new Set<number>()
  let panelMode: 'profile' | 'target' | 'memory' | 'signal' | 'fork' = 'memory'
  let returnFocus: HTMLElement | null = null
  let sound: AudioContext | undefined
  let assetsReady = false
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches
  const flowerDrawKeys = new WeakMap<HTMLCanvasElement, string>()
  let lifeDrawKey = ''
  const starClusters = buildStarClusters()
  const awayFromGarden = () => phase === 'launch' || phase === 'crossroads' || phase === 'rift'
  const launchBeat = () => (root.dataset.launchBeat ?? '') as LaunchBeat | ''
  const inFlight = () => phase === 'launch' || FLIGHT_CLASSES.some(name => root.classList.contains(name))
  function clearFlight() {
    launching = false
    departing = false
    delete root.dataset.launchBeat
    clearTimeout(swallowTimer)
    root.classList.remove(...FLIGHT_CLASSES)
  }
  function setLaunchBeat(beat: LaunchBeat) {
    root.dataset.launchBeat = beat
  }
  function afterBeat(ms: number, next: () => void) {
    clearTimeout(swallowTimer)
    swallowTimer = window.setTimeout(next, ms)
  }

  const ready = Promise.allSettled([
    find<HTMLImageElement>('.garden-background').decode(), sprite.decode(), flowers.decode(), kinds.decode(), actionSprite.decode(),
  ]).then(results => {
    assetsReady = results.every(r => r.status === 'fulfilled')
    find<HTMLElement>('.garden-asset-error').hidden = assetsReady
    if (active) { drawPlayer(); render() }
  })

  function save() {
    try { localStorage.setItem(GARDEN_SAVE_KEY, JSON.stringify(state)) } catch { /* Memory state remains usable. */ }
  }
  function grown() {
    return linePlanted(state)
  }
  function extras() {
    return eventAgesFor(state)
  }
  function kindSlot(kind?: number) {
    return ((kind ?? 0) % FLOWER_COLORS.length + FLOWER_COLORS.length) % FLOWER_COLORS.length
  }
  function plannedAges() {
    return [...new Set([0, 1, 2].flatMap(band => timelineNodes(band, state.target.age, state.selectedAge, state.currentAge, extras())))]
  }
  function pendingGrowth() {
    if (!planting || plantedHere(planting.age, planting.choiceId) || actor.revisit) return 0
    const sample = flowerSample(planting)
    return Math.max(0, Math.min(1, (sample.pose + sample.mix) / (FLOWER_FRAMES_PER_KIND - 1)))
  }
  function drawLifeColor(value: number, pending: number) {
    const planted = grown().filter(item => state.currentAge === null || item.age <= state.currentAge)
    const items = planting && !actor.revisit && !plantedHere(planting.age, planting.choiceId)
      ? [...planted, planting]
      : planted
    const soils = spreadGroundPoints(items.map(item => soilForAge(item.age, state.currentAge)))
    const patches = items.map((item, index) => {
      const kind = kindSlot(choiceAt(item.age, item.choiceId)?.flowerKind)
      const growing = planting?.age === item.age && planting.choiceId === item.choiceId && !plantedHere(item.age, item.choiceId)
      // Before the flower is mostly open only a hairline root signal is visible.
      const reveal = growing
        ? pending < .66 ? pending * .12 : .08 + (pending - .66) / .34 * .92
        : 1
      return { patch: buildLifePatch(item.age, item.choiceId, kind, soils[index]), reveal: Math.max(0, Math.min(1, reveal)) }
    })
    const key = [
      String(Math.round(value * 48)),
      ...patches.map(({ patch, reveal }) => `${patch.age}:${patch.choiceId}:${patch.flowerKind}:${patch.root.x.toFixed(0)}:${Math.round(reveal * 24)}`),
    ].join('|')
    if (lifeDrawKey === key) return
    lifeDrawKey = key
    lifeCanvas.width = 1672
    lifeCanvas.height = 941
    cosmosCanvas.width = 1672
    cosmosCanvas.height = 941
    cosmosStarsCanvas.width = 1672
    cosmosStarsCanvas.height = 941
    lifeLightCanvas.width = 1672
    lifeLightCanvas.height = 941
    growthCanvas.width = 1672
    growthCanvas.height = 941
    lifeColor.imageSmoothingEnabled = false
    cosmosColor.imageSmoothingEnabled = false
    cosmosStars.imageSmoothingEnabled = false
    lifeLight.imageSmoothingEnabled = false
    lifeGrowth.imageSmoothingEnabled = false
    lifeColor.clearRect(0, 0, lifeCanvas.width, lifeCanvas.height)
    cosmosColor.clearRect(0, 0, cosmosCanvas.width, cosmosCanvas.height)
    cosmosStars.clearRect(0, 0, cosmosStarsCanvas.width, cosmosStarsCanvas.height)
    lifeLight.clearRect(0, 0, lifeLightCanvas.width, lifeLightCanvas.height)
    lifeGrowth.clearRect(0, 0, growthCanvas.width, growthCanvas.height)
    drawPlanetSurfaceRegions(lifeColor, patches)
    drawSurfaceGrowth(lifeGrowth, patches)
    drawStarClusters(cosmosColor, starClusters, value)
    drawCosmosSparkles(cosmosStars, starClusters, value)
    const completedPatches = patches.filter(item => item.reveal >= 1).map(item => item.patch)
    const connections = buildLifeConnections(completedPatches, value)
    drawLifeConnections(lifeColor, connections, value)
    drawLifeConnections(lifeLight, connections, value, true)
    for (const { patch, reveal } of patches) {
      drawLifePatch(lifeColor, patch, reveal)
      drawLifeCracks(lifeLight, patch, reveal)
    }
    clearShipOverlay(lifeColor)
    clearShipOverlay(lifeGrowth)
    clearShipOverlay(lifeLight)
    drawEnvironmentColor(lifeColor, value)
    drawEnvironmentLight(lifeLight, value)
  }
  function updateVitality() {
    const total = Math.max(1, plannedAges().length)
    const pending = pendingGrowth()
    const value = calculateVitality(grown().length, total, pending)
    const percent = Math.round(value * 100)
    root.style.setProperty('--garden-vitality', value.toFixed(4))
    root.dataset.vitality = String(percent)
    const meter = find<HTMLElement>('.garden-vitality-meter')
    meter.setAttribute('aria-valuenow', String(percent))
    const label = meter.querySelector('b')
    if (label) label.textContent = `${percent}%`
    drawLifeColor(value, pending)
  }
  function plantedHere(age = state.selectedAge, choiceId?: string) {
    return hasPlanted(grown(), age, choiceId)
  }
  function idealizedHere(age = state.selectedAge, choiceId?: string) {
    return hasPlanted(lineIdeal(state), age, choiceId)
  }
  function commitChoice(list: 'planted' | 'ideal', age: number, choiceId: string, label?: string) {
    const item: GardenState['planted'][number] = { age, choiceId, ...(label ? { label } : {}) }
    const walking = state.line === 'parallel' && state.forkAge !== null && age >= state.forkAge
    if (list === 'ideal') {
      if (walking) state.parallelIdeal = upsertPlanted(state.parallelIdeal, item)
      else state.ideal = upsertPlanted(state.ideal, item)
      return
    }
    if (walking) state.parallelPlanted = upsertPlanted(state.parallelPlanted, item)
    else state.planted = upsertPlanted(state.planted, item)
  }
  function commitPlanted(age: number, choiceId: string, label?: string) {
    commitChoice('planted', age, choiceId, label)
  }
  function commitIdeal(age: number, choiceId: string, label?: string) {
    commitChoice('ideal', age, choiceId, label)
  }
  function choiceLabelFor(choice: EraChoice) {
    if (choice.id === EVENT_MARK_ID) return eventPlantedLabel(choice, eventAt()?.text || '')
    return isOwnChoice(choice) ? ownLabel() || choice.label : choice.label
  }
  function pendingEventTalk() {
    return unfinishedEventTalk(state, readEventTalks())
  }
  function eventTalkLaunch() {
    const unfinished = pendingEventTalk()
    const pending = Boolean(unfinished || eventTalkCue)
    return {
      pending,
      visible: eventTalkLaunchVisible({ pending, away: awayFromGarden(), talkOpen: !eventTalk.hidden }),
      target: eventTalkCue || unfinished,
    }
  }
  function openPendingEventTalk(force = false) {
    if (!force && !shouldEnterCrossroads(state.selectedAge, state.currentAge)) return false
    const next = pendingEventTalk()
    if (!next) return false
    eventTalkCue = next
    openEventTalk(next)
    return true
  }
  function openCuedEventTalk() {
    const next = eventTalkCue || pendingEventTalk() || eventTalkAt(state, state.selectedAge)
    if (next) openEventTalk(next)
  }
  function enterNpcAfterIdeal() {
    const user = grown().find(item => item.age === state.selectedAge)
    inspected = user?.choiceId ?? inspected
    selectedSignal = null
    if (inspected && inspected !== EVENT_MARK_ID) requestLivePortraits(state.selectedAge, inspected)
    clearTimeout(awakeningTimer)
    const soil = soilForAge(state.selectedAge, state.currentAge)
    const choice = inspected ? choiceAt(state.selectedAge, inspected) : undefined
    root.style.setProperty('--awakening-x', `${soil.x / 1672 * 100}%`)
    root.style.setProperty('--awakening-y', `${soil.y / 941 * 100}%`)
    root.style.setProperty('--awakening-color', FLOWER_COLORS[kindSlot(choice?.flowerKind)])
    phase = 'awakening'
    root.inert = true
    save()
    render()
    cue(392)
    awakeningTimer = window.setTimeout(() => {
      if (!active || phase !== 'awakening') return
      root.inert = false
      phase = 'npc'
      render()
      openPendingEventTalk()
    }, reduced() ? 240 : 2100)
  }
  function cue(frequency = 280) {
    try {
      sound ??= new AudioContext()
      void sound.resume()
      const tone = sound.createOscillator(), gain = sound.createGain(), now = sound.currentTime
      tone.frequency.setValueAtTime(frequency, now)
      tone.frequency.exponentialRampToValueAtTime(frequency * 0.66, now + 0.38)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.014, now + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55)
      tone.connect(gain).connect(sound.destination); tone.start(); tone.stop(now + 0.6)
    } catch { /* Silent mode remains playable. */ }
  }
  function journeyAt(age = state.selectedAge) {
    return journeyContext({
      selectedAge: age,
      currentAge: state.currentAge,
      target: state.target,
      profile: state.profile,
      planted: grown(),
    })
  }
  function ownLabel(age = state.selectedAge): string {
    return grown().find(item => item.age === age && item.choiceId === OWN_CHOICE_ID)?.label
      || ownDrafts.get(age)
      || ''
  }
  function eventAt(age = state.selectedAge) {
    return lifeEventAtAge(state.profile, age, state.target.age)
  }
  function nodeAt(age: number): EraNode {
    const base = withOwnChoice(liveNodes.get(age) ?? eraNodeForAge(age), ownLabel(age))
    const event = eventAt(age)
    if (!event) return base
    const live = eventYearLive.get(age)
    const planting = phase !== 'ideal' || age !== state.selectedAge
    return {
      ...base,
      age,
      title: event.text,
      event: event.text,
      era: live?.era || eventEraFallback(event),
      choices: eventYearChoices(age, event, planting ? 'plant' : 'ideal', live?.ideals ?? [], base),
    }
  }
  function era() {
    return nodeAt(state.selectedAge)
  }
  function choiceAt(age: number, choiceId: string): EraChoice | undefined {
    const event = eventAt(age)
    if (event && choiceId === EVENT_MARK_ID) return eventMarkChoice(age, event.text)
    return nodeAt(age).choices.find(item => item.id === choiceId) ?? eraChoice(age, choiceId)
  }
  function requestEventYear(age: number) {
    const event = eventAt(age)
    if (!event || !liveEnabled()) return
    const ticket = ++liveRequest
    void loadEventYear({ age, event, planted: grown(), personalTag: personalTagPayload() }).then(payload => {
      if (ticket !== liveRequest || !active || !payload) return
      eventYearLive.set(age, payload)
      flowerSetKey = ''
      render()
    })
  }
  function requestLiveNode(age: number) {
    if (eventAt(age)) {
      requestEventYear(age)
      return
    }
    if (!liveEnabled()) return
    const ticket = ++liveRequest
    void loadLifeNode(journeyAt(age)).then(node => {
      if (ticket !== liveRequest || !active) return
      liveNodes.set(age, node)
      if (activatedAge === age && (phase === 'choices' || phase === 'inspect')) {
        flowerSetKey = ''
        render()
      }
    })
  }
  function requestLivePortraits(age: number, choiceId: string, mode: 'planted' | 'backtrack' = 'planted') {
    if (!liveEnabled()) return
    const key = mode === 'backtrack' ? `alt:${age}:${choiceId}` : `${age}:${choiceId}`
    void loadLivePortraits(journeyAt(age), choiceId, mode).then(list => {
      if (!active) return
      livePortraits.set(key, list)
      if (mode === 'planted' && phase === 'npc' && inspected === choiceId) render()
      if (mode === 'backtrack' && (panelMode === 'fork' || (phase === 'rift' && riftView.kind === 'backtrack'))) render()
    })
  }
  function drawPlayer() {
    player.clearRect(0, 0, 1672, 941)
    if (!sprite.naturalWidth) return
    player.imageSmoothingEnabled = false
    const { x, y } = actor.position
    const boarding = actor.phase === 'boarding'
    const board = boarding ? actor.progress * actor.progress : 0
    const size = (92 + (y - 616) * .05) * (1 - board * .62)
    const t = actor.progress
    let atlas = sprite, column = 2, row = 1
    if (actor.phase === 'walking') column = Math.floor(actor.walkDistance / 13) % 6
    else if (actionSprite.naturalWidth && ['kneeling', 'planting', 'rising', 'touching'].includes(actor.phase)) {
      atlas = actionSprite; row = 0
      column = actor.phase === 'kneeling' ? Math.min(2, Math.floor(t * 3))
        : actor.phase === 'planting' ? 3
          : actor.phase === 'rising' ? (t < .55 ? 4 : 5)
            : t < .4 ? 1 : t < .75 ? 2 : 1
    } else if (actor.phase === 'turning' && t < .45 || actor.phase === 'greeting') { row = 0; column = 2 }
    else if (actionSprite.naturalWidth) { atlas = actionSprite; row = 0; column = 0 }
    player.save()
    player.globalAlpha = boarding ? Math.max(0, 1 - board) : 1
    player.fillStyle = '#050505a8'
    player.beginPath(); player.ellipse(x, y + 1, size * .2, size * .042, -.12, 0, Math.PI * 2); player.fill()
    player.translate(Math.round(x), Math.round(y)); player.scale(actor.facing, 1)
    if (!reduced() && actor.phase === 'idle' && actor.elapsed % 4 > 2.7) {
      player.drawImage(atlas, column * 128, row * 128 + 86, 128, 42, -size / 2, -size * 42 / 128, size, size * 42 / 128)
      player.drawImage(atlas, column * 128, row * 128, 128, 86, -size / 2, -size - .65, size, size * 86 / 128)
    } else player.drawImage(atlas, column * 128, row * 128, 128, 128, -size / 2, -size, size, size)
    player.restore()
    if (actor.phase === 'planting') {
      player.fillStyle = '#c8c8b9'
      const seedY = y - 5 + Math.min(1, actor.progress * 3) * 5
      player.fillRect(Math.round(x + 22), Math.round(seedY), 2, 3)
    }
    const hit = find<HTMLButtonElement>('.garden-player-hit')
    hit.style.left = `${x / 1672 * 100}%`
    hit.style.top = `${(y - size * .45) / 941 * 100}%`
    hit.disabled = actor.busy
    root.dataset.actorX = x.toFixed(1); root.dataset.actorY = y.toFixed(1)
  }
  function animateActor(now: number) {
    if (!active) return
    const dt = previousActorTime ? Math.min(.1, (now - previousActorTime) / 1000) : 0
    previousActorTime = now
    if (!root.inert && !document.hidden && panel.hidden) {
      const events = actor.advance(dt)
      for (const event of events) {
        if (event.type === 'seed') cue(174)
        if (event.type === 'phase') { root.dataset.actorPhase = event.phase; render() }
        if (event.type === 'complete') {
          const revisiting = event.revisit
          if (planting && !revisiting && !plantedHere(planting.age, planting.choiceId)) {
            const plantedChoice = choiceAt(planting.age, planting.choiceId)
            const event = lifeEventAtAge(state.profile, planting.age, state.target.age)
            commitPlanted(
              planting.age,
              planting.choiceId,
              plantedChoice ? eventPlantedLabel(plantedChoice, event?.text || '') : undefined,
            )
            save()
          }
          planting = null
          cue(revisiting ? 260 : 348)
          inspected = inspected ?? grown().at(-1)?.choiceId ?? null
          if (!revisiting && !idealizedHere(state.selectedAge)) {
            phase = 'ideal'
          } else {
            phase = 'npc'
            if (inspected && inspected !== EVENT_MARK_ID) requestLivePortraits(state.selectedAge, inspected)
          }
          render()
          if (phase === 'npc') openPendingEventTalk()
        }
        if (event.type === 'boarded') {
          cue(118)
          if (launching) {
            launching = false
            root.classList.remove('is-boarding')
            continueLaunchAfterBoard()
          } else if (departing) {
            departing = false
            root.classList.remove('is-boarding')
            if (pendingHole) openRift(pendingHole)
          } else if (pendingHole) {
            openRift(pendingHole)
          }
        }
      }
      const step = Math.floor(actor.walkDistance / 39)
      if (actor.phase === 'walking' && step !== lastStep) { footstep(); lastStep = step }
    }
    if (now - lastDraw > 1000 / 30) { drawPlayer(); updateFlowerFrames(); lastDraw = now }
    actorFrame = requestAnimationFrame(animateActor)
  }
  function footstep() {
    if (!sound || sound.state !== 'running') return
    const tone = sound.createOscillator(), gain = sound.createGain(), now = sound.currentTime
    tone.type = 'triangle'; tone.frequency.setValueAtTime(88, now)
    gain.gain.setValueAtTime(.011, now); gain.gain.exponentialRampToValueAtTime(.0001, now + .07)
    tone.connect(gain).connect(sound.destination); tone.start(); tone.stop(now + .08)
  }
  function flowerSample(item: { age: number; choiceId: string; kind?: number }) {
    const chapter = chapterForAge(item.age)
    const growing = planting?.age === item.age && planting.choiceId === item.choiceId && !actor.revisit
    if (growing) return flowerPoseAt(chapter, actor.growthElapsed)
    return { pose: flowerEndpoint(chapter), next: flowerEndpoint(chapter), mix: 0 }
  }
  function drawFlower(canvas: HTMLCanvasElement, item: { age: number; choiceId: string; kind?: number }) {
    const growing = planting?.age === item.age && planting.choiceId === item.choiceId && !actor.revisit
    const slot = kindSlot(item.kind)
    canvas.dataset.kind = String(slot)
    if (item.kind !== undefined && !plantedHere(item.age, item.choiceId) && !growing) {
      const key = flowers.naturalWidth ? `atlas-preview:${slot}` : kinds.naturalWidth ? `sheet:${slot}` : `kind:${slot}`
      canvas.dataset.pose = String(FLOWER_FRAMES_PER_KIND - 1)
      if (flowerDrawKeys.get(canvas) === key) return
      if (flowers.naturalWidth) {
        canvas.width = 128
        canvas.height = 128
        const ctx = canvas.getContext('2d')!
        ctx.imageSmoothingEnabled = false
        ctx.clearRect(0, 0, 128, 128)
        ctx.drawImage(flowers, (FLOWER_FRAMES_PER_KIND - 1) * 128, slot * 128, 128, 128, 0, 0, 128, 128)
      } else if (kinds.naturalWidth) {
        canvas.width = 128
        canvas.height = 128
        const ctx = canvas.getContext('2d')!
        ctx.imageSmoothingEnabled = false
        ctx.clearRect(0, 0, 128, 128)
        ctx.drawImage(kinds, slot * 128, 0, 128, 128, 0, 0, 128, 128)
      } else {
        paintFlowerKind(canvas, slot)
      }
      flowerDrawKeys.set(canvas, key)
      return
    }
    const sample = flowerSample(item)
    const mix = reduced() ? 0 : Math.round(sample.mix * 8) / 8
    const key = `${slot}:${sample.pose}:${sample.next}:${mix}`
    canvas.dataset.pose = String(sample.pose)
    if (!flowers.naturalWidth || flowerDrawKeys.get(canvas) === key) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.imageSmoothingEnabled = false
    ctx.save()
    ctx.globalAlpha = 1 - mix
    ctx.drawImage(flowers, sample.pose * 128, slot * 128, 128, 128, 0, 0, canvas.width, canvas.height)
    if (mix > 0) {
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = mix
      ctx.drawImage(flowers, sample.next * 128, slot * 128, 128, 128, 0, 0, canvas.width, canvas.height)
    }
    ctx.restore(); flowerDrawKeys.set(canvas, key)
  }
  function updateFlowerFrames() {
    root.querySelectorAll<HTMLButtonElement>('[data-flower-item]').forEach(button => {
      const canvas = button.querySelector('canvas')
      if (!canvas) return
      const age = Number(button.dataset.age)
      const choiceId = button.dataset.choice ?? ''
      const kind = button.dataset.kind === undefined ? undefined : Number(button.dataset.kind)
      drawFlower(canvas, { age, choiceId, kind })
      button.dataset.flowerFrame = String(Number(canvas.dataset.pose) + 1)
      const growing = planting?.age === age && planting.choiceId === choiceId && !actor.revisit && ['planting', 'rising', 'observing'].includes(actor.phase)
      button.classList.toggle('is-growing', growing)
      const sample = flowerSample({ age, choiceId, kind })
      const localGrowth = growing
        ? Math.max(0, Math.min(1, (sample.pose + sample.mix) / (FLOWER_FRAMES_PER_KIND - 1)))
        : plantedHere(age, choiceId) ? 1 : 0
      button.style.setProperty('--flower-growth', localGrowth.toFixed(3))
      button.style.setProperty('--flower-color', FLOWER_COLORS[kindSlot(kind)])
      const label = button.querySelector('small')
      if (growing && label && button.dataset.flowerItem === 'ground') label.textContent = FLOWER_POSES[Number(canvas.dataset.pose)]
    })
    updateVitality()
  }
  function visibleGround() {
    const band = timelineBand(state.selectedAge)
    const planted = grown().filter(item => state.currentAge === null || item.age <= state.currentAge)
    if (planting && timelineBand(planting.age) === band && !planted.some(item => item.age === planting!.age && item.choiceId === planting!.choiceId)) {
      return [...planted, planting]
    }
    return planted
  }
  function pickingBacktrackFlowers() {
    return false
  }
  function backtrackYears() {
    const planted = state.planted.filter(item => state.currentAge === null || item.age <= state.currentAge)
    if (planted.length) return planted
    const age = eraNodeForAge(state.currentAge ? Math.max(0, state.currentAge - 2) : 20).age
    return [{ age, choiceId: nodeAt(age).choices[0].id }]
  }
  function echoTrail(age: number | null) {
    riftBody.querySelectorAll<HTMLElement>('.garden-rift-trail-star').forEach(node => {
      node.classList.toggle('is-echo', age !== null && node.dataset.age === String(age))
    })
  }
  function renderGroundFlowers() {
    groundNav.replaceChildren()
    const picking = pickingBacktrackFlowers()
    const items = (picking ? backtrackYears() : visibleGround()).filter(item => {
      const planted = plantedHere( item.age, item.choiceId)
      const growing = planting?.age === item.age && planting.choiceId === item.choiceId
      return picking || planted || growing
    })
    const soils = spreadGroundPoints(items.map(item => soilForAge(item.age, state.currentAge)))
    items.forEach((item, index) => {
      const planted = plantedHere( item.age, item.choiceId)
      const growing = planting?.age === item.age && planting.choiceId === item.choiceId
      const soil = soils[index]
      const choice = choiceAt(item.age, item.choiceId)
      const storedLabel = 'label' in item && typeof item.label === 'string' ? item.label : ''
      const plantedName = storedLabel || (choice ? eventPlantedLabel(choice, eventAt(item.age)?.text || '') : '') || choice?.label
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'garden-ground-flower'
      button.dataset.flowerItem = 'ground'
      button.dataset.age = String(item.age)
      button.dataset.choice = item.choiceId
      button.dataset.kind = String(kindSlot(choice?.flowerKind))
      button.dataset.chapter = String(chapterForAge(item.age))
      button.dataset.planted = String(planted || picking)
      button.style.left = `${soil.x / 1672 * 100}%`
      button.style.top = `${(soil.y + 9) / 941 * 100}%`
      button.setAttribute('aria-label', picking
        ? `回到 ${item.age}岁 · ${plantedName || '已种下的花'}`
        : `${item.age}岁 · ${plantedName || '已种下的花'}`)
      button.disabled = picking ? false : actor.busy || !assetsReady
      button.classList.toggle('is-planting', growing && actor.phase === 'planting')
      button.classList.toggle('is-rising', growing && actor.phase === 'rising')
      button.classList.toggle('is-rift-pick', picking)
      button.classList.toggle('is-rift-active', picking && riftView.backtrackAge === item.age)
      button.classList.toggle('is-parallel', state.line === 'parallel' && state.forkAge !== null && item.age >= state.forkAge)
      button.style.setProperty('--flower-color', FLOWER_COLORS[kindSlot(choice?.flowerKind)])
      button.style.setProperty('--flower-growth', planted ? '1' : '0')
      button.style.setProperty('--flower-order', String(index))
      const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128
      const label = document.createElement('small')
      label.textContent = picking
        ? `${item.age}岁 · ${plantedName || '种下的花'}`
        : growing ? (actor.revisit ? '轻触时光' : '亲手种下') : `${item.age}岁`
      button.append(canvas, label)
      button.addEventListener('click', () => {
        if (picking) {
          riftView = { ...riftView, backtrackAge: item.age, altChoiceId: null }
          render()
          return
        }
        if (choice) inspectOrPlant(choice, planted)
      })
      if (picking) {
        button.addEventListener('pointerenter', () => echoTrail(item.age))
        button.addEventListener('pointerleave', () => echoTrail(riftView.backtrackAge))
      }
      groundNav.append(button)
      drawFlower(canvas, { age: item.age, choiceId: item.choiceId, kind: choice?.flowerKind })
    })
  }
  function syncChoiceFlower(button: HTMLButtonElement, item: EraChoice, index: number) {
    button.dataset.planted = String(plantedHere( state.selectedAge, item.id))
    button.style.setProperty('--slot', String(index))
    button.classList.toggle('is-planting-away', Boolean(planting && planting.age === state.selectedAge && planting.choiceId === item.id && !actor.revisit))
    button.setAttribute('aria-pressed', String(inspected === item.id))
    button.disabled = actor.busy || !assetsReady
    const name = button.querySelector('span')
    if (name) name.textContent = item.label
    button.setAttribute('aria-label', item.label)
  }
  function markFlowerLanded(button: HTMLButtonElement) {
    button.classList.add('is-landed')
  }
  function renderChoiceFlowers() {
    const showing = activatedAge === state.selectedAge && (phase === 'choices' || phase === 'inspect' || phase === 'ideal')
    choiceNav.hidden = !showing
    if (!showing) return
    const choices = era().choices
    const pads = choicePads(choices.length)
    const nextKey = `${state.selectedAge}:${choices.map(item => item.id).join(',')}`
    const existing = [...choiceNav.querySelectorAll<HTMLButtonElement>('.garden-choice-flower')]
    if (flowerSetKey === nextKey && existing.length === choices.length) {
      choices.forEach((item, index) => syncChoiceFlower(existing[index], item, index))
      return
    }
    flowerSetKey = nextKey
    choiceNav.dataset.count = String(choices.length)
    choiceNav.style.setProperty('--choice-count', String(choices.length))
    choiceNav.replaceChildren()
    choices.forEach((item, index) => {
      const pad = pads[index]
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'garden-choice-flower'
      button.dataset.flowerItem = 'choice'
      button.dataset.age = String(state.selectedAge)
      button.dataset.choice = item.id
      button.dataset.kind = String(item.flowerKind)
      button.dataset.chapter = String(chapterForAge(state.selectedAge))
      button.style.setProperty('--door-x', String(CHOICE_DOOR.x / 1672 * 100))
      button.style.setProperty('--door-y', String(CHOICE_DOOR.y / 941 * 100))
      button.style.setProperty('--pad-x', String(pad.x / 1672 * 100))
      button.style.setProperty('--pad-y', String(pad.y / 941 * 100))
      button.style.setProperty('--slot', String(index))
      button.dataset.lane = choiceLane(index, choices.length)
      button.classList.toggle('is-planting-away', Boolean(planting && planting.age === state.selectedAge && planting.choiceId === item.id && !actor.revisit))
      button.setAttribute('aria-label', item.label)
      const halo = document.createElement('i')
      halo.className = 'garden-choice-halo'
      halo.setAttribute('aria-hidden', 'true')
      const canvas = document.createElement('canvas')
      canvas.width = 128
      canvas.height = 128
      const name = document.createElement('span')
      name.textContent = item.label
      button.append(halo, canvas, name)
      syncChoiceFlower(button, item, index)
      button.addEventListener('click', () => inspectOrPlant(item, plantedHere(state.selectedAge)))
      button.addEventListener('pointerenter', () => actor.lookAt(pad.x))
      button.addEventListener('animationend', event => {
        if (event.animationName === 'garden-flower-fly') markFlowerLanded(button)
      })
      if (root.classList.contains('is-ship-open') || reduced()) markFlowerLanded(button)
      choiceNav.append(button)
      drawFlower(canvas, { age: state.selectedAge, choiceId: item.id, kind: item.flowerKind })
    })
  }
  function renderNpcCard(item: ReturnType<typeof signalPortraits>[number]) {
    const card = document.createElement('article')
    card.className = 'garden-signal-card'
    card.dataset.signal = item.slot
    const head = document.createElement('header')
    const face = npcFace(`${item.slot}:${item.npc.name}`, item.npc.avatar)
    const who = document.createElement('div')
    const name = document.createElement('strong')
    name.textContent = item.npc.name
    const slot = document.createElement('span')
    slot.textContent = item.slot
    const identity = document.createElement('p')
    identity.textContent = item.npc.identity
    who.append(name, slot, identity)
    const close = document.createElement('button')
    close.type = 'button'
    close.className = 'garden-signal-card-close'
    close.setAttribute('aria-label', '收起画像')
    close.textContent = '收起'
    close.disabled = actor.busy
    close.addEventListener('click', () => { selectedSignal = null; render() })
    head.append(face, who, close)
    const live = item as LivePortrait
    const explain = live.explain ?? (() => {
      const chosenForCard = choiceAt(item.age, item.choice.id)
      return chosenForCard ? explainAuthored(chosenForCard, journeyAt()) : null
    })()
    const match = document.createElement('p')
    match.className = 'garden-signal-card-match'
    match.textContent = explain?.headline || item.npc.match
    card.append(head, match)
    const story = document.createElement('p')
    story.className = 'garden-signal-story'
    story.textContent = explain?.story || item.npc.causal.background
    card.append(story)
    const spoken = portraitQuote({ quote: explain?.quote, href: live.href })
    if (spoken) {
      const quote = document.createElement('p')
      quote.className = 'garden-signal-quote'
      quote.textContent = `「${spoken}」`
      card.append(quote)
    }
    const post = choicePostFor(item.age, item.choice.id)
    const href = live.href || post.href
    if (href) {
      const link = document.createElement('a')
      link.className = 'garden-signal-source'
      link.href = href
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      link.textContent = live.href
        ? '去看 TA 的公开原文'
        : `演示帖 · 不是公开原文 · ${post.title}`
      card.append(link)
    }
    return card
  }
  function renderSignals() {
    const signals = find<HTMLElement>('.garden-signals')
    const kicker = find<HTMLElement>('.garden-signals-kicker')
    const body = find<HTMLElement>('.garden-signals-body')
    const chosen = choiceAt(state.selectedAge, inspected ?? '')
    const askingIdealOwn = phase === 'ideal' && chosen !== undefined && isOwnChoice(chosen) && !ownLabel()
    const showInspect = Boolean(chosen) && activatedAge === state.selectedAge && (phase === 'inspect' || askingIdealOwn)
    const showNpc = Boolean(chosen) && activatedAge === state.selectedAge && phase === 'npc'
    const mode = showNpc ? 'npc' : showInspect ? 'inspect' : 'idle'
    root.dataset.signalMode = mode
    signals.hidden = mode === 'idle'
    signals.classList.toggle('is-sky', showNpc)
    if (mode === 'idle') {
      selectedSignal = null
      body.replaceChildren()
      return
    }
    body.replaceChildren()
    if (showInspect && chosen) {
      kicker.innerHTML = '这一年的选择回声 <small>结合你走过的路</small>'
      const card = document.createElement('div')
      card.className = 'garden-signal-reason'
      const title = document.createElement('strong')
      title.textContent = isOwnChoice(chosen)
        ? (ownLabel() ? `你写下了「${ownLabel()}」` : '这一圈留给你自己写')
        : `「${chosen.label}」`
      const why = document.createElement('p')
      why.textContent = chosen.reason
      card.append(title, why)
      if (isOwnChoice(chosen) && !plantedHere( state.selectedAge, OWN_CHOICE_ID)) {
        const ownForm = document.createElement('form')
        ownForm.className = 'garden-own-path'
        const field = document.createElement('label')
        field.textContent = '你这一年走的路'
        const box = document.createElement('input')
        const ownAge = state.selectedAge
        box.type = 'text'
        box.maxLength = 40
        box.autocomplete = 'off'
        box.setAttribute('aria-label', '你这一年走的路')
        box.placeholder = '例如：去当兵，后来又复员'
        box.value = ownLabel()
        box.addEventListener('input', () => {
          const draft = box.value.slice(0, 40)
          if (draft) ownDrafts.set(ownAge, draft)
          else ownDrafts.delete(ownAge)
        })
        const confirm = document.createElement('button')
        confirm.type = 'submit'
        confirm.textContent = '写下这句'
        ownForm.append(field, box, confirm)
        ownForm.addEventListener('submit', event => {
          event.preventDefault()
          const written = box.value.trim().slice(0, 40)
          if (!written) { box.focus(); return }
          ownDrafts.set(state.selectedAge, written)
          flowerSetKey = ''
          if (phase === 'ideal') {
            commitIdeal(state.selectedAge, OWN_CHOICE_ID, written)
            enterNpcAfterIdeal()
            return
          }
          if (plantedHere(state.selectedAge) && !plantedHere(state.selectedAge, OWN_CHOICE_ID)) {
            render()
            find<HTMLElement>('.garden-note').textContent = '这一年已经种过了。先重置当年选择，再写下自己的路。'
            return
          }
          if (plantedHere(state.selectedAge, OWN_CHOICE_ID)) {
            commitPlanted(state.selectedAge, OWN_CHOICE_ID, written)
            save()
            render()
            return
          }
          // Image decoding or a just-finished actor transition can briefly keep
          // the scene busy even though this lightweight form is already usable.
          // Retain the written sentence and start as soon as the scene is ready
          // instead of silently dropping the submit.
          let attempts = 0
          const startOwnPlant = () => {
            if ((!assetsReady || actor.busy) && active && attempts < 24) {
              attempts += 1
              window.setTimeout(startOwnPlant, 50)
              return
            }
            const own = choiceAt(state.selectedAge, OWN_CHOICE_ID)
            if (own) inspectOrPlant(own, false, true)
          }
          startOwnPlant()
        })
        card.append(ownForm)
      } else {
        const explain = explainAuthored(chosen, journeyAt())
        const story = document.createElement('p')
        story.className = 'garden-signal-story'
        story.textContent = explain.story
        card.append(story)
      }
      body.append(card)
      if (!isOwnChoice(chosen) && chosen.id !== EVENT_MARK_ID) requestLivePortraits(state.selectedAge, chosen.id)
      return
    }
    if (!chosen) return
    signals.classList.toggle('is-sky', showNpc)
    kicker.innerHTML = `飞船上方的对照帖 <small>${MATCH_HONESTY}</small>`
    const portraits = chosen.id === EVENT_MARK_ID
      ? eventMarkPortraits(state.selectedAge, chosen)
      : livePortraits.get(`${state.selectedAge}:${chosen.id}`) ?? signalPortraits(state.selectedAge, chosen.id, 'planted')
    const opened = portraits.find(item => item.slot === selectedSignal)
    const row = document.createElement('div')
    row.className = 'garden-signal-portraits'
    for (const item of portraits) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = `garden-signal-npc${item.slot === selectedSignal ? ' is-open' : ''}`
      button.dataset.signal = item.slot
      button.dataset.kind = item.kind
      button.setAttribute('aria-label', `${item.slot} · ${item.npc.name}`)
      button.disabled = actor.busy
      const face = npcFace(`${item.slot}:${item.npc.name}`, item.npc.avatar)
      const badge = document.createElement('em')
      badge.textContent = item.kind === 'B' ? 'B · 跨代' : 'A · 同代'
      const name = document.createElement('strong')
      name.textContent = item.npc.name
      button.append(badge, face, name)
      button.addEventListener('click', () => {
        if (actor.busy) return
        selectedSignal = item.slot === selectedSignal ? null : item.slot
        render()
      })
      row.append(button)
    }
    body.append(row)
    if (opened) body.append(renderNpcCard(opened))
  }
  function renderCopy() {
    const node = era()
    const stats = find<HTMLElement>('.garden-choice-stats')
    const note = find<HTMLElement>('.garden-note')
    delete note.dataset.guide
    const showGuide = (title: string, detail: string) => {
      note.dataset.guide = 'true'
      const heading = document.createElement('strong')
      const help = document.createElement('span')
      heading.textContent = title
      help.textContent = detail
      note.replaceChildren(heading, help)
    }
    find<HTMLElement>('.garden-age').textContent = ''
    stats.replaceChildren()
    renderSignals()
    if (phase === 'launch') {
      find<HTMLElement>('.garden-copy > small').textContent = ''
      find<HTMLElement>('h1').textContent = ''
      find<HTMLElement>('.garden-note').textContent = ''
      stats.hidden = true
      return
    }
    if (actor.busy) {
      find<HTMLElement>('h1').textContent = actor.revisit ? '轻轻触碰这一年。' : '把这一种选择，种到星球上。'
      find<HTMLElement>('.garden-note').textContent = actor.phase === 'walking' || actor.phase === 'turning'
        ? '慢慢走过去吧。那段岁月，就在那里。'
        : actor.revisit ? '轻轻触碰，听听它留下的回声。'
          : actor.phase === 'observing' ? '看它从种子，迅速长成这一段岁月。'
            : '把这颗种子放下，让这一段时光留在这里。'
      stats.hidden = true
      return
    }
    if (phase === 'era' || activatedAge !== state.selectedAge) {
      find<HTMLElement>('h1').textContent = eraHeading(state.selectedAge, state.line === 'parallel')
      find<HTMLElement>('.garden-note').textContent = state.line === 'parallel' && state.forkAge !== null && state.selectedAge < state.forkAge
        ? `这一年还在主宇宙。平行宇宙从 ${state.forkAge} 岁才开始分岔。`
        : node.era
      stats.hidden = true
      return
    }
    if (phase === 'choices' || phase === 'inspect') {
      const chosen = phase === 'inspect' ? choiceAt(state.selectedAge, inspected ?? '') : undefined
      find<HTMLElement>('h1').textContent = eraHeading(state.selectedAge, state.line === 'parallel')
      if (!chosen) {
        if (eventAt()) {
          find<HTMLElement>('.garden-note').textContent = era().era
        } else {
          showGuide(
            state.line === 'parallel' ? '重新选择一朵花' : '选择一朵花',
            '点击一次查看这条路；确认后再点击一次种下。最边上可以写自己的路。',
          )
        }
      } else if (plantedHere(state.selectedAge, chosen.id)) {
        showGuide('这朵花已经种下', '再点击一次，可以走近听它留下的回声；不会重复种植。')
      } else if (plantedHere(state.selectedAge)) {
        showGuide(`正在查看「${chosen.label}」`, '这一年已有选择。想改口请先重置；否则再次点击只会查看另一条路。')
      } else if (isOwnChoice(chosen)) {
        showGuide(ownLabel() ? '确认你写下的路' : '写下你自己的路', ownLabel() ? '再点击一次，把这条路种到星球上。' : '写完后确认，再种下这一年的选择。')
      } else {
        showGuide(`已选择「${chosen.label}」`, '再点击同一朵花，种下你的选择。')
      }
      stats.hidden = true
      return
    }
    if (phase === 'ideal') {
      const askingOwn = (() => {
        const picked = choiceAt(state.selectedAge, inspected ?? '')
        return Boolean(picked && isOwnChoice(picked) && !ownLabel())
      })()
      find<HTMLElement>('h1').textContent = `${state.selectedAge}岁 · 你更希望走哪一条？`
      find<HTMLElement>('.garden-note').textContent = askingOwn
        ? '写下你更希望走的那条路。不会种到星球上。'
        : IDEAL_NOTE
      stats.hidden = true
      return
    }
    if (phase === 'awakening') {
      find<HTMLElement>('h1').textContent = '这一朵花，正在唤醒附近的月壤。'
      find<HTMLElement>('.garden-note').textContent = '颜色从根部向外生长。等星光稳定下来，再去看看与你相近的人生回声。'
      stats.hidden = true
      return
    }
    const chosen = choiceAt(state.selectedAge, inspected ?? '')
    if (phase === 'npc' && chosen) {
      find<HTMLElement>('h1').textContent = '飞船上方来了推荐帖。'
      find<HTMLElement>('.garden-note').textContent = eventTalkLaunch().visible ? EVENT_TALK_HINT : NPC_KIND_NOTE
      stats.hidden = true
    }
  }
  function render() {
    const focusedBefore = document.activeElement instanceof HTMLElement && root.contains(document.activeElement) ? document.activeElement : null
    const chapter = chapterForAge(state.selectedAge)
    const band = timelineBand(state.selectedAge)
    root.dataset.age = String(state.selectedAge)
    root.dataset.chapter = String(chapter)
    root.dataset.currentAge = state.currentAge === null ? '' : String(state.currentAge)
    root.dataset.targetAge = state.target.age === null ? '' : String(state.target.age)
    const loc = find<HTMLElement>('.garden-location')
    const holeMeta = holeById(phase === 'rift' ? riftView.kind : (pendingHole ?? 'backtrack'))
    const crossNote = loc.querySelector<HTMLElement>('.garden-crossroads-note')
    if (crossNote) {
      crossNote.hidden = phase !== 'crossroads'
      crossNote.textContent = phase === 'crossroads' ? '中间这一颗是回溯。走进去，从记下的事件重走另一条路。' : ''
    }
    const transit = find<HTMLElement>('.garden-transit')
    find<HTMLElement>('.garden-awakening-copy').hidden = phase !== 'awakening'
    const galaxy = find<HTMLElement>('.garden-galaxy')
    const warp = find<HTMLElement>('.garden-warp')
    const beat = launchBeat()
    const voyaging = phase === 'launch' && beat === 'voyage'
    const inSpace = phase === 'crossroads' || beat === 'board' || beat === 'voyage' || (phase === 'rift' && riftView.kind === 'backtrack')
    transit.hidden = !voyaging
    galaxy.hidden = !inSpace
    warp.hidden = !voyaging
    if (phase === 'launch') {
      loc.querySelector('span')!.textContent = '前往三岔口'
      loc.querySelector('small')!.textContent = '第三幕 · 启航'
    } else if (phase === 'crossroads') {
      loc.querySelector('span')!.textContent = '回溯入口'
      loc.querySelector('small')!.textContent = `第三幕 · 现年已抵达${state.currentAge === null ? '' : ` · ${state.currentAge} 岁`}`
    } else if (phase === 'rift') {
      if (riftView.kind === 'end') {
        loc.querySelector('span')!.textContent = '回测报告'
        loc.querySelector('small')!.textContent = '第五幕 · 报告与推荐'
      } else {
        loc.querySelector('span')!.textContent = holeMeta?.label ?? '裂隙'
        loc.querySelector('small')!.textContent = holeMeta?.kicker ?? '第四幕'
      }
    } else {
      loc.querySelector('span')!.textContent = state.line === 'parallel' ? '平行宇宙花园' : '月面人生花园'
      loc.querySelector('small')!.textContent = state.line === 'parallel' && state.forkAge !== null
        ? `第三幕 · 从 ${state.forkAge} 岁重选`
        : state.target.age !== null
          ? `第三幕 · 时间回声 · 回溯 ${state.target.age} 岁`
          : state.target.year
            ? `第三幕 · 时间回声 · 回溯 ${state.target.year} 年`
            : '第三幕 · 时间回声'
    }
    root.dataset.line = state.line
    root.dataset.gardenPhase = awayFromGarden() ? phase : (activatedAge === state.selectedAge ? phase : 'era')
    root.dataset.riftKind = phase === 'rift' ? riftView.kind : ''
    root.dataset.agentChapter = phase === 'rift' && riftView.kind === 'backtrack' ? riftView.agentChapter : ''
    root.dataset.riftPick = pickingBacktrackFlowers() ? 'flowers' : ''
    root.dataset.pendingHole = pendingHole ?? ''
    root.dataset.reachedPresent = state.reachedPresent ? 'true' : ''
    root.dataset.actorPhase = actor.phase
    const plantedThisYear = grown().filter(item => item.age === state.selectedAge)
    find<HTMLButtonElement>('[data-action="enter"]').hidden = awayFromGarden() || (activatedAge === state.selectedAge && phase !== 'era')
    find<HTMLButtonElement>('[data-action="enter"]').disabled = actor.busy || !assetsReady
    find<HTMLElement>('[data-action="enter"]').textContent = actor.busy ? '正在走近这段岁月…' : '查看这一年的选择 ↗'
    find<HTMLButtonElement>('[data-action="advance"]').hidden = phase !== 'npc'
    find<HTMLButtonElement>('[data-action="advance"]').disabled = actor.busy || !assetsReady || inFlight()
    find<HTMLElement>('[data-action="advance"]').textContent = shouldEnterCrossroads(state.selectedAge, state.currentAge)
      ? PRESENT_ADVANCE
      : '进入下一个时间点 →'
    const talkLaunch = eventTalkLaunch()
    const talkButton = find<HTMLButtonElement>('[data-action="event-talk"]')
    talkButton.hidden = !talkLaunch.visible
    talkButton.disabled = actor.busy
    talkButton.textContent = eventTalkActionLabel(Boolean(
      talkLaunch.target && (openedEventTalkAges.has(talkLaunch.target.age) || (readEventTalk(talkLaunch.target.age)?.lines.length ?? 0) > 0),
    ))
    find<HTMLElement>('.garden-signals').querySelectorAll<HTMLButtonElement>('button').forEach(button => { button.disabled = actor.busy })
    find<HTMLElement>('[data-action="reset-year"]').hidden = awayFromGarden() || plantedThisYear.length === 0
    find<HTMLButtonElement>('[data-action="memory"]').hidden = !eventYearMemoryVisible({
      eventYear: Boolean(eventAt()),
      away: awayFromGarden(),
      yearOpen: activatedAge === state.selectedAge && phase !== 'era',
    })
    find<HTMLButtonElement>('[data-action="leave-parallel"]').hidden = state.line !== 'parallel' || awayFromGarden()
    find<HTMLButtonElement>('[data-action="leave-parallel"]').disabled = actor.busy
    for (const action of ['target', 'origin', 'chapters', 'reset-year', 'memory', 'event-talk']) find<HTMLButtonElement>(`[data-action="${action}"]`).disabled = actor.busy
    const values = timelineNodes(band, state.target.age, state.selectedAge, state.currentAge, extras())
    const laterBand = band === 0 ? 1 : band === 1 ? 2 : 0
    const laterNodes = timelineNodes(laterBand, state.target.age, state.selectedAge, state.currentAge, extras())
    const laterBeyond = laterNodes.filter(age => age > (band === 0 ? 40 : 80))
    find<HTMLButtonElement>('[data-action="chapters"]').hidden = band === 0 && laterBeyond.length === 0
    find<HTMLElement>('[data-action="chapters"]').textContent = band === 0 ? '40岁以后的时光 →' : band === 1 && laterBeyond.length ? '80岁以后的时光 →' : '← 回看0—40岁'
    find<HTMLElement>('[data-action="target"]').hidden = awayFromGarden() || state.target.age !== null
    find<HTMLElement>('.garden-timeline-caption > span').textContent = chapterLabel(chapter)
    nodes.replaceChildren()
    for (const value of values) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'garden-node'
      button.dataset.age = String(value)
      button.dataset.planted = String(plantedHere(value))
      const event = readLifeEvents(state.profile, state.target.age).find(item => item.age === value)
      button.setAttribute('aria-label', event ? `${value}岁 · 重大事件` : `${value}岁`)
      button.setAttribute('aria-pressed', String(value === state.selectedAge && activatedAge === value))
      button.disabled = actor.busy
      if (event) {
        button.dataset.event = 'true'
        button.title = event.text
      } else if (value === state.target.age) button.title = '你的回溯起点'
      const canvas = document.createElement('canvas')
      canvas.width = 64; canvas.height = 64
      canvas.setAttribute('aria-hidden', 'true')
      const pose = timelineFlowerPose(value)
      if (flowers.naturalWidth) {
        const ctx = canvas.getContext('2d')!
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(flowers, pose * 128, 0, 128, 128, 0, 0, 64, 64)
      }
      const label = document.createElement('span')
      label.textContent = String(value)
      button.append(canvas, label)
      button.addEventListener('click', () => activateAge(value))
      nodes.append(button)
    }
    find<HTMLButtonElement>('[data-action="previous"]').disabled = actor.busy || state.selectedAge === (values[0] ?? 0)
    find<HTMLButtonElement>('[data-action="next"]').disabled = actor.busy || state.selectedAge === (values.at(-1) ?? 100)
    renderCopy()
    renderChoiceFlowers()
    renderGroundFlowers()
    renderHoles()
    renderRift()
    syncNextActions()
    if (pickingBacktrackFlowers()) echoTrail(riftView.backtrackAge)
    updateFlowerFrames()
    if (focusedBefore && !focusedBefore.isConnected) root.focus({ preventScroll: true })
  }
  function syncNextActions() {
    root.querySelectorAll<HTMLElement>('[data-next]').forEach(node => delete node.dataset.next)
    delete choiceNav.dataset.awaitingChoice
    const mark = (node: HTMLElement | null, kind: 'primary' | 'option' = 'primary') => {
      if (!node || node.hidden || (node instanceof HTMLButtonElement && node.disabled)) return
      node.dataset.next = kind
    }

    if (phase === 'era' || activatedAge !== state.selectedAge) {
      mark(find<HTMLButtonElement>('[data-action="enter"]'))
      mark(find<HTMLButtonElement>('[data-action="target"]'), 'option')
      return
    }
    if (phase === 'choices' || phase === 'inspect' || phase === 'ideal') {
      const options = [...choiceNav.querySelectorAll<HTMLButtonElement>('.garden-choice-flower:not(:disabled)')]
      options.forEach(button => mark(button, button.dataset.choice === inspected ? 'primary' : 'option'))
      if (!inspected && options.length > 0) choiceNav.dataset.awaitingChoice = 'true'
      return
    }
    if (phase === 'npc') {
      const launch = find<HTMLButtonElement>('[data-action="event-talk"]')
      if (!launch.hidden) {
        mark(launch)
        mark(find<HTMLButtonElement>('[data-action="advance"]'), 'option')
        return
      }
      mark(find<HTMLButtonElement>('[data-action="advance"]'))
      return
    }
    if (phase === 'crossroads') {
      const holes = [...holesNav.querySelectorAll<HTMLButtonElement>('.garden-hole:not(:disabled)')]
      holes.forEach((button, index) => mark(button, index === 0 ? 'primary' : 'option'))
      return
    }
    if (phase === 'rift') {
      const actions = [...riftBody.querySelectorAll<HTMLButtonElement>('.garden-rift-actions button:not(:disabled)')]
      actions.forEach((button, index) => mark(button, index === 0 ? 'primary' : 'option'))
    }
  }
  function lastChoiceId() {
    return grown().at(-1)?.choiceId ?? null
  }
  function renderHoles() {
    const sky = find<HTMLImageElement>('.garden-orbit-sky')
    const orbit = find<HTMLImageElement>('.garden-orbit-ship')
    const beat = launchBeat()
    const inSpace = phase === 'crossroads' || beat === 'board' || beat === 'voyage'
    sky.hidden = !inSpace
    orbit.hidden = !inSpace
    if (sky.getAttribute('src') !== '/assets/garden/orbit-ship-idle.png') sky.src = '/assets/garden/orbit-ship-idle.png'
    if (orbit.getAttribute('src') !== '/assets/garden/orbit-ship-thrust.png') orbit.src = '/assets/garden/orbit-ship-thrust.png'
    const showHoles = phase === 'crossroads' || beat === 'voyage'
    holesNav.hidden = !showHoles
    if (!showHoles) {
      holesNav.replaceChildren()
      return
    }
    const existing = [...holesNav.querySelectorAll<HTMLButtonElement>('.garden-hole')]
    if (existing.length === RIFT_HOLES.length && existing.every((button, index) => button.dataset.hole === RIFT_HOLES[index].id)) {
      for (const button of existing) {
        const holeHint = holeHintFor(button.dataset.hole as RiftKind, state.currentAge)
        button.setAttribute('aria-label', `${button.querySelector('strong')?.textContent ?? ''} · ${holeHint}`)
        button.setAttribute('aria-pressed', String(pendingHole === button.dataset.hole))
        button.disabled = actor.busy || !assetsReady || phase !== 'crossroads'
        const hint = button.querySelector('small')
        if (hint) hint.textContent = holeHint
      }
      return
    }
    holesNav.replaceChildren()
    for (const hole of RIFT_HOLES) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'garden-hole'
      button.dataset.hole = hole.id
      button.style.left = `${hole.x}%`
      button.style.top = `${hole.y}%`
      button.style.setProperty('--hole-x', String(hole.x))
      button.style.setProperty('--hole-y', String(hole.y))
      const holeHint = holeHintFor(hole.id, state.currentAge)
      button.setAttribute('aria-label', `${hole.label} · ${holeHint}`)
      button.setAttribute('aria-pressed', String(pendingHole === hole.id))
      button.disabled = actor.busy || !assetsReady || phase !== 'crossroads'
      const world = document.createElement('canvas')
      world.className = 'garden-hole-world'
      world.setAttribute('aria-hidden', 'true')
      paintRiftWorld(world, hole.id)
      const title = document.createElement('strong')
      title.textContent = hole.label
      const hint = document.createElement('small')
      hint.textContent = holeHint
      button.append(world, title, hint)
      button.addEventListener('click', () => enterHole(hole.id))
      holesNav.append(button)
    }
  }
  function riftContext() {
    return {
      planted: grown(),
      currentAge: state.currentAge,
      targetAge: state.target.age,
      profileAge: state.profile.age ?? '',
      profileGender: state.profile.gender ?? '',
      profileEducation: state.profile.education ?? '',
      profileHealth: state.profile.health ?? '',
      profileLifeEvent: state.profile.lifeEvent ?? '',
      lastChoiceId: lastChoiceId(),
      interview: readInterviewSave(),
      view: riftView,
    }
  }
  function renderRift() {
    rift.hidden = phase !== 'rift'
    if (phase !== 'rift') return
    renderRiftView(riftBody, riftContext(), {
      back: () => returnToCrossroads(),
      open: kind => openRift(kind),
      setBacktrack: age => { riftView = { ...riftView, backtrackAge: age, altChoiceId: null }; render() },
      setAlt: id => {
        riftView = { ...riftView, altChoiceId: id }
        render()
        if (id && riftView.backtrackAge !== null) {
          root.dispatchEvent(new CustomEvent('life-backtest:garden-rift-choice', {
            bubbles: true,
            detail: { kind: 'backtrack', age: riftView.backtrackAge, choiceId: id, source: liveEnabled() ? 'zhihu' : 'demo', ...getContext() },
          }))
        }
      },
      setFollow: slot => { riftView = { ...riftView, followSlot: slot, age28Id: slot ? riftView.age28Id : null }; render() },
      setAge28: id => { riftView = { ...riftView, age28Id: id }; render() },
      setForeOpen: key => { riftView = { ...riftView, foreOpen: key }; render() },
      setAgent: patch => {
        const walkPicks = { ...riftView.walkPicks }
        if (patch.walkPick) {
          if (patch.walkPick.choiceId) walkPicks[String(patch.walkPick.age)] = patch.walkPick.choiceId
          else delete walkPicks[String(patch.walkPick.age)]
        }
        riftView = {
          ...riftView,
          agentChapter: patch.chapter ?? riftView.agentChapter,
          agentReply: patch.reply !== undefined ? patch.reply : riftView.agentReply,
          evidenceOpen: patch.evidenceOpen ?? riftView.evidenceOpen,
          walkIndex: patch.walkIndex ?? riftView.walkIndex,
          walkPicks,
        }
        render()
      },
      startParallel: age => enterParallel(age),
      toShore: () => { window.location.href = '/' },
      refreshOutlook: slot => {
        riftView = {
          ...riftView,
          outlookFriend: slot === 'friend' ? (riftView.outlookFriend ?? 0) + 1 : riftView.outlookFriend ?? 0,
          outlookConsult: slot === 'consult' ? (riftView.outlookConsult ?? 0) + 1 : riftView.outlookConsult ?? 0,
        }
        render()
      },
    })
  }
  function resetRiftView(kind: RiftKind): RiftView {
    return { kind, backtrackAge: null, altChoiceId: null, followSlot: null, age28Id: null, foreOpen: null, agentChapter: 'appear', agentReply: null, evidenceOpen: false, walkIndex: 0, walkPicks: {}, outlookFriend: 0, outlookConsult: 0 }
  }
  function openOutlook() {
    openRift('end')
  }
  function beginVoyage() {
    eventTalkCue = null
    closePanel(false)
    closeEventTalk()
    cancelPlanting()
    clearFlight()
    rift.classList.remove('is-visible')
    inspected = null
    selectedSignal = null
    activatedAge = null
    pendingHole = null
    riftView = resetRiftView('backtrack')
    state.reachedPresent = true
    save()
    if (reduced()) {
      hideShip()
      beginCrossroads()
      return
    }
    startLaunch()
  }
  function startLaunch() {
    phase = 'launch'
    launching = true
    hatch.hidden = true
    root.classList.add('is-launching')
    setLaunchBeat('board')
    if (!actor.walkTo(BOARDING_DOOR)) {
      launching = false
      continueLaunchAfterBoard()
      return
    }
    render()
  }
  function continueLaunchAfterBoard() {
    launching = false
    setLaunchBeat('voyage')
    cue(118)
    render()
    afterBeat(4200, () => beginCrossroads())
  }
  function beginCrossroads() {
    hideShip()
    closePanel(false)
    cancelPlanting()
    clearFlight()
    rift.classList.remove('is-visible')
    inspected = null
    selectedSignal = null
    activatedAge = null
    pendingHole = null
    riftView = resetRiftView('backtrack')
    state.reachedPresent = true
    save()
    phase = 'crossroads'
    cue(132)
    render()
  }
  function enterParallel(age: number) {
    if (ageValue(age) === null) return
    closePanel(false)
    rift.classList.remove('is-visible')
    root.classList.remove('is-swallowing')
    pendingHole = null
    actor.cancel()
    actor.position = { ...GARDEN_HOME }
    actor.facing = -1
    state.line = 'parallel'
    state.forkAge = age
    state.parallelPlanted = []
    state.selectedAge = age
    state.reachedPresent = true
    inspected = null
    selectedSignal = null
    activatedAge = age
    phase = 'choices'
    save()
    requestLiveNode(age)
    launchShip()
    cue(198)
    render()
  }
  function leaveParallel() {
    if (actor.busy) return
    state.line = 'main'
    save()
    beginCrossroads()
  }
  function enterHole(kind: RiftKind) {
    if (phase !== 'crossroads' || actor.busy || !assetsReady) return
    if (kind === 'backtrack') {
      root.dispatchEvent(new CustomEvent('life-backtest:interview-open', {
        bubbles: true,
        detail: { ...getContext(), actualPlanted: grown(), planted: interviewTrail(state) },
      }))
      return
    }
    openRift(kind)
  }
  function openRift(kind: RiftKind) {
    const next = kind === 'forward' ? 'foresight' : kind
    pendingHole = next
    const planted = grown()
    const age = resolveForkAge(state.target.age, planted, state.currentAge)
    const yours = planted.find(item => item.age === age)?.choiceId ?? eraNodeForAge(age).choices[0].id
    const alt = eraNodeForAge(age).choices.find(item => item.id !== yours && item.id !== 'own')?.id ?? null
    riftView = {
      ...resetRiftView(next),
      backtrackAge: next === 'backtrack' ? age : null,
      altChoiceId: next === 'backtrack' ? alt : null,
      walkIndex: 0,
    }
    phase = 'rift'
    actor.cancel()
    actor.position = { ...GARDEN_HOME }
    actor.facing = -1
    render()
    requestAnimationFrame(() => rift.classList.add('is-visible'))
    root.dispatchEvent(new CustomEvent('life-backtest:garden-rift-open', {
      bubbles: true,
      detail: { kind, ...getContext() },
    }))
    find<HTMLButtonElement>('.garden-rift-back').focus({ preventScroll: true })
  }
  function returnToCrossroads() {
    pendingHole = null
    riftView = resetRiftView('backtrack')
    phase = 'crossroads'
    actor.cancel()
    actor.position = { ...GARDEN_HOME }
    actor.facing = -1
    root.classList.remove('is-swallowing')
    rift.classList.remove('is-visible')
    render()
    holesNav.querySelector<HTMLButtonElement>('.garden-hole')?.focus({ preventScroll: true })
  }
  function hideShip() {
    clearTimeout(shipTimer)
    clearTimeout(landTimer)
    root.classList.remove('is-ship-out', 'is-ship-open')
    hatch.hidden = true
    flowerSetKey = ''
    choiceNav.replaceChildren()
  }
  function launchShip() {
    clearTimeout(shipTimer)
    clearTimeout(landTimer)
    hatch.hidden = true
    root.classList.remove('is-ship-out', 'is-ship-open')
    flowerSetKey = ''
    choiceNav.replaceChildren()
    void root.offsetWidth
    root.classList.add('is-ship-out')
    cue(198)
    render()
    const land = () => choiceNav.querySelectorAll<HTMLButtonElement>('.garden-choice-flower').forEach(markFlowerLanded)
    const open = () => {
      root.classList.add('is-ship-open')
      if (reduced()) land()
      else landTimer = window.setTimeout(land, 1680)
    }
    if (reduced()) open()
    else shipTimer = window.setTimeout(open, 320)
  }
  function cancelPlanting() {
    actor.cancel(); planting = null
  }
  function forgetLiveFrom(age: number) {
    for (const key of [...liveNodes.keys()]) if (key >= age) liveNodes.delete(key)
    for (const key of [...eventYearLive.keys()]) if (key >= age) eventYearLive.delete(key)
    for (const key of [...livePortraits.keys()]) {
      const match = key.match(/(?:^|:)(\d+):/)
      if (match && Number(match[1]) >= age) livePortraits.delete(key)
    }
    for (const key of [...ownDrafts.keys()]) if (key >= age) ownDrafts.delete(key)
  }
  function resetThisYear() {
    if (!active || actor.busy || root.inert || awayFromGarden()) return
    if (!plantedHere(state.selectedAge)) return
    const age = state.selectedAge
    cancelPlanting()
    closePanel(false)
    state = resetYearChoice(state, age)
    forgetLiveFrom(age)
    inspected = null
    selectedSignal = null
    flowerSetKey = ''
    activatedAge = age
    phase = 'choices'
    save()
    requestLiveNode(age)
    launchShip()
    cue(174)
  }
  function selectAge(age: number, activate = false) {
    if (!active || actor.busy || ageValue(age) === null) return
    if (awayFromGarden()) return
    if (state.currentAge !== null && age > state.currentAge) return
    if (state.line === 'parallel' && state.forkAge !== null && age < state.forkAge) activate = false
    cancelPlanting(); closePanel(false)
    state.selectedAge = age; save()
    inspected = null
    selectedSignal = null
    if (activate) {
      activatedAge = age
      phase = 'choices'
      requestLiveNode(age)
      launchShip()
    } else {
      activatedAge = null
      phase = 'era'
      hideShip()
      if (eventAt(age)) requestEventYear(age)
      render()
    }
    cue(220 + chapterForAge(age) * 18)
    frame.classList.remove('is-time-moving'); void frame.offsetWidth; frame.classList.add('is-time-moving')
    clearTimeout(meteorTimer); meteorTimer = window.setTimeout(() => frame.classList.remove('is-time-moving'), 2000)
  }
  function closeEventTalk() {
    persistEventTalk()
    eventTalk.hidden = true
    eventTalk.dataset.age = ''
    eventTalkLog.replaceChildren()
    render()
  }
  function appendEventTalk(who: 'you' | 'other', text: string) {
    const line = document.createElement('p')
    line.className = `garden-event-talk-line is-${who}`
    const name = document.createElement('small')
    name.textContent = who === 'you' ? '你' : '记录员'
    const body = document.createElement('span')
    body.textContent = text
    line.append(name, body)
    eventTalkLog.append(line)
    eventTalkLog.scrollTop = eventTalkLog.scrollHeight
  }
  function persistEventTalk() {
    if (!eventTalk.dataset.age) return
    const age = Number(eventTalk.dataset.age)
    if (!Number.isFinite(age)) return
    const event = readLifeEvents(state.profile, state.target.age).find(item => item.age === age)
    if (!event) return
    const lines = [...eventTalkLog.querySelectorAll('.garden-event-talk-line')].map(node => ({
      who: node.classList.contains('is-you') ? 'you' as const : 'other' as const,
      text: node.querySelector('span')?.textContent?.trim() || '',
    })).filter(item => item.text)
    writeEventTalk({ age: event.age, text: event.text, lines })
  }
  async function askEventTalk(message: string, opening = false) {
    const age = Number(eventTalk.dataset.age)
    const event = readLifeEvents(state.profile, state.target.age).find(item => item.age === age)
    if (!event) return
    if (!opening) appendEventTalk('you', message)
    appendEventTalk('other', '正在对照你种下的路…')
    const waiting = eventTalkLog.lastElementChild
    const waitingBody = waiting?.querySelector('span')
    const planted = grown()
    const before = planted.filter(item => item.age < event.age)
    try {
      const response = await fetch('/api/life/dialogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'event',
          event,
          events: readLifeEvents(state.profile, state.target.age),
          planted,
          before,
          profile: state.profile,
          currentAge: state.currentAge,
          path: planted.map(item => `${item.age}岁 · ${item.label || item.choiceId}`).join(' → '),
          message,
          personalTag: personalTagPayload(),
        }),
      })
      const payload = await response.json() as { ok?: boolean, reply?: string }
      const reply = payload.ok && payload.reply?.trim()
        ? payload.reply.trim()
        : '模型暂时没接上。根据你记下的选择，这件事发生在那个年纪：当时考虑的是你走到这一年之前的那些选择，得到的是另一条路打开的可能，失去的是时间、关系和确定性。'
      if (waitingBody) waitingBody.textContent = reply
      else if (waiting) waiting.textContent = reply
      else appendEventTalk('other', reply)
    } catch {
      const fallback = '模型暂时没接上。先把这件事记在这里：背景是你走到这一年之前的那些选择；当时考虑过安定和想要的路，得到的是开口，失去的是确定性。'
      if (waitingBody) waitingBody.textContent = fallback
      else if (waiting) waiting.textContent = fallback
    }
    persistEventTalk()
  }
  function openEventTalk(event: { age: number, text: string }) {
    persistEventTalk()
    eventTalkCue = event
    openedEventTalkAges.add(event.age)
    eventTalk.hidden = false
    eventTalk.dataset.age = String(event.age)
    eventTalkTitle.textContent = `${event.age}岁 · ${event.text}`
    const before = grown().filter(item => item.age < event.age)
    eventTalkLead.textContent = before.length
      ? `背景是这件事之前的选择：${before.map(item => `${item.age}岁 · ${item.label || item.choiceId}`).join(' → ')}。对照整条时间线，我会披露同一节点当时考虑什么、得到什么、失去什么。`
      : '以这件事之前的选择为背景，对照整条时间线。我会披露同一节点当时考虑什么、得到什么、失去什么。'
    eventTalkReady.textContent = EVENT_TALK_READY
    const saved = readEventTalk(event.age)
    eventTalkLog.replaceChildren()
    eventTalkStart.hidden = Boolean(saved?.lines.length)
    eventTalkStart.textContent = EVENT_TALK_START
    if (saved?.lines.length) {
      for (const line of saved.lines) appendEventTalk(line.who, line.text)
    }
    render()
    if (eventTalkStart.hidden) eventTalkInput.focus({ preventScroll: true })
    else eventTalkStart.focus({ preventScroll: true })
  }
  function activateAge(age: number) {
    const talk = eventTalkAt(state, age)
    if (talk) {
      selectAge(age, false)
      openEventTalk(talk)
      return
    }
    closeEventTalk()
    selectAge(age, true)
  }
  function enterNextEra() {
    const next = nextTimelineAge(state.selectedAge, state.target.age, state.currentAge, extras())
    if (shouldEnterCrossroads(state.selectedAge, state.currentAge, next)) {
      if (openPendingEventTalk(true)) return
      beginVoyage()
      return
    }
    if (next === null) {
      activatedAge = null
      phase = 'era'
      hideShip()
      render()
      return
    }
    selectAge(next, false)
  }
  function inspectOrPlant(choice: EraChoice, planted: boolean, replay = false) {
    if (!active || actor.busy || root.inert || !assetsReady) return
    if (awayFromGarden()) return
    if (activatedAge !== state.selectedAge) activateAge(state.selectedAge)
    if (phase === 'ideal') {
      if (isOwnChoice(choice) && !ownLabel()) {
        inspected = choice.id
        selectedSignal = null
        render()
        find<HTMLInputElement>('.garden-own-path input')?.focus()
        return
      }
      commitIdeal(state.selectedAge, choice.id, choiceLabelFor(choice))
      enterNpcAfterIdeal()
      return
    }
    if (!replay && inspected !== choice.id) {
      inspected = choice.id
      selectedSignal = null
      phase = 'inspect'
      cue(240)
      render()
      return
    }
    if (!replay && isOwnChoice(choice) && !ownLabel() && !planted) {
      inspected = choice.id
      phase = 'inspect'
      render()
      find<HTMLInputElement>('.garden-own-path input')?.focus()
      return
    }
    const yearTaken = plantedHere(state.selectedAge)
    phase = yearTaken && !replay ? 'npc' : 'choices'
    if (choice.id !== EVENT_MARK_ID) requestLivePortraits(state.selectedAge, choice.id)
    planting = { age: state.selectedAge, choiceId: choice.id }
    const nextPlant = planting
    const items = visibleGround()
    const soils = spreadGroundPoints(items.map(item => soilForAge(item.age, state.currentAge)))
    const index = items.findIndex(item => item.age === nextPlant.age && item.choiceId === nextPlant.choiceId)
    const soil = soils[index] ?? soilForAge(state.selectedAge, state.currentAge)
    actor.start(chapterForAge(state.selectedAge), soil, yearTaken && !replay)
    lastStep = 0
    cue(150)
    save()
    render()
  }
  function moveTime(direction: number) {
    const band = timelineBand(state.selectedAge)
    const values = timelineNodes(band, state.target.age, state.selectedAge, state.currentAge, extras())
    const next = direction > 0 ? values.find(v => v > state.selectedAge) : values.toReversed().find(v => v < state.selectedAge)
    selectAge(next ?? Math.max(0, Math.min(100, state.selectedAge + direction * 5)))
  }
  function closePanel(restoreFocus = true) {
    panel.hidden = true; root.classList.remove('has-panel')
    if (restoreFocus) {
      const destination = returnFocus?.isConnected && root.contains(returnFocus) && !panel.contains(returnFocus) ? returnFocus : root
      destination.focus({ preventScroll: true })
    }
  }
  function openPanel(mode: typeof panelMode, signal = '') {
    if (actor.busy) return
    panelMode = mode
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    panel.hidden = false; root.classList.add('has-panel'); output.textContent = ''
    find<HTMLElement>('.garden-profile').replaceChildren(); find<HTMLElement>('.garden-records').replaceChildren()
    form.hidden = mode === 'profile' || mode === 'signal' || mode === 'fork'
    const forks = find<HTMLElement>('.garden-fork-ages')
    forks.hidden = mode !== 'fork'
    forks.replaceChildren()
    const heading = find<HTMLElement>('.garden-panel-title'), copy = find<HTMLElement>('.garden-panel-copy')
    find<HTMLElement>('.garden-panel-kicker').textContent = mode === 'fork' ? '回溯 · 平行宇宙' : mode === 'profile' ? '从第二幕带来的登记' : '零点小姐 · 时间档案'
    if (mode === 'profile') {
      heading.textContent = '你留下的起点'
      copy.textContent = '现实资料与回看年龄分别记录，不会互相覆盖。'
      const labels = { age: '现在的年龄', gender: '性别', education: '学历', health: '生活状况', lifeEvent: '重大人生事件' }
      for (const key of Object.keys(labels) as (keyof typeof labels)[]) {
        const term = document.createElement('dt'), value = document.createElement('dd')
        term.textContent = labels[key]; value.textContent = state.profile[key] || '尚未登记'
        find<HTMLElement>('.garden-profile').append(term, value)
      }
    } else if (mode === 'signal') {
      heading.textContent = signal
      copy.textContent = '相近经历会对照公开讨论。没有结果时保持空白。'
    } else if (mode === 'fork') {
      heading.textContent = '回到哪个年龄，开始另一条时间线？'
      copy.textContent = '种花时只遇见和你同一选择的人。回溯才看另一条路上的答主。从那一年起可以重新选择，主宇宙的花还在。'
      const years = forkAges(state)
      for (const age of years) {
        const grownAt = state.planted.find(item => item.age === age)
        const choice = grownAt ? choiceAt(age, grownAt.choiceId) : undefined
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'garden-fork-age'
        button.textContent = choice ? `${age}岁 · ${choice.label}` : `${age}岁`
        button.addEventListener('click', () => enterParallel(age))
        forks.append(button)
        if (!grownAt) continue
        const alts = livePortraits.get(`alt:${age}:${grownAt.choiceId}`) ?? signalPortraits(age, grownAt.choiceId, 'backtrack')
        requestLivePortraits(age, grownAt.choiceId, 'backtrack')
        if (!alts.length) continue
        const row = document.createElement('div')
        row.className = 'garden-fork-alts'
        const kicker = document.createElement('p')
        kicker.textContent = `${age}岁 · 另一条路上的人`
        row.append(kicker)
        for (const item of alts) {
          const card = document.createElement('div')
          card.className = 'garden-fork-alt'
          card.append(npcFace(`${item.slot}:${item.npc.name}`, item.npc.avatar))
          const who = document.createElement('div')
          const name = document.createElement('strong')
          name.textContent = item.npc.name
          const note = document.createElement('span')
          note.textContent = item.note
          who.append(name, note)
          card.append(who)
          row.append(card)
        }
        forks.append(row)
      }
    } else if (mode === 'target') {
      heading.textContent = state.target.raw ? `“${state.target.raw}”，那时几岁？` : '你想回到几岁？'
      copy.textContent = state.target.kind === 'year' ? '只有当前年龄，还不能准确换算年份。请确认那一年你的年龄。' : '只补充这一个时间点，不需要重新填写登记。'
      form.querySelector('label')!.textContent = '确认回溯年龄（0—100）'
      input.setAttribute('aria-label', '确认回溯年龄'); input.inputMode = 'numeric'; input.value = ''
      input.placeholder = '例如：18'
      form.querySelector('button[type="submit"]')!.textContent = '记录'
    } else if (eventAt()) {
      const event = eventAt()!
      const saved = readPersonalTag().eventNotes.find(item => item.age === event.age)
      heading.textContent = `${event.age}岁 · 记下这一岁`
      copy.textContent = EVENT_NOTE_COPY
      form.querySelector('label')!.textContent = `对「${event.text}」的描述`
      input.setAttribute('aria-label', '对这件事的描述')
      input.inputMode = 'text'
      input.maxLength = 800
      input.placeholder = '例如：那天走廊很静，我还没想清楚要不要走'
      input.value = saved?.note ?? ''
      form.querySelector('button[type="submit"]')!.textContent = '写入个人标签'
      renderEventNote(event, saved?.note ?? '')
    } else {
      heading.textContent = `${state.selectedAge}岁 · 时间档案`
      copy.textContent = NOTE_IS_NOT_CHOICE
      form.querySelector('label')!.textContent = '留给这一岁的记录'
      input.setAttribute('aria-label', '留给这一岁的记录'); input.inputMode = 'text'; input.maxLength = 500
      input.placeholder = '例如：那时有一个一直没有做的选择'
      input.value = state.records.findLast(r => r.age === state.selectedAge)?.text ?? ''
      form.querySelector('button[type="submit"]')!.textContent = '记录'
      renderRecords()
      root.dispatchEvent(new CustomEvent('life-backtest:garden-node-request', { bubbles: true, detail: getContext() }))
    }
    find<HTMLButtonElement>('.garden-panel-close').focus({ preventScroll: true })
  }
  function renderEventNote(event: { age: number, text: string }, note: string) {
    const records = find<HTMLElement>('.garden-records')
    records.replaceChildren()
    const line = document.createElement('p')
    line.textContent = note ? `${event.age}岁 · ${note}` : `${event.age}岁 · 还没有写下这件事当时怎样`
    records.append(line)
  }
  function renderRecords() {
    const records = find<HTMLElement>('.garden-records'); records.replaceChildren()
    for (const record of state.records.filter(r => r.age === state.selectedAge).slice(-3)) {
      const line = document.createElement('p'); line.textContent = `${record.age}岁 · ${record.text}`; records.append(line)
    }
  }
  function getContext() {
    return structuredClone({
      profile: state.profile, currentAge: state.currentAge, target: state.target,
      selectedAge: state.selectedAge, chapter: chapterForAge(state.selectedAge),
      mode: state.currentAge !== null && state.selectedAge > state.currentAge ? 'future-exploration' : 'rewind',
      records: state.records.filter(r => r.age <= state.selectedAge),
      planted: grown(),
      ideal: lineIdeal(state),
      reachedPresent: state.reachedPresent,
    })
  }
  form.addEventListener('submit', event => {
    event.preventDefault()
    if (panelMode === 'target') {
      const age = ageValue(input.value.trim())
      if (age === null) { output.textContent = '请输入0到100之间的完整年龄。'; return }
      state.target.age = age; state.selectedAge = age; save(); closePanel(); render(); cue()
    } else if (eventAt()) {
      const event = eventAt()!
      const text = input.value.trim()
      if (!text) { output.textContent = '先写下一句话，再记录。'; return }
      upsertPersonalEventNote({ age: event.age, event: event.text, note: text })
      renderEventNote(event, text)
      output.textContent = '已写入个人标签。之后的对话会读到这段原话。'
      cue()
    } else {
      const text = input.value.trim()
      if (!text) { output.textContent = '先写下一句话，再记录。'; return }
      state.records.push({ age: state.selectedAge, text, recordedAt: new Date().toISOString() })
      state.records = state.records.slice(-100); save(); renderRecords(); output.textContent = `已记下本机笔记，${NOTE_IS_NOT_CHOICE}`; cue()
    }
  })
  window.addEventListener('keydown', event => {
    if (!active || root.inert) return
    if (event.target instanceof HTMLInputElement && event.repeat && ['KeyW', 'ArrowUp'].includes(event.code)) event.preventDefault()
    if (event.isComposing || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
    if (event.code === 'KeyR' && !event.repeat) {
      event.preventDefault()
      if (phase === 'rift') returnToCrossroads()
      else restart()
      return
    }
    if (event.key === 'Escape') {
      if (phase === 'rift') {
        if (riftView.kind === 'backtrack') {
          if (riftView.evidenceOpen) { riftView = { ...riftView, evidenceOpen: false }; render(); return }
          const previous = prevAgentState(riftView.agentChapter, riftView.walkIndex)
          if (previous) {
            riftView = { ...riftView, agentChapter: previous.chapter, walkIndex: previous.walkIndex, agentReply: previous.chapter === 'appear' ? null : riftView.agentReply }
            render()
            return
          }
          returnToCrossroads()
          return
        }
        if (riftView.followSlot) { riftView = { ...riftView, followSlot: null, age28Id: null }; render(); return }
        if (riftView.foreOpen) { riftView = { ...riftView, foreOpen: null }; render(); return }
        returnToCrossroads(); return
      }
      closePanel(); return
    }
    if (!panel.hidden) return
    if (awayFromGarden()) return
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); moveTime(event.key === 'ArrowLeft' ? -1 : 1) }
  })
  root.tabIndex = -1
  root.addEventListener('wheel', event => {
    const target = event.target instanceof Element ? event.target : null
    const scroller = target?.closest('.garden-panel, .garden-signals.is-sky .garden-signal-card, .garden-event-talk-log, .garden-event-talk, .garden-scene')
    if (!(scroller instanceof HTMLElement) || scroller.hidden) return
    const max = scroller.scrollHeight - scroller.clientHeight
    if (max <= 0) return
    event.stopPropagation()
    const next = Math.min(max, Math.max(0, scroller.scrollTop + event.deltaY))
    if (next !== scroller.scrollTop) event.preventDefault()
    scroller.scrollTop = next
  }, { passive: false })
  root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(b => b.addEventListener('click', () => {
    switch (b.dataset.action) {
      case 'enter': activateAge(state.selectedAge); break
      case 'advance': enterNextEra(); break
      case 'event-talk': openCuedEventTalk(); break
      case 'reset-year':
        resetThisYear()
        break
      case 'target': openPanel('target'); break
      case 'memory': openPanel('memory'); break
      case 'previous': moveTime(-1); break
      case 'next': moveTime(1); break
      case 'leave-parallel': leaveParallel(); break
      case 'chapters': {
        const later = timelineNodes(state.selectedAge < 40 ? 1 : 2, state.target.age, state.selectedAge, state.currentAge, extras())
        if (state.selectedAge < 40 && later.length) selectAge(40)
        else if (state.selectedAge < 80 && later.length) selectAge(80)
        else selectAge(0)
        break
      }
      case 'origin': if (state.target.age === null) openPanel('target'); else selectAge(state.target.age); break
      case 'restart': restart(); break
    }
  }))
  find<HTMLButtonElement>('.garden-rift-back').addEventListener('click', () => returnToCrossroads())
  find<HTMLButtonElement>('.garden-panel-close').addEventListener('click', () => closePanel())
  find<HTMLButtonElement>('.garden-event-talk-close').addEventListener('click', () => closeEventTalk())
  eventTalkStart.addEventListener('click', () => {
    if (eventTalk.hidden || eventTalkStart.hidden) return
    eventTalkStart.hidden = true
    void askEventTalk('请从这件事之前的那些选择讲起。当时你最看重什么？得到了什么，又失去了什么？', true)
  })
  eventTalkForm.addEventListener('submit', event => {
    event.preventDefault()
    const text = eventTalkInput.value.trim()
    if (!text || eventTalk.hidden) return
    eventTalkInput.value = ''
    eventTalkStart.hidden = true
    void askEventTalk(text)
  })
  find<HTMLButtonElement>('.garden-player-hit').addEventListener('click', () => {
    if (actor.busy) return
    actor.greet(); cue(220)
    find<HTMLElement>('.garden-note').textContent = '不着急。先点时间线上的一年，再看看从舱门飞出来的选择。'
  })
  document.addEventListener('visibilitychange', () => { previousActorTime = 0 })
  function restart() {
    const busy = actor.busy
    clearTimeout(awakeningTimer)
    root.inert = false
    cancelPlanting()
    closePanel(false)
    eventTalkCue = null
    closeEventTalk()
    pendingHole = null
    clearFlight()
    if (phase === 'rift') {
      rift.classList.remove('is-visible')
      returnToCrossroads()
      return
    }
    if (phase === 'launch' || phase === 'crossroads') {
      beginCrossroads()
      return
    }
    if (busy && activatedAge === state.selectedAge) {
      inspected = inspected && plantedHere(state.selectedAge, inspected) ? inspected : null
      selectedSignal = null
      phase = 'choices'
      render()
      drawPlayer()
      root.focus({ preventScroll: true })
      cue(174)
      return
    }
    inspected = null
    selectedSignal = null
    activatedAge = null
    phase = 'era'
    hideShip()
    render()
    drawPlayer()
    root.focus({ preventScroll: true })
    cue(174)
  }
  return {
    element: root, ready,
    show(profile?: ArchiveProfile, arrival: 'resume' | 'begin' = 'resume') {
      const incoming = profile ?? readArchiveProfile()
      state = arrival === 'begin' ? newGardenState(incoming) : restoreGardenState(read(GARDEN_SAVE_KEY), incoming)
      if (state.profile.age) writeArchiveProfile(state.profile)
      cancelAnimationFrame(actorFrame); actor = new GardenActor(); previousActorTime = 0; lastDraw = 0
      clearTimeout(awakeningTimer)
      planting = null; inspected = null; selectedSignal = null; activatedAge = null; pendingHole = null
      riftView = resetRiftView('backtrack')
      phase = 'era'
      active = true; root.hidden = false; root.inert = false; closePanel(false); hideShip(); save()
      if (arrival === 'resume' && state.reachedPresent && state.currentAge !== null) beginCrossroads()
      else render()
      drawPlayer()
      actorFrame = requestAnimationFrame(animateActor)
      root.focus({ preventScroll: true })
    },
    hide() { active = false; clearFlight(); cancelAnimationFrame(actorFrame); cancelPlanting(); closeEventTalk(); clearTimeout(meteorTimer); clearTimeout(shipTimer); clearTimeout(landTimer); clearTimeout(awakeningTimer); root.inert = false; rift.classList.remove('is-visible'); root.hidden = true; void sound?.suspend() },
    openOutlook,
    getContext,
  }
}
