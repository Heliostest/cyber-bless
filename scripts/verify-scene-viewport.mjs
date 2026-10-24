// Real production-route browser checks. No scene-review wrapper or test-only
// completion event is used. Run against an already running Vite/preview server:
//   WBR_URL=http://127.0.0.1:5174 node scripts/verify-scene-viewport.mjs
// Optional filters: WBR_VIEWPORT_WIDTHS=320,390 WBR_VIEWPORT_CASES=ordinary,water
// Navigation smoke only: WBR_VIEWPORT_NAV_ONLY=1 (does not assert new layout).
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { scenePointer } from './browser-scene-pointer.mjs'

const base = new URL(process.env.WBR_URL || 'http://127.0.0.1:5174')
const out = fileURLToPath(new URL('../artifacts/scene-viewport-motion/', import.meta.url))
const saveKey = 'cyber-bless:personal:v1'
const navigationOnly = process.env.WBR_VIEWPORT_NAV_ONLY === '1'
const selected = (key, value) => !process.env[key] || process.env[key].split(',').includes(String(value))
const viewports = [
  { name: 'phone-short', width: 320, height: 568, touch: true },
  { name: 'phone', width: 390, height: 844, touch: true },
  { name: 'desktop', width: 1280, height: 900, touch: false },
].filter(viewport => selected('WBR_VIEWPORT_WIDTHS', viewport.width))
const cases = [
  { name: 'ordinary', id: 'tanzaku-tanabata' },
  { name: 'water', id: 'tibetan-water-bowls' },
  { name: 'woodfish', id: 'woodfish' },
].filter(test => selected('WBR_VIEWPORT_CASES', test.name))
const report = {
  capturedAt: new Date().toISOString(), base: base.href, navigationOnly,
  source: 'Microsoft Edge / real App at /; browser viewport, not a native device or keyboard',
  exclusions: [{ id: 'malawi-sansi', reason: 'Hidden from the public App catalog; development-only coverage belongs to verify-sansi-play.mjs and is not a production-entry viewport claim.' }],
  results: [], failures: [], pageErrors: [],
}
await mkdir(out, { recursive: true })
const browser = await chromium.launch({
  channel: process.env.WBR_BROWSER || 'msedge', headless: process.env.WBR_HEADED !== '1',
  args: ['--enable-unsafe-swiftshader', '--no-proxy-server'],
})
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
const save = () => writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n')
const screenshot = (page, name) => page.screenshot({ path: path.join(out, `${name}.png`), fullPage: false })

async function openScene(page, id) {
  await page.goto(base.href, { waitUntil: 'domcontentloaded' })
  await page.locator('.app-shell[data-page="today"]').waitFor()
  assert.equal(await page.locator('.opening-page').count(), 0, 'legacy save must not start the opening guide')
  await page.getByRole('button', { name: '我的', exact: true }).click()
  await page.getByRole('button', { name: '场景目录', exact: true }).click()
  const card = page.locator(`.scene-card[data-scene="${id}"]`)
  for (let more = 0; !await card.count(); more++) {
    assert.ok(more < 12, `scene ${id} must be reachable from the production catalog`)
    const moreButton = page.getByRole('button', { name: '显示更多', exact: true })
    assert.ok(await moreButton.count(), `scene ${id} is absent from the public catalog; do not unhide it for a test`)
    await moreButton.click()
  }
  await card.click()
  await page.locator('.app-shell[data-page="scene"]').waitFor()
  if (id === 'woodfish') await page.locator('.woodfish-visual[data-renderer="ready"]').waitFor({ timeout: 60000 })
  else await page.locator(`.library-scene-stage[data-scene="${id}"][data-ready="true"] canvas[data-environment-ready="true"]`).waitFor({ timeout: 60000 })
  await page.evaluate(() => document.fonts.ready)
  await settle(page)
  assert.equal(new URL(page.url()).pathname, base.pathname, 'checks must remain in the real App entry point')
  const entry = await page.evaluate(() => ({ scripts: [...document.scripts].map(script => script.src).filter(Boolean), debugOverlay: !!document.querySelector('.debug-overlay') }))
  if (!navigationOnly) assert.equal(entry.debugOverlay, false, 'use a production preview so development tooling cannot cover product controls')
  entry.productionAssets = entry.scripts.some(url => /\/assets\/.*\.js(?:\?|$)/.test(url)) && !entry.scripts.some(url => url.includes('/@vite/client'))
  return entry
}

async function record(page, id) {
  return page.evaluate(({ key, id }) => JSON.parse(localStorage.getItem(key)).sceneRecords.find(scene => scene.id === id), { key: saveKey, id })
}

async function layout(page, label) {
  await settle(page)
  const metrics = await page.evaluate(() => {
    const box = element => {
      if (!element) return null
      const r = element.getBoundingClientRect(), style = getComputedStyle(element)
      return {
        x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom,
        clientHeight: element.clientHeight, scrollHeight: element.scrollHeight,
        clientWidth: element.clientWidth, scrollWidth: element.scrollWidth,
        scrollTop: element.scrollTop, overflowY: style.overflowY,
      }
    }
    const result = {
      viewport: { width: innerWidth, height: innerHeight, x: visualViewport?.offsetLeft || 0, y: visualViewport?.offsetTop || 0, visualHeight: visualViewport?.height || innerHeight },
      window: { x: scrollX, y: scrollY }, document: box(document.documentElement), body: box(document.body),
      shell: box(document.querySelector('.app-shell')), main: box(document.querySelector('main.app-content')),
      stage: box(document.querySelector('.library-scene-stage, .woodfish-object')),
      canvas: box(document.querySelector('.scene-experience canvas')),
    }
    window.__sceneViewportLastLayout = result
    return result
  })
  for (const name of ['document', 'body', 'shell', 'main']) {
    const value = metrics[name]
    assert.ok(value, `${label}: ${name} exists`)
    assert.ok(value.scrollHeight <= value.clientHeight + 2, `${label}: ${name} vertical overflow ${value.scrollHeight} > ${value.clientHeight}`)
    assert.ok(value.scrollWidth <= value.clientWidth + 2, `${label}: ${name} horizontal overflow`)
    assert.ok(Math.abs(value.scrollTop) <= 1, `${label}: ${name} scrollTop must stay zero`)
  }
  assert.ok(Math.abs(metrics.window.x) <= 1 && Math.abs(metrics.window.y) <= 1, `${label}: window must stay at its origin`)
  assert.ok(metrics.canvas?.width > 0 && metrics.canvas?.height > 0, `${label}: actual scene canvas stays visible`)
  assert.ok(metrics.canvas.y >= metrics.main.y - 2 && metrics.canvas.bottom <= metrics.main.bottom + 2, `${label}: canvas fits the fixed main region`)
  return { label, ...metrics }
}

async function reachable(locator, label) {
  const boxes = await locator.evaluateAll(elements => elements.filter(element => {
    const r = element.getBoundingClientRect(), style = getComputedStyle(element)
    return r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
  }).map(element => {
    const r = element.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2
    const target = document.elementFromPoint(x, y)
    return {
      text: element.getAttribute('aria-label') || element.textContent.trim(), x: r.x, y: r.y,
      width: r.width, height: r.height, right: r.right, bottom: r.bottom,
      visibleHeight: visualViewport?.height || innerHeight, visibleTop: visualViewport?.offsetTop || 0,
      viewportWidth: innerWidth, hit: target === element || !!target && element.contains(target),
    }
  }))
  assert.ok(boxes.length, `${label}: at least one visible control`)
  for (const b of boxes) {
    assert.ok(b.width >= 43.5 && b.height >= 43.5, `${label}: ${b.text} needs a 44px target (${b.width}x${b.height})`)
    assert.ok(b.x >= -1 && b.right <= b.viewportWidth + 1 && b.y >= b.visibleTop - 1 && b.bottom <= b.visibleTop + b.visibleHeight + 1, `${label}: ${b.text} stays in the visible viewport`)
    assert.equal(b.hit, true, `${label}: ${b.text} is unobstructed`)
  }
  return boxes
}

async function nativePan(page, viewport, label) {
  const before = await layout(page, `${label}-before-pan`)
  const from = await page.evaluate(() => {
    const r = document.querySelector('.app-shell').getBoundingClientRect()
    return [r.left + 5, Math.min(innerHeight - 24, r.bottom - 24)]
  })
  if (viewport.touch) {
    const pointer = await scenePointer(page, true)
    await pointer.down(from)
    for (let i = 1; i <= 8; i++) {
      await pointer.move([from[0], from[1] - i * 14], 1)
      await page.waitForTimeout(25)
    }
    await pointer.up()
  } else {
    await page.mouse.move(...from)
    await page.mouse.wheel(0, 300)
  }
  await page.waitForTimeout(150)
  return { before, after: await layout(page, `${label}-after-pan`) }
}

async function startMotion(page) {
  await page.evaluate(() => {
    const element = document.querySelector('.ritual-narrative-panel')
    const result = { samples: [], events: [], done: false }
    window.__sceneViewportMotion = result
    const started = performance.now()
    const event = e => {
      if (e.target === element) result.events.push({ type: e.type, property: e.propertyName, at: performance.now() - started, elapsed: e.elapsedTime * 1000 })
    }
    for (const name of ['transitionrun', 'transitionstart', 'transitionend', 'transitioncancel']) element.addEventListener(name, event)
    const sample = () => {
      const r = element.getBoundingClientRect(), style = getComputedStyle(element)
      result.samples.push({ at: performance.now() - started, x: r.x, y: r.y, width: r.width, height: r.height, radius: [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomRightRadius, style.borderBottomLeftRadius].map(parseFloat) })
      if (performance.now() - started < 800) requestAnimationFrame(sample)
      else {
        result.done = true
        for (const name of ['transitionrun', 'transitionstart', 'transitionend', 'transitioncancel']) element.removeEventListener(name, event)
      }
    }
    sample()
  })
}

async function endMotion(page) {
  await page.waitForFunction(() => window.__sceneViewportMotion?.done)
  return page.evaluate(() => window.__sceneViewportMotion)
}

function verifyMotion(motion, anchor, label) {
  assert.ok(motion.samples.length >= 3, `${label}: collect real animation frames`)
  const width = motion.samples.map(sample => sample.width), height = motion.samples.map(sample => sample.height)
  assert.ok(Math.max(...width) - Math.min(...width) > 8 || Math.max(...height) - Math.min(...height) > 8, `${label}: morph animates its dimensions`)
  for (const sample of motion.samples) {
    assert.ok(Math.abs(sample.x - anchor.x) <= 1.5 && Math.abs(sample.y - anchor.y) <= 1.5, `${label}: top-left anchor stays fixed`)
    assert.ok(sample.radius.every((radius, i) => Math.abs(radius - anchor.radius[i]) <= 0.5), `${label}: border radius stays fixed throughout motion`)
  }
  const ends = motion.events.filter(event => event.type === 'transitionend' && ['width', 'height'].includes(event.property))
  assert.ok(ends.length, `${label}: normal motion emits a dimension transition end`)
  return ends.map(event => ({ property: event.property, elapsed: event.elapsed, observed: event.at - (motion.events.find(start => start.type === 'transitionstart' && start.property === event.property)?.at || 0) }))
}

async function introduction(page, viewport, id, prefix) {
  const trigger = page.locator('.ritual-narrative-trigger'), panel = page.locator('.ritual-narrative-panel')
  await reachable(trigger, 'introduction trigger')
  const before = await layout(page, 'introduction-closed')
  const anchor = await panel.evaluate(element => {
    const r = element.getBoundingClientRect(), style = getComputedStyle(element)
    return { x: r.x, y: r.y, radius: [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomRightRadius, style.borderBottomLeftRadius].map(parseFloat), duration: style.transitionDuration }
  })
  assert.equal(await panel.getAttribute('data-reduced-motion'), null, 'animation must remain enabled for motion verification')
  await startMotion(page)
  await trigger.click()
  await page.locator('.ritual-narrative-panel[data-open="true"]').waitFor()
  const opening = await endMotion(page), openTimes = verifyMotion(opening, anchor, 'introduction opening')
  const expanded = await layout(page, 'introduction-expanded')
  assert.ok(Math.abs(before.canvas.y - expanded.canvas.y) <= 1 && Math.abs(before.canvas.height - expanded.canvas.height) <= 1, 'introduction floats without displacing the scene canvas')
  const floating = await panel.evaluate(element => {
    const r = element.getBoundingClientRect()
    return { right: r.right, bottom: r.bottom, viewportWidth: innerWidth, viewportHeight: visualViewport?.height || innerHeight, position: getComputedStyle(element).position }
  })
  assert.ok(['absolute', 'fixed'].includes(floating.position), 'introduction uses a floating shell')
  assert.ok(floating.right <= floating.viewportWidth + 1 && floating.bottom <= floating.viewportHeight + 1, 'expanded introduction fits the visual viewport')
  await screenshot(page, `${prefix}-introduction-open`)

  // Capture bubbling input at the actual underlying controls. A successful
  // outside dismissal must neither start a scene gesture nor change progress.
  const previousRecord = await record(page, id)
  const outside = await page.evaluate(() => {
    const panel = document.querySelector('.ritual-narrative-panel').getBoundingClientRect()
    window.__sceneViewportUnderlyingInput = []
    const controls = '.scene-hit-layer,.scene-bow-tap,.woodfish-object,.scene-sansi-key,.favorite-chip,.app-topbar button'
    for (const element of document.querySelectorAll(controls)) {
      for (const type of ['pointerdown', 'pointerup', 'click']) element.addEventListener(type, () => window.__sceneViewportUnderlyingInput.push(type))
    }
    const candidates = []
    for (const element of document.querySelectorAll(controls)) {
      const r = element.getBoundingClientRect()
      for (const f of [.15, .5, .85]) candidates.push([r.left + r.width * f, r.top + r.height * f])
    }
    for (const point of candidates) {
      const [x, y] = point
      if (x < 1 || x >= innerWidth - 1 || y < 1 || y >= innerHeight - 1 || x >= panel.left && x <= panel.right && y >= panel.top && y <= panel.bottom) continue
      if (document.elementFromPoint(x, y)?.closest('.ritual-narrative-backdrop')) return point
    }
    return null
  })
  assert.ok(outside, 'expanded introduction leaves an outside dismissal point above a real App control or scene input surface')
  await startMotion(page)
  if (viewport.touch) await page.touchscreen.tap(...outside)
  else await page.mouse.click(...outside)
  await page.locator('.ritual-narrative-panel[data-open="false"]').waitFor()
  const closing = await endMotion(page), closeTimes = verifyMotion(closing, anchor, 'introduction closing')
  for (const opened of openTimes) {
    const closed = closeTimes.find(event => event.property === opened.property)
    assert.ok(closed, `${opened.property}: opening and closing both animate`)
    assert.ok(Math.abs(opened.elapsed - closed.elapsed) <= 2, `${opened.property}: configured opening/closing durations match`)
    assert.ok(Math.abs(opened.observed - closed.observed) <= 85, `${opened.property}: observed opening/closing durations are symmetric`)
  }
  assert.equal(await page.locator('.ritual-narrative-backdrop').count(), 0, 'backdrop is removed after closing animation')
  assert.deepEqual(await page.evaluate(() => window.__sceneViewportUnderlyingInput), [], 'outside close must not send input through to the ritual')
  assert.deepEqual(await record(page, id), previousRecord, 'outside close must not change scene progress')
  await layout(page, 'introduction-dismissed')
  await trigger.click()
  await page.keyboard.press('Escape')
  await page.locator('.ritual-narrative-backdrop').waitFor({ state: 'detached' })
  assert.equal(await trigger.getAttribute('aria-expanded'), 'false', 'Escape also closes the introduction')
  return { anchor, floating, outside, openTimes, closeTimes, opening, closing }
}

async function finishFinite(page, id, expectedSteps, snapshots) {
  for (let step = 0; step < expectedSteps; step++) {
    const action = page.locator('.scene-bow-tap:not(:disabled)').first()
    await action.waitFor()
    await reachable(action, `${id} step ${step + 1}`)
    // Keyboard activation is the scene's supported auxiliary path; unlike a
    // click it cannot cause Playwright to scroll an off-screen control for us.
    await action.press('Enter')
    await page.waitForFunction(({ key, id, minimum }) => JSON.parse(localStorage.getItem(key)).sceneRecords.some(scene => scene.id === id && scene.progress >= minimum), { key: saveKey, id, minimum: step + 1 })
    snapshots.push(await layout(page, `${id}-step-${step + 1}`))
  }
  await page.locator('.scene-done-row').waitFor()
  assert.equal((await record(page, id)).progress, expectedSteps)
}

async function completionRow(page, label, optionalWish) {
  const row = page.locator('.scene-completion-actions')
  assert.equal(await row.count(), 1, `${label}: one shared completion action row`)
  const semantics = await row.locator('button').evaluateAll(elements => elements.filter(element => {
    const r = element.getBoundingClientRect(), style = getComputedStyle(element)
    return r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
  }).map(element => ({
    text: element.textContent.trim(), favorite: element.matches('.favorite-chip'),
    primary: element.matches('.button.primary'), wish: element.matches('.scene-wish-invite'),
    openingCollect: element.hasAttribute('data-opening-collect'),
  })))
  assert.equal(semantics.length, optionalWish ? 3 : 2, `${label}: only eligible walks expose the third wish action`)
  assert.equal(semantics[0].favorite, true, `${label}: favorite is first in DOM and keyboard order`)
  assert.equal(semantics[0].text, '收藏', `${label}: favorite keeps its concise label`)
  assert.equal(semantics[1].primary, true, `${label}: the primary completion/collect action follows favorite`)
  if (semantics[1].openingCollect) assert.equal(semantics[1].text, '收下', `${label}: opening collect has no trailing instruction`)
  assert.equal(await page.locator('.scene-wish-invite').count(), optionalWish ? 1 : 0, `${label}: no separate duplicate wish invitation`)
  if (optionalWish) {
    assert.equal(semantics[2].wish, true, `${label}: the optional wish action is third in the same row`)
    assert.equal(semantics[2].text, '祈愿', `${label}: optional wish invitation uses its new concise label`)
  }
  const buttons = await reachable(row.locator('button'), label)
  for (let index = 1; index < buttons.length; index++) {
    const previous = buttons[index - 1], current = buttons[index]
    assert.ok(previous.right <= current.x + 1, `${label}: completion actions read left to right without overlap`)
    assert.ok(Math.abs(previous.y + previous.height / 2 - current.y - current.height / 2) <= 1.5, `${label}: all completion actions stay on one horizontal row`)
  }
  return { semantics, buttons }
}

async function completion(page, id, prefix, optionalWish) {
  const snapshots = [await layout(page, `${id}-completed`)]
  const controls = await completionRow(page, `${id} completion actions`, optionalWish)
  await screenshot(page, `${prefix}-completed`)
  const reward = page.locator(`.scene-reward-reveal[data-scene="${id}"]`)
  // The component is decorative and must not capture the completion controls.
  const rewardSeen = await reward.count() > 0
  assert.equal(rewardSeen, true, 'the first completion transition shows its decorative keepsake')
  await page.evaluate(() => {
    const result = { samples: [], done: false }
    window.__sceneViewportReward = result
    const started = performance.now()
    const sample = () => {
      const reveal = document.querySelector('.scene-reward-reveal'), item = reveal?.querySelector('.scene-reward-reveal__item')
      if (!reveal || !item) { result.done = true; result.disappearedAt = performance.now() - started; return }
      const r = item.getBoundingClientRect(), style = getComputedStyle(item)
      result.samples.push({ at: performance.now() - started, phase: reveal.dataset.phase, y: r.y, height: r.height, opacity: Number(style.opacity), pointerEvents: getComputedStyle(reveal).pointerEvents })
      if (performance.now() - started < 6500) requestAnimationFrame(sample)
      else result.done = true
    }
    sample()
  })
  let wishControls, rowAfterCancel, rowAfterSave
  if (optionalWish) {
    const invite = page.locator('.scene-wish-invite')
    await reachable(invite, 'optional wish invitation')
    await invite.click()
    const input = page.locator('.scene-post-wish input')
    await input.fill('愿牵挂的人平安')
    wishControls = await reachable(page.locator('.scene-post-wish button'), 'optional wish form controls')
    snapshots.push(await layout(page, `${id}-wish-open`))
    await screenshot(page, `${prefix}-wish-open`)
    await page.locator('.scene-wish-cancel').click()
    snapshots.push(await layout(page, `${id}-wish-cancelled`))
    rowAfterCancel = await completionRow(page, 'completion actions after cancelling a wish', true)
    await invite.click()
    assert.equal(await input.inputValue(), '', 'cancel discards only the optional draft')
    await input.fill('愿牵挂的人平安')
    await page.locator('.scene-post-wish button[type="submit"]').click()
    await page.locator('.scene-post-wish input').waitFor({ state: 'detached' })
    assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).wishes.length, saveKey), 1, 'only explicit submit saves the optional wish')
    snapshots.push(await layout(page, `${id}-wish-saved`))
    rowAfterSave = await completionRow(page, 'completion actions after saving a wish', false)
  }
  await reward.waitFor({ state: 'detached', timeout: 6500 })
  await page.waitForFunction(() => window.__sceneViewportReward?.done)
  const rewardMotion = await page.evaluate(() => window.__sceneViewportReward)
  const hold = rewardMotion.samples.filter(sample => sample.phase === 'hold'), leave = rewardMotion.samples.filter(sample => sample.phase === 'leave')
  assert.ok(hold.length && leave.length, 'reward visibly holds and leaves before disappearing')
  assert.ok(rewardMotion.samples.every(sample => sample.pointerEvents === 'none'), 'reward animation never intercepts controls')
  assert.ok(leave.at(-1).y < hold[0].y - 25, 'reward moves upward as it leaves')
  assert.ok(leave.at(-1).opacity < 0.15, 'reward fades before removal')
  snapshots.push(await layout(page, `${id}-reward-gone`))
  return { controls, optionalWish, wishControls, rowAfterCancel, rowAfterSave, rewardSeen, rewardMotion, snapshots }
}

try {
  for (const viewport of viewports) for (const test of cases) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, hasTouch: viewport.touch, isMobile: viewport.touch, reducedMotion: 'no-preference', locale: 'zh-CN' })
    const page = await context.newPage(), errors = [], prefix = `${viewport.width}x${viewport.height}-${test.name}`
    page.setDefaultTimeout(30000)
    page.on('pageerror', error => errors.push(error.message))
    // A genuine old v1 save has no opening field: it must keep its established
    // navigation. Sound is off, while both CSS and Three.js motion remain on.
    await page.addInitScript(key => localStorage.setItem(key, JSON.stringify({ version: 1, sceneRecords: [], wishes: [], activeSession: null, sessions: [], collectibles: [], ledger: [], settings: { sound: false, haptics: false, reducedMotion: false } })), saveKey)
    const result = { viewport, case: test.name, id: test.id, snapshots: [] }
    try {
      result.entry = await openScene(page, test.id)
      if (!navigationOnly) {
        result.snapshots.push(await layout(page, `${test.name}-entry`))
        result.pan = await nativePan(page, viewport, test.name)
        if (test.name === 'ordinary') {
          result.introduction = await introduction(page, viewport, test.id, prefix)
          await finishFinite(page, test.id, 3, result.snapshots)
          result.completion = await completion(page, test.id, prefix, true)
        } else if (test.name === 'water') {
          assert.equal(await page.locator('.scene-step-dot').count(), 9, 'all nine water-bowl steps are represented')
          await finishFinite(page, test.id, 9, result.snapshots)
          result.completion = await completion(page, test.id, prefix, false)
        } else if (test.name === 'woodfish') {
          const strike = page.locator('button.woodfish-object'), finish = page.locator('.scene-woodfish-finish')
          await reachable(strike, 'woodfish strike surface')
          for (let count = 0; !await finish.count(); count++) {
            assert.ok(count < 30, 'woodfish exposes its finish action after the minimum')
            await strike.press('Enter')
          }
          const minimum = await record(page, test.id)
          await reachable(finish, 'woodfish manual finish')
          result.snapshots.push(await layout(page, 'woodfish-minimum-reached'))
          for (let extra = 0; extra < 3; extra++) await strike.press('Enter')
          const continued = await record(page, test.id)
          assert.equal(continued.strikes, minimum.strikes + 3, 'woodfish keeps accepting strikes after the minimum')
          assert.equal(continued.progress, minimum.progress, 'extra strikes do not auto-complete the ritual')
          assert.equal(await page.locator('.scene-done-row').count(), 0)
          await screenshot(page, `${prefix}-continue`)
          await finish.press('Enter')
          await page.locator('.scene-done-row').waitFor()
          result.minimum = minimum; result.continued = continued
          result.completion = await completion(page, test.id, prefix, false)
        }
      }
      assert.deepEqual(errors, [], 'browser page errors')
      await screenshot(page, `${prefix}-${navigationOnly ? 'navigation' : 'final'}`)
      report.results.push(result)
      console.log(`PASS ${prefix}${navigationOnly ? ' navigation' : ''}`)
    } catch (error) {
      const failure = { viewport, case: test.name, id: test.id, message: error.message, stack: error.stack, lastLayout: await page.evaluate(() => window.__sceneViewportLastLayout).catch(() => undefined), partial: result }
      report.failures.push(failure)
      await screenshot(page, `${prefix}-failure`).catch(() => {})
      console.error(`FAIL ${prefix}: ${error.message}`)
    } finally {
      report.pageErrors.push(...errors.map(message => ({ viewport: viewport.name, case: test.name, message })))
      await save()
      await context.close()
    }
  }
} finally {
  await save()
  await browser.close()
}
assert.deepEqual(report.failures.map(({ partial, stack, ...failure }) => failure), [], 'scene viewport regressions; see artifacts/scene-viewport-motion/report.json')
assert.deepEqual(report.pageErrors, [], 'browser page errors')
console.log(JSON.stringify({ checks: report.results.length, failures: report.failures.length, output: out }))
