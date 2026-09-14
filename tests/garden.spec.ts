import { expect, test, type Page } from '@playwright/test'

async function finishIdeal(page: Page) {
  const garden = page.getByRole('region', { name: '第三幕：月面人生花园' })
  await expect(garden).toHaveAttribute('data-garden-phase', 'ideal', { timeout: 18_000 })
  await expect(page.getByRole('heading', { level: 1 })).toContainText('更希望')
  const flowers = page.locator('.garden-ground-flower')
  const before = await flowers.count()
  await page.locator('.garden-choice-flower').first().click()
  if (!await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    await expect(garden).toHaveAttribute('data-garden-phase', 'awakening')
    await expect(page.locator('.garden-awakening-copy')).toBeVisible()
    await page.waitForTimeout(650)
    await page.screenshot({ path: 'playtest/garden-03-awakening.png' })
  }
  await expect(garden).toHaveAttribute('data-garden-phase', 'npc', { timeout: 8000 })
  await expect(flowers).toHaveCount(before)
}

test('debug garden skips the first two acts and starts a fresh third act', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('life-backtest.garden.v2', JSON.stringify({
      version: 2,
      profile: { age: '24', gender: '演示', education: '演示 · 本科', health: '良好', lifeEvent: '18岁高考' },
      currentAge: 24,
      target: { raw: '18岁', kind: 'age', age: 18, year: null },
      selectedAge: 24,
      planted: [{ age: 18, choiceId: 'college' }, { age: 25, choiceId: 'second' }],
      records: [],
      recordedAt: '2026-01-01T00:00:00.000Z',
      reachedPresent: true,
    }))
  })
  await page.setViewportSize({ width: 1536, height: 864 })
  await page.goto('/?debug=garden&reset=1')
  const garden = page.getByRole('region', { name: '第三幕：月面人生花园' })
  await expect(garden).toBeVisible()
  await expect(page.getByRole('button', { name: '个人标签' })).toBeVisible()
  await expect(page.locator('.opening-scene')).toBeHidden()
  await expect(page.locator('.archive-scene')).toBeHidden()
  await expect(garden).toHaveAttribute('data-garden-phase', 'era')
  await expect(garden).toHaveAttribute('data-current-age', '24')
  await expect(garden).toHaveAttribute('data-target-age', '18')
  await expect(page.getByRole('button', { name: '25岁', exact: true })).toHaveCount(0)
  await expect(page.locator('.garden-ground-flower')).toHaveCount(0)
  await page.getByRole('button', { name: '个人标签' }).click()
  await expect(page.locator('.personal-tag-profile')).toContainText('演示 · 本科')
})

test('looking back at a planted year does not grow a second flower', async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem('life-backtest.garden.v2'))
  await page.setViewportSize({ width: 1536, height: 864 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?debug=garden')
  const garden = page.getByRole('region', { name: '第三幕：月面人生花园' })
  await page.getByRole('button', { name: '0岁', exact: true }).click()
  const first = page.locator('.garden-choice-flower').first()
  await expect(first).toBeVisible({ timeout: 4000 })
  await first.click()
  await first.click()
  await expect(page.locator('.garden-ground-flower[data-age="0"]')).toHaveCount(1, { timeout: 18_000 })
  await finishIdeal(page)
  await page.getByRole('button', { name: '进入下一个时间点 →' }).click()
  await page.getByRole('button', { name: '5岁', exact: true }).click()
  const five = page.locator('.garden-choice-flower').first()
  await expect(five).toBeVisible({ timeout: 4000 })
  await five.click()
  await five.click()
  await expect(page.locator('.garden-ground-flower[data-age="5"]')).toHaveCount(1, { timeout: 18_000 })
  await finishIdeal(page)
  await page.getByRole('button', { name: '0岁', exact: true }).click()
  const other = page.locator('.garden-choice-flower.is-landed').nth(1)
  await expect(other).toBeVisible({ timeout: 4000 })
  await other.click()
  await other.click()
  await expect(garden).toHaveAttribute('data-actor-phase', 'idle', { timeout: 12_000 })
  await expect(page.locator('.garden-ground-flower[data-age="0"]')).toHaveCount(1)
  await expect(page.locator('.garden-ground-flower[data-age="5"]')).toHaveCount(1)
})

test('age 5 keeps the usual forks and treats dance as part of art school', async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem('life-backtest.garden.v2'))
  await page.setViewportSize({ width: 1536, height: 864 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?debug=garden')
  await page.getByRole('button', { name: '5岁', exact: true }).click()
  await expect(page.getByRole('button', { name: '上幼儿园', exact: true })).toBeVisible({ timeout: 4000 })
  await expect(page.getByRole('button', { name: '去艺校', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '在家自育 / 跟随父母迁移', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '提前上小学 / 跳级', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '这一年常往医院跑', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '去舞校', exact: true })).toHaveCount(0)
  await expect(page.locator('.garden-choice-flower[aria-label="去舞校 / 武校 / 艺校"]')).toHaveCount(0)
  await expect(page.locator('.garden-choice-stat')).toHaveCount(0)
  await page.screenshot({ path: 'playtest/garden-05-art-school.png' })
})

test('writing your own path plants that sentence and later years can be reset', async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem('life-backtest.garden.v2'))
  await page.setViewportSize({ width: 1536, height: 864 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?debug=garden')
  const garden = page.getByRole('region', { name: '第三幕：月面人生花园' })
  await page.getByRole('button', { name: '0岁', exact: true }).click()
  await expect(page.getByRole('button', { name: '写下你自己的路', exact: true })).toBeVisible({ timeout: 4000 })
  await page.getByRole('button', { name: '写下你自己的路', exact: true }).click()
  await page.getByRole('textbox', { name: '你这一年走的路' }).fill('去当兵后来又复员')
  await page.getByRole('button', { name: '写下这句' }).click()
  await expect(page.locator('.garden-ground-flower[data-age="0"][data-choice="own"]')).toHaveAttribute('data-planted', 'true', { timeout: 18_000 })
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('life-backtest.garden.v2') || '{}').planted)).toEqual([
    { age: 0, choiceId: 'own', label: '去当兵后来又复员' },
  ])
  await finishIdeal(page)
  const storedIdeal = await page.evaluate(() => JSON.parse(localStorage.getItem('life-backtest.garden.v2') || '{}').ideal)
  expect(storedIdeal).toEqual([expect.objectContaining({ age: 0 })])
  await expect(page.locator('.garden-ground-flower[data-age="0"]')).toHaveCount(1)
  await page.getByRole('button', { name: '进入下一个时间点 →' }).click()
  await page.getByRole('button', { name: '5岁', exact: true }).click()
  const five = page.locator('.garden-choice-flower').first()
  await expect(five).toBeVisible({ timeout: 4000 })
  await five.click()
  await five.click()
  await expect(page.locator('.garden-ground-flower[data-age="5"]')).toHaveCount(1, { timeout: 18_000 })
  await page.getByRole('button', { name: '0岁', exact: true }).click()
  await page.getByRole('button', { name: '重置当年选择' }).click()
  await expect(page.locator('.garden-ground-flower[data-age="0"]')).toHaveCount(0)
  await expect(page.locator('.garden-ground-flower[data-age="5"]')).toHaveCount(0)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('life-backtest.garden.v2') || '{}').ideal)).toEqual([])
  await expect(garden).toHaveAttribute('data-garden-phase', 'choices')
  await expect(page.getByRole('button', { name: '写下你自己的路', exact: true })).toBeVisible()
})

test('at 24, planting age 20 shows sky NPCs then the 24-year era, not the ending', async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem('life-backtest.garden.v2'))
  await page.setViewportSize({ width: 1536, height: 864 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?debug=garden')
  const garden = page.getByRole('region', { name: '第三幕：月面人生花园' })
  await expect(garden).toBeVisible()
  await expect(garden).toHaveAttribute('data-current-age', '24')
  await expect(page.getByRole('button', { name: '24岁', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '20岁', exact: true }).click()
  await expect(page.locator('.garden-choice-flower.is-landed').first()).toBeVisible({ timeout: 4000 })
  await page.locator('.garden-choice-flower').first().click()
  await page.locator('.garden-choice-flower').first().click()
  await finishIdeal(page)
  await expect(garden).toHaveAttribute('data-garden-phase', 'npc', { timeout: 18_000 })
  await expect(garden).toHaveAttribute('data-age', '20')
  await expect.poll(async () => page.locator('.garden-signal-npc').count()).toBeGreaterThanOrEqual(2)
  await expect(page.locator('.garden-signals')).not.toContainText('同代旁路')
  await expect(page.locator('.garden-signals')).toContainText('飞船上方的对照帖')
  await expect(page.locator('.garden-note')).toContainText('没有真实匹配分数')
  await page.getByRole('button', { name: /A · 同代相近/ }).click()
  await expect(page.locator('.garden-signal-card')).toBeVisible()
  await expect(page.locator('.garden-signal-story')).toBeVisible()
  await expect(page.locator('.garden-signal-card')).not.toContainText('检索')
  await expect(page.locator('.garden-signal-quote')).toHaveCount(0)
  await expect(page.locator('.garden-signal-source')).toContainText('演示帖 · 不是公开原文')
  await page.getByRole('button', { name: '进入下一个时间点 →' }).click()
  await expect(garden).toHaveAttribute('data-age', '24')
  await expect(garden).toHaveAttribute('data-garden-phase', 'era')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('24岁')
  await expect(page.locator('.garden-signals')).toBeHidden()
})

test('planting at 40 keeps earlier flowers on the planet', async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem('life-backtest.garden.v2'))
  await page.setViewportSize({ width: 1536, height: 864 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?debug=garden&age=40')
  const garden = page.getByRole('region', { name: '第三幕：月面人生花园' })
  await expect(garden).toHaveAttribute('data-current-age', '40')
  await page.getByRole('button', { name: '20岁', exact: true }).click()
  await expect(page.locator('.garden-choice-flower.is-landed').first()).toBeVisible({ timeout: 4000 })
  await page.locator('.garden-choice-flower').first().click()
  await page.locator('.garden-choice-flower').first().click()
  await expect(page.locator('.garden-ground-flower[data-age="20"]')).toHaveAttribute('data-planted', 'true', { timeout: 18_000 })
  await page.getByRole('button', { name: '40岁', exact: true }).click()
  await expect(page.locator('.garden-choice-flower.is-landed').first()).toBeVisible({ timeout: 4000 })
  await page.locator('.garden-choice-flower').first().click()
  await page.locator('.garden-choice-flower').first().click()
  await expect(page.locator('.garden-ground-flower[data-age="40"]')).toHaveAttribute('data-planted', 'true', { timeout: 18_000 })
  await expect(page.locator('.garden-ground-flower[data-age="20"]')).toBeVisible()
  await expect(page.locator('.garden-ground-flower[data-age="40"]')).toBeVisible()
})

test('timeline uses five-year nodes, era copy, ship flowers and two-click planting', async ({ page }) => {
  test.setTimeout(150_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width: 1536, height: 864 })
  await page.goto('/?scene=garden')
  const garden = page.getByRole('region', { name: '第三幕：月面人生花园' })
  await expect(garden).toBeVisible()
  await expect(page.locator('.garden-timeline')).toBeVisible()
  await expect(page.getByRole('button', { name: '0岁', exact: true })).toBeVisible()
  await expect(page.locator('.garden-choice-flower')).toHaveCount(0)
  await expect(page.locator('.garden-signals')).toBeHidden()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('岁')
  await expect(page.locator('.garden-note')).not.toHaveText('')
  await expect(page.locator('.garden-note')).not.toContainText('作者骨架')
  await expect(page.locator('.garden-note')).not.toContainText('不是按年龄实时生成')
  await page.getByRole('button', { name: '确认回溯年龄 →' }).click()
  await page.getByRole('textbox', { name: '确认回溯年龄', exact: true }).fill('22')
  await page.getByRole('button', { name: '记录', exact: true }).click()
  await expect(garden).toHaveAttribute('data-age', '22')
  await expect(garden).toHaveAttribute('data-garden-phase', 'era')
  await page.getByRole('button', { name: '20岁', exact: true }).click()
  await expect(garden).toHaveAttribute('data-garden-phase', 'choices')
  await expect(page.locator('.garden-choice-stat')).toHaveCount(0)
  await expect(page.locator('.garden-choice-flower small')).toHaveCount(0)
  expect((await page.locator('.garden-choice-flower').allTextContents()).join('')).not.toContain('%')
  await expect.poll(async () => page.locator('.garden-choice-flower.is-landed').count(), { timeout: 4000 }).toBeGreaterThanOrEqual(6)
  await expect(page.locator('.garden-signals')).toBeHidden()
  await page.screenshot({ path: 'playtest/garden-01-hover.png' })
  const firstFlower = page.locator('.garden-choice-flower').first()
  await firstFlower.click()
  await expect(garden).toHaveAttribute('data-garden-phase', 'inspect')
  await expect(garden).toHaveAttribute('data-signal-mode', 'inspect')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('20岁')
  await expect(page.locator('.garden-signal-reason')).not.toContainText('%')
  await expect(page.locator('.garden-signal-reason')).toContainText('把专业读完')
  await page.screenshot({ path: 'playtest/garden-01b-reason.png' })
  await garden.evaluate((element) => {
    const phases = [element.dataset.actorPhase]
    new MutationObserver(() => {
      const phase = element.dataset.actorPhase
      if (phases.at(-1) !== phase) phases.push(phase)
    }).observe(element, { attributes: true, attributeFilter: ['data-actor-phase'] })
    Object.assign(window, { observedGardenActorPhases: phases })
  })
  await firstFlower.click()
  await page.waitForFunction(() => (window as unknown as { observedGardenActorPhases: string[] }).observedGardenActorPhases.includes('walking'))
  await page.waitForTimeout(850)
  await page.screenshot({ path: 'playtest/garden-motion-01-walking.png' })
  await page.waitForFunction(() => (window as unknown as { observedGardenActorPhases: string[] }).observedGardenActorPhases.includes('kneeling'))
  await page.waitForTimeout(420)
  await page.screenshot({ path: 'playtest/garden-motion-02-kneeling.png' })
  await page.waitForFunction(() => (window as unknown as { observedGardenActorPhases: string[] }).observedGardenActorPhases.includes('planting'))
  await page.screenshot({ path: 'playtest/garden-02-growing.png' })
  await expect(page.locator('.garden-ground-flower')).toHaveAttribute('data-planted', 'true', { timeout: 12_000 })
  const actorPhases = await page.evaluate(() => (window as unknown as { observedGardenActorPhases: string[] }).observedGardenActorPhases)
  expect(actorPhases.filter(phase => ['walking', 'kneeling', 'planting', 'rising', 'observing', 'idle'].includes(phase)))
    .toEqual(['idle', 'walking', 'kneeling', 'planting', 'rising', 'observing', 'idle'])
  await expect(garden).toHaveAttribute('data-age', '20')
  await finishIdeal(page)
  await expect(garden).toHaveAttribute('data-garden-phase', 'npc')
  await expect.poll(async () => page.locator('.garden-signal-npc').count()).toBeGreaterThanOrEqual(2)
  await expect(page.locator('.garden-signals')).not.toContainText('同代旁路')
  await page.getByRole('button', { name: '进入下一个时间点 →' }).click()
  await expect(garden).toHaveAttribute('data-age', '22')
  await expect(garden).toHaveAttribute('data-garden-phase', 'era')
  await expect(page.locator('.garden-signals')).toBeHidden()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('22岁')
  await expect(page.getByRole('button', { name: '记下这一岁' })).toHaveCount(0)
  await page.getByRole('button', { name: '20岁', exact: true }).click()
  await expect.poll(async () => page.locator('.garden-choice-flower.is-landed').count(), { timeout: 4000 }).toBeGreaterThanOrEqual(6)
  await firstFlower.click()
  await firstFlower.click()
  await expect(garden).toHaveAttribute('data-actor-phase', 'idle', { timeout: 12_000 })
  await expect(garden).toHaveAttribute('data-garden-phase', 'npc')
  await expect(garden).toHaveAttribute('data-signal-mode', 'npc')
  await expect.poll(async () => page.locator('.garden-signal-npc').count()).toBeGreaterThanOrEqual(2)
  await expect(page.locator('.garden-signals')).not.toContainText('同代旁路')
  await expect(page.locator('.garden-signals')).toContainText('飞船上方的对照帖')
  await expect(page.locator('.garden-signals')).toContainText('没有真实匹配分数')
  await page.getByRole('button', { name: /A · 同代相近/ }).click()
  await expect(page.locator('.garden-signal-card')).toContainText('选了')
  await expect(page.locator('.garden-signal-story')).toBeVisible()
  await expect(page.locator('.garden-signal-card')).not.toContainText('检索')
  await expect(page.locator('.garden-signal-quote')).toHaveCount(0)
  await expect(page.locator('.garden-signal-card')).toContainText('演示帖 · 不是公开原文')
  await expect(page.locator('.garden-signal-chain')).toHaveCount(0)
  await page.screenshot({ path: 'playtest/garden-03-npc-card.png' })
  await page.getByRole('button', { name: '收起画像' }).click()
  await expect.poll(async () => page.locator('.garden-signal-npc').count()).toBeGreaterThanOrEqual(2)
  await expect(page.locator('.garden-signals')).not.toContainText('同代旁路')
  await page.getByRole('button', { name: '个人标签' }).click()
  await expect(page.locator('.personal-tag-profile')).toContainText('现在的年龄')
  await page.getByRole('button', { name: '关闭个人标签' }).click()
  const feetBefore = await garden.getAttribute('data-actor-x')
  await page.keyboard.press('ArrowRight')
  await expect(garden).toHaveAttribute('data-age', '22')
  await expect(garden).toHaveAttribute('data-garden-phase', 'era')
  await page.keyboard.press('ArrowRight')
  await expect(garden).toHaveAttribute('data-age', '25')
  await page.keyboard.press('ArrowLeft')
  await expect(garden).toHaveAttribute('data-age', '22')
  await expect(garden).toHaveAttribute('data-actor-x', feetBefore!)
  await page.getByRole('button', { name: '40岁以后的时光 →' }).click()
  await expect(garden).toHaveAttribute('data-age', '40')
  await page.getByRole('button', { name: '60岁', exact: true }).click()
  await expect.poll(async () => page.locator('.garden-choice-flower.is-landed').count(), { timeout: 4000 }).toBeGreaterThanOrEqual(6)
  await page.locator('.garden-choice-flower').first().click()
  await page.locator('.garden-choice-flower').first().click()
  await expect(page.locator('.garden-ground-flower[data-age="60"]')).toHaveAttribute('data-planted', 'true', { timeout: 18_000 })
  await page.getByRole('button', { name: '80岁', exact: true }).click()
  await expect(garden).toHaveAttribute('data-age', '80')
  await page.screenshot({ path: 'playtest/garden-04-eighty.png' })
  await page.getByRole('button', { name: '回到回溯起点 ↖' }).click()
  await expect(garden).toHaveAttribute('data-age', '22')
  await page.reload()
  await expect(garden).toHaveAttribute('data-age', '22')
  await expect(page.locator('.garden-signals')).toBeHidden()
  expect(errors).toEqual([])
})

test('extra flowers sit small on the far horizon, not stacked in the sky', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?debug=garden')
  await page.getByRole('button', { name: '0岁', exact: true }).click()
  await expect.poll(async () => page.locator('.garden-choice-flower.is-landed').count(), { timeout: 4000 }).toBeGreaterThanOrEqual(7)
  await expect(page.getByRole('region', { name: '第三幕：月面人生花园' }).locator('.garden-earth')).toBeVisible()
  const extras = page.locator('.garden-choice-flower[data-lane="starboard"]')
  await expect(extras.first()).toBeVisible()
  const scene = await page.locator('.garden-choice-flowers').boundingBox()
  const boxes = await extras.locator('.garden-choice-halo').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect()))
  expect(scene).toBeTruthy()
  for (const box of boxes) {
    const mid = box.y + box.height / 2
    expect(mid).toBeGreaterThan(scene!.y + scene!.height * 0.45)
    expect(box.height).toBeLessThan(scene!.height * 0.16)
  }
  const dialog = await page.locator('.garden-copy').boundingBox()
  const caption = await page.locator('.garden-timeline-caption').boundingBox()
  expect(dialog).toBeTruthy()
  expect(caption).toBeTruthy()
  expect(dialog!.y + dialog!.height).toBeLessThan(caption!.y)
  const origin = await page.getByRole('button', { name: '回到回溯起点 ↖' }).boundingBox()
  expect(origin).toBeTruthy()
  for (const box of await extras.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect()))) {
    const hit = origin!.x < box.x + box.width && origin!.x + origin!.width > box.x && origin!.y < box.y + box.height && origin!.y + origin!.height > box.y
    expect(hit).toBe(false)
  }
  await page.screenshot({ path: 'playtest/garden-starboard-horizon.png', fullPage: true })
})

test('the garden stays usable in portrait and with reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?scene=garden')
  await expect(page.getByRole('region', { name: '第三幕：月面人生花园' })).toBeVisible()
  await page.getByRole('button', { name: '确认回溯年龄 →' }).click()
  await page.getByRole('textbox', { name: '确认回溯年龄', exact: true }).fill('35')
  await page.getByRole('button', { name: '记录', exact: true }).click()
  await page.getByRole('button', { name: '35岁', exact: true }).click()
  await expect.poll(async () => page.locator('.garden-choice-flower.is-landed').count()).toBeGreaterThanOrEqual(6)
  await page.locator('.garden-choice-flower').nth(1).click()
  await page.locator('.garden-choice-flower').nth(1).click()
  await finishIdeal(page)
  await expect(page.getByRole('region', { name: '第三幕：月面人生花园' })).toHaveAttribute('data-garden-phase', 'npc', { timeout: 18_000 })
  await page.getByRole('button', { name: '进入下一个时间点 →' }).click()
  await expect(page.getByRole('region', { name: '第三幕：月面人生花园' })).toHaveAttribute('data-age', '40')
  await expect(page.getByRole('region', { name: '第三幕：月面人生花园' })).toHaveAttribute('data-garden-phase', 'era')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('life-backtest.garden.v2') || '{}').planted)).toEqual([{ age: 35, choiceId: 'sprint', label: '再冲一轮事业' }])
  await page.screenshot({ path: 'playtest/garden-05-portrait.png', fullPage: true })
  const letterbox = await page.getByRole('region', { name: '第三幕：月面人生花园' }).locator('.garden-frame').boundingBox()
  const viewport = page.viewportSize()!
  expect(letterbox).toBeTruthy()
  expect(letterbox!.width).toBeLessThanOrEqual(viewport.width + 1)
  expect(letterbox!.height).toBeLessThanOrEqual(viewport.height + 1)
  expect(Math.abs(letterbox!.width / letterbox!.height - 1672 / 941)).toBeLessThan(0.03)
  expect(await page.getByRole('region', { name: '第三幕：月面人生花园' }).locator('.garden-frame').evaluate(el => getComputedStyle(el).overflow)).toMatch(/hidden/)
})

test('R interrupts travel without teleporting, planting or overwriting the selected age', async ({ page }) => {
  await page.goto('/?scene=garden')
  const garden = page.getByRole('region', { name: '第三幕：月面人生花园' })
  await page.getByRole('button', { name: '0岁', exact: true }).click()
  await expect.poll(async () => page.locator('.garden-choice-flower.is-landed').count(), { timeout: 4000 }).toBeGreaterThanOrEqual(7)
  const halos = await page.locator('.garden-choice-flower.is-landed .garden-choice-halo').evaluateAll(nodes => nodes.map(node => {
    const box = node.getBoundingClientRect()
    return { x: box.x, y: box.y, r: box.right, b: box.bottom }
  }))
  for (let i = 0; i < halos.length; i++) {
    for (let j = i + 1; j < halos.length; j++) {
      const a = halos[i], next = halos[j]
      const overlap = a.x < next.r && a.r > next.x && a.y < next.b && a.b > next.y
      expect(overlap, `flower halo ${i} overlaps ${j}`).toBe(false)
    }
  }
  const origin = await page.getByRole('button', { name: '回到回溯起点 ↖' }).boundingBox()
  expect(origin).toBeTruthy()
  for (const box of await page.locator('.garden-choice-flower[data-lane="starboard"]').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect()))) {
    const hit = origin!.x < box.x + box.width && origin!.x + origin!.width > box.x && origin!.y < box.y + box.height && origin!.y + origin!.height > box.y
    expect(hit, 'starboard flower covers 回到回溯起点').toBe(false)
  }
  await page.screenshot({ path: 'playtest/garden-starboard-desktop.png' })
  await page.locator('.garden-choice-flower').first().click()
  await page.locator('.garden-choice-flower').first().click()
  await expect(garden).toHaveAttribute('data-actor-phase', 'walking')
  await page.waitForTimeout(800)
  await page.keyboard.press('r')
  await expect(garden).toHaveAttribute('data-actor-phase', 'idle')
  const feet = await garden.getAttribute('data-actor-x')
  await page.waitForTimeout(1200)
  await expect(garden).toHaveAttribute('data-actor-x', feet!)
  await expect(garden).toHaveAttribute('data-age', '0')
  await expect(page.locator('.garden-ground-flower')).toHaveCount(0)
  await page.getByRole('button', { name: '与主角打个招呼' }).click()
  await expect(page.locator('.garden-note')).toContainText('先点时间线上的一年')
  await page.screenshot({ path: 'playtest/garden-motion-03-cancel.png' })
})

test('planting up to the present age opens one backtrack planet, then boarding enters the interview', async ({ page }) => {
  test.setTimeout(120_000)
  await page.addInitScript(() => {
    sessionStorage.setItem('life-backtest.archive-profile', JSON.stringify({
      age: '22', lifeEvent: '20岁实习', gender: '演示', education: '本科', health: '良好',
    }))
    localStorage.removeItem('life-backtest.garden.v2')
  })
  await page.setViewportSize({ width: 1536, height: 864 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?scene=garden')
  const garden = page.getByRole('region', { name: '第三幕：月面人生花园' })
  await expect(garden).toBeVisible()
  await expect(garden).toHaveAttribute('data-current-age', '22')
  await expect(garden).toHaveAttribute('data-garden-phase', 'era')
  await expect(page.getByRole('button', { name: '25岁', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '30岁', exact: true })).toHaveCount(0)
  await expect(page.locator('[data-action="chapters"]')).toBeHidden()
  await page.getByRole('button', { name: /^20岁/ }).click()
  await expect(page.locator('[data-action="memory"]')).toBeVisible({ timeout: 4000 })
  const mark = page.locator('.garden-choice-flower')
  await expect(mark).toBeVisible()
  await expect(mark).toHaveCount(1)
  await mark.click()
  await mark.click()
  await expect(page.locator('.garden-ground-flower[data-age="20"]')).toHaveCount(1, { timeout: 18_000 })
  await finishIdeal(page)
  await expect(garden).toHaveAttribute('data-garden-phase', 'npc', { timeout: 18_000 })
  await page.getByRole('button', { name: '进入下一个时间点 →' }).click()
  await expect(garden).toHaveAttribute('data-age', '22')
  await expect(garden).toHaveAttribute('data-garden-phase', 'era')
  await page.getByRole('button', { name: '查看这一年的选择 ↗' }).click()
  await expect(page.locator('.garden-choice-flower.is-landed').first()).toBeVisible({ timeout: 4000 })
  await page.locator('.garden-choice-flower').first().click()
  await page.locator('.garden-choice-flower').first().click()
  await finishIdeal(page)
  await expect(garden).toHaveAttribute('data-garden-phase', 'npc', { timeout: 18_000 })
  await page.getByRole('button', { name: '寻找平行宇宙的「他」 →' }).click()
  await expect(garden).toHaveAttribute('data-garden-phase', 'crossroads', { timeout: 8_000 })
  await expect(page.getByRole('button', { name: '前往分岔口 →' })).toHaveCount(0)
  await expect(page.locator('.garden-copy')).toBeHidden()
  await expect(page.locator('.garden-timeline')).toBeHidden()
  await expect(page.locator('.garden-signals')).toBeHidden()
  await expect(page.locator('.garden-player')).toBeHidden()
  await expect(page.locator('.garden-orbit-ship')).toBeVisible()
  await expect(page.locator('.garden-orbit-sky')).toBeVisible()
  await expect(garden.locator('.garden-galaxy')).toBeVisible()
  await expect(garden.locator('.garden-cosmos-color')).toBeVisible()
  await expect(garden.locator('.garden-cosmos-stars')).toBeVisible()
  await expect(garden.locator('.garden-life-color')).toBeHidden()
  await expect(garden.locator('.garden-life-growth')).toBeHidden()
  await expect(garden.locator('.garden-life-light')).toBeHidden()
  await expect(garden.locator('.garden-planet-rim')).toBeHidden()
  await expect(garden.locator('.garden-ship-contact')).toBeHidden()
  await expect(garden.locator('.garden-ship-ambient')).toBeHidden()
  await expect(page.locator('.garden-orbit-ship')).toHaveCount(1)
  await expect(garden.locator('.garden-location span')).toHaveText('回溯入口')
  await expect(page.locator('.garden-crossroads-note')).toContainText('中间这一颗是回溯')
  await expect(page.getByRole('button', { name: '回溯 · 重访改造的那条路' })).toBeVisible()
  await expect(page.getByRole('button', { name: '前瞻 · 看 23–25 岁的可能' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '结束 · 把选择停在这一刻' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '前进 · 跟随着人生的继续' })).toHaveCount(0)
  await expect(page.locator('.garden-hole-world')).toHaveCount(1)
  await expect(page.locator('.garden-hole-core')).toHaveCount(0)
  await page.screenshot({ path: 'playtest/garden-06-crossroads.png' })
  await page.getByRole('button', { name: '回溯 · 重访改造的那条路' }).click()
  await expect(page.locator('.interview-scene')).toBeVisible()
  await expect(page.locator('.interview-candidate')).toHaveCount(0)
  await expect(page.locator('.interview-timeline')).toBeVisible()
  await expect(page.locator('.interview-input')).toHaveCount(0)
  for (let step = 0; step < 16; step += 1) {
    if (await page.locator('.interview-input').isVisible()) break
    const next = page.locator('.interview-timeline-next')
    if (await next.count() === 0) break
    await next.click()
  }
  await expect(page.locator('.interview-input')).toBeVisible({ timeout: 4_000 })
  await expect(page.locator('.interview-timeline')).toBeHidden()
  await expect(page.getByRole('button', { name: '查看上下文' })).toBeVisible()
  await page.getByRole('button', { name: '查看上下文' }).click()
  await expect(page.locator('.interview-context')).toBeVisible()
  await expect(page.locator('.interview-context')).toContainText('岁')
  await page.getByRole('button', { name: '收起上下文' }).click()
  await expect(page.locator('.interview-context')).toBeHidden()
  await expect(page.locator('.interview-turn.is-other')).toBeVisible()
  await expect(page.locator('.interview-turn.is-you')).toHaveCount(0)
  await page.screenshot({ path: 'playtest/garden-07-interview.png' })
  await page.getByRole('button', { name: '结束对话' }).click()
  await expect(page.locator('.interview-scene')).toBeHidden()
  await expect(garden).toHaveAttribute('data-garden-phase', 'rift')
  await expect(garden.locator('.garden-rift')).toContainText('第五幕')
  await expect(page.locator('.garden-outlook-report')).toBeVisible()
  await expect(page.locator('.garden-outlook-friend')).toContainText('同代')
  await expect(page.locator('.garden-outlook-consult')).toContainText('前辈')
  await expect(page.locator('.garden-outlook-avatar-frame')).toHaveCount(2)
  await expect(page.locator('.garden-outlook-avatar-frame').first()).toBeVisible()
  await expect(page.locator('.garden-outlook-avatar-frame').last()).toBeVisible()
  const outlookLayout = await page.evaluate(() => {
    const report = document.querySelector('.garden-outlook-report')?.getBoundingClientRect()
    const offer = document.querySelector('.garden-outlook-friend')?.getBoundingClientRect()
    return report && offer
      ? { reportWidth: report.width, offerWidth: offer.width, reportArea: report.width * report.height, offerArea: offer.width * offer.height }
      : null
  })
  expect(outlookLayout).not.toBeNull()
  expect(outlookLayout!.reportWidth).toBeGreaterThan(outlookLayout!.offerWidth * 1.5)
  expect(outlookLayout!.reportArea).toBeGreaterThan(outlookLayout!.offerArea * 2.5)
  await expect(page.locator('.garden-outlook-why')).toHaveCount(2)
  await expect(page.locator('.garden-outlook-why').first()).not.toHaveText('')
  await expect(page.locator('.garden-outlook-refresh')).toHaveCount(2)
  const firstFriend = await page.locator('.garden-outlook-friend strong').first().textContent()
  await page.locator('.garden-outlook-friend .garden-outlook-refresh').click()
  await expect.poll(async () => page.locator('.garden-outlook-friend strong').first().textContent()).not.toBe(firstFriend)
  await expect(page.locator('.garden-outlook-avatar-frame')).toHaveCount(2)
  await expect(page.getByRole('button', { name: '个人标签' })).toBeVisible()
  await page.getByRole('button', { name: '写下个人展望' }).click()
  await expect(page.locator('.personal-tag-panel')).toBeVisible()
  await expect(page.locator('.personal-tag')).toHaveClass(/is-outlook-mode/)
  await expect(page.locator('.personal-tag-panel')).toHaveAttribute('role', 'dialog')
  await expect(page.locator('.garden-outlook-offers')).toHaveCSS('opacity', '0')
  const stack = await page.evaluate(() => {
    const tag = document.querySelector('.personal-tag')
    const panel = document.querySelector('.personal-tag-panel')
    const garden = document.querySelector<HTMLElement>('.garden-scene[data-rift-kind="end"]')
    if (!tag || !panel || !garden) return null
    const bounds = panel.getBoundingClientRect()
    const point = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)
    return {
      parentIsApp: tag.parentElement?.id === 'app',
      panelIsTopLayer: Boolean(point && panel.contains(point)),
      gardenIsInert: garden.inert,
      panelWidth: bounds.width,
    }
  })
  expect(stack).not.toBeNull()
  expect(stack!.parentIsApp).toBe(true)
  expect(stack!.panelIsTopLayer).toBe(true)
  expect(stack!.gardenIsInert).toBe(true)
  expect(stack!.panelWidth).toBeGreaterThanOrEqual(420)
  await expect(page.locator('.personal-tag-profile')).toContainText('现在的年龄')
  await expect(page.locator('.personal-tag-profile')).toContainText('22')
  await expect(page.locator('.personal-tag-choices')).toContainText('岁')
  await page.locator('.personal-tag-form textarea[name="plans"]').fill('先验证再决定')
  await page.locator('.personal-tag-form button[type="submit"]').click()
  await expect(page.locator('.personal-tag-panel')).toBeHidden()
  await expect(page.locator('.personal-tag')).not.toHaveClass(/is-outlook-mode/)
  await expect(page.locator('.garden-outlook-offers')).toHaveCSS('opacity', '1')
  await expect(page.locator('.garden-bottom-links > .personal-tag')).toHaveCount(1)
  await expect(page.getByRole('link', { name: '盐选会员' })).toBeVisible()
  await page.getByRole('button', { name: '返回入口' }).first().click()
  await expect(garden).toHaveAttribute('data-garden-phase', 'crossroads')
})

test('choice flowers plant on two clicks, and R unsticks the scene', async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem('life-backtest.garden.v2'))
  await page.setViewportSize({ width: 1536, height: 864 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?debug=garden')
  const garden = page.getByRole('region', { name: '第三幕：月面人生花园' })
  await page.getByRole('button', { name: '0岁', exact: true }).click()
  await expect(page.locator('.garden-choice-flower canvas').first()).toBeVisible({ timeout: 4000 })
  await expect(page.locator('.garden-choice-flower canvas')).toHaveCount(await page.locator('.garden-choice-flower').count())
  await expect(page.locator('.garden-choice-flower small')).toHaveCount(0)
  expect((await page.locator('.garden-choice-flower').allTextContents()).join('')).not.toContain('%')
  await expect(page.locator('.garden-choice-stat')).toHaveCount(0)
  await page.locator('.garden-choice-flower').first().click()
  await expect(garden).toHaveAttribute('data-garden-phase', 'inspect')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('0岁')
  await page.locator('.garden-choice-flower').first().click()
  await expect(garden).toHaveAttribute('data-actor-phase', 'walking', { timeout: 8000 })
  await page.getByRole('button', { name: /重新进入画面/ }).click()
  await expect(garden).toHaveAttribute('data-actor-phase', 'idle')
  await expect(garden).toHaveAttribute('data-age', '0')
  await expect(page.locator('.garden-ground-flower')).toHaveCount(0)
  await page.getByRole('button', { name: '个人标签' }).click()
  const panel = page.locator('.personal-tag-panel')
  await expect(panel).toBeVisible()
  expect(await panel.evaluate(el => getComputedStyle(el).overflowY)).toBe('auto')
  await panel.evaluate(el => { el.scrollTop = 24 })
  expect(await panel.evaluate(el => el.scrollTop)).toBeGreaterThanOrEqual(0)
})

test('event years plant 记下这一岁 then ask the hoped-for path', async ({ page }) => {
  test.setTimeout(60_000)
  await page.route('**/api/life/event-year', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      json: {
        ok: true,
        era: '分数把走廊分成两半。你写下了高考这一年。',
        ideals: [
          { id: 'hope-leave', label: '去外省读书', reason: '想离开熟悉的城' },
          { id: 'hope-repeat', label: '复读一年', reason: '还想再搏一次' },
          { id: 'hope-work', label: '先去工作', reason: '不再把希望押在校园' },
        ],
      },
    })
  })
  await page.addInitScript(() => {
    localStorage.removeItem('life-backtest.garden.v2')
    localStorage.removeItem('life-backtest.personal-tag.v1')
  })
  await page.setViewportSize({ width: 1536, height: 864 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?debug=garden')
  const garden = page.getByRole('region', { name: '第三幕：月面人生花园' })
  await expect(garden).toBeVisible()
  await expect(page.locator('[data-action="memory"]')).toBeHidden()
  await page.getByRole('button', { name: '18岁 · 重大事件' }).click()
  await expect(page.locator('[data-action="memory"]')).toBeVisible({ timeout: 4000 })
  const mark = page.locator('.garden-choice-flower')
  await expect(mark).toBeVisible()
  await expect(page.locator('.garden-choice-flower')).toHaveCount(1)
  await expect(page.locator('.garden-note')).toContainText('高考')
  await page.locator('[data-action="memory"]').click()
  await expect(page.locator('.garden-panel')).toBeVisible()
  await expect(page.getByRole('heading', { name: '18岁 · 记下这一岁' })).toBeVisible()
  await page.getByRole('textbox', { name: '对这件事的描述' }).fill('那天走廊很静')
  await page.getByRole('button', { name: '写入个人标签' }).click()
  await expect(page.locator('.garden-form output')).toContainText('个人标签')
  await page.locator('.garden-panel-close').click()
  await page.getByRole('button', { name: '个人标签' }).click()
  await expect(page.locator('.personal-tag-events')).toContainText('那天走廊很静')
  await page.getByRole('button', { name: '关闭个人标签' }).click()
  await mark.click()
  await mark.click()
  await expect(page.locator('.garden-ground-flower[data-age="18"]')).toHaveCount(1, { timeout: 18_000 })
  await expect(garden).toHaveAttribute('data-garden-phase', 'ideal', { timeout: 18_000 })
  await expect(page.locator('.garden-choice-flower[aria-label="记下这一岁"]')).toHaveCount(0)
  await expect(page.locator('[data-action="memory"]')).toBeVisible()
  await expect.poll(async () => page.locator('.garden-choice-flower.is-landed').count()).toBeGreaterThanOrEqual(3)
  await finishIdeal(page)
  await expect(garden).toHaveAttribute('data-garden-phase', 'npc')
  await page.getByRole('button', { name: '进入下一个时间点 →' }).click()
  await expect(garden).toHaveAttribute('data-age', '20')
  await expect(garden).toHaveAttribute('data-garden-phase', 'era')
  await expect(page.locator('[data-action="memory"]')).toBeHidden()
  await page.getByRole('button', { name: '查看这一年的选择 ↗' }).click()
  await expect.poll(async () => page.locator('.garden-choice-flower.is-landed').count(), { timeout: 4000 }).toBeGreaterThanOrEqual(6)
})

test('extra life-event ages sit on the timeline and talk only after every year is planted', async ({ page }) => {
  test.setTimeout(90_000)
  const planted = [0, 5, 10, 12, 15, 18, 20, 24].map(age => ({ age, choiceId: 'mark', label: '走过' }))
  await page.addInitScript(items => {
    localStorage.setItem('life-backtest.garden.v2', JSON.stringify({
      version: 2,
      profile: {
        age: '24', gender: '演示', education: '演示 · 本科', health: '良好', lifeEvent: '18岁高考',
        lifeEvents: [{ age: 12, text: '跟着父母搬家' }],
      },
      currentAge: 24,
      target: { raw: '18岁高考', kind: 'age', age: 18, year: null },
      selectedAge: 0,
      planted: items,
      records: [],
      recordedAt: '2026-09-13T00:00:00.000Z',
      reachedPresent: false,
      line: 'main',
      forkAge: null,
      parallelPlanted: [],
      ideal: items,
      parallelIdeal: [],
    }))
  }, planted)
  await page.setViewportSize({ width: 1536, height: 864 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?debug=garden')
  const garden = page.getByRole('region', { name: '第三幕：月面人生花园' })
  await expect(garden).toBeVisible()
  await expect(garden.getByRole('heading', { level: 1 })).toHaveText('0岁')
  await expect(page.getByRole('button', { name: /重看这一年的生长/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '12岁 · 重大事件' })).toBeVisible()
  await page.getByRole('button', { name: '12岁 · 重大事件' }).click()
  const talk = page.getByRole('complementary', { name: '重大事件回看' })
  await expect(talk).toBeVisible()
  await expect(talk.locator('h2')).toContainText('跟着父母搬家')
  await expect(page.getByRole('button', { name: '开始这一年的对话' })).toBeVisible()
  await page.getByRole('button', { name: '开始这一年的对话' }).click()
  await expect(talk.locator('.garden-event-talk-log')).not.toHaveText('')
  await page.getByRole('button', { name: '收起对话' }).click()
  await expect(talk).toBeHidden()
  await page.getByRole('button', { name: '24岁', exact: true }).click()
  await expect(page.locator('.garden-choice-flower').first()).toBeVisible({ timeout: 4000 })
  await page.locator('.garden-choice-flower').first().click()
  await page.locator('.garden-choice-flower').first().click()
  await expect(page.getByRole('button', { name: '寻找平行宇宙的「他」 →' })).toBeVisible({ timeout: 18_000 })
  await page.getByRole('button', { name: '寻找平行宇宙的「他」 →' }).click()
  await expect(talk).toBeVisible({ timeout: 8_000 })
  await expect(page.locator('.garden-event-talk-ready')).toContainText(/开始这一年的对话/)
  await expect(talk.locator('h2')).toContainText(/跟着父母搬家|高考/)
  if (await page.getByRole('button', { name: '开始这一年的对话' }).count()) {
    await page.getByRole('button', { name: '开始这一年的对话' }).click()
  }
  await page.getByRole('button', { name: '收起对话' }).click()
  await expect(talk).toBeHidden()
  await expect(page.getByRole('button', { name: '继续这一年的对话' })).toBeVisible()
})

test('fifth act keeps the report dominant with its own glass border', async ({ page }) => {
  const planted = [0, 5, 10, 15, 18, 20, 24].map(age => ({
    age,
    choiceId: `act-five-${age}`,
    label: `${age} 岁的人生选择`,
  }))
  await page.addInitScript(items => {
    localStorage.setItem('life-backtest.garden.v2', JSON.stringify({
      version: 2,
      profile: {
        age: '24',
        gender: '演示',
        education: '演示 · 本科',
        health: '良好',
        lifeEvent: '18岁换了工作',
      },
      currentAge: 24,
      target: { raw: '18岁换了工作', kind: 'age', age: 18, year: null },
      selectedAge: 24,
      planted: items,
      records: [],
      recordedAt: '2026-09-14T00:00:00.000Z',
      reachedPresent: true,
      line: 'main',
      forkAge: null,
      parallelPlanted: [],
      ideal: items,
      parallelIdeal: [],
    }))
  }, planted)
  await page.setViewportSize({ width: 1536, height: 864 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?scene=garden')
  await expect(page.getByRole('region', { name: '第三幕：月面人生花园' })).toBeVisible()

  await page.evaluate(() => {
    const interview = document.querySelector('.interview-scene')
    if (!interview) throw new Error('Missing interview scene')
    interview.dispatchEvent(new CustomEvent('life-backtest:interview-done'))
  })

  await expect(page.getByRole('region', { name: '第三幕：月面人生花园' }).locator('.garden-rift')).toContainText('第五幕')
  await expect(page.locator('.garden-outlook-report')).toBeVisible()
  await expect(page.locator('.garden-outlook-avatar-frame')).toHaveCount(2)

  const visual = await page.evaluate(() => {
    const report = document.querySelector('.garden-outlook-report')
    const card = document.querySelector('.garden-outlook-friend')
    const goldText = document.querySelector('.garden-outlook-report-column.is-interview .garden-outlook-report-section')
    if (!report || !card || !goldText) return null
    const reportRect = report.getBoundingClientRect()
    const cardRect = card.getBoundingClientRect()
    const reportStyle = getComputedStyle(report)
    const cardStyle = getComputedStyle(card)
    return {
      reportWidth: reportRect.width,
      cardWidth: cardRect.width,
      reportArea: reportRect.width * reportRect.height,
      cardArea: cardRect.width * cardRect.height,
      reportRadius: Number.parseFloat(reportStyle.borderTopLeftRadius),
      cardRadius: Number.parseFloat(cardStyle.borderTopLeftRadius),
      reportBorderWidth: Number.parseFloat(reportStyle.borderTopWidth),
      reportBorderStyle: reportStyle.borderTopStyle,
      reportBackground: reportStyle.backgroundImage,
      reportBackdrop: reportStyle.backdropFilter,
      cardBackdrop: cardStyle.backdropFilter,
      gold: getComputedStyle(goldText).color,
    }
  })

  expect(visual).not.toBeNull()
  expect(visual!.reportWidth).toBeGreaterThan(visual!.cardWidth * 1.5)
  expect(visual!.reportArea).toBeGreaterThan(visual!.cardArea * 3)
  expect(visual!.reportRadius).toBeGreaterThanOrEqual(12)
  expect(Math.abs(visual!.reportRadius - visual!.cardRadius)).toBeLessThan(1)
  expect(visual!.reportBorderWidth).toBe(1)
  expect(visual!.reportBorderStyle).toBe('solid')
  expect(visual!.reportBackground).toContain('linear-gradient')
  expect(visual!.reportBackdrop).toContain('blur')
  expect(visual!.cardBackdrop).toContain('blur')
  expect(visual!.gold).toMatch(/^rgb\(\d+, \d+, \d+\)$/)

  const trigger = page.getByRole('button', { name: '写下个人展望' })
  await trigger.click()
  const editor = page.locator('.personal-tag-panel')
  await expect(editor).toBeVisible()
  await expect(editor).toHaveAttribute('aria-modal', 'true')
  await expect(page.locator('.garden-outlook-offers')).toHaveCSS('opacity', '0')
  await expect(page.locator('.personal-tag-form textarea')).toBeFocused()
  const editorLayout = await page.evaluate(() => {
    const panel = document.querySelector('.personal-tag-panel')
    const textarea = document.querySelector('.personal-tag-form textarea')
    const tag = document.querySelector('.personal-tag')
    if (!panel || !textarea || !tag) return null
    const panelRect = panel.getBoundingClientRect()
    const inputRect = textarea.getBoundingClientRect()
    const top = document.elementFromPoint(panelRect.left + panelRect.width / 2, panelRect.top + panelRect.height / 2)
    return {
      parentIsApp: tag.parentElement?.id === 'app',
      panelIsTopLayer: Boolean(top && panel.contains(top)),
      inputInFirstView: inputRect.top >= panelRect.top && inputRect.bottom <= panelRect.bottom,
    }
  })
  expect(editorLayout).toEqual({ parentIsApp: true, panelIsTopLayer: true, inputInFirstView: true })
  await page.screenshot({ path: 'playtest/garden-08-outlook-editor-desktop.png' })
  await page.locator('.personal-tag-cancel').click()
  await expect(editor).toBeHidden()
  await expect(trigger).toBeFocused()
  await expect(page.locator('.garden-outlook-offers')).toHaveCSS('opacity', '1')

  await page.setViewportSize({ width: 390, height: 844 })
  await trigger.click()
  await expect(editor).toBeVisible()
  const mobileLayout = await editor.evaluate(element => {
    const rect = element.getBoundingClientRect()
    return {
      left: Math.round(rect.left),
      top: Math.round(rect.top),
      rightGap: Math.round(innerWidth - rect.right),
      bottomGap: Math.round(innerHeight - rect.bottom),
      width: Math.round(rect.width),
    }
  })
  expect(mobileLayout.left).toBeGreaterThanOrEqual(10)
  expect(mobileLayout.top).toBeGreaterThanOrEqual(10)
  expect(mobileLayout.rightGap).toBeGreaterThanOrEqual(10)
  expect(mobileLayout.bottomGap).toBeGreaterThanOrEqual(10)
  expect(mobileLayout.width).toBeLessThanOrEqual(370)
  await page.screenshot({ path: 'playtest/garden-09-outlook-editor-mobile.png' })
  await page.locator('.personal-tag-cancel').click()
  await expect(editor).toBeHidden()
})
