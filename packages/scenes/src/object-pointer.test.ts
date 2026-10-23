// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { createObjectPointer } from './object-pointer'
const handles: ReturnType<typeof createObjectPointer>[] = []
afterEach(() => { handles.splice(0).forEach(p => p.dispose()); document.body.replaceChildren() })
function event(el: HTMLElement, type: string, id = 1, x = 50) {
  const e = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(e, { pointerId: id, clientX: x, clientY: 50, button: 0, pointerType: 'touch' })
  el.dispatchEvent(e)
}
function mount() {
  const layer = document.createElement('div'); document.body.append(layer)
  layer.setPointerCapture = () => {}; layer.releasePointerCapture = () => {}
  let active = true
  const start = vi.fn(), move = vi.fn(), release = vi.fn(), cancel = vi.fn()
  const pointer = createObjectPointer(layer, { isActive: () => active, canStart: x => x > 20,
    onStart: start, onMove: move, onRelease: release, onCancel: cancel })
  handles.push(pointer)
  return { layer, pointer, start, move, release, cancel, pause: () => { active = false } }
}
it('owns only a gesture starting on an object and releases it once', () => {
  const s = mount()
  event(s.layer, 'pointerdown', 1, 5); event(s.layer, 'pointerup')
  expect(s.release).not.toHaveBeenCalled()
  event(s.layer, 'pointerdown'); expect(s.pointer.isBusy()).toBe(true)
  event(s.layer, 'pointermove', 1, 80); event(s.layer, 'pointerup', 1, 90); event(s.layer, 'pointerup')
  expect(s.start).toHaveBeenCalledExactlyOnceWith(50, 50)
  expect(s.move.mock.calls).toEqual([[80, 50], [90, 50]])
  expect(s.release).toHaveBeenCalledExactlyOnceWith(90, 50)
  expect(s.pointer.isBusy()).toBe(false)
})
it('samples a different release coordinate before committing a moved object, without duplicating the last sample', () => {
  const s = mount(), calls: string[] = []
  s.move.mockImplementation(x => calls.push(`move:${x}`))
  s.release.mockImplementation(x => calls.push(`release:${x}`))
  event(s.layer, 'pointerdown'); event(s.layer, 'pointermove', 1, 70); event(s.layer, 'pointerup', 1, 120)
  expect(calls).toEqual(['move:70', 'move:120', 'release:120'])
  calls.length = 0
  event(s.layer, 'pointerdown'); event(s.layer, 'pointermove', 1, 120); event(s.layer, 'pointerup', 1, 120)
  expect(calls).toEqual(['move:120', 'release:120'])
})
it('keeps a small tap still but samples a deliberate drag delivered only at release', () => {
  const s = mount(); event(s.layer, 'pointerdown'); event(s.layer, 'pointerup', 1, 54)
  expect(s.move).not.toHaveBeenCalled()
  s.release.mockClear()
  event(s.layer, 'pointerdown'); event(s.layer, 'pointerup', 1, 120)
  expect(s.move).toHaveBeenCalledExactlyOnceWith(120, 50)
  expect(s.release).toHaveBeenCalledExactlyOnceWith(120, 50)
})
it.each(['pause', 'cancel', 'dispose', 'second-finger'] as const)('does not commit when the terminal sample causes %s', kind => {
  const s = mount()
  s.move.mockImplementation(x => {
    if (x !== 120) return
    if (kind === 'pause') s.pause()
    else if (kind === 'cancel') s.pointer.cancel()
    else if (kind === 'dispose') s.pointer.dispose()
    else event(document.body, 'pointerdown', 2)
  })
  event(s.layer, 'pointerdown'); event(s.layer, 'pointermove', 1, 70); event(s.layer, 'pointerup', 1, 120)
  expect(s.release).not.toHaveBeenCalled(); expect(s.cancel).toHaveBeenCalledOnce()
  event(document.body, 'pointerup', 2); expect(s.pointer.isBusy()).toBe(false)
})
it.each(['pointercancel', 'lostpointercapture'])('cancels %s without committing', type => {
  const s = mount(); event(s.layer, 'pointerdown'); event(s.layer, type); event(s.layer, 'pointerup')
  expect(s.cancel).toHaveBeenCalledOnce(); expect(s.release).not.toHaveBeenCalled()
  expect(s.pointer.isBusy()).toBe(false)
})
it.each([true, false])('rejects a second finger outside the layer, outside-first=%s', outsideFirst => {
  const s = mount()
  if (outsideFirst) event(document.body, 'pointerdown', 2)
  event(s.layer, 'pointerdown', 1)
  if (!outsideFirst) event(document.body, 'pointerdown', 2)
  event(document.body, 'pointerup', 2)
  expect(s.pointer.isBusy()).toBe(true)
  event(s.layer, 'pointerup', 1)
  expect(s.release).not.toHaveBeenCalled(); expect(s.pointer.isBusy()).toBe(false)
  event(s.layer, 'pointerdown', 3); event(s.layer, 'pointerup', 3)
  expect(s.release).toHaveBeenCalledOnce()
})
it('ignores foreign releases and abandons an outside release', () => {
  const s = mount(); event(s.layer, 'pointerdown'); event(s.layer, 'pointerup', 9)
  expect(s.release).not.toHaveBeenCalled(); expect(s.pointer.isBusy()).toBe(true)
  event(document.body, 'pointerup'); expect(s.cancel).toHaveBeenCalledOnce()
  expect(s.pointer.isBusy()).toBe(false)
})
it('blocks fallback while any finger is down, then permits a normal button click', () => {
  const s = mount(), button = document.createElement('button'); document.body.append(button)
  event(button, 'pointerdown'); expect(s.pointer.isBusy()).toBe(true)
  event(button, 'pointerup'); expect(s.pointer.isBusy()).toBe(false)
})
it('cancels on pause, ignores inactive input and removes listeners on disposal', () => {
  const s = mount(); event(s.layer, 'pointerdown'); s.pause(); s.pointer.cancel()
  event(s.layer, 'pointerup'); event(s.layer, 'pointerdown'); event(s.layer, 'pointerup')
  expect(s.release).not.toHaveBeenCalled(); expect(s.start).toHaveBeenCalledOnce()
  s.pointer.dispose(); s.pointer.dispose(); event(document.body, 'pointerdown')
  expect(s.pointer.isBusy()).toBe(false)
})
it('keeps blank-space touch scrolling available and claims only the object', () => {
  const s = mount()
  const touch = (x: number) => { const e = new Event('touchstart', { cancelable: true }); Object.assign(e, { changedTouches: [{ clientX: x, clientY: 50 }] }); s.layer.dispatchEvent(e); return e.defaultPrevented }
  expect(touch(5)).toBe(false); expect(touch(50)).toBe(true)
})
