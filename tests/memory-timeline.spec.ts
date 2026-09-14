import { expect, test, type Page } from '@playwright/test'

async function openMemories(page: Page, many = false) {
  await page.route('**/api/**', route => route.fulfill({ json: { ok: false } }))
  await page.addInitScript(({ many }) => {
    const planted = many
      ? Array.from({ length: 19 }, (_, index) => ({ age: 18 + index * 4, choiceId: 'own', label: `记录在${18 + index * 4}岁的选择` }))
      : [
          { age: 18, choiceId: 'college', label: '去上大学' },
          { age: 20, choiceId: 'own', label: '把专业读完' },
          { age: 22, choiceId: 'own', label: '第一次实习' },
          { age: 24, choiceId: 'own', label: '留在现在的城市' },
        ]
    localStorage.setItem('life-backtest.garden.v2', JSON.stringify({
      version: 2, profile: { age: many ? '90' : '24', lifeEvent: '18岁高考结束' },
      selectedAge: 18, planted, records: [], reachedPresent: true, line: 'main',
      recordedAt: '2026-09-14T00:00:00Z',
    }))
  }, { many })
  await page.goto('/?scene=interview')
  await expect(page.locator('.interview-scene')).toBeVisible()
}

async function expectSpeechNearCharacters(page: Page) {
  const width = page.viewportSize()!.width
  const bubbles: { left: number; right: number }[] = []
  for (const who of ['other', 'you']) {
    const bubble = page.locator(`.interview-turn.is-${who}.is-anchored`)
    if (await bubble.count() === 0) continue
    const actor = (await page.locator(`.interview-dialogue-actor.is-${who}`).boundingBox())!
    const box = (await bubble.boundingBox())!
    const tailX = await bubble.evaluate(element => {
      const style = getComputedStyle(element, '::before')
      return element.getBoundingClientRect().left + element.clientLeft + parseFloat(style.left) + parseFloat(style.width) / 2
    })
    expect(Math.abs(tailX - (actor.x + actor.width / 2))).toBeLessThan(2)
    // The short tail bridges this gap; text expands upward, not away from its speaker.
    expect(actor.y - (box.y + box.height)).toBeGreaterThanOrEqual(0)
    expect(actor.y - (box.y + box.height)).toBeLessThan(32)
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(width)
    expect(box.y).toBeGreaterThan(80)
    bubbles.push({ left: box.x, right: box.x + box.width })
  }
  if (bubbles.length === 2) expect(bubbles[1].left - bubbles[0].right).toBeGreaterThan(4)
}

test('memories reveal one at a time without leaking future text, then preserve the interview', async ({ page }) => {
  await page.setViewportSize({ width: 1672, height: 941 })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await openMemories(page)
  await expect(page.locator('.interview-location span')).toHaveText('回溯')
  await expect(page.locator('.interview-memory-node')).toHaveCount(1)
  await expect(page.locator('.interview-timeline')).not.toContainText('高考结束')
  await page.screenshot({ path: 'playtest/act4-memory-initial.png' })
  const next = page.locator('.interview-timeline-next')
  await next.dblclick()
  await expect(next).toHaveText('继续显影下一段')
  await expect(page.locator('.interview-memory-node')).toHaveCount(2)
  await expect(page.locator('.interview-timeline')).not.toContainText('去上大学')
  await page.screenshot({ path: 'playtest/act4-memory-middle.png' })
  await page.locator('.interview-memory-node:not(.is-start)').first().click()
  await expect(page.locator('.interview-memory-detail')).toBeVisible()
  await expect(page.locator('.interview-memory-detail')).toContainText(/对照|岁/)
  await page.getByRole('button', { name: '收起', exact: true }).click()
  for (let i = 0; i < 16; i++) {
    if ((await next.textContent()) === '聆听另一个我的回应') break
    await next.click()
    await expect(next).not.toHaveText('再次点击，立即完成')
  }
  await expect(next).toHaveText('聆听另一个我的回应')
  await page.screenshot({ path: 'playtest/act4-memory-complete.png' })
  await page.locator('.interview-scene').evaluate((element) => {
    const phases = [element.dataset.dialoguePhase]
    new MutationObserver(() => phases.push(element.dataset.dialoguePhase))
      .observe(element, { attributes: true, attributeFilter: ['data-dialogue-phase'] })
    Object.assign(window, { observedDialoguePhases: phases })
  })
  await next.click()
  await page.waitForFunction(() => (window as unknown as { observedDialoguePhases: string[] }).observedDialoguePhases.includes('opening'))
  await expect(page.locator('.interview-arrival-skip')).toBeVisible()
  await expect(page.locator('.interview-input')).toHaveCount(0)
  await page.waitForTimeout(420)
  await page.screenshot({ path: 'playtest/act4-dialogue-door-opening.png' })
  await page.waitForFunction(() => (window as unknown as { observedDialoguePhases: string[] }).observedDialoguePhases.includes('threshold'))
  await page.screenshot({ path: 'playtest/act4-dialogue-in-cabin.png' })
  await page.waitForFunction(() => (window as unknown as { observedDialoguePhases: string[] }).observedDialoguePhases.includes('disembark'))
  await page.waitForTimeout(520)
  await page.screenshot({ path: 'playtest/act4-dialogue-disembark.png' })
  await page.waitForFunction(() => (window as unknown as { observedDialoguePhases: string[] }).observedDialoguePhases.includes('manifest'), undefined, { timeout: 4_000 })
  await page.waitForTimeout(360)
  await page.screenshot({ path: 'playtest/act4-dialogue-parallel-forming.png' })
  await expect(page.locator('.interview-input')).toBeVisible()
  await expect(page.locator('.interview-scene')).toHaveAttribute('data-dialogue-phase', 'ready')
  const dialoguePhases = await page.evaluate(() => (window as unknown as { observedDialoguePhases: string[] }).observedDialoguePhases)
  expect(dialoguePhases.filter(phase => ['opening', 'threshold', 'disembark', 'grounded', 'manifest', 'settle', 'ready'].includes(phase)))
    .toEqual(['opening', 'threshold', 'disembark', 'grounded', 'manifest', 'settle', 'ready'])
  await expect(page.locator('.interview-timeline')).toBeHidden()
  await expect(page.locator('.interview-location small')).toHaveText('第四幕 · 与另一个我对话')
  await expect(page.locator('.interview-dialogue-actor')).toHaveCount(2)
  await expect(page.locator('.interview-dialogue-actors')).toBeVisible()
  await expect(page.locator('.interview-dialogue-actors')).not.toContainText('玩家输入')
  await expect(page.locator('.interview-dialogue-actors')).not.toContainText('LLM 回应')
  const actorFeet = await page.locator('.interview-dialogue-actor').evaluateAll(items => items.map(item => item.getBoundingClientRect().bottom))
  expect(Math.abs(actorFeet[0] - actorFeet[1])).toBeLessThan(1)
  await expect(page.locator('.interview-turn[data-speaker="llm-npc"]')).toHaveCount(1)
  await expect(page.locator('.interview-turn[data-speaker="player"]')).toHaveCount(0)
  await expectSpeechNearCharacters(page)
  const manualReply = '我当时更想重新准备一次'
  await page.locator('.interview-input').fill(manualReply)
  await page.locator('.interview-form button[type="submit"]').click()
  await expect(page.locator('.interview-turn[data-speaker="player"]').last()).toContainText(manualReply)
  await expect(page.locator('.interview-turn[data-speaker="llm-npc"]')).toHaveCount(2)
  await expect(page.locator('.interview-log')).not.toContainText('玩家手动输入')
  await expect(page.locator('.interview-log')).not.toContainText('LLM 回应')
  await page.waitForTimeout(1_450)
  await expect(page.locator('.interview-turn:visible')).toHaveCount(2)
  await expectSpeechNearCharacters(page)
  await page.screenshot({ path: 'playtest/act4-dialogue-two-selves.png' })
  const opening = page.locator('.interview-turn[data-speaker="llm-npc"]').first()
  await expect(opening).toBeHidden()
  await page.getByRole('button', { name: '回看对话', exact: true }).click()
  await expect(opening).toBeVisible()
  await expect(page.locator('.interview-turn:visible')).toHaveCount(3)
  await page.screenshot({ path: 'playtest/act4-dialogue-history.png' })
  await page.getByRole('button', { name: '回到人物对话', exact: true }).click()
  await expect(opening).toBeHidden()
  await expectSpeechNearCharacters(page)
  await page.getByRole('button', { name: '轻触另一个我', exact: true }).click()
  await expect(page.locator('.interview-dialogue-actor.is-other')).toHaveAttribute('data-motion', 'greet')
  expect(errors).toEqual([])
})

test('long histories fit the touch viewport without a timeline scrollbar and holding stops at completion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openMemories(page, true)
  const next = page.locator('.interview-timeline-next')
  const box = (await next.boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(390)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await expect(next).toHaveText('聆听另一个我的回应', { timeout: 20_000 })
  await page.mouse.up()
  await expect(page.locator('.interview-timeline')).toBeVisible()
  await expect.poll(async () => page.locator('.interview-memory-node').count()).toBeGreaterThan(19)
  const viewport = page.locator('.interview-memory-viewport')
  const viewportMetrics = await viewport.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    overflowX: getComputedStyle(element).overflowX,
  }))
  expect(viewportMetrics.scrollWidth).toBeLessThanOrEqual(viewportMetrics.clientWidth + 1)
  expect(viewportMetrics.overflowX).toBe('hidden')
  const viewportBox = (await viewport.boundingBox())!
  const nodeBoxes = await page.locator('.interview-memory-node').evaluateAll(nodes => nodes.map((node) => {
    const box = node.getBoundingClientRect()
    return { left: box.left, right: box.right, top: box.top, bottom: box.bottom }
  }))
  for (const box of nodeBoxes) {
    expect(box.left).toBeGreaterThanOrEqual(viewportBox.x - 1)
    expect(box.right).toBeLessThanOrEqual(viewportBox.x + viewportBox.width + 1)
    expect(box.top).toBeGreaterThanOrEqual(viewportBox.y - 1)
    expect(box.bottom).toBeLessThanOrEqual(viewportBox.y + viewportBox.height + 1)
  }
  await page.screenshot({ path: 'playtest/act4-memory-mobile-many.png' })
  await page.reload()
  await expect(page.locator('.interview-memory-node')).toHaveCount(1)
  await page.screenshot({ path: 'playtest/act4-memory-mobile-initial.png' })
})

test('the two-self dialogue keeps characters between the mobile bubbles and input', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openMemories(page)
  const next = page.locator('.interview-timeline-next')
  const nextBox = (await next.boundingBox())!
  await page.mouse.move(nextBox.x + nextBox.width / 2, nextBox.y + nextBox.height / 2)
  await page.mouse.down()
  await expect(next).toHaveText('聆听另一个我的回应', { timeout: 12_000 })
  await page.mouse.up()
  await next.click()
  const actors = page.locator('.interview-dialogue-actor')
  await expect(actors).toHaveCount(2)
  await expect(actors.first()).toBeVisible()
  const composeBox = (await page.locator('.interview-compose').boundingBox())!
  for (const box of await actors.evaluateAll(items => items.map((item) => {
    const rect = item.getBoundingClientRect()
    return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right }
  }))) {
    expect(box.bottom).toBeLessThanOrEqual(composeBox.y + 2)
    expect(box.left).toBeGreaterThanOrEqual(0)
    expect(box.right).toBeLessThanOrEqual(390)
  }
  await expectSpeechNearCharacters(page)
  await page.locator('.interview-input').fill('如果当时再做一次选择，我想先把自己的想法讲清楚，再认真考虑另一条路。')
  await page.locator('.interview-form button[type="submit"]').click()
  await expect(page.locator('.interview-turn.is-pending')).toHaveCount(0)
  await expect(page.locator('.interview-turn:visible')).toHaveCount(2)
  await expectSpeechNearCharacters(page)
  await page.screenshot({ path: 'playtest/act4-dialogue-two-selves-mobile.png' })
  const longReply = '我想保留当时认真做过的选择，也愿意听听另一条路上的故事。'.repeat(7)
  await page.locator('.interview-input').fill(longReply)
  await page.locator('.interview-form button[type="submit"]').click()
  await expect(page.locator('.interview-turn.is-pending')).toHaveCount(0)
  await expect(page.locator('.interview-turn.is-you.is-anchored')).toContainText(longReply)
  await expectSpeechNearCharacters(page)
  const text = page.locator('.interview-turn.is-you.is-anchored .interview-line')
  await text.focus()
  await text.press('End')
  await expect.poll(() => text.evaluate(el => el.scrollTop)).toBeGreaterThan(0)
})

test('the encounter can be skipped without skipping or duplicating the opening dialogue', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await openMemories(page)
  const next = page.locator('.interview-timeline-next')
  const nextBox = (await next.boundingBox())!
  await page.mouse.move(nextBox.x + nextBox.width / 2, nextBox.y + nextBox.height / 2)
  await page.mouse.down()
  await expect(next).toHaveText('聆听另一个我的回应', { timeout: 12_000 })
  await page.mouse.up()
  await next.click()
  await expect(page.locator('.interview-scene')).toHaveAttribute('data-dialogue-phase', 'opening')
  await expect(page.locator('.interview-turn')).toHaveCount(0)
  await page.getByRole('button', { name: '跳过相遇动画', exact: true }).click()
  await expect(page.locator('.interview-scene')).toHaveAttribute('data-dialogue-phase', 'ready')
  await expect(page.locator('.interview-turn[data-speaker="llm-npc"]')).toHaveCount(1)
  await expect(page.locator('.interview-turn[data-speaker="player"]')).toHaveCount(0)
  await expect(page.locator('.interview-arrival-skip')).toHaveCount(0)
  await expect(page.locator('.interview-input')).toBeFocused()
})
