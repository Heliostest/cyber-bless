import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const base = process.argv[2] || process.env.WBR_URL || 'http://127.0.0.1:5174'
const out = 'artifacts/hanging-pivot/all-rituals'
const cases = [
  { id: 'bokjori', body: 'bokjori-scoop', points: [{ name: 'bokjori-scoop', local: [0, 1.23, .075], fixed: [.5, 2.09, -.245] }] },
  { id: 'st-brigids-cross', body: 'brigid-cross', points: [{ name: 'brigid-cross', local: [0, .98, .02], fixed: [0, 1.98, .2656] }] },
  { id: 'breton-banner', body: 'banner-cloth', vertex: 860, points: [
    { name: 'banner-fixed-hem', fixed: [.32, 2.60, .336] }, { name: 'banner-hem-tab', fixed: [1.46, 2.60, .38] },
  ] },
  { id: 'lithuanian-straw-garden', body: 'straw-mobile', points: [{ name: 'straw-mobile', local: [0, .77, .12], fixed: [.72, 2.89, .12] }] },
  { id: 'omamori-cycle', body: 'omamori-pouch-coral', points: [{ name: 'omamori-pouch-coral', local: [0, .64, -.015], fixed: [.58, 1.68, .25] }] },
  { id: 'milagros', body: 'milagros-charm-0', points: [{ name: 'milagros-charm-0', local: [0, .37, .025], fixed: [0, 1.69, .16] }] },
  { id: 'ema-votive-plaque', initial: 3, body: 'ema-plaque', points: [{ name: 'ema-plaque', local: [0, .8, 0], fixed: [0, 1.84, .09] }] },
  { id: 'shrine-suzu-bell', initial: 0, action: true, body: 'suzu-round-split-bell', points: [
    { name: 'suzu-round-split-bell', local: [0, .31, 0], fixed: [0, 2.48, .11] },
    { name: 'suzu-braided-rope', local: [0, -.265, 0], relativeTo: 'suzu-round-split-bell', at: [0, -.265, 0] },
  ] },
  { id: 'shinto-torii', body: 'torii-rack-ema-0', local: [0, -.16, 0], points: [
    ...Array.from({ length: 5 }, (_, i) => ({ name: `torii-rack-ema-${i}` })), { name: 'torii-own-ema' },
  ] },
  { id: 'lantern', body: 'lantern-body', points: [{ name: 'lantern-plaque', relativeTo: 'lantern-body', at: [0, -.39, 0] }] },
  { id: 'tanzaku-tanabata', body: 'tanzaku-loose-strip', local: [0, -.42, 0], points: [
    ...[[-.2, 2.3, 0], [.25, 2, .05], [-.5, 1.7, -.1]].map((at, i) => ({ name: `tanzaku-preset-strip-${i}`, relativeTo: 'tanzaku-bamboo', at })),
    { name: 'tanzaku-loose-strip', relativeTo: 'tanzaku-bamboo', at: [.45, 1.75, .12] },
  ] },
]
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true }), results = []
try {
  for (const config of cases) for (const [width, reduced] of [[390, false], [1280, false], [390, true]]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } }), errors = []
    page.setDefaultTimeout(60000); page.on('pageerror', error => errors.push(error.stack || error.message))
    await page.routeWebSocket('**', socket => socket.close())
    await page.route('**/debug-render-style.ts*', async route => {
      const response = await route.fetch(), body = await response.text(), needle = 'const style = createRenderStyle(renderer, scene, camera);'
      assert.ok(body.includes(needle)); await route.fulfill({ response, body: body.replace(needle, 'globalThis.__hangingQA = { scene, camera };\n' + needle) })
    })
    await page.route('**/SceneReview.tsx*', async route => {
      const response = await route.fetch(), body = await response.text()
      assert.ok(body.includes('createState()')); await route.fulfill({ response, body: body.replace('createState()', `createState({ reducedMotion: ${reduced} })`) })
    })
    // Restore a real scene checkpoint through a test-page response fixture, without a product QA API.
    await page.route(`**/${config.id}/scene.ts*`, async route => {
      const response = await route.fetch(), body = await response.text(), entry = /export function \w+\(ctx\) \{/
      assert.match(body, entry)
      await route.fulfill({ response, body: body.replace(entry, match => `${match}\nctx = { ...ctx, initialProgress: ${config.initial ?? 2}, initialVariant: 'coral', deferWishWriting: true };`) })
    })
    await page.goto(`${base}/scene-review?scene=${config.id}`)
    await page.locator('.library-scene-stage[data-ready="true"]').waitFor()
    await page.evaluate(config => {
      const { scene } = window.__hangingQA
      const body = scene.getObjectByName(config.body), vector = (point = [0, 0, 0]) => body.position.clone().set(...point)
      if (!body) throw Error(`Missing body ${config.body}`)
      const samples = config.points.map(point => {
        const object = scene.getObjectByName(point.name)
        if (!object) throw Error(`Missing attachment ${point.name}`)
        return { ...point, object, baseline: point.fixed ? vector(point.fixed) : object.localToWorld(vector(point.local)) }
      })
      const bodyPoint = () => body.localToWorld(config.vertex === undefined ? vector(config.local) : vector().fromBufferAttribute(body.geometry.getAttribute('position'), config.vertex))
      const first = bodyPoint(), result = window.__allHangingResult = { samples: 0, maxAttachmentError: 0, maxBodyTravel: 0 }
      function frame() {
        scene.updateMatrixWorld(true)
        for (const point of samples) {
          const expected = point.relativeTo ? scene.getObjectByName(point.relativeTo).localToWorld(vector(point.at)) : point.baseline
          result.maxAttachmentError = Math.max(result.maxAttachmentError, point.object.localToWorld(vector(point.local)).distanceTo(expected))
        }
        result.maxBodyTravel = Math.max(result.maxBodyTravel, bodyPoint().distanceTo(first)); result.samples++
        requestAnimationFrame(frame)
      }
      requestAnimationFrame(frame)
    }, config)
    if (config.action) await page.locator('.scene-bow-tap').click()
    await page.waitForFunction(min => window.__allHangingResult.samples >= min, reduced ? 40 : 85)
    const result = await page.evaluate(() => window.__allHangingResult), tag = `${config.id}-${width}-${reduced ? 'reduced' : 'normal'}`
    await page.screenshot({ path: `${out}/${tag}.png`, fullPage: true })
    assert.ok(result.maxAttachmentError < 1e-6, `${tag}: attachment moved ${result.maxAttachmentError}`)
    if (reduced) assert.ok(result.maxBodyTravel < 1e-6, `${tag}: reduced motion moved body ${result.maxBodyTravel}`)
    else assert.ok(result.maxBodyTravel > .0001, `${tag}: no visible body motion`)
    assert.deepEqual(errors, [], tag)
    results.push({ id: config.id, width, reduced, ...result, errors })
    await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2) + '\n')
    console.log(`${tag}: ${result.samples} frames, attachment error ${result.maxAttachmentError}`)
    await page.close()
  }
} finally { await browser.close() }
