import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { scenePointer } from './browser-scene-pointer.mjs'

const base = process.env.WBR_URL || 'http://127.0.0.1:5173'
const out = process.env.WBR_BOJAGI_OUT || 'artifacts/korean-bojagi-wrap/drop'
const widths = process.env.WBR_WIDTHS ? process.env.WBR_WIDTHS.split(',').map(Number) : [284, 390, 320, 1280]
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true }), results = []
try {
  for (const width of widths) {
    const touch = width === 320, page = await browser.newPage({ viewport: { width, height: 1000 }, hasTouch: touch, isMobile: touch }), errors = []
    const reduced = process.env.WBR_MOTION !== '1' && width !== 390, withAudio = width === 320 || width === 390
    page.on('pageerror', error => errors.push(error.message)); page.setDefaultTimeout(60000)
    await page.addInitScript(({ reduced }) => {
      window.__bojagiVibrations = []
      window.__bojagiSounds = []
      Object.defineProperty(navigator, 'vibrate', { configurable: true, value: n => { window.__bojagiVibrations.push(n); return true } })
      const audio = window.AudioContext?.prototype, createOscillator = audio?.createOscillator
      if (createOscillator) audio.createOscillator = function () {
        const oscillator = createOscillator.call(this), start = oscillator.start, setFrequency = oscillator.frequency.setValueAtTime
        let scheduledFrequency = oscillator.frequency.value
        oscillator.frequency.setValueAtTime = function (value, ...args) { scheduledFrequency = value; return setFrequency.call(this, value, ...args) }
        oscillator.start = function (...args) { window.__bojagiSounds.push(scheduledFrequency); return start.apply(this, args) }
        return oscillator
      }
      localStorage.setItem('cyber-bless:personal:v1', JSON.stringify({ version: 1, sceneRecords: [], wishes: [], activeSession: null, sessions: [], collectibles: [], ledger: [], settings: { sound: false, haptics: true, reducedMotion: reduced } }))
    }, { reduced })
    await page.goto(base)
    await page.getByRole('button', { name: '我的', exact: true }).click()
    await page.getByRole('button', { name: '场景目录', exact: true }).click()
    while (!await page.locator('.scene-card[data-scene="korean-bojagi-wrap"]').count()) await page.getByRole('button', { name: '显示更多', exact: true }).click()
    await page.locator('.scene-card[data-scene="korean-bojagi-wrap"]').click()
    await page.locator('.library-scene-stage[data-ready="true"]').waitFor()
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
    await setFeedbackMenu(true)
    const sound = page.getByRole('button', { name: '音效', exact: true })
    if (await sound.count() && (await sound.getAttribute('aria-pressed') === 'true') !== withAudio) await sound.click()
    await setFeedbackMenu(false)
    const input = await scenePointer(page, touch), done = () => page.locator('.scene-step-dot[data-state="done"]').count()
    const point = async role => {
      await page.locator('.scene-hit-layer').scrollIntoViewIfNeeded()
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      return page.locator(`[data-cue-role="${role}"]:not([hidden])`).evaluate(el => {
        const r = el.parentElement.getBoundingClientRect(); return [r.left + Number(el.dataset.x), r.top + Number(el.dataset.y)]
      })
    }
    const shot = async phase => {
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'horizontal overflow')
      await page.screenshot({ path: `${out}/${width}-${touch ? 'touch' : 'mouse'}-${phase}.png`, fullPage: true })
    }
    await shot('start')
    assert.equal(await page.locator('.scene-wish-slot input').count(), 0)
    for (let step = 0; step < 6; step++) {
      if ((touch || withAudio) && (step === 1 || step === 2)) await setFeedbackMenu(true)
      if (touch && (step === 1 || step === 2)) await page.getByRole('button', { name: '震动', exact: true }).click()
      if (withAudio && (step === 1 || step === 2)) await sound.click()
      if ((touch || withAudio) && (step === 1 || step === 2)) await setFeedbackMenu(false)
      const from = await point('source'), to = await point('target'), rect = await page.locator('.scene-hit-layer').boundingBox()
      for (const p of [from, to]) assert.ok(p[0] >= rect.x && p[0] <= rect.x + rect.width && p[1] >= rect.y && p[1] <= rect.y + rect.height, `operation ${step} cue inside canvas`)
      await input.down(from); await input.move([rect.x + 5, rect.y + rect.height - 5], 2); await input.up()
      assert.equal(await done(), step, `operation ${step}: wrong drop advanced`)
      const source = await point('source'), destination = await point('target')
      // Cover different parts of the lid, including points outside the old
      // 22px circle on desktop. The last pull also ends beyond its arrow.
      const offset = step < 4 ? (step % 2 ? -1 : 1) * (width === 1280 ? 25 : 5) : step === 5 ? (width === 1280 ? 25 : 8) : 0
      const target = [destination[0] + offset, destination[1]]
      const length = Math.hypot(target[0] - source[0], target[1] - source[1])
      const pickup = touch && step < 4 ? [source[0] + (target[0] - source[0]) * 12 / length, source[1] + (target[1] - source[1]) * 12 / length] : source
      await input.down(pickup); await input.move(target, 4)
      assert.equal(await done(), step, `operation ${step}: holding advanced before release`)
      await page.waitForFunction(text => document.querySelector('.scene-cue-guide')?.textContent.includes(text), step < 4 ? '已覆盖，松手落定' : step === 4 ? '系带已交叠，松手成结' : '布结已收紧，松手落定')
      assert.equal(await page.locator('.scene-cue-guide').isVisible(), true)
      if (width === 390 || touch && step === 4) await shot(`operation-${step}-held`)
      await input.up()
      if (process.env.WBR_DEBUG) console.log({ step, hint: await page.locator('.scene-hint').innerText(), disabled: await page.locator('.scene-bow-tap').isDisabled(), errors })
      await page.waitForFunction(n => document.querySelectorAll('.scene-step-dot[data-state="done"]').length === n, step + 1)
      await shot(`operation-${step + 1}`)
      assert.equal(await page.locator('.scene-completion-actions').count(), 0, 'craft operation auto-finished')
    }
    await page.getByRole('button', { name: '完成裹礼', exact: true }).click()
    await page.locator('.scene-completion-actions').waitFor(); await shot('finished')
    assert.equal(await page.locator('[data-cue-role="source"]').count(), 0)
    assert.deepEqual(errors, [])
    const vibrations = await page.evaluate(() => window.__bojagiVibrations)
    assert.deepEqual(vibrations, touch ? [24, 24, 24, 24, 40, 12] : [24, 24, 24, 24, 24, 40, 12], 'real host respects live haptic setting and craft strength')
    const sounds = await page.evaluate(() => window.__bojagiSounds)
    assert.deepEqual(sounds.map(n => Math.round(n * 100) / 100), withAudio ? [392, 523.25, 392, 523.25, 392, 523.25, 329.63, 440, 294, 392, 392, 587.33] : [], 'real AudioContext respects the live sound switch and operation tones')
    results.push({ width, input: touch ? 'native-touch' : 'mouse', motion: reduced ? 'reduced' : 'normal', operations: 6, missesRejected: 6, coverageAwayFromCenter: true, waitsForRelease: true, visibleReadyGuide: true, manualFinish: true, liveAudioToggle: withAudio, liveHapticToggle: touch, forgivingClothPickup: touch, vibrations, sounds, errors })
    await writeFile(`${out}/browser.json`, JSON.stringify(results, null, 2)); console.log(JSON.stringify(results.at(-1)))
    await page.close()
  }
} finally { await browser.close() }
