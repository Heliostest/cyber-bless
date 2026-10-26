import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { scenePointer } from './browser-scene-pointer.mjs'

const base = process.env.WBR_URL || 'http://127.0.0.1:5173'
const out = process.env.WBR_DRAGONFLY_OUT || 'artifacts/vietnamese-bamboo-dragonfly/balance'
const widths = process.env.WBR_WIDTHS?.split(',').map(Number) || [320, 390, 284, 1280]
const surfaces = [
  ['dragonfly-wing-front-left', [-1.18, -.14, .545]], ['dragonfly-wing-front-right', [1.18, -.14, .545]],
  ['dragonfly-wing-rear-left', [-.9, -.10, -.05]], ['dragonfly-wing-rear-right', [.9, -.10, -.05]],
  ['dragonfly-head', [0, .035, .13]], ['dragonfly-thorax', [0, .06, 0]], ['dragonfly-tail', [0, .20, -.95]],
]
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true }), results = []
try {
  for (const width of widths) {
    const touch = width === 320, reduced = width !== 320 && width !== 390, errors = []
    const page = await browser.newPage({ viewport: { width, height: 1000 }, hasTouch: touch, isMobile: touch })
    page.setDefaultTimeout(60000); page.on('pageerror', e => errors.push(e.message))
    // Observe the real Three scene and camera without adding a product test API.
    // The only fixture change is the review host's initial accessibility setting.
    await page.route('**/debug-render-style.ts*', async route => {
      const response = await route.fetch(), body = await response.text(), needle = 'const style = createRenderStyle(renderer, scene, camera);'
      assert.ok(body.includes(needle)); await route.fulfill({ response, body: body.replace(needle, 'globalThis.__dragonflyQA = { scene, camera };\n' + needle) })
    })
    await page.route('**/SceneReview.tsx*', async route => {
      const response = await route.fetch(), body = await response.text()
      assert.ok(body.includes('createState()')); await route.fulfill({ response, body: body.replace('createState()', `createState({ reducedMotion: ${reduced} })`) })
    })
    await page.addInitScript(() => {
      window.__dragonflyVibrations = []; window.__dragonflySounds = []
      Object.defineProperty(navigator, 'vibrate', { configurable: true, value: value => { window.__dragonflyVibrations.push(value); return true } })
      const proto = window.AudioContext?.prototype, create = proto?.createOscillator
      if (create) proto.createOscillator = function () {
        const oscillator = create.call(this), start = oscillator.start, set = oscillator.frequency.setValueAtTime; let frequency
        oscillator.frequency.setValueAtTime = function (f, ...args) { frequency = f; return set.call(this, f, ...args) }
        oscillator.start = function (...args) { window.__dragonflySounds.push(frequency); return start.apply(this, args) }
        return oscillator
      }
    })
    await page.goto(`${base}/scene-review?scene=vietnamese-bamboo-dragonfly`)
    await page.locator('.library-scene-stage[data-ready="true"]').waitFor()
    const input = await scenePointer(page, touch), done = () => page.locator('.scene-step-dot[data-state="done"]').count()
    const frame = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    const setFeedbackMenu = async open => {
      const gear = page.locator('button[aria-label="仪式设置"]')
      if (await gear.getAttribute('aria-expanded') !== String(open)) await gear.click()
      await gear.evaluate(async button => {
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        await Promise.all(button.closest('.feedback-controls').getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {})))
        await new Promise(resolve => requestAnimationFrame(resolve))
      })
      if (!open) await page.locator('.feedback-controls-anchor[data-feedback-present]').waitFor({ state: 'detached' })
    }
    const point = async (name, anchor) => {
      await page.locator('.scene-hit-layer').scrollIntoViewIfNeeded(); await frame()
      return page.evaluate(({ name, anchor }) => {
        const { scene, camera } = window.__dragonflyQA, object = scene.getObjectByName(name)
        const p = object.localToWorld(object.position.clone().set(...anchor)).project(camera), r = document.querySelector('.library-scene-stage canvas').getBoundingClientRect()
        return [r.left + (p.x + 1) * r.width / 2, r.top + (1 - p.y) * r.height / 2]
      }, { name, anchor })
    }
    const signals = () => page.evaluate(() => ({ vibrations: [...window.__dragonflyVibrations], sounds: [...window.__dragonflySounds] }))
    const contact = () => page.evaluate(() => {
      const { scene } = window.__dragonflyQA, pivot = scene.getObjectByName('dragonfly-balance-pivot'), tip = scene.getObjectByName('dragonfly-support-tip')
      return { distance: pivot.getWorldPosition(pivot.position.clone().set(0, 0, 0)).distanceTo(tip.getWorldPosition(tip.position.clone().set(0, 0, 0))), angle: Math.hypot(pivot.rotation.x, pivot.rotation.y, pivot.rotation.z) }
    })
    const shot = async phase => {
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      await page.screenshot({ path: `${out}/${width}-${touch ? 'touch' : 'mouse'}-${phase}.png`, fullPage: true })
    }
    await shot('prepared')
    const from = await point('dragonfly-head', [0, .035, .13])
    await input.down(from); await input.move([from[0], from[1] - 60], 4); assert.equal(await done(), 0)
    await input.up(); await page.waitForFunction(() => document.querySelectorAll('.scene-step-dot[data-state="done"]').length === 1)
    await shot('placed'); assert.ok((await contact()).distance < 1e-7)
    for (let n = 0; n < surfaces.length; n++) {
      if (n === 2 || n === 3) {
        await setFeedbackMenu(true)
        await page.getByRole('button', { name: '震动', exact: true }).click(); await page.getByRole('button', { name: '音效', exact: true }).click()
        await setFeedbackMenu(false)
      }
      const before = await signals(), p = await point(...surfaces[n])
      await input.down(p); await input.up(); await frame()
      const after = await signals(), enabled = n !== 2
      assert.equal(after.vibrations.length, before.vibrations.length + Number(enabled), surfaces[n][0])
      assert.equal(after.sounds.length, before.sounds.length + Number(enabled), surfaces[n][0])
      assert.equal(await done(), 2); assert.equal(await page.locator('.scene-completion-actions').count(), 0)
      if (n === 0) {
        const finish = await page.getByRole('button', { name: '结束体验', exact: true }).evaluate(button => ({
          color: getComputedStyle(button).color, prefix: getComputedStyle(button, '::before').content,
          width: button.clientWidth, contentWidth: button.scrollWidth,
        }))
        assert.notEqual(finish.color, 'rgba(0, 0, 0, 0)', 'finish button text must be visibly painted')
        assert.ok(!finish.prefix.includes('辅助'), 'finish must be labelled as an action, not an assist')
        assert.ok(finish.width >= 80 && finish.contentWidth <= finish.width, 'finish label must fit without clipping')
      }
      const state = await contact(); assert.ok(state.distance < 1e-7); if (!reduced) assert.ok(state.angle > 1e-5)
    }
    // Both directions are accepted from different real surfaces, while still swinging.
    for (const [index, delta] of [[1, [30, 18]], [6, [-25, -20]]]) {
      const p = await point(...surfaces[index]), before = await signals()
      await input.down(p); await input.move([p[0] + delta[0], p[1] + delta[1]], 3)
      if (index === 1) await shot('held')
      await input.up(); await frame(); assert.equal((await signals()).vibrations.length, before.vibrations.length + 1)
      assert.equal(await done(), 2); assert.ok((await contact()).distance < 1e-7)
    }
    const p = await point(...surfaces[0]), before = await signals()
    await input.down(p); await input.move([p[0] + 15, p[1] + 15], 2); await input.cancel(); await frame()
    assert.deepEqual(await signals(), before); assert.equal(await done(), 2)
    await shot('free-play')
    await page.getByRole('button', { name: '结束体验', exact: true }).click(); await page.locator('.scene-completion-actions').waitFor(); await shot('finished')
    assert.equal(await done(), 3); assert.equal(await page.locator('[data-cue-role="source"]').count(), 0)
    const completionLayout = await page.evaluate(() => {
      const header = document.querySelector('.ritual-narrative-header'), summary = header.querySelector('summary'), status = header.querySelector('[role="status"]')
      const h = header.getBoundingClientRect(), s = summary.getBoundingClientRect(), c = status.getBoundingClientRect()
      return {
        copy: status.textContent, centreOffset: c.y + c.height / 2 - s.y - s.height / 2, rightOffset: h.right - c.right,
        footerCopy: document.querySelector('.scene-done-row').textContent,
        buttons: [...document.querySelectorAll('.scene-completion-actions > button')].map(button => {
          const r = button.getBoundingClientRect()
          return { top: r.top, height: r.height, font: getComputedStyle(button).fontSize }
        }),
      }
    })
    assert.equal(completionLayout.copy, '体验完成。'); assert.ok(Math.abs(completionLayout.centreOffset) < 1)
    assert.ok(Math.abs(completionLayout.rightOffset) < 1); assert.ok(!completionLayout.footerCopy.includes('体验完成'))
    assert.equal(completionLayout.buttons.length, 2)
    assert.equal(completionLayout.buttons[0].top, completionLayout.buttons[1].top)
    assert.ok(completionLayout.buttons.every(button => button.height === 52 && button.font === '16px'))
    await page.locator('.ritual-narrative > summary').click()
    const narrativeWidth = await page.locator('.ritual-narrative > p').evaluate(p => p.getBoundingClientRect().width - p.closest('.ritual-narrative-header').getBoundingClientRect().width)
    assert.ok(Math.abs(narrativeWidth) < 1, 'expanded narrative retains the complete header width')
    await shot('finished-open')
    const finalSignals = await signals(); assert.equal(finalSignals.vibrations.length, 10); assert.equal(finalSignals.sounds.length, 10)
    assert.ok(finalSignals.sounds.every(f => f === 659.25)); assert.deepEqual(errors, [])
    results.push({ width, input: touch ? 'native-touch' : 'mouse', motion: reduced ? 'reduced' : 'normal', surfaces: 7, freeDrags: 2, noAutoFinish: true, fixedBeak: true, cancel: true, liveSettings: true, ...finalSignals, errors })
    await writeFile(`${out}/browser.json`, JSON.stringify(results, null, 2)); console.log(JSON.stringify(results.at(-1)))
    await page.close()
  }
} finally { await browser.close() }
