import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { scenePointer } from './browser-scene-pointer.mjs'

const base = process.env.WBR_URL || 'http://127.0.0.1:5182'
const out = new URL('../artifacts/interaction-fixes-2026-10-23/browser/', import.meta.url)
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })
const results = [], errors = []
const page = await browser.newPage({ viewport: { width: 390, height: 1040 }, hasTouch: true })
page.on('pageerror', error => errors.push(error.message))
async function open(id) {
  await page.goto(`${base}/scene-review?scene=${id}`)
  await page.bringToFront()
  await page.locator(`.library-scene-stage[data-scene="${id}"][data-ready="true"] canvas[data-environment-ready="true"]`).waitFor()
  await page.locator('[data-cue-role="source"]').first().waitFor({ state: 'attached' })
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}
async function point(role = 'source') {
  return page.locator(`[data-cue-role="${role}"]:not([hidden])`).first().evaluate(el => {
    const r = el.parentElement.getBoundingClientRect()
    return [r.left + Number(el.dataset.x), r.top + Number(el.dataset.y)]
  })
}
async function finished(id, step) {
  // Chinowa's five-second crossing advances with capped frame deltas. Software
  // WebGL can need more wall time; wait for the checkpoint, not a fixed delay.
  await page.waitForFunction(n => document.querySelector('.scene-progress')?.textContent.includes(`已完成 ${n} / 3`), step, { timeout: 45000 })
  if (step < 3) await page.locator('.scene-bow-tap:not([disabled])').waitFor({ state: 'attached' })
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  results.push({ id, step })
  console.log(`${id}: physical step ${step} completed`)
}
try {
  for (const touch of [false, true]) {
    const input = await scenePointer(page, touch)
    for (const id of ['sumiyoshi-godairiki', 'chinowa-kuguri', 'thai-songkran-elders']) {
      await open(id)
      for (const [step, distance] of [[1, 85], [2, 120], [3, 180]]) {
        const from = await point()
        const angle = await page.locator('.scene-cue-direction').first().evaluate(el => parseFloat(el.style.getPropertyValue('--cue-angle'))) * Math.PI / 180
        const direction = [Math.cos(angle), Math.sin(angle)]
        const far = [from[0] + direction[0] * distance, from[1] + direction[1] * distance]
        const end = [from[0] + direction[0] * (distance - 20), from[1] + direction[1] * (distance - 20)]
        await input.down(from); await input.move(far); await input.move(end, 3)
        assert.equal(await page.locator('.scene-hint').getAttribute('data-ready'), 'true', `${id}: normal drag should preview completion`)
        assert.ok(await page.locator('.scene-hint').evaluate(el => el.getBoundingClientRect().height > 10 && getComputedStyle(el).clipPath === 'none'), `${id}: readiness must be visible`)
        await input.up(); await finished(id, step)
      }
      results.push({ id, touch, longDragsAndCorrection: true })
    }
    for (const id of ['welsh-love-spoon', 'lithuanian-straw-garden', 'sorbian-painted-egg']) {
      await open(id)
      for (let step = 1; step <= 2; step++) {
        if (id === 'sorbian-painted-egg' && step === 2)
          await page.waitForFunction(() => [...document.querySelectorAll('.scene-cue-text')].some(el => el.textContent.startsWith('轻托彩蛋')))
        const from = await point(), to = await point('target')
        await input.down(from); await input.move(to)
        assert.equal(await page.locator('.scene-hint').getAttribute('data-drop-ready'), 'true', `${id}: aligned drop should show readiness`)
        assert.ok(await page.locator('.scene-hint').evaluate(el => el.getBoundingClientRect().height > 10 && getComputedStyle(el).clipPath === 'none'), `${id}: drop feedback must be visible`)
        await input.up(); await finished(id, step)
      }
      results.push({ id, touch, physicalPlacements: true })
    }
  }
  assert.deepEqual(errors, [])
} catch (error) {
  await page.screenshot({ path: new URL('failure.png', out).pathname.replace(/^\/(?:([A-Z]:))/, '$1'), fullPage: true })
  throw error
} finally {
  await writeFile(new URL('report.json', out), JSON.stringify({ results, errors }, null, 2))
  await browser.close()
}
console.log(JSON.stringify({ checks: results.length, errors }))
