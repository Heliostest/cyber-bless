import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { scenePointer } from './browser-scene-pointer.mjs'

const base = process.env.WBR_URL || 'http://127.0.0.1:5173'
const out = process.env.WBR_ANGKLUNG_OUT || 'artifacts/indonesian-angklung/free-shake'
const widths = process.env.WBR_WIDTHS?.split(',').map(Number) || [390, 320, 284]
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true }), results = []
try {
  for (const width of widths) {
    const touch = width === 320, reduced = width === 284, errors = []
    const page = await browser.newPage({ viewport: { width, height: 1000 }, hasTouch: touch, isMobile: touch })
    page.setDefaultTimeout(60000); page.on('pageerror', error => errors.push(error.message))
    await page.route('**/debug-render-style.ts*', async route => {
      const response = await route.fetch(), body = await response.text(), needle = 'const style = createRenderStyle(renderer, scene, camera);'
      assert.ok(body.includes(needle)); await route.fulfill({ response, body: body.replace(needle, 'globalThis.__angklungQA = { scene, camera };\n' + needle) })
    })
    await page.route('**/SceneReview.tsx*', async route => {
      const response = await route.fetch(), body = await response.text()
      assert.ok(body.includes('createState()')); await route.fulfill({ response, body: body.replace('createState()', `createState({ reducedMotion: ${reduced} })`) })
    })
    await page.addInitScript(() => {
      window.__angklungTicks = []; window.__angklungSounds = []
      Object.defineProperty(navigator, 'vibrate', { configurable: true, value: value => { window.__angklungTicks.push(value); return true } })
      const proto = window.AudioContext?.prototype, create = proto?.createOscillator
      if (create) proto.createOscillator = function () {
        const oscillator = create.call(this), start = oscillator.start, set = oscillator.frequency.setValueAtTime; let frequency
        oscillator.frequency.setValueAtTime = function (f, ...args) { frequency = f; return set.call(this, f, ...args) }
        oscillator.start = function (...args) { window.__angklungSounds.push(frequency); return start.apply(this, args) }
        return oscillator
      }
    })
    await page.goto(`${base}/scene-review?scene=indonesian-angklung`)
    await page.locator('.library-scene-stage[data-ready="true"]').waitFor()
    const input = await scenePointer(page, touch)
    const signals = () => page.evaluate(() => ({ ticks: [...window.__angklungTicks], sounds: [...window.__angklungSounds] }))
    const point = async (name, anchor) => {
      await page.locator('.scene-hit-layer').scrollIntoViewIfNeeded()
      return page.evaluate(({ name, anchor }) => {
        const { scene, camera } = window.__angklungQA, object = scene.getObjectByName(name)
        const p = object.localToWorld(object.position.clone().set(...anchor)).project(camera), r = document.querySelector('.library-scene-stage canvas').getBoundingClientRect()
        return [r.left + (p.x + 1) * r.width / 2, r.top + (1 - p.y) * r.height / 2]
      }, { name, anchor })
    }
    const shot = async phase => {
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      await page.screenshot({ path: `${out}/${width}-${phase}.png`, fullPage: true })
    }
    const end = page.getByRole('button', { name: '结束体验', exact: true })
    assert.equal(await end.isDisabled(), true); await shot('ready')
    const p = await point('angklung-frame-grip', [0, 0, .10])
    await input.down(p)
    for (const [i, x] of [36, -36, 36, -36].entries()) {
      const before = await signals(); await input.move([p[0] + x, p[1] + (i % 2 ? 16 : -16)], 3)
      const after = await signals()
      assert.ok(after.ticks.length > before.ticks.length, 'tick follows movement before release')
      assert.ok(after.sounds.length > before.sounds.length, 'tone follows movement before release')
      assert.equal(await page.locator('.scene-completion-actions').count(), 0)
    }
    await shot('held'); const heldSignals = await signals()
    await page.waitForTimeout(250); assert.deepEqual(await signals(), heldSignals)
    await input.up(); assert.equal(await end.isEnabled(), true)
    await page.waitForTimeout(350); assert.deepEqual(await signals(), heldSignals)
    for (const name of ['angklung-tube-long-body', 'angklung-tube-short-body']) {
      const from = await point(name, [0, .7, .19]), before = await signals()
      await input.down(from); await input.move([from[0] + 32, from[1] - 24], 4); await input.up()
      assert.ok((await signals()).ticks.length > before.ticks.length); assert.equal(await page.locator('.scene-completion-actions').count(), 0)
    }
    await page.getByRole('button', { name: '震动', exact: true }).click(); await page.getByRole('button', { name: '音效', exact: true }).click()
    const from = await point('angklung-frame-grip', [0, 0, .10]), beforeMuted = await signals()
    await input.down(from); await input.move([from[0] - 36, from[1]], 4); await input.up()
    assert.deepEqual(await signals(), beforeMuted)
    await page.getByRole('button', { name: '震动', exact: true }).click(); await page.getByRole('button', { name: '音效', exact: true }).click()
    const afterMute = await point('angklung-frame-grip', [0, 0, .10])
    await input.down(afterMute); await input.move([afterMute[0] + 36, afterMute[1]], 4); await input.up()
    assert.ok((await signals()).ticks.length > beforeMuted.ticks.length)
    const cancel = await point('angklung-frame-grip', [0, 0, .10]), beforeCancel = await signals()
    await input.down(cancel); await input.move([cancel[0] + 6, cancel[1]], 2); await input.cancel()
    assert.deepEqual(await signals(), beforeCancel)
    const appearance = await end.evaluate(button => ({ color: getComputedStyle(button).color, width: button.clientWidth, scroll: button.scrollWidth, height: button.getBoundingClientRect().height }))
    assert.notEqual(appearance.color, 'rgba(0, 0, 0, 0)'); assert.ok(appearance.width >= 70 && appearance.scroll <= appearance.width && appearance.height >= 44)
    await page.waitForTimeout(140)
    const keyboardBefore = await signals(), keyboardStart = await page.evaluate(() => performance.now())
    await page.getByRole('button', { name: '轻摇一下', exact: true }).focus()
    for (let n = 0; n < 10; n++) { await page.keyboard.down('Enter'); await page.waitForTimeout(20) }
    await page.keyboard.up('Enter')
    const keyboardAfter = await signals(), keyboardTime = await page.evaluate(() => performance.now()) - keyboardStart
    const keyboardBeats = keyboardAfter.ticks.length - keyboardBefore.ticks.length
    assert.ok(keyboardBeats > 0 && keyboardBeats <= Math.ceil(keyboardTime / 110) + 1)
    assert.equal(keyboardAfter.sounds.length - keyboardBefore.sounds.length, keyboardBeats * 2)
    assert.equal(await page.locator('.scene-completion-actions').count(), 0)
    await shot('free-play'); await end.click(); await page.locator('.scene-completion-actions').waitFor(); await shot('finished')
    const done = await signals(); assert.ok(done.sounds.every(f => f === 392 || f === 784)); assert.deepEqual(errors, [])
    results.push({ width, input: touch ? 'native-touch' : 'mouse', reduced, continuousShake: true, liveTones: true, liveHaptics: true, noAutoFinish: true, allSurfaces: true, settings: true, cancel: true, keyboardBeats, keyboardTime, manualFinish: true, ticks: done.ticks, sounds: done.sounds, errors })
    await writeFile(`${out}/browser.json`, JSON.stringify(results, null, 2)); console.log(JSON.stringify(results.at(-1)))
    await page.close()
  }
} finally { await browser.close() }
