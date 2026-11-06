// @vitest-environment jsdom
import * as THREE from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { configureLocale, SUPPORTED_LOCALES } from '@wbr/i18n'
import { createCloseInspection } from './close-inspection'
import { createStepOverlay } from './procedural-kit'

const cleanups: (() => void)[] = []
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); document.body.replaceChildren(); configureLocale('zh-Hans') })
function mount(width = 390, height = 408, reduced = false, autoReturn?: boolean) {
  const canvas = document.createElement('canvas'), overlay = document.createElement('div')
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width, height }) as DOMRect
  document.body.append(canvas, overlay)
  const ui = createStepOverlay(overlay, { title: 'Object', stepsAria: 'Steps', action: 'Place' }, () => {})
  ui.hitLayer.setPointerCapture = () => {}; ui.hitLayer.releasePointerCapture = () => {}
  const scene = new THREE.Scene(), group = new THREE.Group(), actor = new THREE.Group()
  scene.add(group); group.position.set(.2, .1, -.3); group.scale.setScalar(1.2); group.add(actor)
  const solid = new THREE.Mesh(new THREE.BoxGeometry(2.6, .12, .8), new THREE.MeshBasicMaterial())
  const detail = new THREE.Mesh(new THREE.BoxGeometry(.1, .4, .1), new THREE.MeshBasicMaterial())
  actor.add(solid, detail); detail.position.set(.5, .25, 0); actor.position.set(-.5, .3, .4)
  const furniture = new THREE.Mesh(new THREE.BoxGeometry(6, 3, .2), new THREE.MeshBasicMaterial())
  furniture.position.z = -.5; scene.add(furniture)
  const hidden = furniture.clone(); hidden.visible = false; scene.add(hidden)
  const camera = new THREE.PerspectiveCamera(40, width / height, .1, 40)
  camera.position.set(3, 3, 9); camera.lookAt(0, .5, 0); camera.updateMatrixWorld(true); scene.updateMatrixWorld(true)
  const initial = { camera: camera.position.clone(), quaternion: camera.quaternion.clone(), actor: actor.position.clone(), rotation: actor.quaternion.clone(), detail: detail.position.clone() }
  let active = true, inspection: ReturnType<typeof createCloseInspection>
  const prepare = vi.fn(() => true), originalPlace = vi.fn()
  const sync = () => { ui.actionBtn.hidden = false; ui.actionBtn.disabled = !active; inspection.decorate(false) }
  inspection = createCloseInspection({ canvas, scene, camera, actor, ui, autoReturn, isActive: () => active, isReducedMotion: () => reduced, prepare, safe: () => {}, changed: sync })
  ui.actionBtn.addEventListener('click', originalPlace)
  cleanups.push(() => { inspection.dispose(); solid.geometry.dispose(); detail.geometry.dispose(); furniture.geometry.dispose() })
  sync()
  const run = (seconds: number) => { for (let elapsed = 0; elapsed < seconds; elapsed += .025) inspection.update(.025) }
  const point = () => { scene.updateMatrixWorld(true); const p = new THREE.Box3().setFromObject(actor, true).getCenter(new THREE.Vector3()).project(camera); return [(.5 + p.x / 2) * width, (.5 - p.y / 2) * height] as [number, number] }
  const pointer = (type: string, [x,y]: [number,number]) => { const e = new Event(type, { bubbles: true }); Object.assign(e, { clientX: x, clientY: y, pointerId: 1, isPrimary: true, button: 0, pointerType: 'touch' }); ui.hitLayer.dispatchEvent(e) }
  return { scene, actor, solid, detail, furniture, hidden, camera, initial, ui, inspection, prepare, originalPlace, run, point, pointer, pause() { active = false; inspection.update(.025); sync() }, resume() { active = true; sync() } }
}

describe('close object inspection', () => {
  it.each(SUPPORTED_LOCALES)('uses mobile help for pickup and the current viewing phase in %s', locale => {
    configureLocale(locale)
    const s=mount()
    expect(s.ui.actionBtn.title).not.toMatch(/方向[键鍵]|\b(?:enter|esc|arrow keys)\b/i)
    s.ui.actionBtn.click();s.run(.7)
    expect(s.ui.actionBtn.title).toBe(s.ui.hintEl.textContent)
  })
  it('requires pickup and explicit continue, leaving time to look after the automatic full orbit', () => {
    const s = mount()
    expect(s.inspection.canPlace()).toBe(false)
    s.ui.actionBtn.click(); expect(s.originalPlace).not.toHaveBeenCalled(); s.run(.7)
    expect(s.inspection.canPlace()).toBe(false)
    expect(s.camera.position.distanceTo(s.initial.camera)).toBeGreaterThan(1)
    expect(s.furniture.visible).toBe(false); expect(s.hidden.visible).toBe(false)
    const p = s.camera.position.clone(); s.run(3)
    expect(s.camera.position.distanceTo(p)).toBeGreaterThan(1)
    expect(s.actor.quaternion.angleTo(s.initial.rotation)).toBeLessThan(1e-7)
    expect(s.detail.position.distanceTo(s.initial.detail)).toBeLessThan(1e-7)
    s.run(9)
    expect(s.inspection.canPlace()).toBe(false)
    expect(s.ui.hitLayer.parentElement?.getAttribute('data-close-inspection')).toBe('viewing')
    expect(s.furniture.visible).toBe(false)
    s.ui.actionBtn.click(); s.run(.6)
    expect(s.inspection.canPlace()).toBe(true)
    expect(s.camera.position.distanceTo(s.initial.camera)).toBeLessThan(1e-7)
    expect(s.camera.quaternion.angleTo(s.initial.quaternion)).toBeLessThan(1e-7)
    expect(s.actor.position.distanceTo(s.initial.actor)).toBeLessThan(1e-7)
    expect(s.furniture.visible).toBe(true); expect(s.hidden.visible).toBe(false)
    expect(s.originalPlace).not.toHaveBeenCalled(); s.ui.actionBtn.click(); expect(s.originalPlace).toHaveBeenCalledOnce()
  })
  it('supports an explicitly opted-in automatic return without placing on the same action', () => {
    const s = mount(390, 408, false, true)
    s.ui.actionBtn.click(); s.run(8)
    expect(s.inspection.canPlace()).toBe(true)
    expect(s.originalPlace).not.toHaveBeenCalled()
    expect(s.actor.position.distanceTo(s.initial.actor)).toBeLessThan(1e-7)
  })
  it.each([[284, 408], [390, 408], [1280, 600]])('keeps the complete actor inside the close frame throughout an orbit at %i x %i', (w,h) => {
    const s = mount(w,h); s.ui.actionBtn.click(); s.run(.7)
    for (let i = 0; i < 36; i++) {
      for (const mesh of [s.solid,s.detail]) {
        const vertices = mesh.geometry.getAttribute('position')
        for (let n = 0; n < vertices.count; n++) {
          const p = new THREE.Vector3().fromBufferAttribute(vertices,n).applyMatrix4(mesh.matrixWorld).project(s.camera)
          expect(Math.abs(p.x)).toBeLessThan(.95); expect(Math.abs(p.y)).toBeLessThan(.95)
        }
      }
      s.run(.15)
    }
  })
  it('hands a single finger the camera and stops the automatic turn until explicitly continuing', () => {
    const s = mount(); s.ui.actionBtn.click(); s.run(.7)
    const p = s.point(), before = s.camera.position.clone()
    s.pointer('pointerdown',p); s.pointer('pointermove',[p[0]+45,p[1]+12]); s.pointer('pointerup',[p[0]+45,p[1]+12])
    expect(s.camera.position.distanceTo(before)).toBeGreaterThan(.1)
    const manual = s.camera.position.clone(); s.run(12)
    expect(s.inspection.canPlace()).toBe(false); expect(s.camera.position.distanceTo(manual)).toBeLessThan(1e-7)
    s.ui.actionBtn.click(); s.run(.6)
    expect(s.inspection.canPlace()).toBe(true); expect(s.originalPlace).not.toHaveBeenCalled()
  })
  it('can continue early and ignores rapid double clicks while approaching or returning', () => {
    const s = mount(); s.ui.actionBtn.click(); s.ui.actionBtn.click(); s.run(.7)
    s.ui.actionBtn.click(); s.ui.actionBtn.click(); s.run(.6)
    expect(s.inspection.canPlace()).toBe(true); expect(s.originalPlace).not.toHaveBeenCalled()
  })
  it('offers stable manual inspection with reduced motion and keeps the completed object untouched', () => {
    const s = mount(390,408,true); s.ui.actionBtn.click()
    const close = s.camera.position.clone(); s.run(12)
    expect(s.camera.position.distanceTo(close)).toBeLessThan(1e-7); expect(s.inspection.canPlace()).toBe(false)
    s.ui.actionBtn.click(); s.run(.05); expect(s.inspection.canPlace()).toBe(true)
    const done = mount(); done.inspection.decorate(true); done.run(8)
    expect(done.camera.position.distanceTo(done.initial.camera)).toBeLessThan(1e-7)
    expect(done.actor.position.distanceTo(done.initial.actor)).toBeLessThan(1e-7)
  })
  it('restores every temporary state when cancelled, inactive or disposed without enabling placement', () => {
    for (const operation of ['cancel','inactive','dispose'] as const) {
      const s = mount(); s.ui.actionBtn.click(); s.run(1)
      if (operation === 'cancel') s.inspection.cancel()
      else if (operation === 'inactive') s.pause()
      else s.inspection.dispose()
      expect(s.camera.position.distanceTo(s.initial.camera)).toBeLessThan(1e-7)
      expect(s.actor.position.distanceTo(s.initial.actor)).toBeLessThan(1e-7)
      expect(s.furniture.visible).toBe(true); expect(s.hidden.visible).toBe(false)
      expect(s.originalPlace).not.toHaveBeenCalled()
      if (operation !== 'dispose') expect(s.inspection.canPlace()).toBe(false)
    }
  })
  it('rejects non-finite time and keyboard input does not move the physical actor', () => {
    const s = mount(); s.ui.actionBtn.click(); s.run(.7)
    for (const dt of [NaN, Infinity, -3]) s.inspection.update(dt)
    s.ui.actionBtn.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}))
    const p = s.camera.position.clone(); s.run(8)
    expect(s.camera.position.distanceTo(p)).toBeLessThan(1e-7)
    expect(s.actor.quaternion.angleTo(s.initial.rotation)).toBeLessThan(1e-7)
    s.ui.actionBtn.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}))
    expect(s.camera.position.distanceTo(s.initial.camera)).toBeLessThan(1e-7)
  })
  it('restores the uncommitted closeup when its owning pointer is cancelled', () => {
    const s = mount(); s.ui.actionBtn.click(); s.run(.7)
    const p = s.point(); s.pointer('pointerdown',p); s.pointer('pointermove',[p[0]+20,p[1]+10]); s.pointer('pointercancel',[p[0]+20,p[1]+10])
    expect(s.camera.position.distanceTo(s.initial.camera)).toBeLessThan(1e-7)
    expect(s.actor.position.distanceTo(s.initial.actor)).toBeLessThan(1e-7)
    expect(s.furniture.visible).toBe(true); expect(s.inspection.canPlace()).toBe(false)
    s.run(8); expect(s.originalPlace).not.toHaveBeenCalled()
  })
  it('cancels a pending pickup before inspection begins and accepts a fresh touch', () => {
    const s = mount(390,408,true)
    const center = s.solid.getWorldPosition(new THREE.Vector3()).project(s.camera)
    const p: [number,number] = [(.5 + center.x / 2) * 390, (.5 - center.y / 2) * 408]
    s.pointer('pointerdown',p)
    s.inspection.cancel()
    s.pointer('pointerup',p)
    expect(s.prepare).not.toHaveBeenCalled()
    expect(s.camera.position.distanceTo(s.initial.camera)).toBeLessThan(1e-7)
    expect(s.actor.position.distanceTo(s.initial.actor)).toBeLessThan(1e-7)
    expect(s.inspection.canPlace()).toBe(false)
    s.pointer('pointerdown',p); s.pointer('pointerup',p)
    expect(s.prepare).toHaveBeenCalledOnce()
    expect(s.ui.actionBtn.textContent).toBe('继续安放')
  })
  it('does not let a reduced-motion continue double click also place the object', () => {
    const s = mount(390,408,true); s.ui.actionBtn.click(); s.ui.actionBtn.click(); s.ui.actionBtn.click()
    expect(s.originalPlace).not.toHaveBeenCalled()
    s.run(.05)
    s.ui.actionBtn.dispatchEvent(new MouseEvent('click',{detail:2,bubbles:true}))
    expect(s.originalPlace).not.toHaveBeenCalled()
    s.ui.actionBtn.dispatchEvent(new MouseEvent('click',{detail:1,bubbles:true}))
    expect(s.originalPlace).toHaveBeenCalledOnce()
  })
  it('does not let the native pickup double-click tail skip reduced-motion viewing', () => {
    const s = mount(390,408,true)
    s.ui.actionBtn.dispatchEvent(new MouseEvent('click',{detail:1,bubbles:true}))
    s.ui.actionBtn.dispatchEvent(new MouseEvent('click',{detail:2,bubbles:true}))
    s.run(.05)
    expect(s.ui.hitLayer.parentElement?.getAttribute('data-close-inspection')).toBe('viewing')
    expect(s.inspection.canPlace()).toBe(false)
    expect(s.originalPlace).not.toHaveBeenCalled()
    s.ui.actionBtn.dispatchEvent(new MouseEvent('click',{detail:1,bubbles:true})); s.run(.05)
    expect(s.inspection.canPlace()).toBe(true)
  })
  it('shows an explicit continue action while manual inspection is open', () => {
    const s = mount(); s.ui.actionBtn.click(); s.run(.7)
    expect(s.ui.actionBtn.textContent).toBe('继续安放')
    expect(s.ui.actionBtn.querySelector('.scene-helper-action')).toBeNull()
  })
  it('temporarily lights a dark closeup without changing the authored materials', () => {
    const s = mount(); s.scene.backgroundIntensity = .065
    const color = s.solid.material.color.clone()
    s.ui.actionBtn.click(); s.run(.7)
    const lights = s.scene.children.filter(object => object instanceof THREE.PointLight && object.visible) as THREE.PointLight[]
    expect(lights.length).toBeGreaterThan(0)
    expect(lights[0]!.intensity).toBeGreaterThan(1)
    s.inspection.cancel()
    expect(lights.every(light => !light.visible)).toBe(true)
    expect(s.solid.material.color.equals(color)).toBe(true)
  })
})
