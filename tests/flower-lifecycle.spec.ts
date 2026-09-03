import { expect, test, type Page } from '@playwright/test'

// Observe the actual rendered sequence. Screenshot encoding can take longer than
// a short pose, so round-tripping an assertion per pose would miss valid frames.
async function observeGrowth(page: Page, chapter: number) {
  await page.evaluate(chapter => {
    const root = document.querySelector('.garden-scene')!
    const seen: number[] = []
    const capture = () => {
      const flower = root.querySelector<HTMLElement>(`[data-chapter="${chapter}"].garden-flower`)
      if (!flower?.classList.contains('is-growing')) return
      const frame = Number(flower.dataset.flowerFrame)
      if (seen.at(-1) !== frame) seen.push(frame)
    }
    const observer = new MutationObserver(capture)
    observer.observe(root, { attributes: true, attributeFilter: ['data-flower-frame', 'class'], subtree: true, childList: true })
    root.addEventListener('test:stop-growth-observer', () => observer.disconnect(), { once: true })
    Object.assign(window, { observedFlowerFrames: seen })
  }, chapter)
}

async function observedFrames(page: Page) {
  return page.evaluate(() => {
    document.querySelector('.garden-scene')!.dispatchEvent(new Event('test:stop-growth-observer'))
    return (window as unknown as { observedFlowerFrames: number[] }).observedFlowerFrames
  })
}

test('the flower grows through all poses to full bloom and then all the way to seeds', async ({ page }) => {
  test.setTimeout(65_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width: 1536, height: 864 })
  await page.goto('/?scene=garden')
  const garden = page.locator('.garden-scene')
  const bloom = page.getByRole('button', { name: '30—40岁 · 盛放', exact: true })
  await observeGrowth(page, 3)
  await bloom.click()
  await expect(bloom).toHaveClass(/is-planting/, { timeout: 10_000 })
  await expect(bloom).toHaveAttribute('data-planted', 'false')
  await page.screenshot({ path: 'playtest/flower-growth-seed.png' })
  await expect(garden).toHaveAttribute('data-actor-phase', 'observing')
  await page.screenshot({ path: 'playtest/flower-growth-middle.png' })
  await expect(bloom).toHaveAttribute('data-planted', 'true')
  expect(await observedFrames(page)).toEqual(Array.from({ length: 11 }, (_, i) => i + 1))
  await expect(bloom).toHaveAttribute('data-flower-frame', '11')
  await page.screenshot({ path: 'playtest/flower-growth-11.png' })
  await expect(garden).toHaveAttribute('data-actor-phase', 'idle')
  await expect(bloom.locator('canvas')).toHaveCSS('transform', 'none')
  // Transparent sprite margins: no white/checkerboard rectangle is shipped.
  expect(await bloom.locator('canvas').evaluate((el: HTMLCanvasElement) => el.getContext('2d')!.getImageData(0, 0, 1, 1).data[3])).toBe(0)

  await page.getByRole('button', { name: '40岁以后的时光 →' }).click()
  const seedhead = page.getByRole('button', { name: '60—70岁 · 结籽', exact: true })
  await observeGrowth(page, 6)
  await seedhead.click()
  await expect(seedhead).toHaveClass(/is-planting/, { timeout: 10_000 })
  await expect(seedhead).toHaveAttribute('data-flower-frame', /^(13|14|15)$/, { timeout: 10_000 })
  await page.screenshot({ path: 'playtest/flower-wither-middle.png' })
  await expect(seedhead).toHaveAttribute('data-planted', 'true', { timeout: 10_000 })
  expect(await observedFrames(page)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1))
  await expect(seedhead).toHaveAttribute('data-flower-frame', '16')
  await page.screenshot({ path: 'playtest/flower-wither-16.png' })
  const saved = await page.evaluate(() => localStorage.getItem('life-backtest.garden.v1'))
  await page.getByRole('button', { name: '重看这一章的生长 ↻' }).click()
  await expect(seedhead).toHaveClass(/is-growing/, { timeout: 10_000 })
  await expect(garden).toHaveAttribute('data-actor-phase', 'observing')
  await page.keyboard.press('r')
  await expect(garden).toHaveAttribute('data-actor-phase', 'idle')
  await expect(seedhead).toHaveAttribute('data-flower-frame', '16')
  expect(await page.evaluate(() => localStorage.getItem('life-backtest.garden.v1'))).toBe(saved)
  await page.screenshot({ path: 'playtest/flower-replay-cancel.png' })
  expect(errors).toEqual([])
})

test('R cancels a new planting during growth without committing it', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.goto('/?scene=garden')
  const bloom = page.getByRole('button', { name: '30—40岁 · 盛放', exact: true })
  await bloom.click()
  await expect(page.locator('.garden-scene')).toHaveAttribute('data-actor-phase', 'observing', { timeout: 12_000 })
  await page.keyboard.press('r')
  await page.waitForTimeout(4500)
  await expect(bloom).toHaveAttribute('data-planted', 'false')
  await expect(page.locator('.garden-scene')).toHaveAttribute('data-actor-phase', 'idle')
  await page.screenshot({ path: 'playtest/flower-growth-cancel-narrow.png' })
  await page.reload()
  await expect(bloom).toHaveAttribute('data-planted', 'false')
})
