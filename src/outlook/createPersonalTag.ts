import { hasPersonalTag, PROFILE_LABELS, readTagSnapshot, writePersonalTag } from './personalTag'

export const PERSONAL_TAG_OPEN = 'life-backtest:personal-tag-open'

export function openPersonalTag() {
  document.dispatchEvent(new CustomEvent(PERSONAL_TAG_OPEN))
}

export function createPersonalTag(host: HTMLElement) {
  const root = document.createElement('div')
  root.className = 'personal-tag'
  root.innerHTML = `
    <button type="button" class="personal-tag-toggle">个人标签</button>
    <aside class="personal-tag-panel" hidden aria-label="个人标签">
      <button type="button" class="personal-tag-close" aria-label="关闭个人标签">×</button>
      <p class="personal-tag-kicker">个人标签</p>
      <h2>你的标签</h2>
      <p class="personal-tag-copy">登记资料、这一路的选择，以及你写下的未来打算。保存在这台设备上，游戏全程都能打开。</p>
      <section class="personal-tag-block">
        <p class="personal-tag-block-kicker">个人信息</p>
        <dl class="personal-tag-profile"></dl>
      </section>
      <section class="personal-tag-block">
        <p class="personal-tag-block-kicker">这一路的选择</p>
        <ol class="personal-tag-choices"></ol>
      </section>
      <form class="personal-tag-form">
        <label>未来打算<textarea name="plans" maxlength="800" rows="4" placeholder="接下来想试的路、想守住的东西、想留给以后的自己。"></textarea></label>
        <div class="personal-tag-actions">
          <button type="submit">保存</button>
          <output aria-live="polite"></output>
        </div>
      </form>
    </aside>
  `
  host.append(root)

  const toggle = root.querySelector<HTMLButtonElement>('.personal-tag-toggle')!
  const panel = root.querySelector<HTMLElement>('.personal-tag-panel')!
  const profileList = root.querySelector<HTMLElement>('.personal-tag-profile')!
  const choiceList = root.querySelector<HTMLElement>('.personal-tag-choices')!
  const form = root.querySelector<HTMLFormElement>('.personal-tag-form')!
  const plans = form.querySelector<HTMLTextAreaElement>('[name="plans"]')!
  const output = form.querySelector<HTMLOutputElement>('output')!

  function fill() {
    const snap = readTagSnapshot()
    profileList.replaceChildren()
    for (const key of Object.keys(PROFILE_LABELS) as (keyof typeof PROFILE_LABELS)[]) {
      const term = document.createElement('dt')
      const value = document.createElement('dd')
      term.textContent = PROFILE_LABELS[key]
      value.textContent = snap.profile[key] || '尚未登记'
      profileList.append(term, value)
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
    plans.value = snap.outlook.plans
    output.textContent = snap.outlook.updatedAt ? '已保存在本机。' : ''
    root.classList.toggle('is-written', hasPersonalTag(snap.outlook))
  }

  function open() {
    fill()
    panel.hidden = false
    root.classList.add('is-open')
    toggle.setAttribute('aria-expanded', 'true')
    plans.focus()
  }

  function close() {
    panel.hidden = true
    root.classList.remove('is-open')
    toggle.setAttribute('aria-expanded', 'false')
  }

  toggle.addEventListener('click', () => {
    if (panel.hidden) open()
    else close()
  })
  root.querySelector<HTMLButtonElement>('.personal-tag-close')!.addEventListener('click', close)
  document.addEventListener(PERSONAL_TAG_OPEN, () => open())
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || panel.hidden) return
    event.preventDefault()
    event.stopImmediatePropagation()
    close()
    toggle.focus()
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
    if (!plans.value.trim()) {
      output.textContent = '先写下一句未来打算，再保存。'
      return
    }
    writePersonalTag({ plans: plans.value })
    fill()
    close()
  })
  fill()
  return { element: root, open, close }
}
