// Production-entry checks for the scene-header settings shell. Run after build:
//   WBR_URL=http://127.0.0.1:4174 node scripts/verify-feedback-menu.mjs
// Optional: WBR_FEEDBACK_WIDTHS=320,390 WBR_BROWSER=msedge WBR_HEADED=1
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const base = new URL(process.env.WBR_URL || 'http://127.0.0.1:4174')
const out = fileURLToPath(new URL('../artifacts/feedback-menu-2026-10-25/', import.meta.url))
const saveKey = 'cyber-bless:personal:v1', sceneId = 'tanzaku-tanabata'
const shellSelector = '.feedback-controls', gearSelector = '.feedback-controls-trigger'
const viewports = [
  { name: 'phone-short', width: 320, height: 568, touch: true },
  { name: 'phone', width: 390, height: 844, touch: true },
  { name: 'desktop', width: 1132, height: 1244, touch: false },
].filter(viewport => !process.env.WBR_FEEDBACK_WIDTHS || process.env.WBR_FEEDBACK_WIDTHS.split(',').includes(String(viewport.width)))
const report = {
  capturedAt: new Date().toISOString(), base: base.href,
  source: 'Microsoft Edge / production App at /, actual browser mouse or native touch input',
  scope: 'Browser viewports; saved sound/haptics settings and host capability are checked, not physical speaker or vibration output.',
  results: [], failures: [], pageErrors: [],
}
await mkdir(out, { recursive: true })
const save = () => writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n')
const screenshot = (page, name) => page.screenshot({ path: path.join(out, `${name}.png`), fullPage: false })
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
const browser = await chromium.launch({
  channel: process.env.WBR_BROWSER || 'msedge', headless: process.env.WBR_HEADED !== '1',
  args: ['--no-proxy-server', '--enable-unsafe-swiftshader'],
})

async function activate(locator, viewport) {
  if (viewport.touch) await locator.tap()
  else await locator.click()
}
async function pointClick(page, viewport, point) {
  if (viewport.touch) await page.touchscreen.tap(...point)
  else await page.mouse.click(...point)
}
async function savedState(page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)), saveKey)
}
async function openScene(page, viewport) {
  await page.goto(base.href, { waitUntil: 'domcontentloaded' })
  await page.locator('.app-shell[data-page="today"]').waitFor()
  assert.equal(await page.locator('.opening-page').count(), 0, 'the genuine v1 seed keeps established navigation')
  await activate(page.getByRole('button', { name: '我的', exact: true }), viewport)
  await activate(page.getByRole('button', { name: '场景目录', exact: true }), viewport)
  const card = page.locator(`.scene-card[data-scene="${sceneId}"]`)
  for (let more = 0; !await card.count(); more++) {
    assert.ok(more < 12, 'scene is reachable through the public catalog')
    const moreButton = page.getByRole('button', { name: '显示更多', exact: true })
    assert.ok(await moreButton.count(), 'the scene must stay in the public catalog')
    await activate(moreButton, viewport)
  }
  await activate(card, viewport)
  await page.locator('.app-shell[data-page="scene"]').waitFor()
  await page.locator(`.library-scene-stage[data-scene="${sceneId}"][data-ready="true"] canvas[data-environment-ready="true"]`).waitFor({ timeout: 60000 })
  // The renderer registers this control through an external store after canvas
  // setup. Require the real hidden entry before starting any shell animation.
  await page.locator('.feedback-controls-options .visual-style-anchor > button[aria-label="视觉风格"]').waitFor({ state: 'attached', timeout: 60000 })
  await page.evaluate(() => document.fonts.ready)
  await settle(page)
  assert.equal(new URL(page.url()).pathname, base.pathname, 'use the real App entry point throughout')
  const entry = await page.evaluate(() => ({ scripts: [...document.scripts].map(script => script.src).filter(Boolean), debugOverlay: !!document.querySelector('.debug-overlay'), canHaptic: typeof navigator.vibrate === 'function' }))
  assert.equal(entry.debugOverlay, false, 'production preview has no developer overlay')
  assert.ok(entry.scripts.some(url => /\/assets\/.*\.js(?:\?|$)/.test(url)), 'production assets are loaded')
  assert.ok(!entry.scripts.some(url => url.includes('/@vite/client')), 'development entry is excluded')
  return entry
}

async function layout(page, label) {
  await settle(page)
  const metrics = await page.evaluate(() => {
    const box = element => {
      if (!element) return null
      const r = element.getBoundingClientRect(), style = getComputedStyle(element)
      return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom, clientHeight: element.clientHeight, scrollHeight: element.scrollHeight, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, scrollTop: element.scrollTop, overflowY: style.overflowY }
    }
    const result = {
      viewport: { width: innerWidth, height: innerHeight }, window: { x: scrollX, y: scrollY },
      document: box(document.documentElement), body: box(document.body), shell: box(document.querySelector('.app-shell')), main: box(document.querySelector('main.app-content')),
      menu: box(document.querySelector('.feedback-controls')), canvas: box(document.querySelector('.scene-experience canvas')),
      focus: document.activeElement?.outerHTML?.slice(0, 350), bodyOverflow: document.body.style.overflow, shellOverflow: document.querySelector('.app-shell').style.overflow,
      inertNodes: [...document.querySelectorAll('.app-shell [inert]')].filter(element => !element.closest('.feedback-controls-options')).map(element => ({ tag: element.tagName, className: element.className, id: element.id, ariaHidden: element.getAttribute('aria-hidden') })),
      sceneLoadError: document.querySelector('.scene-load-error')?.textContent?.trim() || null,
    }
    window.__feedbackLastLayout = result
    return result
  })
  for (const name of ['document', 'body', 'shell', 'main']) {
    const value = metrics[name]
    assert.ok(value, `${label}: ${name} exists`)
    assert.ok(value.scrollHeight <= value.clientHeight + 2, `${label}: ${name} has no vertical page overflow (${value.scrollHeight}/${value.clientHeight})`)
    assert.ok(value.scrollWidth <= value.clientWidth + 2, `${label}: ${name} has no horizontal page overflow`)
    assert.ok(Math.abs(value.scrollTop) <= 1, `${label}: ${name} stays at scrollTop zero`)
  }
  assert.ok(Math.abs(metrics.window.x) <= 1 && Math.abs(metrics.window.y) <= 1, `${label}: window stays at its origin`)
  assert.equal(metrics.sceneLoadError, null, `${label}: renderer remains healthy; ${metrics.sceneLoadError}`)
  assert.ok(metrics.canvas?.width > 0 && metrics.canvas?.height > 0, `${label}: scene canvas remains visible`)
  return { label, ...metrics }
}
async function reachable(locator, label) {
  const boxes = await locator.evaluateAll(elements => elements.map(element => {
    const r = element.getBoundingClientRect(), target = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    return { label: element.getAttribute('aria-label') || element.textContent.trim(), x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom, viewportWidth: innerWidth, viewportHeight: innerHeight, hit: target === element || !!target && element.contains(target) }
  }))
  assert.ok(boxes.length, `${label}: visible controls exist`)
  for (const box of boxes) {
    assert.ok(box.width >= 43.5 && box.height >= 43.5, `${label}: ${box.label} has a 44px touch target (${box.width}x${box.height})`)
    assert.ok(box.x >= -1 && box.y >= -1 && box.right <= box.viewportWidth + 1 && box.bottom <= box.viewportHeight + 1, `${label}: ${box.label} fits the viewport`)
    assert.equal(box.hit, true, `${label}: ${box.label} is unobstructed`)
  }
  return boxes
}
async function shellState(page) {
  return page.locator(shellSelector).evaluate(element => {
    const rect = element.getBoundingClientRect(), style = getComputedStyle(element), gear = element.querySelector('.feedback-controls-trigger'), gs = getComputedStyle(gear)
    return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height, radius: [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomRightRadius, style.borderBottomLeftRadius].map(parseFloat), property: style.transitionProperty, duration: style.transitionDuration, timing: style.transitionTimingFunction, gear: { pressed: gear.getAttribute('aria-pressed'), expanded: gear.getAttribute('aria-expanded'), transform: gs.transform, glyphTranslate: getComputedStyle(gear.querySelector('svg')).translate, background: gs.background, boxShadow: gs.boxShadow } }
  })
}
async function assertClosed(page, label) {
  const gear = page.locator(gearSelector)
  assert.equal(await gear.getAttribute('aria-pressed'), 'false', `${label}: gear is released`)
  assert.equal(await gear.getAttribute('aria-expanded'), 'false', `${label}: collapsed state is accessible`)
  assert.deepEqual(await page.locator(shellSelector).getByRole('button').evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-label'))), ['仪式设置'], `${label}: only the gear is exposed initially`)
  assert.equal(await page.evaluate(() => !!document.activeElement?.closest('.feedback-controls-options')), false, `${label}: focus does not remain in hidden settings`)
  const state = await shellState(page)
  assert.ok(Math.abs(state.height - state.width) <= 0.5, `${label}: the closed shell is square`)
  return state
}

async function startMotion(page, name, duration = 760) {
  await page.evaluate(({ selector, name, duration }) => {
    const element = document.querySelector(selector), started = performance.now()
    const result = { samples: [], events: [], done: false }
    window.__feedbackMotion ||= {}; window.__feedbackMotion[name] = result
    const event = e => { if (e.target === element) result.events.push({ type: e.type, property: e.propertyName, at: performance.now() - started, elapsed: e.elapsedTime * 1000 }) }
    for (const type of ['transitionrun', 'transitionstart', 'transitionend', 'transitioncancel']) element.addEventListener(type, event)
    const sample = () => {
      const r = element.getBoundingClientRect(), style = getComputedStyle(element)
      const scroll = [document.documentElement, document.body, document.querySelector('.app-shell'), document.querySelector('main.app-content')].map(item => ({ height: item.clientHeight, scrollHeight: item.scrollHeight, width: item.clientWidth, scrollWidth: item.scrollWidth, top: item.scrollTop }))
      result.samples.push({ at: performance.now() - started, x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, radius: [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomRightRadius, style.borderBottomLeftRadius].map(parseFloat), scroll, window: { x: scrollX, y: scrollY } })
      if (performance.now() - started < duration) requestAnimationFrame(sample)
      else {
        result.done = true
        for (const type of ['transitionrun', 'transitionstart', 'transitionend', 'transitioncancel']) element.removeEventListener(type, event)
      }
    }
    sample()
  }, { selector: shellSelector, name, duration })
}
async function endMotion(page, name) {
  await page.waitForFunction(name => window.__feedbackMotion?.[name]?.done, name)
  return page.evaluate(name => window.__feedbackMotion[name], name)
}
function verifyAnchors(motion, anchor, label) {
  assert.ok(motion.samples.length >= 3, `${label}: actual animation frames are collected`)
  for (const sample of motion.samples) {
    for (const key of ['width', 'y', 'right']) assert.ok(Math.abs(sample[key] - anchor[key]) <= 0.6, `${label}: shell ${key} is fixed throughout animation`)
    assert.ok(sample.radius.every(radius => Math.abs(radius - 24) <= 0.5), `${label}: all four 24px corner radii stay fixed`)
    for (const scroll of sample.scroll) {
      assert.ok(scroll.scrollHeight <= scroll.height + 2 && scroll.scrollWidth <= scroll.width + 2 && Math.abs(scroll.top) <= 1, `${label}: no page scrolling during animation`)
    }
    assert.ok(Math.abs(sample.window.x) <= 1 && Math.abs(sample.window.y) <= 1, `${label}: window stays at its origin during animation`)
  }
}
function verifyMotion(motion, anchor, direction, label) {
  verifyAnchors(motion, anchor, label)
  const first = motion.samples[0].height, last = motion.samples.at(-1).height
  assert.ok(direction * (last - first) >= 90, `${label}: shell visibly changes height`)
  const middle = motion.samples.filter(sample => sample.height > Math.min(first, last) + 1 && sample.height < Math.max(first, last) - 1)
  assert.ok(new Set(middle.map(sample => sample.height.toFixed(2))).size >= 3, `${label}: height changes continuously through intermediate frames`)
  for (let index = 1; index < motion.samples.length; index++) assert.ok(direction * (motion.samples[index].height - motion.samples[index - 1].height) >= -0.75, `${label}: height moves smoothly in one direction`)
  const ended = motion.events.find(event => event.type === 'transitionend' && ['height', 'block-size'].includes(event.property))
  assert.ok(ended, `${label}: normal height motion finishes`)
  assert.ok(Math.abs(ended.elapsed - 420) <= 2, `${label}: height transition is exactly 420ms (${ended.elapsed})`)
  const started = motion.events.find(event => event.type === 'transitionstart' && event.property === ended.property)
  return { cssDuration: ended.elapsed, observedDuration: ended.at - started.at, intermediateFrames: middle.length }
}
function verifyTransition(state) {
  const properties = state.property.split(',').map(value => value.trim()), durations = state.duration.split(',').map(value => parseFloat(value) * 1000)
  const easings = state.timing.match(/cubic-bezier\([^)]*\)|[\w-]+/g)
  const index = properties.findIndex(property => ['height', 'block-size', 'all'].includes(property))
  assert.ok(index >= 0, 'shell declares a height transition')
  assert.equal(durations[index % durations.length], 420, 'height transition declares 420ms')
  assert.ok(['ease-in-out', 'cubic-bezier(0.42, 0, 0.58, 1)'].includes(easings[index % easings.length]), `height uses ease-in-out (${state.timing})`)
}

async function outsideDismiss(page, viewport, anchor, name) {
  const before = await savedState(page), route = page.url()
  const point = await page.evaluate(() => {
    window.__feedbackUnderlyingInput = []
    for (const element of document.querySelectorAll('.back-button,.favorite-chip,.scene-hit-layer,.scene-bow-tap,.scene-action')) {
      for (const type of ['pointerdown', 'pointerup', 'click']) element.addEventListener(type, () => window.__feedbackUnderlyingInput.push({ type, className: element.className }))
    }
    const r = document.querySelector('.back-button').getBoundingClientRect()
    return [r.x + r.width / 2, r.y + r.height / 2]
  })
  await startMotion(page, name)
  await pointClick(page, viewport, point)
  await page.waitForTimeout(170)
  await screenshot(page, `${viewport.width}x${viewport.height}-closing`)
  const motion = await endMotion(page, name), timing = verifyMotion(motion, anchor, -1, name)
  assert.deepEqual(await page.evaluate(() => window.__feedbackUnderlyingInput), [], 'outside dismissal consumes pointerdown, pointerup and click before the underlying App control')
  assert.deepEqual(await savedState(page), before, 'outside dismissal does not change scene progress, favorites or saved data')
  assert.equal(page.url(), route, 'outside dismissal does not change the URL')
  assert.equal(await page.locator('.app-shell').getAttribute('data-page'), 'scene', 'outside dismissal does not navigate back')
  await assertClosed(page, name)
  return { point, motion, timing }
}

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, hasTouch: viewport.touch, isMobile: viewport.touch, reducedMotion: 'no-preference', locale: 'zh-CN' })
    const page = await context.newPage(), errors = [], consoleMessages = [], prefix = `${viewport.width}x${viewport.height}`
    page.setDefaultTimeout(30000)
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (['error', 'warning'].includes(message.type())) consoleMessages.push({ type: message.type(), text: message.text() }) })
    await page.addInitScript(key => localStorage.setItem(key, JSON.stringify({ version: 1, sceneRecords: [], wishes: [], activeSession: null, sessions: [], collectibles: [], ledger: [], settings: { sound: false, haptics: false, reducedMotion: false } })), saveKey)
    const result = { viewport, snapshots: [], consoleMessages }
    try {
      result.entry = await openScene(page, viewport)
      const gear = page.locator(gearSelector), options = page.locator('.feedback-controls-options')
      result.closed = await assertClosed(page, 'entry')
      verifyTransition(result.closed)
      result.gearTarget = await reachable(gear, 'gear')
      result.snapshots.push(await layout(page, 'entry'))
      await screenshot(page, `${prefix}-closed`)

      await startMotion(page, 'opening')
      await activate(gear, viewport)
      await page.waitForTimeout(170)
      await screenshot(page, `${prefix}-opening`)
      result.opening = await endMotion(page, 'opening')
      result.openTiming = verifyMotion(result.opening, result.closed, 1, 'opening')
      result.expanded = await shellState(page)
      assert.equal(result.expanded.gear.pressed, 'true', 'expanded gear stays pressed after input release')
      assert.equal(result.expanded.gear.expanded, 'true', 'expanded gear reports its expanded state')
      assert.notDeepEqual({ transform: result.expanded.gear.transform, background: result.expanded.gear.background, boxShadow: result.expanded.gear.boxShadow }, { transform: result.closed.gear.transform, background: result.closed.gear.background, boxShadow: result.closed.gear.boxShadow }, 'persistent pressed gear has a visible pressed treatment')
      assert.ok(result.expanded.gear.boxShadow.includes('inset'), 'persistent pressed gear has a recessed shadow after input release')
      result.controls = await reachable(options.getByRole('button'), 'expanded settings')
      assert.deepEqual(result.controls.map(control => control.label), result.entry.canHaptic ? ['音效', '震动', '视觉风格'] : ['音效', '视觉风格'], 'only supported controls appear in their intended order')
      for (let index = 1; index < result.controls.length; index++) {
        assert.ok(result.controls[index].y >= result.controls[index - 1].bottom - 0.5, 'settings are vertically stacked')
        assert.ok(Math.abs(result.controls[index].x - result.controls[0].x) <= 0.5, 'settings share one column')
      }
      result.snapshots.push(await layout(page, 'expanded'))
      await screenshot(page, `${prefix}-expanded`)
      assert.ok(Math.abs(result.snapshots[0].canvas.y - result.snapshots.at(-1).canvas.y) <= 0.5 && Math.abs(result.snapshots[0].canvas.height - result.snapshots.at(-1).canvas.height) <= 0.5, 'menu floats without displacing the scene canvas')

      await activate(options.getByRole('button', { name: '音效', exact: true }), viewport)
      assert.equal(await options.getByRole('button', { name: '音效', exact: true }).getAttribute('aria-pressed'), 'true', 'sound toggle updates accessibly')
      await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).settings.sound === true, saveKey)
      assert.equal(await gear.getAttribute('aria-expanded'), 'true', 'sound selection keeps settings open')
      if (result.entry.canHaptic) {
        await activate(options.getByRole('button', { name: '震动', exact: true }), viewport)
        await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).settings.haptics === true, saveKey)
        assert.equal(await options.getByRole('button', { name: '震动', exact: true }).getAttribute('aria-pressed'), 'true', 'supported vibration setting updates')
        assert.equal(await gear.getAttribute('aria-expanded'), 'true', 'vibration selection keeps settings open')
      }
      result.snapshots.push(await layout(page, 'settings-changed'))
      result.outside = await outsideDismiss(page, viewport, result.closed, 'outside-closing')
      assert.equal(result.outside.timing.cssDuration, result.openTiming.cssDuration, 'open and outside-close timing are symmetric')
      result.snapshots.push(await layout(page, 'outside-closed'))
      await screenshot(page, `${prefix}-outside-closed`)

      await activate(gear, viewport)
      await page.waitForTimeout(480)
      await startMotion(page, 'gear-closing')
      await activate(gear, viewport)
      result.gearClosing = await endMotion(page, 'gear-closing')
      result.gearCloseTiming = verifyMotion(result.gearClosing, result.closed, -1, 'gear-closing')
      assert.equal(result.gearCloseTiming.cssDuration, result.openTiming.cssDuration, 'gear close uses the same duration as opening')
      await assertClosed(page, 'gear-closed')

      const gearBox = await gear.boundingBox(), gearPoint = [gearBox.x + gearBox.width / 2, gearBox.y + gearBox.height / 2]
      await startMotion(page, 'rapid', 1100)
      for (const delay of [80, 70, 90, 0]) {
        await pointClick(page, viewport, gearPoint)
        if (delay) await page.waitForTimeout(delay)
      }
      result.rapid = await endMotion(page, 'rapid')
      verifyAnchors(result.rapid, result.closed, 'rapid reversals')
      await assertClosed(page, 'rapid-final')
      result.snapshots.push(await layout(page, 'rapid-final'))

      await activate(gear, viewport)
      await page.waitForTimeout(480)
      const baseline = await layout(page, 'before-visual-style')
      await activate(options.getByRole('button', { name: '视觉风格', exact: true }), viewport)
      const dialog = page.getByRole('dialog', { name: '视觉风格', exact: true })
      await dialog.waitFor()
      result.snapshots.push(await layout(page, 'visual-style-open'))
      assert.equal(await gear.getAttribute('aria-expanded'), 'true', 'opening the visual child dialog preserves the parent menu')
      const beforeVisual = await savedState(page)
      await activate(dialog.locator('button[data-style="gouache"]'), viewport)
      const scopeDialog = page.getByRole('dialog', { name: '应用视觉风格', exact: true })
      await scopeDialog.waitFor()
      assert.deepEqual(await savedState(page), beforeVisual, 'previewing a style does not save it before scope confirmation')
      result.scopeTargets = await reachable(scopeDialog.getByRole('button'), 'visual style scope')
      assert.deepEqual(result.scopeTargets.map(control => control.label), ['仅当前仪式', '应用到全部仪式', '取消'], 'scope confirmation exposes both application ranges and cancellation')
      assert.equal(await gear.getAttribute('aria-expanded'), 'true', 'scope confirmation keeps the parent settings open')
      await screenshot(page, `${prefix}-visual-style-scope`)
      await activate(scopeDialog.getByRole('button', { name: '取消', exact: true }), viewport)
      await dialog.waitFor()
      assert.deepEqual(await savedState(page), beforeVisual, 'canceling a scope choice preserves the host save')
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-style')), 'gouache', 'canceling scope confirmation returns focus to the selected tile')
      await activate(dialog.locator('button[data-style="gouache"]'), viewport)
      await scopeDialog.waitFor()
      await activate(scopeDialog.getByRole('button', { name: '仅当前仪式', exact: true }), viewport)
      await dialog.waitFor()
      assert.equal(await dialog.locator('button[data-style="gouache"]').getAttribute('aria-pressed'), 'true', 'a visual style can be selected through the child dialog')
      await page.waitForFunction(({ key, id }) => JSON.parse(localStorage.getItem(key)).visualStyles?.[id]?.style === 'gouache', { key: saveKey, id: sceneId })
      await screenshot(page, `${prefix}-visual-style`)
      await activate(dialog.getByRole('button', { name: '关闭视觉风格', exact: true }), viewport)
      await dialog.waitFor({ state: 'detached' })
      assert.equal(await gear.getAttribute('aria-expanded'), 'true', 'closing the visual dialog returns to the open parent menu')
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), '视觉风格', 'child dialog returns focus to its visible trigger')
      let restored = await layout(page, 'visual-style-closed')
      assert.equal(restored.bodyOverflow, baseline.bodyOverflow, 'visual close restores body scroll lock')
      assert.equal(restored.shellOverflow, baseline.shellOverflow, 'visual close restores shell scroll lock')
      await activate(gear, viewport)
      await page.waitForTimeout(480)
      await assertClosed(page, 'visual-parent-closed')
      restored = await layout(page, 'visual-parent-closed')
      assert.equal(restored.bodyOverflow, baseline.bodyOverflow, 'parent close leaves no body scroll lock')
      assert.equal(restored.shellOverflow, baseline.shellOverflow, 'parent close leaves no shell scroll lock')
      assert.deepEqual(restored.inertNodes, result.snapshots[0].inertNodes, 'parent close restores the original inert nodes, including the already closed introduction')
      assert.equal(await page.locator('.visual-style-backdrop').count(), 0, 'no visual dialog backdrop remains')
      result.snapshots.push(restored)
      await screenshot(page, `${prefix}-final`)
      await activate(page.locator('.back-button'), viewport)
      await page.locator('.app-shell[data-page="scenes"]').waitFor()
      result.closedCleanupNavigation = await page.locator('.app-shell').getAttribute('data-page')
      assert.equal(result.closedCleanupNavigation, 'scenes', 'after closing, the next intentional Back works without a lingering input or focus trap')
      assert.deepEqual(errors, [], 'browser page errors')
      report.results.push(result)
      console.log(`PASS ${prefix}`)
    } catch (error) {
      report.failures.push({ viewport, message: error.message, stack: error.stack, lastLayout: await page.evaluate(() => window.__feedbackLastLayout).catch(() => undefined), sceneLoadError: await page.locator('.scene-load-error').allTextContents().catch(() => undefined), inertNodes: await page.locator('.app-shell [inert]').evaluateAll(elements => elements.map(element => ({ tag: element.tagName, className: element.className, id: element.id, ariaHidden: element.getAttribute('aria-hidden') }))).catch(() => undefined), partial: result })
      await screenshot(page, `${prefix}-failure`).catch(() => {})
      console.error(`FAIL ${prefix}: ${error.message}`)
    } finally {
      report.pageErrors.push(...errors.map(message => ({ viewport: viewport.name, message })))
      await save()
      await context.close()
    }
  }
} finally {
  await save()
  await browser.close()
}
assert.deepEqual(report.failures.map(({ stack, partial, ...failure }) => failure), [], 'feedback menu regressions; see artifacts/feedback-menu-2026-10-25/report.json')
assert.deepEqual(report.pageErrors, [], 'browser page errors')
console.log(JSON.stringify({ checks: report.results.length, failures: report.failures.length, output: out }))
