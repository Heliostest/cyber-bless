// Build first. WBR_URL=http://127.0.0.1:4175 node scripts/verify-visual-style-thumbnails.mjs
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { installThumbnailTelemetry, realThumbnailEvidence, sceneCanvasMetrics, thumbnailSelector } from './visual-style-thumbnail-checks.mjs'

const base = new URL(process.env.WBR_URL || 'http://127.0.0.1:4175')
const output = fileURLToPath(new URL('../artifacts/visual-style-thumbnails-2026-10-28/', import.meta.url))
const saveKey = 'cyber-bless:personal:v1'
const report = { capturedAt: new Date().toISOString(), base: base.href, scenes: [], failures: [], pageErrors: [] }
await mkdir(output, { recursive: true })
const save = () => writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n')
const browser = await chromium.launch({ channel: process.env.WBR_BROWSER || 'msedge', headless: process.env.WBR_HEADED !== '1',
  args: ['--no-proxy-server', '--enable-unsafe-swiftshader'] })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: 'zh-CN' })
await context.addInitScript(installThumbnailTelemetry)
await context.addInitScript(({ key, origin }) => {
  if (location.origin === origin) localStorage.setItem(key, JSON.stringify({ version: 1, sceneRecords: [], wishes: [],
    activeSession: null, sessions: [], collectibles: [], ledger: [], settings: { sound: false, haptics: false, reducedMotion: false } }))
}, { key: saveKey, origin: base.origin })
const page = await context.newPage()
page.setDefaultTimeout(30000)
page.on('pageerror', error => report.pageErrors.push(error.message))
const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), saveKey)
const screenshot = name => page.screenshot({ path: path.join(output, `${name}.png`), fullPage: false })

async function chooseScene(id) {
  const card = page.locator(`.scene-card[data-scene="${id}"]`)
  await page.locator('.scene-search input').fill(id)
  await card.waitFor()
  await card.tap()
  await page.locator(`.library-scene-stage[data-scene="${id}"][data-ready="true"] canvas[data-environment-ready="true"]`).waitFor({ timeout: 90000 })
  await page.locator('.visual-style-anchor > button').waitFor({ state: 'attached', timeout: 60000 })
  await page.getByRole('button', { name: '仪式设置', exact: true }).tap()
  await page.waitForTimeout(500)
}

try {
  await page.goto(base.href, { waitUntil: 'domcontentloaded' })
  await page.locator('.app-shell[data-page="today"]').waitFor()
  await page.getByRole('button', { name: '我的', exact: true }).tap()
  await page.getByRole('button', { name: '场景目录', exact: true }).tap()
  for (const id of ['tanzaku-tanabata', 'woodfish', 'yeondeunghoe']) {
    const result = { id }
    try {
      await chooseScene(id)
      const before = await saved(), canvas = await sceneCanvasMetrics(page)
      const trigger = page.getByRole('button', { name: '视觉风格', exact: true })
      const dialog = page.getByRole('dialog', { name: '视觉风格', exact: true })
      await screenshot(`${id}-before-menu`)

      // Open and dismiss in the same task, before queued animation frames run.
      result.cancelledQueue = await page.evaluate(async () => {
        const before = window.__thumbnailCaptures
        document.querySelector('.visual-style-anchor > button').click()
        await Promise.resolve(); await Promise.resolve()
        const close = document.querySelector('[data-visual-style-close]')
        if (!close) throw Error('visual menu did not mount before the cancellation check')
        close.click()
        await Promise.resolve()
        return { before, immediatelyAfter: window.__thumbnailCaptures }
      })
      await dialog.waitFor({ state: 'detached' })
      await page.waitForTimeout(300)
      result.cancelledQueue.after = await page.evaluate(() => window.__thumbnailCaptures)
      assert.equal(result.cancelledQueue.after, result.cancelledQueue.immediatelyAfter, 'closing the menu cancels queued screenshot work')
      assert.deepEqual(await saved(), before, 'early cancellation changes neither settings nor ritual progress')

      await trigger.tap()
      await dialog.waitFor()
      result.thumbnails = await realThumbnailEvidence(page, { output, prefix: id, contactSheet: true })
      assert.deepEqual(await sceneCanvasMetrics(page), canvas, 'real snapshots keep the original canvas dimensions and do not create a second WebGL renderer')
      assert.deepEqual(await saved(), before, 'generating shader frames does not advance the ritual or save preferences')
      assert.equal(await dialog.locator('[aria-pressed="true"][data-style]').count(), 1, 'capture preserves the selected live shader')
      await screenshot(`${id}-menu`)
      if (report.scenes.length) {
        const previous = report.scenes[0].thumbnails
        assert.ok(result.thumbnails.every(image => image.signature !== previous.find(other => other.style === image.style)?.signature), `${id}: every thumbnail is newly rendered from this ritual rather than a shared shader sample`)
      }
      if (id === 'tanzaku-tanabata') {
        await dialog.locator('[data-style="pixel-art"]').focus()
        await page.keyboard.press('Enter')
        await page.waitForFunction(() => document.querySelector('[data-style="pixel-art"]').getAttribute('aria-pressed') === 'true')
        const original = await dialog.locator('[data-style="pixel-art"] .visual-style-swatch img').getAttribute('src')
        await dialog.locator('.visual-style-tuning summary').tap()
        const slider = dialog.locator('input[type="range"]').first()
        await slider.focus(); await slider.press('Home')
        for (let value = 1; value < 8; value++) await slider.press('ArrowRight')
        await page.waitForFunction(({ selector, original }) => {
          const image = document.querySelector(selector)
          return image?.complete && image.naturalWidth === 160 && image.src !== original
        }, { selector: '[data-style="pixel-art"] .visual-style-swatch img', original }, { timeout: 90000 })
        assert.equal(await slider.inputValue(), '8')
        result.parameterUpdated = true
        assert.deepEqual(await saved(), before, 'refreshing a parameter thumbnail remains an unsaved draft')
        await screenshot(`${id}-parameter-preview`)
      }
      await page.keyboard.press('Escape')
      await dialog.waitFor({ state: 'detached' })
      assert.deepEqual(await saved(), before, 'dismissing the menu discards the thumbnail preview draft')
      await page.waitForTimeout(250)
      assert.equal(await page.locator(thumbnailSelector).count(), 0, 'closed menu leaves no previous ritual image elements')
      report.scenes.push(result)
      console.log(`PASS thumbnails ${id}`)
      await page.keyboard.press('Escape')
      await page.waitForTimeout(460)
      await page.getByRole('button', { name: '返回', exact: true }).tap()
      await page.locator('.app-shell[data-page="scenes"]').waitFor()
    } catch (error) {
      report.failures.push({ id, message: error.message, stack: error.stack, partial: result,
        sceneLoadError: await page.locator('.scene-load-error').allTextContents().catch(() => []) })
      await screenshot(`${id}-failure`).catch(() => {})
      console.error(`FAIL thumbnails ${id}: ${error.message}`)
      break
    } finally { await save() }
  }
} finally {
  await save()
  await context.close()
  await browser.close()
}
assert.equal(report.failures.length, 0, `thumbnail failures: ${path.join(output, 'report.json')}`)
assert.equal(report.scenes.length, 3, 'day, woodfish and night rituals are all verified')
assert.deepEqual(report.pageErrors, [], 'thumbnail generation emits no browser page errors')
console.log(JSON.stringify({ scenes: report.scenes.length, failures: report.failures.length, output }))
