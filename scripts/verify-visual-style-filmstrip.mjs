// Build first, then run against the production preview:
//   WBR_URL=http://127.0.0.1:4174 node scripts/verify-visual-style-filmstrip.mjs
// Optional: WBR_BROWSER=msedge WBR_HEADED=1 WBR_FILMSTRIP_WIDTHS=320,390
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { visualStyleOptions } from '../packages/core/src/visual-style.ts'
import { installThumbnailTelemetry, realThumbnailEvidence, sceneCanvasMetrics } from './visual-style-thumbnail-checks.mjs'

const base = new URL(process.env.WBR_URL || 'http://127.0.0.1:4174')
const out = fileURLToPath(new URL('../artifacts/visual-style-filmstrip-2026-10-28/', import.meta.url))
const saveKey = 'cyber-bless:personal:v1', sceneId = 'tanzaku-tanabata'
const stripSelector = '.visual-style-grid.visual-style-filmstrip'
const viewports = [
  { name: 'phone-short', width: 320, height: 568, touch: true },
  { name: 'phone', width: 390, height: 844, touch: true },
  { name: 'phone-landscape', width: 844, height: 390, touch: true },
  { name: 'desktop-narrow', width: 1000, height: 800, touch: false },
  { name: 'desktop', width: 1132, height: 900, touch: false },
].filter(item => !process.env.WBR_FILMSTRIP_WIDTHS || process.env.WBR_FILMSTRIP_WIDTHS.split(',').includes(String(item.width)))
const report = { capturedAt: new Date().toISOString(), base: base.href,
  scope: 'Production App navigation and browser touch/mouse/keyboard input. Layout checks do not validate cultural claims or physical mobile hardware.',
  results: [], failures: [], pageErrors: [] }
await mkdir(out, { recursive: true })
const save = () => writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n')
const browser = await chromium.launch({ channel: process.env.WBR_BROWSER || 'msedge', headless: process.env.WBR_HEADED !== '1',
  args: ['--no-proxy-server', '--enable-unsafe-swiftshader'] })
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
const screenshot = (page, name) => page.screenshot({ path: path.join(out, `${name}.png`), fullPage: false })
const activate = (locator, viewport) => viewport.touch ? locator.tap() : locator.click()
const saved = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), saveKey)

async function openScene(page, viewport) {
  await page.goto(base.href, { waitUntil: 'domcontentloaded' })
  await page.locator('.app-shell[data-page="today"]').waitFor()
  assert.equal(await page.locator('.opening-page').count(), 0, 'established v1 save enters normal navigation')
  await activate(page.getByRole('button', { name: '我的', exact: true }), viewport)
  await activate(page.getByRole('button', { name: '场景目录', exact: true }), viewport)
  const card = page.locator(`.scene-card[data-scene="${sceneId}"]`)
  for (let more = 0; !await card.count(); more++) {
    assert.ok(more < 12, 'fixture scene remains reachable through the public catalog')
    await activate(page.getByRole('button', { name: '显示更多', exact: true }), viewport)
  }
  await activate(card, viewport)
  await page.locator(`.library-scene-stage[data-scene="${sceneId}"][data-ready="true"] canvas[data-environment-ready="true"]`).waitFor({ timeout: 60000 })
  await page.locator('.feedback-controls-options .visual-style-anchor > button').waitFor({ state: 'attached', timeout: 60000 })
  await page.evaluate(() => document.fonts.ready)
  assert.equal(await page.locator('.debug-overlay').count(), 0, 'production entry excludes the developer shader panel')
  assert.ok(await page.evaluate(() => [...document.scripts].some(script => /\/assets\/.*\.js(?:\?|$)/.test(script.src))), 'production assets are loaded')
  await activate(page.getByRole('button', { name: '仪式设置', exact: true }), viewport)
  await page.waitForTimeout(460)
}

async function locks(page) {
  return page.evaluate(() => ({ body: document.body.style.overflow,
    shell: document.querySelector('.app-shell').style.overflow,
    inert: [...document.querySelectorAll('.app-shell [inert]')].map(item => ({ tag: item.tagName, className: item.className, aria: item.getAttribute('aria-hidden') })) }))
}

async function metrics(page) {
  await settle(page)
  return page.evaluate(selector => {
    const rect = item => {
      const box = item.getBoundingClientRect()
      return { x: box.x, y: box.y, width: box.width, height: box.height, right: box.right, bottom: box.bottom }
    }
    const strip = document.querySelector(selector), menu = document.querySelector('.visual-style-menu')
    const result = { viewport: { width: innerWidth, height: innerHeight }, menu: rect(menu), strip: { ...rect(strip),
      scrollLeft: strip.scrollLeft, clientWidth: strip.clientWidth, scrollWidth: strip.scrollWidth,
      scrollSnapType: getComputedStyle(strip).scrollSnapType, overflowX: getComputedStyle(strip).overflowX },
      cards: [...strip.querySelectorAll('button[data-style]')].map(item => ({ ...rect(item), id: item.dataset.style,
        top: item.offsetTop, pressed: item.getAttribute('aria-pressed'), snap: getComputedStyle(item).scrollSnapAlign })),
      pages: [document.documentElement, document.body, document.querySelector('.app-shell')].map(item => ({
        name: item.className || item.tagName, clientWidth: item.clientWidth, scrollWidth: item.scrollWidth })),
      scrollX, scrollY, sceneLoadError: document.querySelector('.scene-load-error')?.textContent?.trim() || null }
    window.__filmstripLastLayout = result
    return result
  }, stripSelector)
}

function assertContained(value, label) {
  assert.ok(value.menu.x >= -1 && value.menu.right <= value.viewport.width + 1, `${label}: menu fits horizontally`)
  assert.ok(value.menu.y >= -1 && value.menu.bottom <= value.viewport.height + 1, `${label}: menu fits vertically`)
  assert.ok(value.viewport.height - value.menu.bottom <= 50, `${label}: menu stays near the bottom`)
  assert.ok(value.strip.scrollWidth > value.strip.clientWidth + 20, `${label}: the filmstrip has horizontal scrolling`)
  assert.match(value.strip.overflowX, /auto|scroll/, `${label}: overflow is contained by the filmstrip`)
  assert.match(value.strip.scrollSnapType, /x/, `${label}: filmstrip snaps horizontally`)
  assert.deepEqual(value.cards.map(card => card.id).sort(), visualStyleOptions.map(option => option.id).sort(), `${label}: all shader choices are available`)
  assert.ok(Math.max(...value.cards.map(card => card.top)) - Math.min(...value.cards.map(card => card.top)) <= 1, `${label}: cards stay on one row`)
  assert.ok(value.cards.every(card => card.width >= 44 && card.height >= 44 && card.snap.includes('center')), `${label}: cards have touch targets and centered snap`)
  assert.ok(value.pages.every(item => item.scrollWidth <= item.clientWidth + 2), `${label}: no document or shell horizontal overflow`)
  assert.ok(Math.abs(value.scrollX) <= 1, `${label}: horizontal gestures do not pan the page`)
  assert.equal(value.sceneLoadError, null, `${label}: the scene renderer remains mounted`)
}

async function assertCardVisible(page, id, centered = false) {
  await page.waitForFunction(({ selector, id, centered }) => {
    const strip = document.querySelector(selector), card = strip.querySelector(`[data-style="${id}"]`)
    const a = strip.getBoundingClientRect(), b = card.getBoundingClientRect()
    return b.x >= a.x - 2 && b.right <= a.right + 2 && b.y >= -1 && b.bottom <= innerHeight + 1
      && (!centered || Math.abs((a.x + a.right - b.x - b.right) / 2) < 7)
  }, { selector: stripSelector, id, centered })
}

async function assertCenteredPreview(page) {
  await page.waitForFunction(selector => {
    const strip = document.querySelector(selector), box = strip.getBoundingClientRect()
    const cards = [...strip.querySelectorAll('button[data-style]')]
    const nearest = cards.reduce((best, card) => {
      const rect = card.getBoundingClientRect(), distance = Math.abs(rect.x + rect.width / 2 - box.x - box.width / 2)
      return !best || distance < best.distance ? { card, distance } : best
    }, null)
    return nearest?.card.getAttribute('aria-pressed') === 'true'
  }, stripSelector)
  return page.locator(`${stripSelector} [aria-pressed="true"]`).getAttribute('data-style')
}

async function assertScopeReachable(page, label) {
  const targets = await page.locator('.visual-style-scope-current, .visual-style-scope-all, .visual-style-done').evaluateAll(elements => elements.map(element => {
    const box = element.getBoundingClientRect(), hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
    return { text: element.textContent.trim(), x: box.x, y: box.y, right: box.right, bottom: box.bottom,
      width: box.width, height: box.height, viewportWidth: innerWidth, viewportHeight: innerHeight,
      reachable: !!hit && (hit === element || element.contains(hit)) }
  }))
  assert.equal(targets.length, 3, `${label}: inline scopes and Done exist`)
  for (const target of targets) {
    assert.ok(target.width >= 43.5 && target.height >= 43.5, `${label}: ${target.text} has a touch target`)
    assert.ok(target.x >= -1 && target.y >= -1 && target.right <= target.viewportWidth + 1 && target.bottom <= target.viewportHeight + 1, `${label}: ${target.text} fits in the viewport before any automatic scrolling`)
    assert.equal(target.reachable, true, `${label}: ${target.text} is visible and not covered by the footer before any automatic scrolling`)
  }
  return targets
}

async function dragStrip(page, viewport, cdp) {
  const box = await page.locator(stripSelector).boundingBox()
  const previous = await page.locator(`${stripSelector} [aria-pressed="true"]`).getAttribute('data-style')
  const start = { x: box.x + box.width * .82, y: box.y + Math.min(box.height * .42, 58) }
  const endX = box.x + box.width * .18
  if (viewport.touch) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...start, id: 0 }] })
    for (let step = 1; step <= 12; step++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + (endX - start.x) * step / 12, y: start.y, id: 0 }] })
      await page.waitForTimeout(18)
    }
    const live = await assertCenteredPreview(page)
    if (await page.locator(stripSelector).evaluate(strip => strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 10))
      assert.notEqual(live, previous, 'touch movement previews the new center while the finger is still down')
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  } else {
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    for (let step = 1; step <= 18; step++) {
      await page.mouse.move(start.x + (endX - start.x) * step / 18, start.y)
      await page.waitForTimeout(18)
    }
    const live = await assertCenteredPreview(page)
    if (await page.locator(stripSelector).evaluate(strip => strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 10))
      assert.notEqual(live, previous, 'mouse movement previews the new center while the button is still down')
    await page.mouse.up()
  }
  await page.waitForTimeout(650)
  assert.equal(await page.getByRole('dialog', { name: '应用视觉风格', exact: true }).count(), 0, 'dragging never opens a confirmation dialog')
  return assertCenteredPreview(page)
}

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height },
      hasTouch: viewport.touch, isMobile: viewport.touch, reducedMotion: 'no-preference', locale: 'zh-CN' })
    const page = await context.newPage(), errors = [], prefix = `${viewport.width}x${viewport.height}`
    const result = { viewport, layouts: [] }
    page.setDefaultTimeout(20000)
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(installThumbnailTelemetry)
    await page.addInitScript(({ key, origin }) => {
      if (location.origin === origin) localStorage.setItem(key, JSON.stringify({ version: 1, sceneRecords: [], wishes: [],
        activeSession: null, sessions: [], collectibles: [], ledger: [], settings: { sound: false, haptics: false, reducedMotion: false } }))
      window.__filmstripScrollCalls = []
      for (const method of ['scrollTo', 'scrollBy', 'scrollIntoView']) {
        const original = Element.prototype[method]
        Element.prototype[method] = function (...args) {
          if (this.matches('.visual-style-filmstrip, .visual-style-filmstrip *')) window.__filmstripScrollCalls.push({ method, args })
          return original.apply(this, args)
        }
      }
    }, { key: saveKey, origin: base.origin })
    try {
      await openScene(page, viewport)
      const baseline = await locks(page), before = await saved(page)
      const canvasBefore = await sceneCanvasMetrics(page)
      const trigger = page.getByRole('button', { name: '视觉风格', exact: true })
      const dialog = page.getByRole('dialog', { name: '视觉风格', exact: true })
      await activate(trigger, viewport)
      await dialog.waitFor()
      await assertCardVisible(page, 'toon-soft')
      result.thumbnails = await realThumbnailEvidence(page, { output: out, prefix: `${prefix}-thumbnail`, contactSheet: viewport.width === 390 })
      assert.deepEqual(await sceneCanvasMetrics(page), canvasBefore, 'thumbnail generation keeps the visible renderer size, canvas CSS and WebGL context count unchanged')
      assert.deepEqual(await saved(page), before, 'generating all shader thumbnails changes neither preferences nor ritual progress')
      assert.equal(await dialog.locator('[data-style="toon-soft"]').getAttribute('aria-pressed'), 'true', 'thumbnail generation leaves the main live preview on its initial shader')
      const initial = await metrics(page)
      assertContained(initial, 'initial')
      result.scopeTargets = await assertScopeReachable(page, 'initial')
      result.layouts.push({ label: 'initial', ...initial })
      await screenshot(page, `${prefix}-open`)

      const cdp = viewport.touch ? await context.newCDPSession(page) : null
      const draggedStyle = await dragStrip(page, viewport, cdp)
      result.nativeImageDrags = await page.evaluate(() => window.__thumbnailNativeDrags)
      assert.ok(result.nativeImageDrags.every(event => event.prevented), 'native HTML image dragging never steals a filmstrip gesture')
      let dragged = await metrics(page)
      assert.ok(dragged.strip.scrollLeft > initial.strip.scrollLeft + 15, 'real touch swipe or mouse drag moves the filmstrip')
      assert.deepEqual(await saved(page), before, 'dragging changes neither style nor saved ritual progress')
      assert.notEqual(draggedStyle, 'toon-soft', 'dragging previews the centered shader without a click')
      result.gesture = viewport.touch ? 'CDP native touch swipe' : 'mouse pointer drag'
      result.layouts.push({ label: 'dragged', ...dragged })
      for (let attempt = 0; attempt < 12; attempt++) {
        const last = dragged.cards.at(-1)
        if (last.x >= dragged.strip.x - 2 && last.right <= dragged.strip.right + 2) break
        await dragStrip(page, viewport, cdp)
        dragged = await metrics(page)
      }
      const lastId = dragged.cards.at(-1).id
      await assertCardVisible(page, lastId)
      await screenshot(page, `${prefix}-last-card`)
      await activate(dialog.locator(`[data-style="${lastId}"]`), viewport)
      await assertCardVisible(page, lastId, true)
      assert.equal(await assertCenteredPreview(page), lastId, 'clicking a visible card centers and previews it')
      await assertScopeReachable(page, 'draft')
      assert.deepEqual(await saved(page), before, 'clicking a style previews it without saving')
      assert.equal(await page.getByRole('dialog', { name: '应用视觉风格', exact: true }).count(), 0, 'clicking never opens a confirmation dialog')
      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')))
      assert.deepEqual(await saved(page), before, 'pagehide does not commit a draft')

      await dialog.locator('[data-style="toon-soft"]').focus()
      await page.keyboard.press('End')
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-style')), lastId, 'End focuses the last card')
      await assertCardVisible(page, lastId)
      await page.keyboard.press('Home')
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-style')), 'toon-soft', 'Home focuses the first card')
      await page.keyboard.press('ArrowRight')
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-style')), 'original', 'ArrowRight focuses the next card')
      await page.keyboard.press('ArrowLeft')
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-style')), 'toon-soft', 'ArrowLeft focuses the previous card')
      await page.keyboard.press('End')
      await page.keyboard.press('Enter')
      await assertCardVisible(page, lastId, true)
      assert.deepEqual(await saved(page), before, 'keyboard navigation remains a draft')
      assert.equal(await dialog.locator('.visual-style-scope-current').getAttribute('aria-pressed'), 'true', 'save defaults to this ritual')
      result.layouts.push({ label: 'draft', ...await metrics(page) })
      await screenshot(page, `${prefix}-selected`)
      await activate(dialog.locator('.visual-style-done'), viewport)
      await dialog.waitFor({ state: 'detached' })
      await page.waitForFunction(({ key, id, style }) => JSON.parse(localStorage.getItem(key)).visualStyles?.[id]?.style === style,
        { key: saveKey, id: sceneId, style: lastId })
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), '视觉风格', 'Done returns focus to the settings trigger')
      assert.deepEqual(await locks(page), baseline, 'Done restores shell/body locks and existing inert state')
      const committed = await saved(page)

      await activate(trigger, viewport)
      await dialog.waitFor()
      await assertCardVisible(page, lastId, true)
      assertContained(await metrics(page), 'reopened')
      await dialog.locator(`[data-style="${lastId}"]`).focus()
      await page.keyboard.press('Home')
      await assertCardVisible(page, 'toon-soft', true)
      await page.keyboard.press('End')
      await assertCardVisible(page, lastId, true)
      await activate(dialog.locator('.visual-style-done'), viewport)
      await dialog.waitFor({ state: 'detached' })
      assert.deepEqual(await saved(page), committed, 'Done closes normally after browsing back to the already saved style')
      assert.deepEqual(await locks(page), baseline, 'no-op Done restores locks')

      await activate(trigger, viewport)
      await dialog.waitFor()
      await assertCardVisible(page, lastId, true)
      await dialog.locator(`[data-style="${lastId}"]`).focus()
      await page.keyboard.press('Home')
      await assertCardVisible(page, 'toon-soft', true)
      await assertCenteredPreview(page)
      await page.keyboard.press('Escape')
      await dialog.waitFor({ state: 'detached' })
      assert.deepEqual(await saved(page), committed, 'Escape discards the changed preview')
      assert.deepEqual(await locks(page), baseline, 'Escape restores locks')

      // Parameter changes, global scope and native dismissal all remain drafts.
      await activate(trigger, viewport)
      await dialog.waitFor()
      await assertCardVisible(page, lastId, true)
      await dialog.locator('[data-style="pixel-art"]').focus()
      await page.keyboard.press('Enter')
      await assertCardVisible(page, 'pixel-art', true)
      await assertCenteredPreview(page)
      await dialog.locator('.visual-style-tuning summary').click()
      const slider = dialog.locator('input[type="range"]').first()
      await slider.focus()
      await slider.press('Home')
      for (let value = 1; value < 8; value++) await slider.press('ArrowRight')
      assert.equal(await slider.inputValue(), '8', 'pixel parameters can be edited with real keyboard input')
      await activate(dialog.locator('.visual-style-scope-all'), viewport)
      await page.waitForTimeout(250)
      assert.deepEqual(await saved(page), committed, 'parameters and scope wait for Done')
      await page.evaluate(() => document.dispatchEvent(new CustomEvent('wbr:close-visual-style', { cancelable: true, detail: document.querySelector('.app-shell') })))
      await dialog.waitFor({ state: 'detached' })
      assert.deepEqual(await saved(page), committed, 'native dismissal discards style, parameter and scope drafts')
      assert.deepEqual(await locks(page), baseline, 'native dismissal restores locks')

      await activate(trigger, viewport)
      await dialog.waitFor()
      await assertCardVisible(page, lastId, true)
      await dialog.locator(`[data-style="${lastId}"]`).focus()
      await page.keyboard.press('Home')
      await assertCardVisible(page, 'toon-soft', true)
      await activate(dialog.getByRole('button', { name: '关闭视觉风格', exact: true }), viewport)
      await dialog.waitFor({ state: 'detached' })
      assert.deepEqual(await saved(page), committed, 'close discards a draft')

      await activate(trigger, viewport)
      await dialog.waitFor()
      await dialog.locator(`[data-style="${lastId}"]`).focus()
      await page.keyboard.press('Home')
      await assertCardVisible(page, 'toon-soft', true)
      if (viewport.touch) await page.touchscreen.tap(10, 10)
      else await page.mouse.click(10, 10)
      await dialog.waitFor({ state: 'detached' })
      assert.deepEqual(await saved(page), committed, 'outside dismissal discards a draft')
      assert.deepEqual(await locks(page), baseline, 'outside dismissal restores locks')

      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.waitForFunction(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
      await page.evaluate(() => { window.__filmstripScrollCalls = [] })
      await activate(trigger, viewport)
      await dialog.waitFor()
      await assertCardVisible(page, lastId, true)
      await dialog.locator(`[data-style="${lastId}"]`).focus()
      await page.keyboard.press('Home')
      await assertCardVisible(page, 'toon-soft')
      result.reducedMotionScrollCalls = await page.evaluate(() => window.__filmstripScrollCalls)
      assert.ok(result.reducedMotionScrollCalls.length > 0, 'reduced-motion scrolling was observed')
      assert.ok(result.reducedMotionScrollCalls.every(call => call.args.every(arg => !arg || typeof arg !== 'object' || arg.behavior !== 'smooth')), 'reduced motion never requests smooth scrolling')
      await screenshot(page, `${prefix}-reduced-motion`)
      await page.keyboard.press('Escape')
      await dialog.waitFor({ state: 'detached' })
      assert.deepEqual(await locks(page), baseline, 'reduced-motion close restores locks')
      assert.deepEqual(errors, [], 'no browser page errors')
      report.results.push(result)
      console.log(`PASS ${prefix}`)
    } catch (error) {
      report.failures.push({ viewport, message: error.message, stack: error.stack, partial: result,
        lastLayout: await page.evaluate(() => window.__filmstripLastLayout).catch(() => undefined),
        sceneLoadError: await page.locator('.scene-load-error').allTextContents().catch(() => undefined) })
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
assert.equal(report.failures.length, 0, `filmstrip regressions; see ${path.join(out, 'report.json')}`)
assert.deepEqual(report.pageErrors, [], 'browser page errors')
console.log(JSON.stringify({ checks: report.results.length, failures: report.failures.length, output: out }))
