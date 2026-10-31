// @vitest-environment jsdom
import * as THREE from 'three'
import { afterEach, expect, it, vi } from 'vitest'
import { createQuietEnding } from './quiet-ending'

const endings: ReturnType<typeof createQuietEnding>[] = []
afterEach(() => { endings.splice(0).forEach(value => value.dispose()); document.body.replaceChildren(); vi.restoreAllMocks() })
function setup() {
  const overlay = document.createElement('div'), hitLayer = document.createElement('div'), actionBtn = document.createElement('button'), hintEl = document.createElement('div')
  overlay.append(hitLayer, actionBtn, hintEl); document.body.append(overlay)
  const object = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial())
  let active = true, reduced = false
  const complete = vi.fn(), ending = createQuietEnding({ overlay, isActive: () => active, isReducedMotion: () => reduced }, {
    ui: { hitLayer, actionBtn, hintEl }, duration: 3, motion: 'sway', targets: () => [object], complete,
  })
  endings.push(ending)
  const run = (seconds: number) => { for (let i = 0; i < Math.round(seconds * 20); i++) ending.update(.05) }
  return { overlay, hitLayer, actionBtn, hintEl, object, ending, complete, run, pause: () => { active = false }, resume: () => { active = true }, reduce: () => { reduced = true } }
}
it('animates the quiet phase and completes once after active time, without another tap', () => {
  const s = setup(); s.ending.sync(true); s.run(1)
  expect(s.object.quaternion.angleTo(new THREE.Quaternion())).toBeGreaterThan(0)
  expect(s.complete).not.toHaveBeenCalled(); expect(s.actionBtn.hidden).toBe(true); expect(s.actionBtn.disabled).toBe(true)
  s.ending.sync(true); s.run(1.5); expect(s.complete).not.toHaveBeenCalled()
  s.run(.6); expect(s.complete).toHaveBeenCalledOnce(); s.run(4); expect(s.complete).toHaveBeenCalledOnce()
  expect(s.object.quaternion.angleTo(new THREE.Quaternion())).toBeCloseTo(0)
})
it('freezes while inactive and cancels disposal without issuing a late completion', () => {
  const s = setup(); s.ending.sync(true); s.run(1); s.pause(); s.run(10)
  expect(s.complete).not.toHaveBeenCalled(); s.resume(); s.run(1)
  expect(s.complete).not.toHaveBeenCalled(); s.ending.dispose(); s.run(10); expect(s.complete).not.toHaveBeenCalled()
})
it('uses a brief, still confirmation for reduced motion', () => {
  const s = setup(); s.reduce(); s.ending.sync(true); s.run(.4)
  expect(s.object.quaternion.angleTo(new THREE.Quaternion())).toBe(0); expect(s.complete).not.toHaveBeenCalled()
  s.run(.25); expect(s.complete).toHaveBeenCalledOnce()
})
it('protects focus, composition and a nonempty native draft while allowing form controls', () => {
  const s = setup(), form = document.createElement('form'), input = document.createElement('input'), submit = document.createElement('button')
  form.append(input, submit); s.overlay.append(form); s.ending.sync(true)
  input.focus(); s.run(5); expect(s.complete).not.toHaveBeenCalled()
  input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })); input.blur(); s.run(5); expect(s.complete).not.toHaveBeenCalled()
  input.value = '愿平安'; input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })); s.run(5); expect(s.complete).not.toHaveBeenCalled()
  let submitted = false; form.addEventListener('submit', event => { event.preventDefault(); submitted = true })
  submit.click(); expect(submitted).toBe(true)
  input.value = ''; s.run(3.1); expect(s.complete).toHaveBeenCalledOnce()
})
it('blocks obsolete gesture clicks and marks completion before a reentrant callback', () => {
  const s = setup(), click = vi.fn(); s.hitLayer.addEventListener('pointerup', click); s.actionBtn.addEventListener('click', click)
  s.ending.sync(true); s.hitLayer.dispatchEvent(new Event('pointerup', { bubbles: true })); s.actionBtn.click(); expect(click).not.toHaveBeenCalled()
  s.complete.mockImplementation(() => { s.ending.sync(true); s.ending.update(.05); s.ending.dispose() })
  s.run(3.1); expect(s.complete).toHaveBeenCalledOnce()
})
it('does not override the scene terminal button state or grant completion outside a quiet phase', () => {
  const s = setup(); s.ending.sync(false); s.run(5); expect(s.complete).not.toHaveBeenCalled()
  s.ending.sync(true); s.actionBtn.hidden = true; s.actionBtn.disabled = true; s.ending.sync(false)
  expect(s.actionBtn.hidden).toBe(true); expect(s.actionBtn.disabled).toBe(true); s.run(5); expect(s.complete).not.toHaveBeenCalled()
})
