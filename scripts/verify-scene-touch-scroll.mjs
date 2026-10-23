import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { scenePointer } from './browser-scene-pointer.mjs'

const base = process.env.WBR_URL || 'http://127.0.0.1:5182'
const out = new URL('../artifacts/scene-touch-scroll/', import.meta.url)
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })
const results = [], failures = [], pageErrors = []

try {
  for (const viewport of [{ width: 390, height: 800 }, { width: 320, height: 720 }]) {
    const page = await browser.newPage({ viewport, hasTouch: true, isMobile: true })
    page.on('pageerror', error => pageErrors.push(error.message))
    const input = await scenePointer(page, true)
    const scrollY = () => page.evaluate(() => window.scrollY)
    const point = role => page.locator(`[data-cue-role="${role}"]:not([hidden])`).first().evaluate(el => {
      const r = el.parentElement.getBoundingClientRect()
      return [r.left + Number(el.dataset.x), r.top + Number(el.dataset.y)]
    })
    const settled = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    async function open(id) {
      await page.goto(`${base}/scene-review?scene=${id}`)
      await page.locator(`.library-scene-stage[data-scene="${id}"][data-ready="true"] canvas[data-environment-ready="true"]`).waitFor()
      await page.locator('[data-cue-role="source"]').first().waitFor({ state: 'attached' })
      await page.locator('.scene-hit-layer').first().scrollIntoViewIfNeeded()
      await page.evaluate(() => {
        window.scrollTo(0, 40)
        window.__touchScrollEvents = []
        for (const type of ['pointerdown', 'pointerup', 'pointercancel']) {
          window.addEventListener(type, event => window.__touchScrollEvents.push({ type, x: event.clientX, y: event.clientY }))
        }
      })
      await settled()
      assert.ok(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight - scrollY > 80), 'fixture must allow meaningful page scrolling')
    }
    async function move(from, to) {
      // Allow the browser's native pan recognizer to run between real CDP
      // touch events. Synthetic DOM pointer events cannot reproduce this bug.
      for (let i = 1; i <= 10; i++) {
        await input.move([from[0] + (to[0] - from[0]) * i / 10, from[1] + (to[1] - from[1]) * i / 10], 1)
        await page.waitForTimeout(30)
      }
    }
    async function noScroll(before) {
      await settled()
      const after = await scrollY()
      assert.ok(Math.abs(after - before) <= 1, `page scrolled during a canvas gesture: ${before} -> ${after}`)
      assert.equal(await page.evaluate(() => window.__touchScrollEvents.some(e => e.type === 'pointercancel')), false, 'browser must not cancel the scene gesture for panning')
      return { before, after }
    }
    async function run(id, name, test) {
      try {
        await open(id)
        results.push({ id, width: viewport.width, name, ...await test() })
        console.log(`PASS ${viewport.width} ${id}: ${name}`)
      } catch (error) {
        const failure = { id, width: viewport.width, name, message: error.message }
        failures.push(failure)
        await page.screenshot({ path: new URL(`${viewport.width}-${id}-${name}.png`, out).pathname.replace(/^\/(?:([A-Z]:))/, '$1'), fullPage: true })
        console.error(`FAIL ${viewport.width} ${id}: ${name}: ${error.message}`)
      }
    }
    for (const id of ['welsh-love-spoon', 'sumiyoshi-godairiki']) {
      await run(id, 'canvas-empty', async () => {
        const r = await page.locator('.scene-hit-layer').first().boundingBox()
        const from = [r.x + 10, Math.min(viewport.height - 30, r.y + r.height - 30)]
        assert.ok(await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('.scene-hit-layer'), from), 'gesture must start in the canvas hit layer')
        const before = await scrollY()
        await input.down(from); await move(from, [from[0], from[1] - 100]); await input.up()
        return noScroll(before)
      })
      await run(id, 'object-drag', async () => {
        const from = await point('source'), before = await scrollY()
        let to
        if (id === 'welsh-love-spoon') to = await point('target')
        else {
          const angle = await page.locator('.scene-cue-direction').first().evaluate(el => parseFloat(el.style.getPropertyValue('--cue-angle'))) * Math.PI / 180
          to = [from[0] + Math.cos(angle) * 85, from[1] + Math.sin(angle) * 85 + 15]
        }
        await input.down(from); await move(from, to); await input.up()
        await page.waitForFunction(() => document.querySelector('.scene-progress')?.textContent.includes('已完成 1 / 3'), undefined, { timeout: 45000 })
        return noScroll(before)
      })
      await run(id, 'outside-scroll', async () => {
        const stage = await page.locator('.library-scene-stage').boundingBox()
        const layer = await page.locator('.scene-hit-layer').first().boundingBox()
        const from = [Math.max(2, stage.x - 5), Math.min(viewport.height - 30, layer.y + layer.height - 30)]
        assert.ok(await page.evaluate(([x, y]) => !document.elementFromPoint(x, y)?.closest('.library-scene-stage'), from), 'gesture must start outside the scene')
        const before = await scrollY()
        await input.down(from); await move(from, [from[0], from[1] - 100]); await input.up()
        await page.waitForFunction(y => Math.abs(scrollY - y) > 30, before)
        return { before, after: await scrollY() }
      })
    }
    await run('welsh-love-spoon', 'leave-canvas-and-retry', async () => {
      const from = await point('source'), r = await page.locator('.scene-hit-layer').first().boundingBox(), before = await scrollY()
      const outside = [from[0], Math.max(5, r.y - 25)]
      await input.down(from); await move(from, outside); await input.up()
      await noScroll(before)
      assert.ok(await page.locator('.scene-progress').textContent().then(text => text.includes('已完成 0 / 3')), 'an invalid drop must not advance')
      await settled()
      const retry = await point('source'), to = await point('target')
      await input.down(retry); await move(retry, to); await input.up()
      await page.waitForFunction(() => document.querySelector('.scene-progress')?.textContent.includes('已完成 1 / 3'), undefined, { timeout: 45000 })
      return noScroll(before)
    })
    await page.close()
  }
} finally {
  await writeFile(new URL('report.json', out), JSON.stringify({ results, failures, pageErrors }, null, 2))
  await browser.close()
}
assert.deepEqual(failures, [], 'native touch scroll regressions')
assert.deepEqual(pageErrors, [], 'page errors')
console.log(JSON.stringify({ checks: results.length, failures: failures.length, pageErrors }))
