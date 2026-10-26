// @vitest-environment jsdom
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createPosePlacement } from './pose-placement'

function mount(width = 390, destination?: (step: number, goal: THREE.Vector3) => THREE.Vector3, planeNormal?: THREE.Vector3) {
  const canvas = document.createElement('canvas'), height = 408, left = 17, top = 89
  canvas.getBoundingClientRect = () => ({ left, top, width, height }) as DOMRect
  const scene = new THREE.Scene(), parent = new THREE.Group(), root = new THREE.Group()
  scene.add(parent); parent.position.set(.2, .1, 0); parent.scale.setScalar(1.2); parent.add(root)
  const target = new THREE.Mesh(new THREE.BoxGeometry(.5, .5, .1), new THREE.MeshBasicMaterial())
  root.add(target); target.position.set(.1, .05, 0)
  const camera = new THREE.PerspectiveCamera(40, width / height, .1, 40)
  camera.position.set(0, 0, 8); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true)
  const anchor: [number, number, number] = [0, 0, .06]
  const pose = (_step: number, n: number) => { root.position.set(-1 + 2 * n, n * .3, 0); root.rotation.z = n * .3; scene.updateMatrixWorld(true) }
  const model = { pose, roots: [root], targets: [target], anchors: [anchor] }
  pose(0, 0)
  const placement = createPosePlacement(canvas, camera, model, scene, { destination, planeNormal })
  const project = (point: THREE.Vector3) => { const p = point.clone().project(camera); return [left + (p.x + 1) * width / 2, top + (1 - p.y) * height / 2] as const }
  const source = () => { scene.updateMatrixWorld(true); return project(target.localToWorld(new THREE.Vector3(...anchor))) }
  return { canvas, scene, root, camera, placement, source, project }
}
describe('physical pose placement', () => {
  it('can keep a board piece on its physical horizontal surface while following the finger', () => {
    const s = mount(390, undefined, new THREE.Vector3(0, 1, 0))
    s.camera.position.set(2, 5, 8); s.camera.lookAt(0, 0, 0); s.camera.updateMatrixWorld(true)
    const a = s.source(), y = s.root.position.y
    s.placement.begin(0, ...a); s.placement.move(a[0] + 30, a[1] + 30)
    expect(s.root.position.y).toBeCloseTo(y, 8)
    expect(s.source()[0]).toBeCloseTo(a[0] + 30, 5)
    expect(s.source()[1]).toBeCloseTo(a[1] + 30, 5)
  })
  it('can accept at an open container mouth and still settle to its canonical inside pose', () => {
    const mouth = new THREE.Vector3(1.4, .8, .5), s = mount(390, () => mouth.clone())
    expect(s.placement.destination(0).distanceTo(mouth)).toBeLessThan(1e-8)
    const a = s.source(), goal = s.project(mouth)
    s.placement.begin(0, ...a)
    expect(s.placement.move(...goal)).toBe(true)
    s.placement.capture(); s.placement.settle(1)
    expect(s.root.position.distanceTo(new THREE.Vector3(1, .3, 0))).toBeLessThan(1e-8)
  })
  it.each([320, 390, 1280])('follows an off-centre grip and accepts the object at its destination at %ipx', width => {
    const s = mount(width), a = s.source(), goal = s.project(s.placement.destination(0))
    expect(s.placement.begin(0, a[0] + 12, a[1] - 9)).toBe(true)
    expect(s.placement.ready(a[0] + 12, a[1] - 9)).toBe(false)
    s.placement.move(a[0] + 32, a[1] + 11)
    expect(s.source()[0] - a[0]).toBeCloseTo(20, 5)
    expect(s.source()[1] - a[1]).toBeCloseTo(20, 5)
    // A detour and correction do not change the destination rule.
    s.placement.move(a[0] + 40, a[1] + 70)
    expect(s.placement.move(goal[0] + 12, goal[1] - 9)).toBe(true)
    expect(s.source()[0]).toBeCloseTo(goal[0], 5)
    expect(s.source()[1]).toBeCloseTo(goal[1], 5)
    const held = s.root.position.clone()
    s.placement.capture(); s.root.position.set(-1, 0, 0); s.placement.settle(0)
    expect(s.root.position.distanceTo(held)).toBeLessThan(1e-8)
    s.root.position.set(-1, 0, 0); s.placement.settle(1)
    expect(s.root.position.distanceTo(new THREE.Vector3(1, .3, 0))).toBeLessThan(1e-8)
  })
  it('rejects a long motion to empty space, outside release, invalid coordinates and an occluded goal', () => {
    const s = mount(), a = s.source(), goal = s.project(s.placement.destination(0))
    s.placement.begin(0, ...a)
    expect(s.placement.move(a[0], a[1] + 120)).toBe(false)
    expect(s.placement.move(NaN, goal[1])).toBe(false)
    expect(s.placement.ready(-1, goal[1])).toBe(false)
    const blocker = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
    blocker.position.copy(s.placement.destination(0)); blocker.position.z += 1
    s.scene.add(blocker)
    expect(s.placement.move(...goal)).toBe(false)
    blocker.removeFromParent()
    expect(s.placement.ready(...goal)).toBe(true)
    s.placement.cancel()
    expect(s.source()[0]).toBeCloseTo(a[0], 5)
    expect(s.source()[1]).toBeCloseTo(a[1], 5)
  })
})
