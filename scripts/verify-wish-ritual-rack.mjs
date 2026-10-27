import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { builtInScenes } from '../packages/core/src/daily-scenes.ts'
import { sceneStepCount } from '../packages/core/src/scene-steps.ts'

// Production-browser evidence for collected objects on the wooden wish rack.
// This checks saved data and UI; it does not validate cultural facts or hardware.
const out = 'artifacts/wish-ritual-rack'
const base = process.env.WBR_URL || 'http://127.0.0.1:5176'
const key = 'cyber-bless:personal:v1'
const at = '2026-10-26T08:00:00.000Z'
const results = [], screenshots = [], pages = []
let currentPage
const entry = id => {
  const value = builtInScenes.find(item => item.id === id)
  assert.ok(value, `missing fixture scene ${id}`)
  return value
}
const keepsake = (id, sceneId, extra = {}) => ({
  id, kind: 'scene', title: entry(sceneId).title, sceneId, wishScene: true, at, ...extra,
})
const sampleWish = { id: 'existing-wish', title: '愿家人平安，也给自己一点从容', intention: '',
  category: 'life', returnMethod: 'kindness', status: 'active', archived: false, createdAt: at, notes: [] }
const state = (collectibles = [], extra = {}) => ({
  version: 1, sceneRecords: [], wishes: [sampleWish], activeSession: null,
  sessions: [], collectibles, ledger: [],
  settings: { sound: false, haptics: false, reducedMotion: true }, ...extra,
})
const completeRecord = id => {
  const value = entry(id)
  return { id, title: value.title, engine: value.engine, revision: value.revision,
    manifestUrl: value.manifestUrl, progress: sceneStepCount(value), steps: sceneStepCount(value),
    favorite: false, lastOpened: at }
}
const mainInventory = [
  keepsake('used-tanzaku', 'tanzaku-tanabata', { spentAt: at, title: '短册系竹 · 已用旧藏' }),
  keepsake('unused-daruma', 'daruma-eye-painting'),
  keepsake('unused-crane', 'crane'),
]
const selector = id => `.wish-rack-item[data-collectible-id="${id}"]`
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ channel: process.env.WBR_BROWSER || 'msedge', headless: true,
  args: ['--no-proxy-server', '--enable-unsafe-swiftshader'] })
async function open(saved, width = 390) {
  const page = await browser.newPage({ viewport: { width, height: 1000 } })
  currentPage = page
  page.setDefaultTimeout(20000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  pages.push({ page, width, errors })
  await page.addInitScript(({ key, saved, origin }) => {
    if (location.origin === origin) localStorage.setItem(key, JSON.stringify(saved))
  }, { key, saved, origin: new URL(base).origin })
  await page.goto(base)
  await page.locator('[data-tab="wishes"]').click()
  await page.locator('.app-shell[data-page="wishes"]').waitFor()
  await page.evaluate(() => document.fonts.ready)
  assert.equal(await page.locator('.bless-app.reduce-motion').count(), 1)
  return page
}
const saved = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)
async function settleSave(page, predicate) {
  await page.waitForFunction(({ key, predicate }) => {
    const value = JSON.parse(localStorage.getItem(key))
    return predicate === 'daruma-spent' ? !!value.collectibles.find(item => item.id === 'unused-daruma')?.spentAt
      : predicate === 'one-new-wish' ? value.wishes.length === 2 : false
  }, { key, predicate })
  return saved(page)
}
async function noOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({ viewport: innerWidth,
    document: document.documentElement.scrollWidth, body: document.body.scrollWidth }))
  assert.ok(dimensions.document <= dimensions.viewport && dimensions.body <= dimensions.viewport,
    `${label}: horizontal overflow ${JSON.stringify(dimensions)}`)
  return dimensions
}
async function screenshot(page, name) {
  await page.evaluate(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    for (const node of document.querySelectorAll('.app-shell, .app-content')) node.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })
  const path = `${out}/${name}`
  await page.screenshot({ path, fullPage: true })
  screenshots.push(path)
}
async function rackItems(page) {
  return page.locator('.wish-rack-item').evaluateAll(items => items.map(item => ({
    id: item.dataset.collectibleId, sceneId: item.dataset.scene, status: item.dataset.rackStatus,
    title: item.querySelector('strong').textContent, label: item.getAttribute('aria-label'),
    icons: item.querySelectorAll('.wish-rack-charm .scene-icon').length,
  })))
}
async function theme(page) {
  const style = await page.locator('.app-shell').evaluate(shell => {
    const css = getComputedStyle(shell), title = shell.querySelector('.title-ribbon')
    const dock = shell.querySelector('[data-tab="wishes"]')
    return { color: css.color, ground: css.backgroundImage, island: css.getPropertyValue('--island').trim(),
      ribbonBefore: getComputedStyle(title, '::before').display,
      ribbonAfter: getComputedStyle(title, '::after').backgroundImage,
      pinkDock: getComputedStyle(dock).backgroundImage }
  })
  assert.equal(style.color, 'rgb(74, 42, 18)')
  assert.equal(style.island, '#cdf1e6')
  assert.ok(style.ground.includes('radial-gradient'))
  assert.notEqual(style.ribbonBefore, 'none')
  assert.ok(style.ribbonAfter.includes('linear-gradient'))
  assert.ok(style.pinkDock.includes('rgb(255, 196, 211)') && style.pinkDock.includes('rgb(255, 159, 184)'))
  return style
}
async function finish(page) {
  let actions = 0
  for (; actions < 28; actions++) {
    await page.waitForFunction(() => document.querySelector('.scene-done-row') || document.querySelector('.scene-bow-tap:not(:disabled)'))
    if (await page.locator('.scene-done-row').count()) return actions
    assert.equal(await page.locator('.scene-post-wish input, .scene-wish-invite').count(), 0)
    await page.locator('.scene-bow-tap').press('Enter')
  }
  throw Error('scene did not finish through its existing keyboard helper')
}
try {
  for (const width of [320, 390, 1280]) {
    const page = await open(state(mainInventory), width)
    await page.locator('.wish-ritual-rack').waitFor()
    const items = await rackItems(page)
    assert.deepEqual(items.map(({ id, status }) => [id, status]), [
      ['unused-crane', 'unused'], ['unused-daruma', 'unused'], ['used-tanzaku', 'used'],
    ])
    assert.ok(items.every(item => item.icons === 1))
    assert.equal(new Set(await page.locator('.wish-rack-item .scene-icon').evaluateAll(icons => icons.map(icon => icon.innerHTML))).size, 3,
      'the row displays the three actual, distinct scene icons')
    assert.equal(await page.locator('.wish-rack-count').innerText(), '2 个未用')
    assert.equal(await page.locator('.wish-rack-toggle').count(), 0)
    assert.equal(await page.locator('.pray-button').count(), 1)
    const appearance = await page.locator('.wish-rack-row').evaluate(row => ({
      wood: getComputedStyle(row, '::before').backgroundImage,
      unused: getComputedStyle(row.querySelector('[data-rack-status="unused"] .wish-rack-charm')).backgroundImage,
      used: getComputedStyle(row.querySelector('[data-rack-status="used"] .wish-rack-charm')).backgroundImage,
      usedOpacity: getComputedStyle(row.querySelector('[data-rack-status="used"] .scene-icon')).opacity,
      usedFilter: getComputedStyle(row.querySelector('[data-rack-status="used"] .scene-icon')).filter,
      transition: getComputedStyle(row.querySelector('.wish-rack-charm')).transitionDuration,
    }))
    assert.ok(appearance.wood.includes('linear-gradient'))
    assert.ok(appearance.unused.includes('linear-gradient'))
    assert.equal(appearance.used, 'none')
    assert.ok(Number(appearance.usedOpacity) < 1)
    assert.ok(appearance.usedFilter.includes('saturate'))
    assert.equal(appearance.transition, '0s', 'reduced motion suppresses charm transitions')
    const island = await theme(page)
    await noOverflow(page, `rack ${width}px`)
    await screenshot(page, `rack-${width}.png`)
    results.push({ check: 'three-object-display', width, items, appearance, theme: island, horizontalOverflow: false })
  }

  const expanded = state([
    keepsake('used-crane', 'crane', { spentAt: at }),
    keepsake('unused-crane-older', 'crane'),
    keepsake('unused-daruma-copy', 'daruma-eye-painting'),
    keepsake('unused-crane-newer', 'crane'),
    keepsake('pending-crane', 'crane', { spentAt: at }),
    keepsake('hidden-lantern', 'lantern'),
    { id: 'legacy-crane', kind: 'crane', title: '旧纸鹤', at },
    keepsake('nonprayer-woodfish', 'woodfish', { wishScene: false }),
    { id: 'badge', kind: 'badge', title: '如愿', at },
  ], { sceneRecords: [completeRecord('crane')], vesselDrafts: { 'pending-crane': { line: '愿家人平安', at } } })
  const expandedPage = await open(expanded)
  assert.deepEqual((await rackItems(expandedPage)).map(item => item.id), ['pending-crane', 'unused-crane-newer', 'unused-daruma-copy'])
  assert.equal(await expandedPage.locator('.wish-rack-toggle').getAttribute('aria-expanded'), 'false')
  await expandedPage.locator('.wish-rack-toggle').click()
  const all = await rackItems(expandedPage)
  assert.deepEqual(all.map(item => [item.id, item.status]), [
    ['pending-crane', 'pending'], ['unused-crane-newer', 'unused'], ['unused-daruma-copy', 'unused'],
    ['unused-crane-older', 'unused'], ['used-crane', 'used'],
  ])
  assert.equal(await expandedPage.locator('.wish-rack-row').count(), 2)
  assert.ok(all.every(item => item.icons === 1))
  assert.equal(await expandedPage.locator('.wish-rack-toggle').getAttribute('aria-expanded'), 'true')
  assert.ok(all[0].label.includes('接着刚才'))
  await noOverflow(expandedPage, 'expanded rack 390px')
  await screenshot(expandedPage, 'rack-expanded-390.png')
  await expandedPage.locator('.wish-rack-toggle').click()
  assert.equal(await expandedPage.locator('.wish-rack-item').count(), 3)
  assert.equal(await expandedPage.locator('.wish-rack-toggle').getAttribute('aria-expanded'), 'false')
  results.push({ check: 'expanded-copies-and-exclusions', collapsedCount: 3, expandedCount: all.length,
    items: all, hiddenLegacyNonprayerExcluded: true, collapsedAgain: true, horizontalOverflow: false })

  const usedPage = await open(state(mainInventory))
  const usedIcon = await usedPage.locator(`${selector('used-tanzaku')} .scene-icon`).innerHTML()
  await usedPage.locator(selector('used-tanzaku')).click()
  await usedPage.locator('.app-shell[data-page="collection"]').waitFor()
  assert.equal(await usedPage.locator('.page-heading .title-ribbon').innerText(), '短册系竹 · 已用旧藏')
  assert.equal(await usedPage.locator('.scene-art[data-scene="tanzaku-tanabata"] .scene-icon').innerHTML(), usedIcon)
  assert.equal(await usedPage.locator('.vessel-spent-line').innerText(), '已拿去许过愿')
  assert.equal(await usedPage.locator('.scene-wish-invite, .scene-post-wish').count(), 0)
  assert.deepEqual((await saved(usedPage)).collectibles, mainInventory)
  await noOverflow(usedPage, 'used collection 390px')
  results.push({ check: 'used-exact-collection', collectibleId: 'used-tanzaku', actualCollectionTitle: '短册系竹 · 已用旧藏', actualIconPreserved: true })

  const nonwritingItem = keepsake('unused-alasita', 'alasita-miniature-house', { title: '微屋寄愿 · 未用旧藏' })
  const nonwritingPage = await open(state([nonwritingItem]))
  assert.equal(await nonwritingPage.locator(selector('unused-alasita')).getAttribute('data-rack-status'), 'unused')
  assert.ok((await nonwritingPage.locator(selector('unused-alasita')).getAttribute('aria-label')).includes('查看收藏'))
  await nonwritingPage.locator(selector('unused-alasita')).click()
  await nonwritingPage.locator('.app-shell[data-page="collection"]').waitFor()
  assert.equal(await nonwritingPage.locator('.page-heading .title-ribbon').innerText(), nonwritingItem.title)
  assert.equal(await nonwritingPage.locator('.library-scene-stage, .scene-wish-invite, .scene-post-wish').count(), 0)
  assert.equal((await saved(nonwritingPage)).collectibles[0].spentAt, undefined)
  results.push({ check: 'unspent-nonwriting-object', collectibleId: nonwritingItem.id, route: 'collection', consumed: false, writingPromised: false })

  const pendingLine = '愿家人平安，也愿小家越来越安稳'
  const pendingItem = keepsake('pending-alasita', 'alasita-miniature-house', { spentAt: at })
  const pendingState = state([keepsake('other-unused-crane', 'crane'), pendingItem], {
    sceneRecords: [completeRecord('alasita-miniature-house')], vesselDrafts: { [pendingItem.id]: { line: pendingLine, at } },
  })
  const pendingPage = await open(pendingState)
  assert.equal((await rackItems(pendingPage))[0].id, pendingItem.id)
  assert.equal(await pendingPage.locator(selector(pendingItem.id)).getAttribute('data-rack-status'), 'pending')
  await pendingPage.locator(selector(pendingItem.id)).click()
  await pendingPage.locator('.app-shell[data-page="scene"] .scene-keep-choice').waitFor()
  assert.equal(await pendingPage.locator('.scene-keep-line').innerText(), `「${pendingLine}」`)
  assert.equal(await pendingPage.getByRole('button', { name: '留下它', exact: true }).count(), 1)
  assert.equal(await pendingPage.getByRole('button', { name: '不留下', exact: true }).count(), 1)
  assert.equal(await pendingPage.locator('.scene-wish-invite, .scene-post-wish input').count(), 0)
  const pendingSaved = await saved(pendingPage)
  assert.deepEqual(pendingSaved.vesselDrafts, pendingState.vesselDrafts)
  assert.equal(pendingSaved.sceneRecords[0].progress, sceneStepCount(entry('alasita-miniature-house')))
  assert.deepEqual(pendingSaved.collectibles, pendingState.collectibles)
  assert.equal(pendingSaved.wishes.length, 1)
  await noOverflow(pendingPage, 'old pending decision 390px')
  await screenshot(pendingPage, 'pending-alasita-decision-390.png')
  results.push({ check: 'pending-original-decision', collectibleId: pendingItem.id,
    draft: pendingSaved.vesselDrafts[pendingItem.id], progress: pendingSaved.sceneRecords[0].progress, originalDecisionPreserved: true })

  const walkPage = await open(state(mainInventory), 320)
  await walkPage.locator(selector('unused-daruma')).click()
  await walkPage.locator('.app-shell[data-page="scene"] .library-scene-stage[data-scene="daruma-eye-painting"][data-ready="true"]').waitFor()
  const justOpened = await saved(walkPage)
  assert.deepEqual(justOpened.collectibles, mainInventory, 'opening an unused vessel must not consume any copy')
  assert.equal(justOpened.wishes.length, 1)
  assert.equal(await walkPage.locator('.scene-wish-invite, .scene-post-wish input').count(), 0)
  const actions = await finish(walkPage)
  assert.equal(actions, 3)
  const completed = await settleSave(walkPage, 'daruma-spent')
  assert.ok(completed.collectibles.find(item => item.id === 'unused-daruma').spentAt)
  assert.equal(completed.collectibles.find(item => item.id === 'unused-crane').spentAt, undefined)
  assert.equal(completed.wishes.length, 1, 'finishing without writing does not create a wish')
  assert.equal(await walkPage.locator('.scene-post-wish input').count(), 0)
  await walkPage.locator('.scene-wish-invite').click()
  const input = walkPage.locator('.scene-post-wish input')
  await input.fill('   ')
  assert.equal(await walkPage.locator('.scene-post-wish button[type="submit"]').isDisabled(), true)
  await input.fill('等想清楚再写')
  await walkPage.locator('.scene-wish-cancel').click()
  assert.equal((await saved(walkPage)).wishes.length, 1)
  await walkPage.locator('.scene-wish-invite').click()
  assert.equal(await input.inputValue(), '')
  await input.fill('愿新的一步踏实向前')
  await walkPage.locator('.scene-post-wish button[type="submit"]').click()
  const recorded = await settleSave(walkPage, 'one-new-wish')
  assert.equal(recorded.wishes[0].sourceSceneId, 'daruma-eye-painting')
  assert.equal(recorded.wishes[0].title, '愿新的一步踏实向前')
  await noOverflow(walkPage, 'completed vessel 320px')
  await screenshot(walkPage, 'completed-daruma-saved-320.png')
  results.push({ check: 'unused-exact-vessel-and-post-completion-writing', collectibleId: 'unused-daruma',
    sceneId: 'daruma-eye-painting', openedWithoutConsumption: true, createdOnOpening: 0,
    keyboardActions: actions, consumedAfterCompletion: ['unused-daruma'], otherUnusedCopyPreserved: true,
    createdOnCompletion: 0, blankDisabled: true, canceledWithoutCreating: true, reopenedDraftEmpty: true,
    explicitlyCreated: 1, sourceSceneId: recorded.wishes[0].sourceSceneId, horizontalOverflow: false })

  const emptyPage = await open(state([]))
  assert.equal(await emptyPage.locator('.wish-ritual-rack').count(), 0)
  assert.equal(await emptyPage.locator('.pray-button').count(), 1)
  await noOverflow(emptyPage, 'empty inventory 390px')
  await screenshot(emptyPage, 'empty-inventory-390.png')
  results.push({ check: 'empty-inventory', rackCount: 0, createCtas: 1 })

  for (const { errors, width } of pages) assert.deepEqual(errors, [], `${width}px page errors`)
  const report = { passed: true, base, checkedAt: new Date().toISOString(), results, screenshots,
    pageErrors: pages.flatMap(({ errors }) => errors), reducedMotion: true,
    scope: 'Rendered browser UI, saved data and actual scene keyboard helper. Physical haptics and cultural evidence are not assessed.' }
  await writeFile(`${out}/browser.json`, JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report, null, 2))
} catch (error) {
  if (currentPage && !currentPage.isClosed()) await screenshot(currentPage, 'failure.png').catch(() => {})
  await writeFile(`${out}/browser.json`, JSON.stringify({ passed: false, base, results, screenshots,
    pageErrors: pages.flatMap(({ errors }) => errors), error: error.stack || String(error) }, null, 2) + '\n')
  throw error
} finally { await browser.close() }
