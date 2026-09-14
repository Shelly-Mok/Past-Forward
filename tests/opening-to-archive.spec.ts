import { expect, test } from '@playwright/test'

test('one continuous run connects shore, rewind, archive interview and the playable lunar garden', async ({ page }) => {
  test.setTimeout(100_000)
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1536, height: 864 })
  await page.goto('/')

  const opening = page.locator('.opening-scene')
  const moon = page.locator('.moon-target')
  const archive = page.locator('.archive-scene')

  await expect(opening).toHaveClass(/is-ready/)
  await expect(opening).toHaveAttribute('data-transition', 'shore')
  await page.screenshot({ path: 'playtest/opening-to-archive-01-shore.png' })

  for (let index = 0; index < 9; index += 1) await page.keyboard.press('ArrowUp')
  await expect(opening).toHaveAttribute('data-transition', 'space')
  await expect(opening).toHaveClass(/is-copy-playing/, { timeout: 4_000 })
  await expect(opening).toHaveAttribute('data-copy-step', '1')
  await moon.click()
  await expect(opening).toHaveAttribute('data-copy-step', '2')
  await moon.click()
  await expect(opening).toHaveAttribute('data-copy-step', '3')
  await moon.click()
  await expect(opening).toHaveClass(/is-copy-complete/)
  await page.screenshot({ path: 'playtest/opening-to-archive-02-space.png' })

  const moonBounds = await moon.boundingBox()
  if (!moonBounds) throw new Error('Moon target is not visible')
  await page.mouse.move(moonBounds.x + moonBounds.width / 2, moonBounds.y + moonBounds.height / 2)
  await page.mouse.down()
  await page.mouse.move(moonBounds.x + moonBounds.width / 2 + 160, moonBounds.y + moonBounds.height / 2 + 90)
  await page.screenshot({ path: 'playtest/opening-to-archive-03-mid-pull.png' })
  await page.mouse.up()
  await expect(opening).toHaveClass(/is-drag-enabled/)

  await moon.press('Enter')
  await expect(opening).toHaveClass(/is-portal-ready/)
  await page.getByRole('button', { name: '开始回测' }).click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'playtest/opening-to-archive-04-warp.png' })

  await expect(archive).toHaveClass(/is-active/, { timeout: 4_000 })
  await expect(archive).toHaveAttribute('data-entry', 'warp')
  await expect(archive).toHaveAttribute('data-phase', 'arrival')
  await expect(opening).toHaveAttribute('aria-hidden', 'true')
  await page.screenshot({ path: 'playtest/opening-to-archive-05-arrival.png' })

  // Continue the same session, without a debug URL or injected saved profile.
  const interview = page.locator('.archive-interview')
  for (const answer of ['35', '女', '本科', '工作', '18岁高考']) {
    await page.keyboard.down('w')
    await expect(interview).toHaveAttribute('aria-hidden', 'false', { timeout: 12_000 })
    await page.keyboard.up('w')
    await page.locator('.archive-interview-input').fill(answer)
    if (answer === '18岁高考') {
      await page.getByLabel('事件发生时的年龄').fill('12')
      await page.getByLabel('那一年的重大选择').fill('跟着父母搬家')
      await page.getByRole('button', { name: '记下这一年' }).click()
      await expect(page.locator('.archive-life-event-list')).toContainText('12岁 · 跟着父母搬家')
    }
    await page.locator('.archive-interview-input').press('Enter')
    await expect(interview).toHaveAttribute('aria-hidden', 'true')
  }
  await expect(archive).toHaveAttribute('data-phase', 'ready')
  await page.keyboard.press('e')
  await expect(archive).toHaveAttribute('data-phase', 'portal', { timeout: 30_000 })
  for (let index = 0; index < 10; index += 1) await page.keyboard.press('w')
  await expect(archive).toHaveAttribute('data-phase', 'portal-arrived', { timeout: 12_000 })
  await expect(page.locator('.garden-whiteout')).toBeHidden({ timeout: 12_000 })
  const garden = page.getByRole('region', { name: '第三幕：月面人生花园' })
  await expect(garden).toBeVisible()
  await expect(archive).toBeHidden()
  await expect(opening).toBeHidden()
  await expect(garden).toHaveAttribute('data-current-age', '35')
  await expect(garden).toHaveAttribute('data-target-age', '18')
  await expect(garden).toHaveAttribute('data-age', '0')
  await expect(page.getByRole('button', { name: '12岁 · 重大事件' })).toBeVisible()
  await page.getByRole('button', { name: '15岁', exact: true }).click()
  const flower = page.locator('.garden-choice-flower').first()
  await expect(flower).toHaveClass(/is-landed/, { timeout: 4000 })
  await flower.click()
  await flower.click()
  await expect(garden).toHaveAttribute('data-actor-phase', 'walking')
  await expect(page.locator('.garden-ground-flower')).toHaveAttribute('data-planted', 'true', { timeout: 12_000 })
  await page.screenshot({ path: 'playtest/three-acts-06-planted.png' })

  expect(consoleErrors.filter(text => !text.includes('502'))).toEqual([])
})
