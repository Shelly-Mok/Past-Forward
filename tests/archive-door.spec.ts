import { expect, test } from '@playwright/test'

const answers = ['24', '不透露', '单身，与父母同住', '学生', '大学毕业前']

test('the archive waits for the profile and memory reel before opening the vault', async ({ page }) => {
  test.setTimeout(90_000)
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
    localStorage.setItem('life-backtest.garden.v2', JSON.stringify({
      version: 2,
      profile: { age: '24', gender: '不透露', family: '单身，与父母同住', status: '学生', rewind: '大学毕业前' },
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
  await page.keyboard.press('e')
  await expect(scene).toHaveAttribute('data-phase', 'audit', { timeout: 4_000 })
  await page.screenshot({ path: 'playtest/archive-door-02-audit.png' })

  await expect(scene).toHaveAttribute('data-phase', 'unlocking', { timeout: 12_000 })
  await page.screenshot({ path: 'playtest/archive-door-03-unlocking.png' })

  await expect(scene).toHaveAttribute('data-phase', 'opening', { timeout: 4_000 })
  const earlyAngle = await scene.evaluate((element) => element.style.getPropertyValue('--door-angle'))
  await page.screenshot({ path: 'playtest/archive-door-04a-seal-break.png' })

  await page.waitForFunction(() => {
    const element = document.querySelector<HTMLElement>('.archive-scene')
    return Math.abs(Number.parseFloat(element?.style.getPropertyValue('--door-angle') || '0')) >= 40
  })
  const middleAngle = await scene.evaluate((element) => element.style.getPropertyValue('--door-angle'))
  await page.screenshot({ path: 'playtest/archive-door-04b-heavy-swing.png' })

  await page.waitForFunction(() => {
    const element = document.querySelector<HTMLElement>('.archive-scene')
    return Math.abs(Number.parseFloat(element?.style.getPropertyValue('--door-angle') || '0')) >= 70
  })
  const lateAngle = await scene.evaluate((element) => element.style.getPropertyValue('--door-angle'))
  await page.screenshot({ path: 'playtest/archive-door-04c-settle.png' })

  expect(Math.abs(Number.parseFloat(earlyAngle))).toBeLessThan(Math.abs(Number.parseFloat(lateAngle)))
  expect(Math.abs(Number.parseFloat(middleAngle))).toBeGreaterThan(35)
  expect(Math.abs(Number.parseFloat(lateAngle))).toBeGreaterThan(68)

  await expect(scene).toHaveAttribute('data-phase', 'portal', { timeout: 7_000 })
  await expect(page.locator('.archive-audit-message')).toHaveText('门已经打开了。准备好以后，就往前走吧。')
  await expect(page.locator('.archive-vault-portal-state')).toBeVisible()
  await expect(page.locator('.archive-vault-door-3d')).toBeVisible()
  await page.screenshot({ path: 'playtest/archive-door-05-portal.png' })

  await page.keyboard.press('w')
  await expect(scene).toHaveAttribute('data-phase', 'portal-walking')
  for (let index = 0; index < 9; index += 1) await page.keyboard.press('w')
  await page.screenshot({ path: 'playtest/archive-door-05a-walking-to-portal.png' })
  await expect(scene).toHaveAttribute('data-phase', 'portal-arrived', { timeout: 8_000 })
  await expect(page.locator('.archive-audit-message')).toHaveText('慢慢往前吧。你的时光，正在另一侧等你。')
  await expect(scene).toHaveCSS('--portal-walk-progress', '1.0000')
  await expect(page.locator('.archive-seated-state')).toHaveCSS('opacity', '0')
  await page.screenshot({ path: 'playtest/archive-door-05b-arrived-at-portal.png' })

  const whiteout = page.locator('.garden-whiteout')
  await expect(whiteout).toHaveAttribute('data-phase', 'white', { timeout: 4000 })
  await expect(whiteout).toHaveCSS('opacity', '1')
  await expect(whiteout).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await page.screenshot({ path: 'playtest/archive-garden-06-white.png' })
  await expect(whiteout).toBeHidden({ timeout: 12_000 })
  const garden = page.locator('.garden-scene')
  await expect(garden).toBeVisible()
  await expect(scene).toBeHidden()
  await expect(garden).toHaveAttribute('data-garden-phase', 'era')
  await expect(garden).toHaveAttribute('data-current-age', '24')
  await expect(page.getByRole('button', { name: '25岁', exact: true })).toHaveCount(0)
  await expect(page.locator('.garden-ground-flower')).toHaveCount(0)
  await expect(garden).toHaveAttribute('data-target-age', '')
  await expect(page.locator('.garden-note')).toContainText('你刚来到这个时代')
  await page.getByRole('button', { name: '个人标签' }).click()
  await expect(page.locator('.personal-tag-profile')).toContainText('单身，与父母同住')
  await expect(page.locator('.personal-tag-profile')).toContainText('学生')
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
      profile: { age: '24', gender: '不透露', family: '单身，与父母同住', status: '学生', rewind: '大学毕业前' },
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
