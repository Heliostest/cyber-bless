// Browser input only: dispatch real mouse events or Chrome's native touch path.
export async function scenePointer(page, touch = false) {
  const sampleSteps = Math.max(2, Math.min(24, Math.floor(Number(process.env.WBR_POINTER_STEPS) || 12)))
  const stepsFor = steps => process.env.WBR_POINTER_STEPS ? sampleSteps : steps
  if (!touch) return {
    async down(p) { await page.mouse.move(...p); await page.mouse.down() },
    async move(p, steps = 12) { await page.mouse.move(...p, { steps: stepsFor(steps) }) },
    async up() { await page.mouse.up() },
    async cancel() { await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await page.mouse.up(); await page.evaluate(() => window.dispatchEvent(new Event('focus'))) },
  }
  const session = await page.context().newCDPSession(page)
  let last = [0, 0]
  const send = (type, p) => session.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p[0], y: p[1], id: 1 }] : [] })
  return {
    async down(p) { last = p; await send('touchStart', p) },
    async move(p, steps = 12) {
      steps = stepsFor(steps)
      const from = last
      for (let i = 1; i <= steps; i++) await send('touchMove', [from[0] + (p[0] - from[0]) * i / steps, from[1] + (p[1] - from[1]) * i / steps])
      last = p
    },
    async up() { await send('touchEnd') },
    async cancel() { await send('touchCancel') },
  }
}
