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
  await expect(opening).toHaveClass(/is-copy-complete/, { timeout: 4_000 })
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
  for (const answer of ['35', '不透露', '与家人同住', '上班', '18岁']) {
    await page.keyboard.down('w')
    await expect(interview).toHaveAttribute('aria-hidden', 'false', { timeout: 12_000 })
    await page.keyboard.up('w')
    await page.locator('.archive-interview-input').fill(answer)
    await page.locator('.archive-interview-input').press('Enter')
    await expect(interview).toHaveAttribute('aria-hidden', 'true')
  }
  await expect(archive).toHaveAttribute('data-phase', 'ready')
  await page.keyboard.press('e')
  await expect(archive).toHaveAttribute('data-phase', 'portal', { timeout: 30_000 })
  await page.keyboard.down('w')
  await expect(archive).toHaveAttribute('data-phase', 'portal-arrived', { timeout: 12_000 })
  await page.keyboard.up('w')
  await expect(page.locator('.garden-whiteout')).toBeHidden({ timeout: 12_000 })
  const garden = page.locator('.garden-scene')
  await expect(garden).toBeVisible()
  await expect(archive).toBeHidden()
  await expect(opening).toBeHidden()
  await expect(garden).toHaveAttribute('data-current-age', '35')
  await expect(garden).toHaveAttribute('data-target-age', '18')
  await expect(garden).toHaveAttribute('data-age', '18')
  const flower = page.getByRole('button', { name: '10—20岁 · 含苞', exact: true })
  await flower.click()
  await expect(garden).toHaveAttribute('data-actor-phase', 'walking')
  await expect(flower).toHaveAttribute('data-planted', 'true', { timeout: 12_000 })
  await page.screenshot({ path: 'playtest/three-acts-06-planted.png' })

  expect(consoleErrors).toEqual([])
})
