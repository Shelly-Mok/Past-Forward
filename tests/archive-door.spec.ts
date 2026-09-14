import { expect, test } from '@playwright/test'

const answers = ['24', '女', '本科', '工作', '毕业那年']

test('the archive waits for the profile and memory reel before opening the vault', async ({ page }) => {
  test.setTimeout(150_000)
  const consoleErrors: string[] = []
  const failedResponses: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') {
      const location = message.location()
      consoleErrors.push(`${message.text()} @ ${location.url}:${location.lineNumber ?? 0}`)
    }
  })
  page.on('response', (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`)
  })

  await page.addInitScript(() => {
    if (sessionStorage.getItem('test:archive-door-seeded')) return
    sessionStorage.setItem('test:archive-door-seeded', 'true')
    localStorage.setItem('life-backtest.garden.v2', JSON.stringify({
      version: 2,
      profile: { age: '24', gender: '女', education: '本科', health: '良好', lifeEvent: '毕业那年' },
      currentAge: 24,
      target: { raw: '大学毕业前', kind: 'stage', age: 18, year: null },
      selectedAge: 24,
      planted: [{ age: 18, choiceId: 'college' }, { age: 25, choiceId: 'second' }],
      records: [],
      recordedAt: '2026-01-01T00:00:00.000Z',
      reachedPresent: true,
    }))
  })
  await page.setViewportSize({ width: 1536, height: 864 })
  await page.goto('/?debug=archive')
  await page.waitForTimeout(1_150)
  const scene = page.locator('.archive-scene')
  const interview = page.locator('.archive-interview')
  const input = page.locator('.archive-interview-input')

  await expect(scene).toHaveAttribute('data-phase', 'arrival')
  await page.screenshot({ path: 'playtest/archive-door-01-arrival.png' })

  for (const answer of answers) {
    await page.keyboard.down('w')
    await expect(interview).toHaveAttribute('aria-hidden', 'false', { timeout: 12_000 })
    await page.keyboard.up('w')
    await input.fill(answer)
    await input.press('Enter')
    await expect(interview).toHaveAttribute('aria-hidden', 'true')
  }

  await expect(scene).toHaveAttribute('data-phase', 'ready')
  await scene.evaluate((element) => {
    const phases = [element.dataset.phase]
    const angles = [Math.abs(Number.parseFloat(element.style.getPropertyValue('--door-angle') || '0'))]
    new MutationObserver(() => {
      const phase = element.dataset.phase
      const angle = Math.abs(Number.parseFloat(element.style.getPropertyValue('--door-angle') || '0'))
      if (phases.at(-1) !== phase) phases.push(phase)
      if (angles.at(-1) !== angle) angles.push(angle)
    }).observe(element, { attributes: true, attributeFilter: ['data-phase', 'style'] })
    Object.assign(window, { observedArchivePhases: phases, observedArchiveAngles: angles })
  })
  await page.keyboard.press('e')
  await page.waitForFunction(() => (window as unknown as { observedArchivePhases: string[] }).observedArchivePhases.includes('audit'))
  await page.screenshot({ path: 'playtest/archive-door-02-audit.png' })

  await page.waitForFunction(() => (window as unknown as { observedArchivePhases: string[] }).observedArchivePhases.includes('unlocking'), undefined, { timeout: 12_000 })
  await page.screenshot({ path: 'playtest/archive-door-03-unlocking.png' })

  await page.waitForFunction(() => (window as unknown as { observedArchivePhases: string[] }).observedArchivePhases.includes('opening'))
  await page.screenshot({ path: 'playtest/archive-door-04a-seal-break.png' })

  await expect(scene).toHaveAttribute('data-phase', 'portal', { timeout: 7_000 })
  const archivePhases = await page.evaluate(() => (window as unknown as { observedArchivePhases: string[] }).observedArchivePhases)
  expect(archivePhases.filter(phase => ['sitting', 'audit', 'unlocking', 'opening', 'portal'].includes(phase)))
    .toEqual(['sitting', 'audit', 'unlocking', 'opening', 'portal'])
  const archiveAngles = await page.evaluate(() => (window as unknown as { observedArchiveAngles: number[] }).observedArchiveAngles)
  expect(archiveAngles.at(-1)).toBeGreaterThan(68)
  expect(archiveAngles.some(angle => angle > 0 && angle < 68)).toBe(true)
  expect(archiveAngles.every((angle, index) => index === 0 || angle >= archiveAngles[index - 1])).toBe(true)
  await expect(page.locator('.archive-audit-message')).toHaveText('门已经打开了。准备好以后，就往前走吧。')
  await expect(page.locator('.archive-vault-portal-state')).toBeVisible()
  await expect(page.locator('.archive-vault-door-3d')).toBeVisible()
  await page.screenshot({ path: 'playtest/archive-door-05-portal.png' })

  const whiteout = page.locator('.garden-whiteout')
  await whiteout.evaluate((element) => {
    const phases: Array<string | undefined> = [element.dataset.phase]
    let whiteStyle: { opacity: string, backgroundColor: string } | null = null
    new MutationObserver(() => {
      const phase = element.dataset.phase
      if (phases.at(-1) !== phase) phases.push(phase)
      if (phase === 'white') {
        const style = getComputedStyle(element)
        whiteStyle = { opacity: style.opacity, backgroundColor: style.backgroundColor }
      }
    }).observe(element, { attributes: true, attributeFilter: ['data-phase', 'class', 'hidden'] })
    Object.assign(window, { observedWhiteoutPhases: phases, observedWhiteoutStyle: () => whiteStyle })
  })
  await page.keyboard.press('w')
  await expect(scene).toHaveAttribute('data-phase', 'portal-walking')
  for (let index = 0; index < 9; index += 1) await page.keyboard.press('w')
  await page.screenshot({ path: 'playtest/archive-door-05a-walking-to-portal.png' })
  await expect(scene).toHaveAttribute('data-phase', 'portal-arrived', { timeout: 8_000 })
  await expect(page.locator('.archive-audit-message')).toHaveText('慢慢往前吧。你的时光，正在另一侧等你。')
  await expect(scene).toHaveCSS('--portal-walk-progress', '1.0000')
  await expect(page.locator('.archive-seated-state')).toHaveCSS('opacity', '0')
  await page.screenshot({ path: 'playtest/archive-door-05b-arrived-at-portal.png' })

  await page.waitForFunction(() => (window as unknown as { observedWhiteoutPhases: string[] }).observedWhiteoutPhases.includes('white'))
  const whiteoutStyle = await page.evaluate(() => (window as unknown as { observedWhiteoutStyle: () => { opacity: string, backgroundColor: string } }).observedWhiteoutStyle())
  expect(whiteoutStyle).toEqual({ opacity: '1', backgroundColor: 'rgb(255, 255, 255)' })
  await page.screenshot({ path: 'playtest/archive-garden-06-white.png' })
  await expect(whiteout).toBeHidden({ timeout: 12_000 })
  const whiteoutPhases = await page.evaluate(() => (window as unknown as { observedWhiteoutPhases: string[] }).observedWhiteoutPhases)
  expect(whiteoutPhases.filter(phase => ['entering', 'white', 'revealing', 'complete'].includes(phase)))
    .toEqual(['entering', 'white', 'revealing', 'complete'])
  const garden = page.locator('.garden-scene[aria-label="第三幕：月面人生花园"]')
  await expect(garden).toBeVisible()
  await expect(scene).toBeHidden()
  await expect(garden).toHaveAttribute('data-garden-phase', 'era')
  await expect(garden).toHaveAttribute('data-current-age', '24')
  await expect(page.getByRole('button', { name: '25岁', exact: true })).toHaveCount(0)
  await expect(page.locator('.garden-ground-flower')).toHaveCount(0)
  await expect(garden).toHaveAttribute('data-target-age', '')
  await expect(page.locator('.garden-note')).toContainText('你刚来到这个时代')
  await page.getByRole('button', { name: '个人标签' }).click()
  await expect(page.locator('.personal-tag-profile')).toContainText('本科')
  await expect(page.locator('.personal-tag-profile')).toContainText('毕业那年')
  await page.getByRole('button', { name: '关闭个人标签' }).click()
  await page.getByRole('button', { name: '确认回溯年龄 →' }).click()
  await page.getByRole('textbox', { name: '确认回溯年龄', exact: true }).fill('18')
  await page.getByRole('button', { name: '记录', exact: true }).click()
  await expect(garden).toHaveAttribute('data-age', '18')
  await expect(garden).toHaveAttribute('data-current-age', '24')
  await expect(garden).toHaveAttribute('data-chapter', '1')
  await page.screenshot({ path: 'playtest/archive-garden-07-entered.png' })
  await page.keyboard.press('r')
  await expect(garden).toHaveAttribute('data-age', '18')
  await expect(garden).toHaveAttribute('data-current-age', '24')
  await page.reload()
  await expect(garden).toHaveAttribute('data-target-age', '18')
  await expect(garden).toHaveAttribute('data-current-age', '24')

  expect({ consoleErrors, failedResponses }).toEqual({ consoleErrors: [], failedResponses: [] })
})

test('starting the archive discards the previous garden exit', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('life-backtest.garden.v1', '{"reachedPresent":true}')
    localStorage.setItem('life-backtest.garden.v2', JSON.stringify({
      version: 2,
      profile: { age: '24', gender: '女', education: '本科', health: '良好', lifeEvent: '毕业那年' },
      currentAge: 24,
      target: { raw: '大学毕业前', kind: 'stage', age: 18, year: null },
      selectedAge: 24,
      planted: [{ age: 18, choiceId: 'college' }, { age: 25, choiceId: 'second' }],
      records: [],
      recordedAt: '2026-01-01T00:00:00.000Z',
      reachedPresent: true,
    }))
  })
  await page.goto('/?debug=archive')
  await expect(page.locator('.archive-scene')).toHaveAttribute('data-phase', 'arrival')
  expect(await page.evaluate(() => localStorage.getItem('life-backtest.garden.v1'))).toBeNull()
  expect(await page.evaluate(() => localStorage.getItem('life-backtest.garden.v2'))).toBeNull()
})

test('the archive scene keeps the playfield readable at a narrower desktop size', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') {
      const location = message.location()
      consoleErrors.push(`${message.text()} @ ${location.url}:${location.lineNumber ?? 0}`)
    }
  })
  await page.setViewportSize({ width: 1024, height: 700 })
  await page.goto('/?debug=archive')
  await page.waitForTimeout(1_150)
  await expect(page.locator('.archive-scene')).toHaveAttribute('data-phase', 'arrival')
  await page.screenshot({ path: 'playtest/archive-door-07-narrow.png' })
  expect(consoleErrors).toEqual([])
})
