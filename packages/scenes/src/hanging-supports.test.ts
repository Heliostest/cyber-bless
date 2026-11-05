// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { SceneContext, SceneInstance } from './contract'
import { loadScene } from './registry'

const rendered = vi.hoisted(() => ({ scene: null as THREE.Scene | null }))
vi.mock('three', async original => {
  const actual = await original<typeof import('three')>()
  class WebGLRenderer {
    shadowMap = { enabled: false, type: 0 }
    setSize() {} setPixelRatio() {} setClearColor() {} dispose() {} forceContextLoss() {}
  }
  return { ...actual, WebGLRenderer }
})
vi.mock('@wbr/scene-runtime/debug-render-style', () => ({
  createDebugRenderStyle(_renderer: unknown, scene: THREE.Scene, camera: THREE.Camera) {
    rendered.scene = scene
    return { setStyle() {}, resize() {}, dispose() {}, render() { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) } }
  },
}))
const instances: SceneInstance[] = []
afterEach(() => { instances.splice(0).forEach(instance => instance.dispose()); document.body.replaceChildren(); vi.restoreAllMocks() })
async function mount(id: string, initialProgress = 2, extra: Partial<SceneContext> = {}) {
  const canvas = document.createElement('canvas'), overlay = document.createElement('div')
  document.body.append(canvas, overlay)
  Object.defineProperties(canvas, { clientWidth: { value: 390 }, clientHeight: { value: 560 } })
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 390, height: 560 }) as DOMRect
  const module = await loadScene(id)
  const instance = module.create({ canvas, overlay, gestures: Gestures, shared: Shared, initialProgress,
    isSoundEnabled: () => false, ...extra })
  instances.push(instance); instance.start(); instance.update(0)
  return { instance, scene: rendered.scene! }
}

it.each([0, 2, 3])('keeps every torii rack board suspended from its top at checkpoint %i', async initial => {
  let time = 0; vi.spyOn(performance, 'now').mockImplementation(() => time)
  const s = await mount('shinto-torii', initial), boards: THREE.Mesh[] = []
  s.scene.traverse(object => {
    if (object instanceof THREE.Mesh && object.geometry instanceof THREE.ExtrudeGeometry && object.geometry.parameters.options.depth === .014) boards.push(object)
  })
  expect(boards).toHaveLength(6)
  const samples = boards.map(board => {
    const positions = board.geometry.getAttribute('position')
    let top = 0
    for (let i = 1; i < positions.count; i++) if (positions.getY(i) > positions.getY(top)) top = i
    const local = new THREE.Vector3().fromBufferAttribute(positions, top), bottom = new THREE.Vector3().fromBufferAttribute(positions, 0)
    return { board, local, fixed: board.localToWorld(local.clone()), bottom, bodyHome: board.localToWorld(bottom.clone()) }
  })
  let travel = 0
  for (let frame = 0; frame < 160; frame++) {
    time += 25
    s.instance.update(.025); s.scene.updateMatrixWorld(true)
    for (const { board, local, fixed, bottom, bodyHome } of samples) {
      expect(board.localToWorld(local.clone()).distanceTo(fixed)).toBeLessThan(1e-8)
      travel = Math.max(travel, board.localToWorld(bottom.clone()).distanceTo(bodyHome))
    }
  }
  expect(travel).toBeGreaterThan(.005)
})

it.each([2, 3])('keeps the lantern plaque cord on the moving lower rim at checkpoint %i', async initial => {
  let time = 0; vi.spyOn(performance, 'now').mockImplementation(() => time)
  const s = await mount('lantern', initial), lantern = s.scene.getObjectByName('lantern-body')!
  let plaque: THREE.Object3D | undefined
  s.scene.traverse(object => {
    if (object instanceof THREE.Mesh) {
      const size = new THREE.Box3().setFromBufferAttribute(object.geometry.getAttribute('position') as THREE.BufferAttribute).getSize(new THREE.Vector3())
      if (Math.abs(size.x - .2) < 1e-6 && Math.abs(size.y - .28) < 1e-6) plaque = object.parent!
    }
  })
  expect(plaque).toBeDefined()
  for (let frame = 0; frame < 160; frame++) {
    time += 25; s.instance.update(.025); s.scene.updateMatrixWorld(true)
    const rim = lantern.localToWorld(new THREE.Vector3(0, -.39, 0))
    expect(plaque!.getWorldPosition(new THREE.Vector3()).distanceTo(rim)).toBeLessThan(1e-8)
  }
})

it.each([2, 3])('keeps all paper-strip tops on the moving bamboo at checkpoint %i', async initial => {
  let time = 0; vi.spyOn(performance, 'now').mockImplementation(() => time)
  const s = await mount('tanzaku-tanabata', initial), strips: THREE.Mesh[] = []
  let bamboo: THREE.Object3D | undefined
  s.scene.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return
    if (object.geometry instanceof THREE.PlaneGeometry && object.geometry.parameters.width === .12 && object.geometry.parameters.height === .42) strips.push(object)
    if (object.geometry instanceof THREE.CylinderGeometry && object.geometry.parameters.height === .5 && object.geometry.parameters.radiusTop === .05) bamboo = object.parent!
  })
  expect(strips).toHaveLength(4); expect(bamboo).toBeDefined()
  const fixtures = [[-.2, 2.3, 0], [.25, 2, .05], [-.5, 1.7, -.1], [.45, 1.75, .12]]
  const samples = fixtures.map(point => ({ point: new THREE.Vector3(...point), strip: strips.find(strip => Math.abs(strip.position.x - point[0]) < 1e-6)! }))
  for (let frame = 0; frame < 160; frame++) {
    time += 25; s.instance.update(.025); s.scene.updateMatrixWorld(true)
    for (const { point, strip } of samples) {
      expect(strip).toBeDefined()
      expect(strip.getWorldPosition(new THREE.Vector3()).distanceTo(bamboo!.localToWorld(point.clone()))).toBeLessThan(1e-8)
    }
  }
})
