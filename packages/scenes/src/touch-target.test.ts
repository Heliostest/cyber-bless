// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { createTouchTarget, insideCanvas, projectTouchPoint } from './touch-target'

function setup() {
  const canvas = document.createElement('canvas')
  canvas.getBoundingClientRect = () => ({ left: 10, top: 20, width: 400, height: 400 }) as DOMRect
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 20)
  camera.position.z = 5; camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true)
  const scene = new THREE.Scene(), target: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> = new THREE.Mesh(new THREE.SphereGeometry(.025, 16, 12), new THREE.MeshBasicMaterial())
  scene.add(target)
  const touch = createTouchTarget(canvas, camera, scene)
  return { canvas, camera, scene, target, touch }
}

describe('bounded visible touch targets', () => {
  it('accepts a tiny visible object within 22 CSS pixels, but not distant or off-canvas input', () => {
    const s = setup(), p = projectTouchPoint(s.canvas, s.camera, s.target)!
    expect(s.touch.hit(p.x + 20, p.y, s.target)).toBe(true)
    expect(s.touch.hit(p.x + 30, p.y, s.target)).toBe(false)
    expect(s.touch.hit(9, p.y, s.target)).toBe(false)
    expect(insideCanvas(s.canvas, NaN, p.y)).toBe(false)
  })
  it('samples a thin visible ring rather than requiring a ray through its empty centre', () => {
    const s = setup()
    s.target.geometry.dispose(); s.target.geometry = new THREE.TorusGeometry(.11, .008, 6, 32)
    const p = projectTouchPoint(s.canvas, s.camera, s.target)!
    expect(s.touch.hit(p.x, p.y, s.target)).toBe(true)
  })
  it('rejects distant moves before intersecting the scene meshes', () => {
    const s = setup(), raycast = vi.spyOn(s.target, 'raycast')
    expect(s.touch.hit(30, 40, s.target)).toBe(false)
    expect(raycast).not.toHaveBeenCalled()
    raycast.mockRestore()
  })
  it('never reaches around an opaque foreground surface under the fingertip', () => {
    const s = setup(), p = projectTouchPoint(s.canvas, s.camera, s.target)!
    const blocker = new THREE.Mesh(new THREE.PlaneGeometry(.10, .20), new THREE.MeshBasicMaterial())
    blocker.position.set(.09, 0, 1); s.scene.add(blocker)
    expect(s.touch.hit(p.x + 12, p.y, s.target)).toBe(false)
    expect(s.touch.occluded(p.x + 12, p.y, s.target)).toBe(true)
    blocker.removeFromParent()
    expect(s.touch.hit(p.x + 12, p.y, s.target)).toBe(true)
    expect(s.touch.occluded(p.x + 12, p.y, s.target)).toBe(false)
  })
  it('excludes a held object but keeps external occlusion and hidden target checks', () => {
    const s = setup(), p = projectTouchPoint(s.canvas, s.camera, s.target)!
    const held = new THREE.Mesh(new THREE.PlaneGeometry(.5, .5), new THREE.MeshBasicMaterial())
    held.position.z = 1; s.scene.add(held)
    expect(s.touch.hit(p.x, p.y, s.target)).toBe(false)
    expect(s.touch.hit(p.x, p.y, s.target, { ignore: held })).toBe(true)
    s.target.visible = false
    expect(s.touch.hit(p.x, p.y, s.target, { ignore: held })).toBe(false)
  })
})
