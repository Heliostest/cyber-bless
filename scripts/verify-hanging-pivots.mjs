import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const base = process.argv[2] || process.env.WBR_URL || 'http://127.0.0.1:5173'
const out = process.env.WBR_HANGING_OUT || 'artifacts/hanging-pivot'
const scenes = [
  { id: 'bokjori', name: 'bokjori-scoop', pivot: 'bokjori-suspension', anchor: [0, 1.23, .075], fixed: [.5, 2.09, -.245], actions: 2 },
  { id: 'st-brigids-cross', name: 'brigid-cross', pivot: 'brigid-suspension', anchor: [0, .98, .02], fixed: [0, 1.98, .2656], actions: 5 },
]
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true }), results = []
try {
  for (const config of scenes) for (const [width, reduced] of [[390, false], [1280, false], [390, true]]) {
    const errors = [], page = await browser.newPage({ viewport: { width, height: 1000 } })
    page.setDefaultTimeout(60000); page.on('pageerror', error => errors.push(error.stack || error.message))
    // Other work may update this shared checkout during QA; keep this page's modules stable.
    await page.routeWebSocket('**', socket => socket.close())
    await page.route('**/debug-render-style.ts*', async route => {
      const response = await route.fetch(), body = await response.text(), needle = 'const style = createRenderStyle(renderer, scene, camera);'
      assert.ok(body.includes(needle))
      await route.fulfill({ response, body: body.replace(needle, 'globalThis.__hangingQA = { scene, camera };\n' + needle) })
    })
    await page.route('**/SceneReview.tsx*', async route => {
      const response = await route.fetch(), body = await response.text()
      assert.ok(body.includes('createState()'))
      await route.fulfill({ response, body: body.replace('createState()', `createState({ reducedMotion: ${reduced} })`) })
    })
    await page.goto(`${base}/scene-review?scene=${config.id}`)
    await page.locator('.library-scene-stage[data-ready="true"]').waitFor()
    await page.evaluate(config => {
      const { scene } = window.__hangingQA, object = scene.getObjectByName(config.name), pivot = scene.getObjectByName(config.pivot)
      const local = object.position.clone().set(...config.anchor), pin = object.position.clone().set(...config.fixed)
      const result = window.__hangingResult = { samples: 0, maxAttachmentError: 0, maxBodyTravel: 0 }
      let firstBody
      function sample() {
        scene.updateMatrixWorld(true)
        if (pivot.position.y > 0) {
          const contact = object.localToWorld(local.clone()), body = object.getWorldPosition(local.clone().set(0, 0, 0))
          firstBody ??= body.clone()
          result.samples++; result.maxAttachmentError = Math.max(result.maxAttachmentError, contact.distanceTo(pin))
          result.maxBodyTravel = Math.max(result.maxBodyTravel, body.distanceTo(firstBody))
        }
        requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    }, config)
    for (let i = 0; i < config.actions; i++) await page.locator('.scene-bow-tap').click()
    await page.waitForFunction(() => window.__hangingResult.samples >= 15)
    const tag = `${config.id}-${width}-${reduced ? 'reduced' : 'normal'}`
    await page.screenshot({ path: `${out}/${tag}-hung.png`, fullPage: true })
    await page.locator('.scene-completion-actions').waitFor()
    const result = await page.evaluate(() => window.__hangingResult)
    assert.ok(result.samples >= 15, tag)
    assert.ok(result.maxAttachmentError < 1e-7, `${tag}: attachment moved ${result.maxAttachmentError}`)
    if (reduced) assert.ok(result.maxBodyTravel < 1e-7, `${tag}: reduced motion moved the object`)
    else assert.ok(result.maxBodyTravel > .01, `${tag}: object did not sway`)
    assert.deepEqual(errors, [], tag)
    await page.screenshot({ path: `${out}/${tag}-complete.png`, fullPage: true })
    results.push({ id: config.id, width, reduced, ...result, errors })
    console.log(`${tag}: ${result.samples} frames, attachment error ${result.maxAttachmentError}`)
    await page.close()
  }
} finally { await browser.close() }
await writeFile(`${out}/browser-results.json`, JSON.stringify(results, null, 2) + '\n')
console.log(JSON.stringify(results, null, 2))
