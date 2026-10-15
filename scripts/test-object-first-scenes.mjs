import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'

const base = process.env.WBR_URL || 'http://127.0.0.1:5178/'
const out = path.resolve('artifacts/object-first-scenes/browser')
await mkdir(out, { recursive: true })
const allIds = ['korean-bojagi-wrap', 'vietnamese-bamboo-dragonfly', 'turkish-ebru-paper', 'indonesian-angklung', 'weifang-paper-kite', 'chinese-shadow-puppet', 'faroese-wool-knit', 'niue-shell-necklace','polish-paper-cut', 'uzbek-clay-bowl','chinese-woodblock-print', 'czech-bead-star','fijian-woven-fan', 'amazigh-woven-rug','slovak-wire-bird', 'hungarian-embroidery-hoop', 'andalusian-ceramic-tile', 'sicilian-painted-cart','bai-indigo-cloth', 'ndebele-painted-house', 'purepecha-copper-bowl', 'welsh-love-spoon','barcelos-clay-rooster','finnish-birch-basket','croatian-licitar-heart','catalan-festival-giant','sorbian-painted-egg','basque-sunflower','breton-banner','lithuanian-straw-garden','dalarna-wooden-horse','aland-votive-ship','blang-tea','minangkabau-spinning-top','chinese-incense','hongsheng-red-string','italian-ex-voto','czech-pilgrim-journal','omikuji','polish-blessing-basket','navruz-sumalak','floating-lantern-loy-krathong','omamori-cycle','shrine-suzu-bell','st-brigids-cross','bokjori','woodfish','celtic-folk-spring','theravada-water','furin-wind-chime',
  'daruma-eye-painting','mizuhiki','milagros','phuang-malai','ema-votive-plaque',
  'clootie-well-rag','diya-oil-lamp','votive-candle-catholic','shinto-torii',
  'tibetan-wheel','tanzaku-tanabata','crane','slavic-wreath','lantern','yeondeunghoe']
const ids = process.env.WBR_SCENES ? process.env.WBR_SCENES.split(',') : allIds
const key = 'cyber-bless:personal:v1'
const empty = { version: 1, sceneRecords: [], wishes: [], activeSession: null, sessions: [], collectibles: [], ledger: [],
  settings: { sound: false, haptics: false, reducedMotion: true } }
const browser = await chromium.launch({ headless: true })
const errors = [], results = []
async function pageAt(width) {
  const page = await browser.newPage({ viewport: { width, height: width > 500 ? 900 : 844 } })
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(({ key, empty }) => localStorage.setItem(key, JSON.stringify(empty)), { key, empty })
  await page.goto(base)
  await page.getByRole('button', { name: '我的', exact: true }).click()
  await page.getByRole('button', { name: '场景目录', exact: true }).click()
  return page
}
async function open(page, id) {
  while (!await page.locator(`.scene-card[data-scene="${id}"]`).count()) await page.getByRole('button', { name: '显示更多', exact: true }).click()
  await page.locator(`.scene-card[data-scene="${id}"]`).click()
  await page.locator('canvas[data-environment-ready="true"]').waitFor()
  await page.locator('.scene-object-cue[data-cue-role="source"] .scene-object-cue-ring').first().waitFor()
  await page.locator('canvas').scrollIntoViewIfNeeded()
}
async function cuePoint(page, role = 'source', index = 0) {
  await page.locator(`[data-cue-role="${role}"]:not([hidden]) .scene-object-cue-ring`).nth(index).waitFor()
  return page.locator(`[data-cue-role="${role}"]`).nth(index).evaluate(el => {
    const box = el.parentElement.getBoundingClientRect()
    return [box.left + Number(el.dataset.x), box.top + Number(el.dataset.y)]
  })
}
async function tap(page) { await page.mouse.click(...await cuePoint(page)); await page.waitForTimeout(100) }
async function drag(page) {
  const from = await cuePoint(page), to = await cuePoint(page, 'target')
  await page.mouse.move(...from); await page.mouse.down(); await page.mouse.move(...to, { steps: 18 }); await page.mouse.up()
}
async function progress(page, id, n) {
  await page.waitForFunction(({ key, id, n }) => JSON.parse(localStorage.getItem(key)).sceneRecords.find(r => r.id === id)?.progress === n, { key, id, n })
  await page.waitForTimeout(100) // Let the next rendered frame replace the previous phase's marker.
}
for (const width of process.env.WBR_FLOW_ONLY ? [] : [390, 320, 1280]) {
  const page = await pageAt(width)
  for (const id of ids) {
    console.log(`Checking ${id} at ${width}px`)
    await open(page, id)
    const state = await page.evaluate(() => {
      const layer = document.querySelector('.scene-object-cues'), box = layer.getBoundingClientRect()
      const sources = [...layer.querySelectorAll('[data-cue-role="source"]')]
      const labels = [...layer.querySelectorAll('.scene-object-cue:not([hidden]):not([data-compact="true"]) .scene-object-cue-label')].map(el => {
        const r = el.getBoundingClientRect(); return { text: el.textContent, left: r.left - box.left, right: r.right - box.left, top: r.top - box.top, bottom: r.bottom - box.top }
      })
      return { count: sources.length, full: sources.filter(el => el.dataset.compact !== 'true').length, passive: getComputedStyle(layer).pointerEvents, width: box.width, height: box.height, labels,
        motion: getComputedStyle(sources[0].firstElementChild).animationName,
        buttons: [...document.querySelectorAll('.scene-bow-tap:not([hidden])')].map(el => ({ height: el.getBoundingClientRect().height, shadow: getComputedStyle(el).boxShadow, name: el.getAttribute('aria-label') })),
        overflow: document.documentElement.scrollWidth > innerWidth }
    })
    assert.ok(state.count >= 1 && state.full <= 3, `${id} ${width}: source count`)
    assert.equal(state.passive, 'none'); assert.equal(state.motion, 'none'); assert.equal(state.overflow, false)
    for (const label of state.labels) assert.ok(label.left >= 0 && label.right <= state.width + 1 && label.top >= 0 && label.bottom <= state.height + 1, `${id} ${width}: label outside canvas ${JSON.stringify(label)}`)
    for (const button of state.buttons) { assert.ok(button.height >= 44); assert.equal(button.shadow, 'none'); assert.ok(button.name) }
    const point = await cuePoint(page)
    assert.equal(await page.evaluate(([x,y]) => !!document.elementFromPoint(x,y)?.closest('.scene-object-cues'), point), false, 'cue intercepted the physical object')
    if (width === 390 || ['diya-oil-lamp','daruma-eye-painting','crane'].includes(id)) await page.screenshot({ path: path.join(out, `${id}-${width}.png`), fullPage: true, animations: 'disabled' })
    results.push({ id, width, sources: state.count })
    await page.getByRole('button', { name: '返回', exact: true }).click()
    assert.equal(await page.locator('.scene-object-cues').count(), 0, `${id}: cue DOM leaked`)
  }
  await page.close(); console.log(`${width}px: ${ids.length} scenes have passive, bounded object hints`)
}
if (!process.env.WBR_FLOW_ONLY) await writeFile(path.join(out,'layout-report.json'),JSON.stringify({ results, errors },null,2))
// Use the displayed geometry anchors themselves, never the auxiliary buttons.
for (const id of ['celtic-folk-spring','clootie-well-rag','lantern','furin-wind-chime','crane']) {
  if (!ids.includes(id)) continue
  const page = await pageAt(390); await open(page, id)
  if (id === 'celtic-folk-spring') {
    await tap(page); await progress(page,id,1); await drag(page); await progress(page,id,2)
  } else if (id === 'clootie-well-rag') {
    await drag(page); await progress(page,id,1); await drag(page); await progress(page,id,2); await tap(page); await progress(page,id,3)
  } else if (id === 'lantern') {
    await tap(page); await progress(page,id,1); await page.locator('[data-cue-role="source"][data-kind="drag"]').waitFor({ state: 'attached' })
    await drag(page); await progress(page,id,2); await tap(page); await progress(page,id,3)
  } else if (id === 'furin-wind-chime') {
    // Reduced motion skips the ringing animation and enters listening immediately.
    await tap(page); await progress(page,id,2); await page.locator('[data-cue-role="source"][data-kind="tap"]').waitFor({ state: 'attached' }); await tap(page); await progress(page,id,3)
  } else {
    for (let i = 0; i < 4; i++) { await page.locator('[data-cue-role="source"][data-kind="tap"]').waitFor({ state: 'attached' }); await tap(page) }
    await progress(page,id,1); await page.locator('[data-cue-role="source"][data-kind="drag"]').waitFor({ state: 'attached' }); await drag(page); await progress(page,id,2)
  }
  assert.equal(await page.locator('[data-cue-role="source"]').count(), 0, `${id}: finished physical phase retained hints`)
  results.push({ id, objectFlow: 'passed' }); console.log(`${id}: displayed object anchors complete the physical steps`)
  await page.close()
}
await browser.close()
assert.deepEqual(errors, [])
await writeFile(path.join(out,process.env.WBR_FLOW_ONLY ? 'flows-report.json' : 'report.json'),JSON.stringify({ results, errors },null,2))
console.log(JSON.stringify({ sizes: process.env.WBR_FLOW_ONLY ? 0 : 3, scenes: ids.length, objectFlows: results.filter(r => r.objectFlow).length, errors, out }))
