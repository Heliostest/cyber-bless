import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { builtInScenes, isSceneVisibleInApp } from '../packages/core/src/daily-scenes.ts'
import { sceneIntention } from '../packages/core/src/scene-intentions.ts'

const out = 'artifacts/optional-scene-wishes', results = []
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })
const base = process.env.WBR_URL || 'http://127.0.0.1:5173'
async function open(id, width = 390, reduced = false) {
  const page = await browser.newPage({ viewport: { width, height: 1000 } }), errors = []
  page.on('pageerror', error => errors.push(error.message))
  if (reduced) {
    await page.addInitScript(() => localStorage.setItem('cyber-bless:personal:v1', JSON.stringify({
      version: 1, sceneRecords: [], wishes: [], activeSession: null, sessions: [], collectibles: [], ledger: [],
      settings: { sound: false, haptics: false, reducedMotion: true },
    })))
    await page.goto(base)
    await page.getByRole('button', { name: '我的', exact: true }).click()
    await page.getByRole('button', { name: '场景目录', exact: true }).click()
    while (!await page.locator(`.scene-card[data-scene="${id}"]`).count()) await page.getByRole('button', { name: '显示更多', exact: true }).click()
    await page.locator(`.scene-card[data-scene="${id}"]`).click()
  } else await page.goto(`${base}/scene-review?scene=${id}`)
  await page.locator('.scene-intention').waitFor()
  await page.locator('canvas').first().waitFor()
  if (id !== 'woodfish') await page.locator('.library-scene-stage[data-ready="true"]').waitFor()
  return { page, errors }
}
async function finish(page) {
  for (let n = 0; n < 28; n++) {
    await page.waitForFunction(() => document.querySelector('.scene-done-row') || document.querySelector('.scene-bow-tap:not(:disabled)'))
    if (await page.locator('.scene-done-row').count()) return
    await page.locator('.scene-bow-tap').press('Enter')
  }
  throw Error('the ritual must finish without typing')
}
try {
  for (const entry of builtInScenes.filter(isSceneVisibleInApp)) {
    const { page, errors } = await open(entry.id)
    const intention = sceneIntention(entry.id)
    assert.equal(await page.locator('.scene-intention').getAttribute('data-kind'), intention.kind)
    assert.equal(await page.locator('.scene-intention strong').innerText(), intention.label)
    assert.equal(await page.locator('.scene-intention p').innerText(), intention.action)
    assert.equal(await page.locator('.scene-intention p').isVisible(), true)
    assert.equal(await page.locator('.scene-post-wish').count(), 0)
    assert.equal(await page.locator('.library-scene-stage input').count(), 0, `${entry.id} must not ask for writing during actions`)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    assert.deepEqual(errors, [])
    results.push({ id: entry.id, kind: intention.kind, purposeVisible: true, textBoxDuringRitual: false })
    await writeFile(`${out}/browser.json`, JSON.stringify(results, null, 2))
    console.log(JSON.stringify(results.at(-1)))
    await page.close()
  }

  for (const [id, record] of [['tanzaku-tanabata', true], ['korean-bojagi-wrap', false], ['omikuji', false]]) {
    const { page, errors } = await open(id, 320, true)
    await page.locator('.library-scene-stage[data-ready="true"]').waitFor()
    await finish(page)
    assert.equal(await page.locator('.scene-post-wish input').count(), 0)
    if (sceneIntention(id).optionalWish) {
      await page.locator('.scene-wish-invite').click()
      const input = page.locator('.scene-post-wish input')
      await input.fill('   ')
      assert.equal(await page.locator('.scene-post-wish button[type="submit"]').isDisabled(), true)
      await input.fill(record ? '愿牵挂的人平安' : '还没写好的草稿')
      if (record) {
        await page.locator('.scene-post-wish button[type="submit"]').click()
        assert.equal(await page.locator('.scene-post-wish input').count(), 0)
        assert.ok((await page.locator('.scene-wish-saved').innerText()).includes('已存进心愿'))
      } else {
        await page.locator('.scene-wish-cancel').click()
        await page.locator('.scene-wish-invite').click()
        assert.equal(await input.inputValue(), '')
        await page.locator('.scene-wish-cancel').click()
      }
    } else assert.equal(await page.locator('.scene-post-wish').count(), 0)
    await page.screenshot({ path: `${out}/${id}-done-320.png`, fullPage: true })
    if (record) await page.getByRole('button', { name: '去心愿看看', exact: true }).click()
    else {
      await page.locator('.scene-completion-actions .button.primary').click()
      if (!await page.locator('[data-tab="wishes"]').count()) {
        assert.equal(await page.locator('.app-shell').getAttribute('data-page'), 'scenes')
        await page.getByRole('button', { name: '返回', exact: true }).click()
      }
      await page.locator('[data-tab="wishes"]').click()
    }
    await page.locator('.app-shell[data-page="wishes"]').waitFor()
    assert.equal(await page.locator('.wish-card').count(), record ? 1 : 0)
    if (record) assert.equal(await page.locator('.wish-card strong').innerText(), '愿牵挂的人平安')
    assert.deepEqual(errors, [])
    results.push({ id, completedWithoutWriting: true, explicitRecord: record, wishCards: record ? 1 : 0 })
    await writeFile(`${out}/browser.json`, JSON.stringify(results, null, 2))
    console.log(JSON.stringify(results.at(-1)))
    await page.close()
  }
  await writeFile(`${out}/browser.json`, JSON.stringify(results, null, 2))
} finally { await browser.close() }
