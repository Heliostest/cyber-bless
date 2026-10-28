// @vitest-environment jsdom
import * as THREE from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as gestures from '@wbr/gestures'
import * as shared from '@wbr/shared'
import type { InteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { SceneContext, SceneInstance } from './contract'
import { create as alasita } from './alasita-miniature-house'
import { create as brat } from './brat-bride-cloth'
import { create as fu } from './chinese-fu-paper'
import { create as longevity } from './chinese-longevity-lock'
import { create as ruyi } from './chinese-ruyi-scepter'
import { create as hamaya } from './japanese-hamaya'
import { create as kadomatsu } from './japanese-kadomatsu'
import { create as sotdae } from './korean-sotdae'
import { create as lanna } from './lanna-sand-pagoda'
import { create as nagashibina } from './mochigase-nagashibina'
import { create as pucara } from './pucara-rooftop-bulls'
import { create as steelyard } from './chinese-steelyard'
import { create as nazar } from './turkish-nazar-bead'

// Real scene input, models, cameras and hit tests; replace only GPU operations.
const rendered = vi.hoisted(() => ({ scene: null as unknown, camera: null as unknown }))
vi.mock('three', async original => {
  const actual = await original<typeof import('three')>()
  return { ...actual, WebGLRenderer: class {
    domElement: HTMLCanvasElement
    shadowMap = { enabled: false, type: 0 }
    constructor({ canvas }: { canvas: HTMLCanvasElement }) { this.domElement = canvas }
    setSize() {} setPixelRatio() {} setClearColor() {} dispose() {} forceContextLoss() {}
  } }
})
vi.mock('@wbr/scene-runtime/debug-render-style', () => ({
  createDebugRenderStyle(_renderer: unknown, scene: THREE.Scene, camera: THREE.Camera) {
    rendered.scene = scene; rendered.camera = camera
    return { setStyle() {}, resize() {}, render() { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }, dispose() {} }
  },
}))

type Factory = (context: SceneContext) => SceneInstance
type Point = [number, number]
const instances: SceneInstance[] = []
afterEach(() => {
  instances.splice(0).forEach(instance => instance.dispose())
  document.body.replaceChildren(); vi.unstubAllGlobals()
})

function mount(create: Factory, initialProgress: number) {
  const canvas = document.createElement('canvas'), overlay = document.createElement('div'), host = document.createElement('div')
  const rect = { left: 17, top: 91, width: 390, height: 408 }
  Object.defineProperties(canvas, { clientWidth: { value: rect.width }, clientHeight: { value: rect.height } })
  canvas.getBoundingClientRect = () => rect as DOMRect
  host.append(canvas, overlay); document.body.append(host)
  let observedResize = () => {}, active = true
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { observedResize = callback }
    observe() {} disconnect() {}
  })
  const progress: number[] = [], complete = vi.fn(), haptic = vi.fn()
  overlay.addEventListener('scene:complete', complete)
  const instance = create({ canvas, overlay, gestures, shared, initialProgress, isActive: () => active,
    isSoundEnabled: () => false, isReducedMotion: () => true, haptic, onProgress: value => progress.push(value) })
  instances.push(instance); instance.start(); instance.update(.025)
  const scene = rendered.scene as THREE.Scene, camera = rendered.camera as THREE.Camera
  const layer = overlay.querySelector<HTMLElement>('.scene-hit-layer')!, button = overlay.querySelector<HTMLButtonElement>('button')!
  const setCapture = vi.fn(), releaseCapture = vi.fn()
  layer.setPointerCapture = setCapture; layer.releasePointerCapture = releaseCapture
  const project = (object: THREE.Object3D, anchor: [number, number, number] = [0, 0, 0]): Point => {
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true)
    const point = object.localToWorld(new THREE.Vector3(...anchor)).project(camera)
    return [rect.left + (point.x + 1) * rect.width / 2, rect.top + (1 - point.y) * rect.height / 2]
  }
  const grip = (): Point => {
    let selected: { object: THREE.Object3D; cue: InteractionCue } | undefined
    scene.traverse(object => {
      const cue = (object.userData.interactionCues as InteractionCue[] | undefined)?.find(item => item.enabled() && item.kind === 'drag')
      if (cue && !selected) selected = { object, cue }
    })
    if (!selected) throw new Error('The live scene must expose its active physical grip')
    return project(selected.object, selected.cue.anchor)
  }
  return { instance, scene, layer, button, rect, grip, project, progress, complete, haptic, setCapture, releaseCapture,
    resize: () => observedResize(), pause: () => { active = false; instance.update(.025) },
    resume: () => { active = true; window.dispatchEvent(new Event('focus')); instance.update(.025) } }
}

function pointer(target: EventTarget, type: string, [clientX, clientY]: Point, shift = false) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, { clientX, clientY, pointerId: 1, pointerType: 'mouse', button: 0, buttons: type === 'pointerup' ? 0 : 1, shiftKey: shift, isPrimary: true })
  target.dispatchEvent(event)
}
function key(button: HTMLButtonElement, value: string) {
  button.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }))
}
function snapshot(root: THREE.Object3D) {
  const result = new Map<THREE.Object3D, { position: THREE.Vector3; quaternion: THREE.Quaternion; scale: THREE.Vector3 }>()
  root.traverse(object => result.set(object, { position: object.position.clone(), quaternion: object.quaternion.clone(), scale: object.scale.clone() }))
  return result
}
function expectSnapshot(saved: ReturnType<typeof snapshot>) {
  for (const [object, expected] of saved) {
    expect(object.position.distanceTo(expected.position), `${object.name} position`).toBeLessThan(1e-7)
    expect(object.quaternion.angleTo(expected.quaternion), `${object.name} quaternion`).toBeLessThan(1e-7)
    expect(object.scale.distanceTo(expected.scale), `${object.name} scale`).toBeLessThan(1e-7)
  }
}
type Recovery = 'Escape' | 'blur' | 'pause' | 'resize'
function recover(scene: ReturnType<typeof mount>, event: Recovery) {
  if (event === 'Escape') key(scene.button, 'Escape')
  else if (event === 'blur') window.dispatchEvent(new Event('blur'))
  else if (event === 'pause') scene.pause()
  else scene.resize()
}

describe('released continuous placement restores the saved scene checkpoint', () => {
  const inspectable = [
    { name: 'Pucara', create: pucara, actor: 'pucara-carrier' },
    { name: 'Kadomatsu', create: kadomatsu, actor: 'kadomatsu-right' },
  ]
  for (const entry of inspectable) for (const at of [0, 1, 2]) for (const input of ['keyboard', 'Shift'] as const) {
    it.each<Recovery>(['Escape', 'blur', 'pause', 'resize'])(`${entry.name} old ${at}, ${input}: restores an ownerless inspection on %s`, recovery => {
      const s = mount(entry.create, at), actor = s.scene.getObjectByName(entry.actor)!, canonical = snapshot(s.scene), rotation = actor.quaternion.clone()
      if (input === 'keyboard') key(s.button, 'ArrowRight')
      else {
        const start = s.grip(), end: Point = [start[0] + 48, start[1] + 15]
        pointer(s.layer, 'pointerdown', start, true); pointer(s.layer, 'pointermove', end, true); pointer(s.layer, 'pointerup', end, true)
        expect(s.releaseCapture).toHaveBeenCalledWith(1)
      }
      expect(actor.quaternion.angleTo(rotation)).toBeGreaterThan(.1)
      expect(s.progress).toEqual([])
      recover(s, recovery); expectSnapshot(canonical)
      expect(s.progress).toEqual([]); expect(s.complete).not.toHaveBeenCalled(); expect(s.haptic).not.toHaveBeenCalled()
      s.resume(); s.button.click(); s.instance.update(.025)
      expect(s.progress).toEqual([3]); expect(s.complete).toHaveBeenCalledOnce()
    })
  }

  for (const at of [1, 2]) it.each<Exclude<Recovery, 'Escape'>>(['blur', 'pause', 'resize'])(`steelyard old ${at}: restores the released whole apparatus on %s`, recovery => {
    const s = mount(steelyard, at), actor = s.scene.getObjectByName('steelyard-subject')!, canonical = snapshot(s.scene), home = actor.position.clone()
    const start = s.grip(), end: Point = [start[0] + 48, start[1] - 20]
    pointer(s.layer, 'pointerdown', start); pointer(s.layer, 'pointermove', end); pointer(s.layer, 'pointerup', end)
    expect(actor.position.distanceTo(home)).toBeGreaterThan(.1)
    expect(Math.abs(actor.position.x - home.x) + Math.abs(actor.position.z - home.z)).toBeGreaterThan(.1)
    expect(s.releaseCapture).toHaveBeenCalledWith(1); expect(s.progress).toEqual([])
    recover(s, recovery); expectSnapshot(canonical)
    expect(s.progress).toEqual([]); expect(s.complete).not.toHaveBeenCalled(); expect(s.haptic).not.toHaveBeenCalled()
    s.resume(); s.button.click(); expect(s.progress).toEqual([3])
  })
})

describe('captured release outside the canvas does not strand a movable object off screen', () => {
  it.each([0,1,2])('restores the full Nazar checkpoint after captured Shift inspection releases outside at old %i', at => {
    const s=mount(nazar,at),canonical=snapshot(s.scene),root=s.scene.getObjectByName('nazar-charm')!,rotation=root.quaternion.clone(),start=s.grip()
    pointer(s.layer,'pointerdown',start,true);pointer(s.layer,'pointermove',[start[0]+12,start[1]+8],true)
    expect(root.quaternion.angleTo(rotation)).toBeGreaterThan(.1)
    pointer(s.layer,'pointerup',[s.rect.left-1000,start[1]],true)
    expectSnapshot(canonical);expect(s.progress).toEqual([]);expect(s.complete).not.toHaveBeenCalled();expect(s.haptic).not.toHaveBeenCalled()
    s.button.click();expect(s.progress).toEqual([3]);expect(s.complete).toHaveBeenCalledOnce()
  })
  const scenes = [
    ['Alasita', alasita], ['Brat', brat], ['Fu', fu], ['Longevity lock', longevity], ['Ruyi', ruyi],
    ['Hamaya', hamaya], ['Kadomatsu', kadomatsu], ['Sotdae', sotdae], ['Lanna', lanna],
    ['Nagashibina', nagashibina], ['Nazar', nazar],
  ] as const
  for (const [name, create] of scenes) for (const at of [0, 1, 2]) {
    it.each(['captured layer', 'window listener'] as const)(`${name} old ${at}: restores after %s pointerup outside the canvas`, destination => {
      const s = mount(create, at), canonical = snapshot(s.scene), start = s.grip(), outside: Point = [s.rect.left - 1000, start[1]]
      pointer(s.layer, 'pointerdown', start)
      expect(s.setCapture).toHaveBeenCalledWith(1)
      pointer(s.layer, 'pointermove', outside)
      pointer(destination === 'window listener' ? document.body : s.layer, 'pointerup', outside)
      expect(s.releaseCapture).toHaveBeenCalledWith(1); expectSnapshot(canonical)
      expect(s.progress).toEqual([]); expect(s.complete).not.toHaveBeenCalled(); expect(s.haptic).not.toHaveBeenCalled()
      s.button.click(); s.instance.update(.025); expect(s.progress).toEqual([3])
    })
  }
})
