import { readLifeEvents } from '../archive/archiveInterview'
import { hasPersonalTag, PROFILE_LABELS, readTagSnapshot, writePersonalTag } from './personalTag'

export const PERSONAL_TAG_OPEN = 'life-backtest:personal-tag-open'
export const OUTLOOK_REOPEN_GUARD_MS = 400

export type PersonalTagMode = 'default' | 'outlook'
type PersonalTagOpenDetail = { mode?: PersonalTagMode, trigger?: HTMLElement | null }

export function shouldBlockOutlookReopen(closedAt: number | null, now: number): boolean {
  return closedAt != null && now - closedAt < OUTLOOK_REOPEN_GUARD_MS
}

export function openPersonalTag(mode: PersonalTagMode = 'default') {
  const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
  document.dispatchEvent(new CustomEvent<PersonalTagOpenDetail>(PERSONAL_TAG_OPEN, {
    detail: { mode, trigger },
  }))
}

export function createPersonalTag(host: HTMLElement) {
  const root = document.createElement('div')
  root.className = 'personal-tag'
  root.innerHTML = `
    <div class="personal-tag-scrim" aria-hidden="true"></div>
    <button type="button" class="personal-tag-toggle">个人标签</button>
    <aside class="personal-tag-panel" hidden aria-label="个人标签">
      <button type="button" class="personal-tag-close" aria-label="关闭个人标签">×</button>
      <p class="personal-tag-kicker">个人标签</p>
      <h2 id="personal-tag-title">你的标签</h2>
      <p class="personal-tag-copy">登记资料、这一路的选择、记下的事件，以及你写下的未来打算。保存在这台设备上，游戏全程都能打开。</p>
      <button type="button" class="personal-tag-context-toggle" aria-expanded="false"></button>
      <div class="personal-tag-context">
        <section class="personal-tag-block">
          <p class="personal-tag-block-kicker">个人信息</p>
          <dl class="personal-tag-profile"></dl>
        </section>
        <section class="personal-tag-block">
          <p class="personal-tag-block-kicker">这一路的选择</p>
          <ol class="personal-tag-choices"></ol>
        </section>
        <section class="personal-tag-block">
          <p class="personal-tag-block-kicker">记下的事件</p>
          <ol class="personal-tag-events"></ol>
        </section>
      </div>
      <form class="personal-tag-form">
        <label>未来打算<textarea name="plans" maxlength="800" rows="4" placeholder="接下来想试的路、想守住的东西、想留给以后的自己。"></textarea></label>
        <div class="personal-tag-actions">
          <button type="submit">保存</button>
          <button type="button" class="personal-tag-cancel">取消</button>
          <output aria-live="polite"></output>
        </div>
      </form>
    </aside>
  `
  host.append(root)

  const toggle = root.querySelector<HTMLButtonElement>('.personal-tag-toggle')!
  const panel = root.querySelector<HTMLElement>('.personal-tag-panel')!
  const scrim = root.querySelector<HTMLElement>('.personal-tag-scrim')!
  const kicker = root.querySelector<HTMLElement>('.personal-tag-kicker')!
  const title = root.querySelector<HTMLElement>('#personal-tag-title')!
  const copy = root.querySelector<HTMLElement>('.personal-tag-copy')!
  const contextToggle = root.querySelector<HTMLButtonElement>('.personal-tag-context-toggle')!
  const profileList = root.querySelector<HTMLElement>('.personal-tag-profile')!
  const choiceList = root.querySelector<HTMLElement>('.personal-tag-choices')!
  const eventList = root.querySelector<HTMLElement>('.personal-tag-events')!
  const form = root.querySelector<HTMLFormElement>('.personal-tag-form')!
  const plans = form.querySelector<HTMLTextAreaElement>('[name="plans"]')!
  const submit = form.querySelector<HTMLButtonElement>('[type="submit"]')!
  const cancel = form.querySelector<HTMLButtonElement>('.personal-tag-cancel')!
  const output = form.querySelector<HTMLOutputElement>('output')!
  let closedAt: number | null = null
  let mode: PersonalTagMode = 'default'
  let returnParent: Node | null = null
  let returnBefore: ChildNode | null = null
  let returnFocus: HTMLElement | null = null
  let modalBackground: HTMLElement | null = null
  let modalBackgroundAriaHidden: string | null = null
  let modalBackgroundWasInert = false
  let contextItemCount = 0
  let closeTimer: number | null = null

  function syncContextToggle() {
    const expanded = root.classList.contains('is-context-open')
    contextToggle.setAttribute('aria-expanded', String(expanded))
    contextToggle.textContent = `${expanded ? '收起' : '查看'}个人信息、选择与记下的事件（${contextItemCount} 项）`
  }

  function fill() {
    const snap = readTagSnapshot()
    profileList.replaceChildren()
    for (const key of Object.keys(PROFILE_LABELS) as (keyof typeof PROFILE_LABELS)[]) {
      const term = document.createElement('dt')
      const value = document.createElement('dd')
      term.textContent = PROFILE_LABELS[key]
      value.textContent = snap.profile[key] || '尚未登记'
      profileList.append(term, value)
      if (key === 'lifeEvent') {
        for (const extra of readLifeEvents(snap.profile)) {
          if (extra.text === snap.profile.lifeEvent) continue
          const extraTerm = document.createElement('dt')
          const extraValue = document.createElement('dd')
          extraTerm.textContent = `${extra.age}岁的事件`
          extraValue.textContent = extra.text
          profileList.append(extraTerm, extraValue)
        }
      }
    }
    choiceList.replaceChildren()
    if (!snap.choices.length) {
      const empty = document.createElement('li')
      empty.className = 'is-empty'
      empty.textContent = '这一路还没有种下选择。'
      choiceList.append(empty)
    } else {
      for (const item of snap.choices) {
        const row = document.createElement('li')
        row.textContent = `${item.age} 岁 · ${item.label}`
        choiceList.append(row)
      }
    }
    eventList.replaceChildren()
    if (!snap.outlook.eventNotes.length) {
      const empty = document.createElement('li')
      empty.className = 'is-empty'
      empty.textContent = '还没有记下事件的描述。'
      eventList.append(empty)
    } else {
      for (const item of snap.outlook.eventNotes) {
        const row = document.createElement('li')
        row.textContent = `${item.age}岁 · ${item.event}：${item.note}`
        eventList.append(row)
      }
    }
    contextItemCount = snap.choices.length + snap.outlook.eventNotes.length
    syncContextToggle()
    plans.value = snap.outlook.plans
    output.textContent = snap.outlook.updatedAt ? '已保存在本机。' : ''
    root.classList.toggle('is-written', hasPersonalTag(snap.outlook))
  }

  function enterOutlookMode(trigger: HTMLElement | null) {
    mode = 'outlook'
    returnParent = root.parentNode
    returnBefore = root.nextSibling
    returnFocus = trigger
    host.append(root)
    root.classList.add('is-outlook-mode')
    root.classList.remove('is-context-open')
    syncContextToggle()
    kicker.textContent = '第五幕 · 个人展望'
    title.textContent = '写下个人展望'
    copy.textContent = '先写下接下来想验证的一步。个人资料与这一路的选择可按需展开查看。'
    submit.textContent = '保存展望'
    panel.setAttribute('role', 'dialog')
    panel.setAttribute('aria-modal', 'true')
    panel.setAttribute('aria-labelledby', 'personal-tag-title')
    modalBackground = document.querySelector<HTMLElement>('.garden-scene[data-rift-kind="end"]:not([hidden])')
    if (modalBackground) {
      modalBackgroundAriaHidden = modalBackground.getAttribute('aria-hidden')
      modalBackgroundWasInert = modalBackground.inert
      modalBackground.inert = true
      modalBackground.setAttribute('aria-hidden', 'true')
      modalBackground.setAttribute('data-personal-tag-obscured', 'true')
    }
  }

  function leaveOutlookMode() {
    if (modalBackground) {
      modalBackground.inert = modalBackgroundWasInert
      if (modalBackgroundAriaHidden === null) modalBackground.removeAttribute('aria-hidden')
      else modalBackground.setAttribute('aria-hidden', modalBackgroundAriaHidden)
      modalBackground.removeAttribute('data-personal-tag-obscured')
    }
    modalBackground = null
    modalBackgroundAriaHidden = null
    modalBackgroundWasInert = false
    panel.removeAttribute('role')
    panel.removeAttribute('aria-modal')
    panel.removeAttribute('aria-labelledby')
    kicker.textContent = '个人标签'
    title.textContent = '你的标签'
    copy.textContent = '登记资料、这一路的选择、记下的事件，以及你写下的未来打算。保存在这台设备上，游戏全程都能打开。'
    submit.textContent = '保存'
    root.classList.remove('is-outlook-mode', 'is-context-open')
    if (returnParent) {
      if (returnBefore && returnBefore.parentNode === returnParent) returnParent.insertBefore(root, returnBefore)
      else returnParent.appendChild(root)
    }
    returnParent = null
    returnBefore = null
    mode = 'default'
  }

  function open(nextMode: PersonalTagMode = 'default', trigger: HTMLElement | null = null) {
    if (shouldBlockOutlookReopen(closedAt, Date.now())) return
    fill()
    returnFocus = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : toggle)
    if (nextMode === 'outlook') enterOutlookMode(returnFocus)
    panel.hidden = false
    root.classList.add('is-open')
    toggle.setAttribute('aria-expanded', 'true')
    panel.scrollTop = 0
    plans.focus({ preventScroll: true })
  }

  function close() {
    if (panel.hidden) return
    if (closeTimer !== null) {
      window.clearTimeout(closeTimer)
      closeTimer = null
    }
    const focusTarget = returnFocus
    panel.hidden = true
    root.classList.remove('is-open')
    toggle.setAttribute('aria-expanded', 'false')
    if (mode === 'outlook') leaveOutlookMode()
    returnFocus = null
    if (focusTarget?.isConnected) focusTarget.focus()
    else if (toggle.isConnected) toggle.focus()
  }

  toggle.addEventListener('click', () => {
    if (panel.hidden) open('default', toggle)
    else close()
  })
  root.querySelector<HTMLButtonElement>('.personal-tag-close')!.addEventListener('click', close)
  cancel.addEventListener('click', close)
  scrim.addEventListener('click', close)
  contextToggle.addEventListener('click', () => {
    root.classList.toggle('is-context-open')
    syncContextToggle()
  })
  document.addEventListener(PERSONAL_TAG_OPEN, event => {
    const detail = (event as CustomEvent<PersonalTagOpenDetail>).detail
    open(detail?.mode === 'outlook' ? 'outlook' : 'default', detail?.trigger ?? null)
  })
  document.addEventListener('keydown', event => {
    if (panel.hidden) return
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopImmediatePropagation()
      close()
      return
    }
    if (mode !== 'outlook' || event.key !== 'Tab') return
    const focusable = [...panel.querySelectorAll<HTMLElement>('button:not([disabled]), textarea:not([disabled]), input:not([disabled]), a[href]')]
      .filter(node => node.offsetParent !== null)
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable.at(-1)!
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }, true)
  panel.addEventListener('wheel', event => {
    if (panel.hidden) return
    event.stopPropagation()
    const top = panel.scrollTop
    const max = panel.scrollHeight - panel.clientHeight
    if (max <= 0) return
    const next = Math.min(max, Math.max(0, top + event.deltaY))
    if (next !== top) event.preventDefault()
    panel.scrollTop = next
  }, { passive: false })
  form.addEventListener('submit', event => {
    event.preventDefault()
    event.stopPropagation()
    if (!plans.value.trim()) {
      output.textContent = '先写下一句未来打算，再保存。'
      return
    }
    writePersonalTag({ plans: plans.value })
    fill()
    if (mode === 'outlook') {
      output.textContent = '已保存，正在回到报告。'
      closeTimer = window.setTimeout(() => {
        closeTimer = null
        closedAt = Date.now()
        close()
      }, 700)
      return
    }
    closedAt = Date.now()
    close()
  })
  panel.addEventListener('click', event => event.stopPropagation())
  fill()
  return { element: root, open, close }
}
