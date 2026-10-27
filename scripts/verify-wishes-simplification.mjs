import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { builtInScenes, isSceneVisibleInApp } from '../packages/core/src/daily-scenes.ts'
import { sceneIntention } from '../packages/core/src/scene-intentions.ts'

// Real browser coverage of the approved host redesign. This checks UI and saved
// data; it does not assess cultural evidence or physical sound/haptic hardware.
const out = 'artifacts/wishes-island-redo'
const base = process.env.WBR_URL || 'http://127.0.0.1:5173'
const storageKey = 'cyber-bless:personal:v1'
const sceneId = 'tanzaku-tanabata'
const source = builtInScenes.find(entry => entry.id === sceneId)
assert.ok(source)
const results = []
const screenshots = []
const pages = []
let currentPage
const state = (wishes = []) => ({
  version: 1, sceneRecords: [], wishes, activeSession: null, sessions: [],
  collectibles: [], ledger: [],
  settings: { sound: false, haptics: false, reducedMotion: true },
})
const wish = (id, title, extra = {}) => ({
  id, title, intention: '', category: 'life', returnMethod: 'kindness',
  createdAt: '2026-10-25T08:00:00.000Z', status: 'active', archived: false,
  notes: [], ...extra,
})
const populated = state([
  wish('active-source', '愿牵挂的人平安，也愿自己走稳每一步', {
    sourceSceneId: sceneId,
    notes: [{ id: 'note-1', text: '给家人打了一通电话。', at: '2026-10-26T08:00:00.000Z' }],
  }),
  wish('active-legacy', '慢慢准备，认真迎接新的开始'),
  wish('fulfilled', '想学的那首曲子，终于完整弹下来了', {
    status: 'fulfilled', realizedAt: '2026-10-26T08:00:00.000Z',
    fulfilledAt: '2026-10-26T09:00:00.000Z',
  }),
  wish('archived', '给尚未想好的方向留一点时间', { archived: true }),
])

await mkdir(out, { recursive: true })
const browser = await chromium.launch({
  channel: process.env.WBR_BROWSER || 'msedge', headless: true,
  args: ['--no-proxy-server', '--enable-unsafe-swiftshader'],
})
async function open(saved, width) {
  const page = await browser.newPage({ viewport: { width, height: 1000 } })
  currentPage = page
  page.setDefaultTimeout(20000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  pages.push({ page, errors, width })
  // Supplying a valid old-format empty save exercises a first-time user with no
  // collectibles while keeping the unrelated first-play opening out of scope.
  await page.addInitScript(({ key, saved, origin }) => {
    if (location.origin === origin) localStorage.setItem(key, JSON.stringify(saved))
  }, { key: storageKey, saved, origin: new URL(base).origin })
  await page.goto(base)
  await page.locator('[data-tab="wishes"]').click()
  await page.locator('.app-shell[data-page="wishes"]').waitFor()
  await page.evaluate(() => document.fonts.ready)
  return page
}
async function screenshot(page, file) {
  const path = `${out}/${file}`
  await page.evaluate(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    for (const node of document.querySelectorAll('.app-shell, .app-content')) node.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })
  await page.screenshot({ path, fullPage: true })
  screenshots.push(path)
}
async function noOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    viewport: innerWidth, document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }))
  assert.ok(dimensions.document <= dimensions.viewport && dimensions.body <= dimensions.viewport,
    `${label}: horizontal overflow ${JSON.stringify(dimensions)}`)
  return dimensions
}
async function saved(page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey)
}
async function savedWishCount(page, count) {
  await page.waitForFunction(({ key, count }) => JSON.parse(localStorage.getItem(key)).wishes.length === count,
    { key: storageKey, count })
}
async function keyboardFocus(page, selector) {
  const control = page.locator(selector).first()
  await control.focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  const focus = await control.evaluate(element => {
    const css = getComputedStyle(element)
    return { active: document.activeElement === element, visible: element.matches(':focus-visible'),
      outlineStyle: css.outlineStyle, outlineWidth: css.outlineWidth, outlineColor: css.outlineColor }
  })
  assert.equal(focus.active, true, `${selector} must receive keyboard focus`)
  assert.equal(focus.visible, true, `${selector} must show a keyboard focus state`)
  assert.notEqual(focus.outlineStyle, 'none', `${selector} needs a visible outline`)
  assert.ok(parseFloat(focus.outlineWidth) > 0, `${selector} needs a visible outline width`)
  return focus
}
async function dockStyle(page, activeTab) {
  const expected = {
    today: { face: '#ffd966', high: '#ffe896', tint: 'rgb(255, 243, 198)', gradient: ['rgb(255, 232, 150)', 'rgb(255, 217, 102)'] },
    wishes: { face: '#ff9fb8', high: '#ffc4d3', tint: 'rgb(255, 227, 234)', gradient: ['rgb(255, 196, 211)', 'rgb(255, 159, 184)'] },
    world: { face: '#8fd17a', high: '#b6e5a6', tint: 'rgb(228, 245, 218)', gradient: ['rgb(182, 229, 166)', 'rgb(143, 209, 122)'] },
    me: { face: '#8fd0f5', high: '#b9e3fa', tint: 'rgb(224, 242, 252)', gradient: ['rgb(185, 227, 250)', 'rgb(143, 208, 245)'] },
  }
  const tabs = await page.locator('.bottom-nav button[data-tab]').evaluateAll(buttons => buttons.map(button => {
    const css = getComputedStyle(button)
    return { id: button.dataset.tab, selected: button.hasAttribute('aria-current'),
      face: css.getPropertyValue('--tab').trim(), high: css.getPropertyValue('--tab-hi').trim(),
      gradient: css.backgroundImage, shadow: css.boxShadow,
      iconBackground: getComputedStyle(button.querySelector('svg')).backgroundColor }
  }))
  assert.equal(tabs.length, 4)
  for (const tab of tabs) {
    assert.equal(tab.face, expected[tab.id].face, `${tab.id} retains its original dock color`)
    assert.equal(tab.high, expected[tab.id].high)
    assert.equal(tab.selected, tab.id === activeTab)
    if (tab.selected) {
      assert.ok(tab.gradient.includes('linear-gradient'))
      for (const color of expected[tab.id].gradient) assert.ok(tab.gradient.includes(color))
      assert.notEqual(tab.shadow, 'none')
    } else assert.equal(tab.iconBackground, expected[tab.id].tint)
  }
  return tabs
}
async function islandStyle(page) {
  const style = await page.locator('.app-shell').evaluate(shell => {
    const css = getComputedStyle(shell)
    const ribbon = shell.querySelector('.title-ribbon')
    const primary = getComputedStyle(shell.querySelector('.pray-button'))
    const card = getComputedStyle(shell.querySelector('.wish-card'))
    const pseudo = name => {
      const visual = getComputedStyle(ribbon, name)
      return { content: visual.content, display: visual.display, visibility: visual.visibility,
        background: visual.backgroundImage, height: visual.height }
    }
    return { shell: { color: css.color, background: css.backgroundImage,
      island: css.getPropertyValue('--island').trim() },
      ribbon: { before: pseudo('::before'), after: pseudo('::after') },
      primary: { gradient: primary.backgroundImage, shadow: primary.boxShadow,
        radius: primary.borderRadius, height: primary.height },
      card: { background: card.backgroundColor, border: card.borderTopWidth,
        radius: card.borderRadius, shadow: card.boxShadow } }
  })
  assert.equal(style.shell.color, 'rgb(74, 42, 18)', 'original warm Animal Island ink stays intact')
  assert.equal(style.shell.island, '#cdf1e6')
  assert.ok((style.shell.background.match(/radial-gradient/g) || []).length >= 2, 'original dotted island ground stays visible')
  for (const pseudo of Object.values(style.ribbon)) {
    assert.notEqual(pseudo.content, 'none')
    assert.notEqual(pseudo.display, 'none')
    assert.equal(pseudo.visibility, 'visible')
    assert.ok(pseudo.background.includes('linear-gradient'), 'ribbon band and face remain visible')
    assert.ok(parseFloat(pseudo.height) > 0)
  }
  assert.ok(style.primary.gradient.includes('linear-gradient'))
  assert.ok(style.primary.gradient.includes('rgb(134, 232, 220)'))
  assert.ok(style.primary.gradient.includes('rgb(79, 216, 201)'))
  assert.ok(style.primary.shadow.includes('inset') && style.primary.shadow.includes('6px'), 'the primary keeps its raised candy ledge')
  assert.ok(parseFloat(style.primary.radius) >= parseFloat(style.primary.height) / 2, 'primary remains pill-shaped')
  assert.equal(style.card.background, 'rgb(251, 243, 220)')
  assert.equal(style.card.border, '3px')
  assert.equal(style.card.radius, '24px')
  assert.ok(style.card.shadow.includes('inset') && style.card.shadow.includes('6px'))
  style.dock = await dockStyle(page, 'wishes')
  return style
}
async function picker(page) {
  await page.locator('.pray-button').click()
  await page.locator('.app-shell[data-page="new"] #vessel-picker').waitFor()
  assert.equal(await page.locator('.new-wish-page form, .new-wish-page input, .new-wish-page textarea').count(), 0)
  assert.equal(await page.locator('#vessel-picker .vessel-card').count(), 0)
  const choices = await page.locator('#vessel-picker .wish-scene-choice').evaluateAll(rows => rows.map(row => row.dataset.scene))
  const expected = builtInScenes.filter(isSceneVisibleInApp).filter(entry => {
    const intention = sceneIntention(entry.id)
    return intention.kind === 'wish' && intention.optionalWish
  }).map(entry => entry.id)
  assert.deepEqual([...choices].sort(), [...expected].sort())
  assert.ok(choices.includes(sceneId), 'a new user can select the tanzaku scene without collectibles')
  assert.equal(choices.includes('lantern'), false, 'the hidden lantern stays excluded')
  assert.equal(choices.includes('alasita-miniature-house'), false, 'non-writing wishes stay excluded')
  const tiles = await page.locator('#vessel-picker .wish-scene-choice').evaluateAll(rows => rows.map(row => {
    const css = getComputedStyle(row)
    return { badges: row.querySelectorAll('.scene-badge').length, titles: row.querySelectorAll('strong').length,
      subtitles: row.querySelectorAll('small').length, background: css.backgroundColor,
      border: css.borderTopWidth, shadow: css.boxShadow }
  }))
  for (const tile of tiles) {
    assert.equal(tile.badges, 1)
    assert.equal(tile.titles, 1)
    assert.equal(tile.subtitles, 0, 'direct tiles contain only the badge and title')
    assert.equal(tile.background, 'rgb(251, 243, 220)')
    assert.equal(tile.border, '3px')
    assert.notEqual(tile.shadow, 'none')
  }
  const columns = await page.locator('#vessel-picker .wish-practice-grid').evaluate(grid => getComputedStyle(grid).gridTemplateColumns.split(' ').length)
  assert.equal(columns, 2, 'the ritual picker uses two columns')
  await noOverflow(page, 'picker')
  return choices
}
async function finishScene(page) {
  let actions = 0
  for (; actions < 28; actions++) {
    await page.waitForFunction(() => document.querySelector('.scene-done-row') || document.querySelector('.scene-bow-tap:not(:disabled)'))
    if (await page.locator('.scene-done-row').count()) return actions
    assert.equal(await page.locator('.scene-post-wish input, .scene-wish-invite').count(), 0,
      'writing must remain unavailable before the actual scene completes')
    await page.locator('.scene-bow-tap').press('Enter')
  }
  throw Error('the ritual did not finish through the existing keyboard interaction helper')
}
try {
  for (const width of [320, 390, 1280]) {
    const page = await open(populated, width)
    assert.equal(await page.locator('.pray-button').count(), 1)
    assert.equal(await page.getByRole('button', { name: '去许愿', exact: true }).count(), 1)
    assert.equal(await page.locator('.art-lantern').count(), 0)
    assert.equal(await page.locator('.filter-row button').count(), 3)
    const filterChecks = []
    for (const [label, ids] of [
      ['进行中', ['active-source', 'active-legacy']],
      ['已如愿', ['fulfilled']], ['先放下', ['archived']],
    ]) {
      const filter = page.getByRole('button', { name: label, exact: true })
      await filter.click()
      assert.equal(await filter.getAttribute('aria-pressed'), 'true')
      const actual = await page.locator('.wish-card').evaluateAll(rows => rows.map(row => row.dataset.wishId))
      assert.deepEqual(actual, ids)
      await noOverflow(page, `${width}px ${label}`)
      filterChecks.push({ label, wishIds: actual })
    }
    await page.getByRole('button', { name: '进行中', exact: true }).click()
    assert.ok((await page.locator('.wish-card[data-wish-id="active-source"] small').innerText()).includes('1 条记录'))
    const focus = await keyboardFocus(page, '.pray-button')
    await page.getByRole('heading', { name: '我的心愿', exact: true }).click()
    const visualStyle = await islandStyle(page)
    await screenshot(page, `list-${width}.png`)
    await picker(page)
    results.push({ check: 'list-and-create-route', width, filterChecks, createCtas: 1,
      lanterns: 0, horizontalOverflow: false, focus, visualStyle, newRouteHasForm: false })
    if (width === 390) {
      await screenshot(page, 'picker-390.png')
      await page.locator('.back-button').click()
      await page.locator('.wish-card[data-wish-id="active-source"]').click()
      await page.locator('.wish-source').waitFor()
      assert.equal(await page.locator('.wish-source').innerText(), `记于「${source.title}」`)
      assert.equal(await page.locator('.art-lantern').count(), 0)
      await noOverflow(page, 'source detail 390px')
      await screenshot(page, 'detail-390.png')
      await page.locator('.back-button').click()
      await page.locator('.wish-card[data-wish-id="active-legacy"]').click()
      assert.equal(await page.locator('.wish-source').count(), 0, 'legacy wishes must not receive an invented source')
      results.push({ check: 'detail-source', width, sceneId, actualTitle: source.title,
        sourceText: `记于「${source.title}」`, legacyHasInventedSource: false, lanterns: 0, horizontalOverflow: false })
      await page.locator('.back-button').click()
      await page.locator('[data-tab="today"]').click()
      await page.locator('.app-shell[data-page="today"]').waitFor()
      await noOverflow(page, 'Today continuity 390px')
      const todayDock = await dockStyle(page, 'today')
      const todayGround = await page.locator('.app-shell').evaluate(shell => getComputedStyle(shell).backgroundImage)
      assert.ok(todayGround.includes('radial-gradient'))
      await screenshot(page, 'today-390.png')
      results.push({ check: 'today-theme-continuity', width, dottedGround: true, dock: todayDock, horizontalOverflow: false })
    }
  }

  const page = await open(state(), 320)
  assert.equal(await page.locator('.wish-card').count(), 0)
  assert.equal(await page.locator('.pray-button').count(), 1)
  assert.equal(await page.locator('.wish-empty button').count(), 0)
  await screenshot(page, 'empty-320.png')
  const choices = await picker(page)
  await page.locator(`#vessel-picker .wish-scene-choice[data-scene="${sceneId}"]`).click()
  await page.locator('.app-shell[data-page="scene"]').waitFor()
  await page.locator('.library-scene-stage[data-ready="true"]').waitFor()
  assert.equal(await page.locator('.scene-intention').getAttribute('data-kind'), 'wish')
  assert.equal(await page.locator('.scene-post-wish input, .scene-wish-invite').count(), 0)
  assert.equal((await saved(page)).collectibles.length, 0)
  const actions = await finishScene(page)
  assert.ok(actions > 0, 'first-time entry must require actual scene actions')
  assert.equal(await page.locator('.scene-post-wish input').count(), 0)
  assert.equal((await saved(page)).wishes.length, 0)
  await noOverflow(page, 'completed scene 320px')
  const developmentOverlay = await page.locator('.debug-overlay').count() > 0
  await screenshot(page, 'completed-before-writing-320.png')
  await page.locator('.scene-wish-invite').click()
  const input = page.locator('.scene-post-wish input')
  const submit = page.locator('.scene-post-wish button[type="submit"]')
  await input.click()
  await input.fill('   ')
  assert.equal(await submit.isDisabled(), true)
  await input.fill('还没想好的草稿')
  assert.equal((await saved(page)).wishes.length, 0)
  await page.locator('.scene-wish-cancel').click()
  assert.equal(await input.count(), 0)
  assert.equal((await saved(page)).wishes.length, 0)
  await page.locator('.scene-wish-invite').click()
  assert.equal(await input.inputValue(), '')
  const title = '愿家人平安，也给自己一点从容'
  await input.fill(`  ${title}  `)
  assert.equal((await saved(page)).wishes.length, 0)
  // A rapid repeated submit reaches the actual React form twice during this
  // user click, exercising the existing postWishSubmitted guard in-browser.
  await page.locator('.scene-post-wish form').evaluate(form => {
    form.addEventListener('submit', () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })), { once: true })
  })
  await submit.click()
  await savedWishCount(page, 1)
  assert.equal(await input.count(), 0)
  const stored = await saved(page)
  assert.equal(stored.wishes.length, 1)
  assert.equal(stored.wishes[0].title, title)
  assert.equal(stored.wishes[0].sourceSceneId, sceneId)
  await screenshot(page, 'completed-saved-320.png')
  await page.locator('.scene-done-row .scene-completion-actions .button.primary').click()
  await page.locator('.app-shell[data-page="wishes"]').waitFor()
  await page.locator(`.wish-card.reward-landed[data-wish-id="${stored.wishes[0].id}"]`).waitFor()
  assert.equal(await page.locator('.wish-card').count(), 1)
  assert.equal(await page.locator('.wish-card strong').innerText(), title)
  assert.equal(await page.locator('[data-tab="wishes"] i').innerText(), '+1')
  await noOverflow(page, 'saved first-time list 320px')
  await screenshot(page, 'first-time-saved-list-320.png')
  results.push({ check: 'first-time-complete-record-route', width: 320, sceneId,
    pickerChoices: choices, keyboardSceneActions: actions, writingBeforeCompletion: false,
    blankSubmitDisabled: true, wishesAfterCancel: 0, reopenedDraft: '',
    wishesAfterRepeatedExplicitSubmit: stored.wishes.length,
    savedTitle: stored.wishes[0].title, savedSourceSceneId: stored.wishes[0].sourceSceneId,
    returnPage: 'wishes', landedWishId: stored.wishes[0].id, rewardDestination: 'wishes',
    rewardTabBadge: '+1', horizontalOverflow: false,
    recordInviteActivation: 'pointer click', developmentOverlayPresent: developmentOverlay })

  for (const { errors, width } of pages) assert.deepEqual(errors, [], `${width}px page errors`)
  const summary = { passed: true, base, checkedAt: new Date().toISOString(), results, screenshots,
    pageErrors: pages.flatMap(({ errors }) => errors),
    scope: 'Browser UI, keyboard helper interactions and persisted data. Physical haptics and cultural facts are not evaluated.' }
  await writeFile(`${out}/browser.json`, JSON.stringify(summary, null, 2) + '\n')
  console.log(JSON.stringify(summary, null, 2))
} catch (error) {
  if (currentPage && !currentPage.isClosed()) await screenshot(currentPage, 'failure.png').catch(() => {})
  const failure = { passed: false, base, checkedAt: new Date().toISOString(), results, screenshots,
    pageErrors: pages.flatMap(({ errors }) => errors), error: error.stack || String(error) }
  await writeFile(`${out}/browser.json`, JSON.stringify(failure, null, 2) + '\n')
  throw error
} finally {
  await browser.close()
}
