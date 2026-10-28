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
  return { canvas, scene, parent, root, camera, placement, source, project }
}
describe('physical pose placement', () => {
  it('can require a deliberate departure before returning to an overlapping home destination', () => {
    const s=mount(), root=s.root
    const model={roots:[root],targets:[root],pose(_step:number,_n:number){root.position.set(0,0,0);root.updateMatrixWorld(true)}}
    model.pose(0,0)
    const placement=createPosePlacement(s.canvas,s.camera,model,s.scene,{requireDeparture:true}), p=s.project(root.getWorldPosition(new THREE.Vector3()))
    placement.begin(0,...p); expect(placement.move(p[0]+3,p[1])).toBe(false)
    expect(placement.move(p[0],p[1]-40)).toBe(false)
    expect(placement.move(p[0]+8,p[1]+4)).toBe(true)
  })
  it('can settle an accessible action from the current pose without a fabricated pointer grab', () => {
    const s = mount(), from = s.root.position.clone()
    s.placement.capture(0); s.root.position.set(9,9,9); s.placement.settle(0)
    expect(s.root.position.distanceTo(from)).toBeLessThan(1e-8)
    s.placement.settle(1); expect(s.root.position.distanceTo(new THREE.Vector3(1,.3,0))).toBeLessThan(1e-8)
  })
  it('inspects a held object through a full turn without accepting, moving its physical center or changing the destination', () => {
    const s = mount(), a = s.source(), initial = new THREE.Box3().setFromObject(s.root,true).getCenter(new THREE.Vector3()), q = s.root.quaternion.clone(), goal = s.placement.destination(0)
    s.placement.begin(0,...a); s.placement.rotate(Math.PI / 2,0)
    expect(s.root.quaternion.angleTo(q)).toBeCloseTo(Math.PI / 2,6)
    expect(new THREE.Box3().setFromObject(s.root,true).getCenter(new THREE.Vector3()).distanceTo(initial)).toBeLessThan(1e-8)
    expect(s.placement.destination(0).distanceTo(goal)).toBeLessThan(1e-8)
    expect(s.placement.ready(...a)).toBe(false)
    s.placement.rotate(Math.PI * 1.5,0)
    expect(s.root.quaternion.angleTo(q)).toBeLessThan(1e-7)
    expect(s.placement.ready(...a)).toBe(false)
  })
  it('rebases the grip after turning so renewed movement follows the pointer without a jump', () => {
    const s = mount(), a = s.source(); s.placement.begin(0,a[0]+11,a[1]-7)
    s.placement.move(a[0]+31,a[1]+13); s.placement.rotate(.8,.3)
    const before = s.root.getWorldPosition(new THREE.Vector3())
    expect(s.placement.rebase(a[0]+31,a[1]+13)).toBe(true)
    expect(s.placement.move(a[0]+31,a[1]+13)).toBe(false)
    expect(s.root.getWorldPosition(new THREE.Vector3()).distanceTo(before)).toBeLessThan(1e-8)
    const p = s.source(); s.placement.move(a[0]+41,a[1]+18)
    const after = s.source()
    expect(after[0]-p[0]).toBeCloseTo(10,5); expect(after[1]-p[1]).toBeCloseTo(5,5)
  })
  it('retains released inspection, allows a new grab and settles to the exact canonical final transform', () => {
    const s = mount(), a = s.source(); s.placement.begin(0,...a); s.placement.move(a[0]+30,a[1]+15); s.placement.rotate(.7,.4)
    const viewed = s.root.quaternion.clone(), viewedPosition = s.root.position.clone()
    s.placement.release(); s.placement.cancel()
    expect(s.root.quaternion.angleTo(viewed)).toBeLessThan(1e-7)
    expect(s.root.position.distanceTo(viewedPosition)).toBeLessThan(1e-8)
    expect(s.placement.move(...a)).toBe(false)
    const grip = s.source(), goal = s.project(s.placement.destination(0))
    expect(s.placement.begin(0,...grip)).toBe(true)
    expect(s.placement.move(...goal)).toBe(true)
    s.placement.capture(); s.placement.settle(1)
    expect(s.root.position.distanceTo(new THREE.Vector3(1,.3,0))).toBeLessThan(1e-8)
    expect(s.root.quaternion.angleTo(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),.3))).toBeLessThan(1e-7)
  })
  it('rotates in camera axes beneath a transformed parent and cancels back to the grabbed pose', () => {
    const s = mount(); s.parent.rotation.set(.15,.4,-.2); s.parent.scale.setScalar(1.8); s.scene.updateMatrixWorld(true)
    const a = s.source(), original = s.root.quaternion.clone(), worldPosition = new THREE.Box3().setFromObject(s.root,true).getCenter(new THREE.Vector3()), worldRotation = s.root.getWorldQuaternion(new THREE.Quaternion())
    s.placement.begin(0,...a); s.placement.rotate(Math.PI / 3,0)
    const expected = new THREE.Quaternion().setFromAxisAngle(s.camera.up.clone().normalize(),Math.PI / 3).multiply(worldRotation)
    expect(s.root.getWorldQuaternion(new THREE.Quaternion()).angleTo(expected)).toBeLessThan(1e-7)
    expect(new THREE.Box3().setFromObject(s.root,true).getCenter(new THREE.Vector3()).distanceTo(worldPosition)).toBeLessThan(1e-8)
    s.placement.cancel(); expect(s.root.quaternion.angleTo(original)).toBeLessThan(1e-7)
  })
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
