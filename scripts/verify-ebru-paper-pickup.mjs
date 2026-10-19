import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { scenePointer } from './browser-scene-pointer.mjs'

const base = process.env.WBR_URL || 'http://127.0.0.1:5173'
const out = process.env.WBR_EBRU_OUT || 'artifacts/turkish-ebru-paper/pickup'
const widths = process.env.WBR_WIDTHS?.split(',').map(Number) || [390, 320, 284]
const locations = [[-1.25, .45, .70], [1.25, .45, -.70], [0, .45, 0]]
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true }), results = []
try {
  for (const width of widths) {
    const touch = width === 320, reduced = width === 284, errors = []
    const page = await browser.newPage({ viewport: { width, height: 1000 }, hasTouch: touch, isMobile: touch })
    page.setDefaultTimeout(60000); page.on('pageerror', error => errors.push(error.message))
    // Observe real geometry and camera; only seed the host accessibility setting.
    await page.route('**/debug-render-style.ts*', async route => {
      const response = await route.fetch(), body = await response.text(), needle = 'const style = createRenderStyle(renderer, scene, camera);'
      assert.ok(body.includes(needle))
      await route.fulfill({ response, body: body.replace(needle, 'globalThis.__ebruQA = { scene, camera };\n' + needle) })
    })
    await page.route('**/SceneReview.tsx*', async route => {
      const response = await route.fetch(), body = await response.text()
      assert.ok(body.includes('createState()'))
      await route.fulfill({ response, body: body.replace('createState()', `createState({ reducedMotion: ${reduced} })`) })
    })
    await page.addInitScript(() => {
      window.__ebruVibrations = []
      Object.defineProperty(navigator, 'vibrate', { configurable: true, value: value => { window.__ebruVibrations.push(value); return true } })
    })
    await page.goto(`${base}/scene-review?scene=turkish-ebru-paper`)
    const input = await scenePointer(page, touch)
    const count = () => page.locator('.scene-step-dot[data-state="done"]').count()
    const point = async (name, anchor) => {
      await page.locator('.scene-hit-layer').scrollIntoViewIfNeeded()
      return page.evaluate(({ name, anchor }) => {
        const { scene, camera } = window.__ebruQA, object = scene.getObjectByName(name)
        const p = object.localToWorld(object.position.clone().set(...anchor)).project(camera)
        const r = document.querySelector('.library-scene-stage canvas').getBoundingClientRect()
        return [r.left + (p.x + 1) * r.width / 2, r.top + (1 - p.y) * r.height / 2]
      }, { name, anchor })
    }
    for (let trial = 0; trial < locations.length; trial++) {
      if (trial) await page.getByRole('button', { name: '重新开始', exact: true }).click()
      await page.locator('.library-scene-stage[data-ready="true"]').waitFor()
      await page.locator('.scene-bow-tap').click()
      await page.waitForFunction(() => document.querySelectorAll('.scene-step-dot[data-state="done"]').length === 1)
      const before = await page.evaluate(() => window.__ebruVibrations.length)
      if (!trial) {
        const rim = await point('ebru-rim-end-1', [0, 0, 0])
        await input.down(rim); await input.move([rim[0], rim[1] - 60], 4); await input.up()
        assert.equal(await count(), 1)
        const p = await point('ebru-paper-blank', locations[trial])
        await input.down(p); await input.move([p[0], p[1] - 25], 3); await input.cancel()
        assert.equal(await count(), 1)
        assert.equal(await page.evaluate(() => window.__ebruVibrations.length), before)
      }
      const p = await point('ebru-paper-blank', locations[trial])
      await input.down(p); await input.move([p[0] + 8, p[1] - 30], 4)
      assert.equal(await count(), 1)
      const held = await page.evaluate(() => {
        const paper = window.__ebruQA.scene.getObjectByName('ebru-paper-blank'), positions = paper.geometry.getAttribute('position'), uv = paper.geometry.getAttribute('uv')
        const anchor = paper.userData.interactionCues[0].anchor
        let cueDistance = Infinity
        for (let i = 0; i < positions.count; i++) if (uv.getX(i) === .5 && uv.getY(i) === .125) {
          cueDistance = Math.hypot(anchor[0] - positions.getX(i), anchor[1] - positions.getY(i), anchor[2] - positions.getZ(i))
        }
        return { raised: Math.max(...Array.from({ length: positions.count }, (_, i) => positions.getY(i))), cueHeight: anchor[1], cueDistance }
      })
      assert.ok(held.raised > .9, 'the actual paper follows the grab before release')
      assert.ok(held.cueHeight > .9 && held.cueDistance < 1e-7, 'the cue follows an actual paper vertex')
      if (!trial) await page.screenshot({ path: `${out}/${width}-held.png`, fullPage: true })
      await input.move([p[0] + 12, p[1] - 60], 4); await input.up()
      await page.waitForFunction(() => document.querySelectorAll('.scene-step-dot[data-state="done"]').length === 2)
      assert.equal(await page.evaluate(() => window.__ebruVibrations.length), before + 1)
      assert.equal(await page.locator('.scene-completion-actions').count(), 0)
      const paper = await point('ebru-paper-print', [0, 1.6, .28])
      await input.down(paper); await input.up(); await page.locator('.scene-completion-actions').waitFor()
      assert.equal(await count(), 3)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    }
    await page.screenshot({ path: `${out}/${width}-finished.png`, fullPage: true })
    assert.deepEqual(errors, [])
    results.push({ width, input: touch ? 'native-touch' : 'mouse', reduced, paperLocations: locations.length, followsGrab: true, rimRejected: true, cancel: true, feedback: true, completed: true, errors })
    await writeFile(`${out}/browser.json`, JSON.stringify(results, null, 2)); console.log(JSON.stringify(results.at(-1)))
    await page.close()
  }
} finally { await browser.close() }
