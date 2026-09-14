import { expect, test, type Page } from '@playwright/test'

async function observeGrowth(page: Page, age: number) {
  await page.evaluate(age => {
    const root = document.querySelector('.garden-scene')!
    const seen: number[] = []
    const capture = () => {
      const flower = root.querySelector<HTMLElement>(`[data-age="${age}"].garden-ground-flower`)
      if (!flower?.classList.contains('is-growing')) return
      const frame = Number(flower.dataset.flowerFrame)
      if (seen.at(-1) !== frame) seen.push(frame)
    }
    const observer = new MutationObserver(capture)
    observer.observe(root, { attributes: true, attributeFilter: ['data-flower-frame', 'class'], subtree: true, childList: true })
    root.addEventListener('test:stop-growth-observer', () => observer.disconnect(), { once: true })
    Object.assign(window, { observedFlowerFrames: seen })
  }, age)
}

async function observedFrames(page: Page) {
  return page.evaluate(() => {
    document.querySelector('.garden-scene')!.dispatchEvent(new Event('test:stop-growth-observer'))
    return (window as unknown as { observedFlowerFrames: number[] }).observedFlowerFrames
  })
}

async function plantAge(page: Page, label: string) {
  await page.getByRole('button', { name: label, exact: true }).click()
  const flower = page.locator('.garden-choice-flower').first()
  await expect(flower).toHaveClass(/is-landed/, { timeout: 4000 })
  await flower.click()
  await flower.click()
}

test('each chosen flower grows through all sixteen poses to its own stable bloom', async ({ page }) => {
  test.setTimeout(65_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width: 1536, height: 864 })
  await page.goto('/?scene=garden')
  const garden = page.locator('.garden-scene[aria-label="第三幕：月面人生花园"]')
  await observeGrowth(page, 30)
  await plantAge(page, '30岁')
  const bloom = page.locator('.garden-ground-flower[data-age="30"]')
  await expect(bloom).toHaveClass(/is-planting/, { timeout: 10_000 })
  await expect(bloom).toHaveAttribute('data-planted', 'false')
  await page.screenshot({ path: 'playtest/flower-growth-seed.png' })
  await expect(garden).toHaveAttribute('data-actor-phase', 'observing')
  await page.screenshot({ path: 'playtest/flower-growth-middle.png' })
  await expect(bloom).toHaveAttribute('data-planted', 'true')
  expect(await observedFrames(page)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1))
  await expect(bloom).toHaveAttribute('data-flower-frame', '16')
  await expect(bloom).toHaveAttribute('data-kind', await page.locator('.garden-choice-flower').first().getAttribute('data-kind') ?? '0')
  expect(await page.locator('.garden-vitality-meter').getAttribute('aria-valuenow')).not.toBe('0')
  const sameMatureSprite = await page.locator('.garden-choice-flower').first().locator('canvas').evaluate((choiceCanvas, groundCanvas) => {
    const a = choiceCanvas.getContext('2d')!.getImageData(0, 0, 128, 128).data
    const b = (groundCanvas as HTMLCanvasElement).getContext('2d')!.getImageData(0, 0, 128, 128).data
    return a.length === b.length && a.every((value, index) => value === b[index])
  }, await bloom.locator('canvas').elementHandle())
  expect(sameMatureSprite).toBe(true)
  await page.screenshot({ path: 'playtest/flower-growth-16.png' })
  await expect(garden).toHaveAttribute('data-actor-phase', 'idle')
  await expect(bloom.locator('canvas')).toHaveCSS('transform', 'none')
  expect(await bloom.locator('canvas').evaluate((el: HTMLCanvasElement) => el.getContext('2d')!.getImageData(0, 0, 1, 1).data[3])).toBe(0)

  await page.getByRole('button', { name: '40岁以后的时光 →' }).click()
  await observeGrowth(page, 60)
  await plantAge(page, '60岁')
  const seedhead = page.locator('.garden-ground-flower[data-age="60"]')
  await expect(seedhead).toHaveClass(/is-planting/, { timeout: 10_000 })
  await expect(seedhead).toHaveAttribute('data-flower-frame', /^(8|9|10|11|12|13|14|15)$/, { timeout: 10_000 })
  await page.screenshot({ path: 'playtest/flower-wither-middle.png' })
  await expect(seedhead).toHaveAttribute('data-planted', 'true', { timeout: 10_000 })
  expect(await observedFrames(page)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1))
  await expect(seedhead).toHaveAttribute('data-flower-frame', '16')
  await page.screenshot({ path: 'playtest/flower-wither-16.png' })
  await page.getByRole('button', { name: '60岁', exact: true }).click()
  await expect(page.getByRole('button', { name: /重看这一年的生长/ })).toHaveCount(0)
  await expect(seedhead).toHaveAttribute('data-flower-frame', '16')
  await expect(page.locator('.garden-ground-flower[data-age="60"]')).toHaveAttribute('data-planted', 'true')
  expect(errors).toEqual([])
})

test('R cancels a new planting during growth without committing it', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.goto('/?scene=garden')
  await plantAge(page, '30岁')
  const bloom = page.locator('.garden-ground-flower[data-age="30"]')
  await expect(page.locator('.garden-scene[aria-label="第三幕：月面人生花园"]')).toHaveAttribute('data-actor-phase', 'observing', { timeout: 12_000 })
  await page.keyboard.press('r')
  await page.waitForTimeout(4500)
  await expect(bloom).toHaveCount(0)
  await expect(page.locator('.garden-scene[aria-label="第三幕：月面人生花园"]')).toHaveAttribute('data-actor-phase', 'idle')
  await page.screenshot({ path: 'playtest/flower-growth-cancel-narrow.png' })
  await page.reload()
  await expect(page.locator('.garden-ground-flower[data-age="30"]')).toHaveCount(0)
})
