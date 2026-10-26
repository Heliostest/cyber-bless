// Run against a built production preview. Uses public catalog navigation and
// native browser input; no scene test route or application-state injection API.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { chromium } from 'playwright'
import { scenePointer } from './browser-scene-pointer.mjs'

const base = process.env.WBR_URL || 'http://127.0.0.1:4174'
const out = fileURLToPath(new URL('../artifacts/spatial-placement-2026-10-26/browser/', import.meta.url))
const cases = [
  ['japanese-kadomatsu', 3], ['chinese-longevity-lock', 3], ['chinese-ruyi-scepter', 3],
  ['balinese-canang-sari', 3], ['brat-bride-cloth', 3], ['kagami-mochi-offering', 3],
  ['horseshoe-doorway-luck', 3], ['kameido-usokae', 3], ['sumiyoshi-godairiki', 3],
  ['aland-votive-ship', 1], ['votive-candle-catholic', 1], ['polish-blessing-basket', 2],
  ['tibetan-water-bowls', 9],
].filter(([id]) => !process.env.WBR_SCENES || process.env.WBR_SCENES.split(',').includes(id))
const widths = (process.env.WBR_WIDTHS || '320,390').split(',').map(Number)
const report = { at: new Date().toISOString(), base, results: [], failures: [], pageErrors: [], scope: 'Production WebGL, touch viewport emulation; not physical mobile-device testing.' }
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ channel: process.env.WBR_BROWSER || 'msedge', headless: true, args: ['--no-proxy-server', '--enable-unsafe-swiftshader'] })
const save = () => writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n')
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
async function point(page, role) {
  return page.locator(`[data-cue-role="${role}"]:not([hidden])`).first().evaluate(element => {
    const r = element.parentElement.getBoundingClientRect()
    return [r.left + Number(element.dataset.x), r.top + Number(element.dataset.y)]
  })
}
async function open(page, id) {
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: '我的', exact: true }).click()
  await page.getByRole('button', { name: '场景目录', exact: true }).click()
  const card = page.locator(`.scene-card[data-scene="${id}"]`)
  for (let n = 0; !await card.count(); n++) {
    assert.ok(n < 12, `${id} is reachable in the catalog`)
    const more = page.getByRole('button', { name: '显示更多', exact: true })
    assert.ok(await more.count(), `${id} is a visible App scene, rather than a hidden historical engine`)
    await more.click()
  }
  await card.click()
  await page.locator(`.library-scene-stage[data-scene="${id}"][data-ready="true"] canvas[data-environment-ready="true"]`).waitFor({ timeout: 60000 })
  await page.locator('[data-cue-role="source"]:not([hidden])').first().waitFor()
  await page.evaluate(() => document.fonts.ready)
  await settle(page)
  assert.equal(await page.locator('.scene-load-error').count(), 0)
  assert.ok(await page.evaluate(() => [...document.scripts].some(script => /\/assets\/.*\.js/.test(script.src))), 'loads built assets')
}
async function layout(page) {
  return page.evaluate(() => {
    const nodes = [document.documentElement, document.body, document.querySelector('.app-shell'), document.querySelector('main.app-content')]
    return nodes.filter(Boolean).map(element => ({ className: element.className, h: element.clientHeight, sh: element.scrollHeight, w: element.clientWidth, sw: element.scrollWidth, top: element.scrollTop }))
  })
}
try {
  for (const width of widths) for (const [id, steps] of cases) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: true, isMobile: true, locale: 'zh-CN' })
    const page = await context.newPage(), errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(() => localStorage.setItem('cyber-bless:personal:v1', JSON.stringify({ version: 1, sceneRecords: [], wishes: [], activeSession: null, sessions: [], collectibles: [], ledger: [], settings: { sound: false, haptics: false, reducedMotion: false } })))
    let at = 0
    try {
      await open(page, id)
      const input = await scenePointer(page, true), result = { id, width, steps: [] }
      for (at = 0; at < steps; at++) {
        await page.locator('[data-cue-role="target"]:not([hidden])').first().waitFor()
        const from = await point(page, 'source'), to = await point(page, 'target')
        const offset = [5, -4], start = [from[0] + offset[0], from[1] + offset[1]]
        const end = [to[0] + offset[0], to[1] + offset[1]]
        await input.down(start)
        const middle = [start[0] + (end[0] - start[0]) * .2, start[1] + (end[1] - start[1]) * .2]
        await input.move(middle, 3); await settle(page)
        const held = await point(page, 'source')
        assert.ok(Math.hypot(held[0] - from[0], held[1] - from[1]) > 1, `${id} ${at}: visible object follows the held input`)
        // Take a correction outside the acceptance region before approaching.
        const detour = [middle[0], Math.min(760, Math.max(110, middle[1] + 18))]
        await input.move(detour, 3); await input.move(end, 8)
        await page.waitForFunction(n => document.querySelector('.scene-progress')?.textContent.includes(`已完成 ${n} /`), at + 1, { timeout: 45000 })
        const acceptedWhileHeld = await page.locator('.scene-progress').textContent()
        await input.move([Math.min(width - 5, end[0] + 30), Math.max(90, end[1] - 25)], 2)
        await settle(page)
        assert.equal(await page.locator('.scene-progress').textContent(), acceptedWhileHeld, 'remaining finger motion cannot advance a second checkpoint')
        await page.screenshot({ path: path.join(out, `${width}-${id}-${at + 1}.png`) })
        await input.up(); await settle(page)
        result.steps.push({ at, from, to, held, acceptedWhileHeld })
      }
      for (const node of await layout(page)) assert.ok(node.sh <= node.h + 2 && node.sw <= node.w + 2 && Math.abs(node.top) <= 1, 'scene remains a single phone page')
      assert.deepEqual(errors, [])
      report.results.push(result); console.log(`${width} ${id}: ${steps} placements accepted before pointerup`)
    } catch (error) {
      const sceneError = await page.locator('.scene-load-error').allTextContents().catch(readError => [`Diagnostic unavailable: ${readError.message}`])
      const detail = { id, width, at, message: error.message, sceneError }
      report.failures.push(detail); console.error(JSON.stringify(detail))
      await page.screenshot({ path: path.join(out, `${width}-${id}-failure.png`) }).catch(() => {})
    } finally { report.pageErrors.push(...errors); await context.close(); await save() }
  }
} finally { await browser.close(); await save() }
assert.equal(report.failures.length, 0, 'all spatial browser checks pass')
assert.deepEqual(report.pageErrors, [])
