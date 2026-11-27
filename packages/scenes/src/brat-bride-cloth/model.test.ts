import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { _resetRapierLoaderForTest, isRapierLoaded } from '@wbr/scene-runtime/rapier-soft-body'
import { createBratBrideModel } from './model'
import { disposeTree } from '../procedural-kit'

function clothSpan(cloth: THREE.Mesh) {
  cloth.geometry.computeBoundingBox()
  return cloth.geometry.boundingBox!.getSize(new THREE.Vector3())
}

describe('cloth and real window supports', () => {
  it('never loads Rapier WASM in the model constructor or in reduced-motion activate()', async () => {
    _resetRapierLoaderForTest()
    expect(isRapierLoaded()).toBe(false)
    const m = createBratBrideModel({ isReducedMotion: () => true })
    expect(isRapierLoaded()).toBe(false)
    expect(m.smoothing.rapierReady).toBe(false)
    await m.smoothing.activate()
    expect(isRapierLoaded()).toBe(false)
    expect(m.smoothing.rapierReady).toBe(false)
    m.dispose(); disposeTree(m.root)
  })

  it('responds locally to horizontal and outward-diagonal smoothing, stretches outward, and stays on the sill', () => {
    const m = createBratBrideModel(); m.pose(3, 0); m.smoothing.begin()
    const p = m.cloth.geometry.getAttribute('position'), before = Array.from(p.array), buffer = p.array
    const gatheredSpan = clothSpan(m.cloth)
    // Newly set cloth lands visibly gathered narrower than its full laid width.
    expect(gatheredSpan.x).toBeLessThan(1.60)
    expect(gatheredSpan.x).toBeGreaterThan(1.30)
    expect(gatheredSpan.y).toBeGreaterThan(0.08)

    m.smoothing.stroke(new THREE.Vector2(-.7, -.12), new THREE.Vector2(0, .06))
    m.smoothing.update(.05, false)
    expect(Array.from(p.array)).not.toEqual(before)
    expect(m.smoothing.progress()).toBeGreaterThan(0); expect(m.smoothing.progress()).toBeLessThan(.8)
    for (const dt of [NaN, Infinity, -1, 10000, ...Array(100).fill(.05)]) m.smoothing.update(dt, false)
    expect(p.array).toBe(buffer)
    for (let i = 0; i < p.count; i++) {
      expect(Number.isFinite(p.getY(i))).toBe(true)
      expect(p.getY(i)).toBeGreaterThanOrEqual(0)
    }
    m.dispose(); disposeTree(m.root)
  })

  it('requires surface coverage rather than taps, vertical rubbing or repeated rubbing of one spot, and expands flat on finish', () => {
    const m = createBratBrideModel(); m.pose(3, 0); m.smoothing.begin()
    const gatheredSpan = clothSpan(m.cloth)
    for (let i = 0; i < 30; i++) m.smoothing.stroke(new THREE.Vector2(0, -.2), new THREE.Vector2(0, .2))
    expect(m.smoothing.progress()).toBe(0)
    for (let i = 0; i < 30; i++) m.smoothing.stroke(new THREE.Vector2(-.05, 0), new THREE.Vector2(.05, 0))
    expect(m.smoothing.progress()).toBeLessThan(.3)
    for (const z of [-.24, 0, .24]) m.smoothing.stroke(new THREE.Vector2(-.78, z), new THREE.Vector2(.78, z))
    expect(m.smoothing.progress()).toBeGreaterThan(.82)
    m.smoothing.finish(); m.smoothing.update(.05, true)
    const flatSpan = clothSpan(m.cloth)
    expect(flatSpan.x).toBeCloseTo(1.65, 4)
    expect(flatSpan.z).toBeCloseTo(.74, 4)
    expect(flatSpan.x).toBeGreaterThan(gatheredSpan.x + 0.08)
    const p = m.cloth.geometry.getAttribute('position')
    expect(Math.max(...Array.from({ length: p.count }, (_, i) => p.getY(i)))).toBeLessThan(.013)
    m.dispose(); disposeTree(m.root)
  })

  it('attaches the night pane to its actual wooden frame', () => {
    const m = createBratBrideModel(), pane = new THREE.Box3().setFromObject(m.root.getObjectByName('window-night-pane')!, true)
    for (const name of ['window-frame--1.27', 'window-frame-1.27', 'window-crossbar-2.07']) {
      expect(pane.intersectsBox(new THREE.Box3().setFromObject(m.root.getObjectByName(name)!, true)), name).toBe(true)
    }
    m.dispose(); disposeTree(m.root)
  })

  it('preserves all checkpoint shapes and world matrices, including a path reversal and lift drape', () => {
    const m = createBratBrideModel()
    for (let step = 0; step < 3; step++) {
      m.pose(step, 1)
      const positions = Array.from(m.cloth.geometry.getAttribute('position').array), matrix = [...m.cloth.matrixWorld.elements]
      m.pose(step + 1, 0)
      expect(Array.from(m.cloth.geometry.getAttribute('position').array)).toEqual(positions)
      expect(m.cloth.matrixWorld.elements).toEqual(matrix)
    }
    // Lifted pose visibly droops under gravity and gathers inward relative to flat sill span.
    m.pose(1, 0.5)
    const liftedSpan = clothSpan(m.cloth)
    expect(liftedSpan.y).toBeGreaterThan(0.18)
    expect(liftedSpan.x).toBeLessThan(1.48)

    m.pose(0, 0); const before = Array.from(m.cloth.geometry.getAttribute('position').array)
    m.pose(2, .7); m.pose(0, 0)
    expect(Array.from(m.cloth.geometry.getAttribute('position').array)).toEqual(before)
    m.dispose(); disposeTree(m.root)
  })

  it('starts on the bench and ends fully supported on the sill without hover or overhang', () => {
    const m = createBratBrideModel()
    for (const [step, top, support] of [[0, .32, m.bench], [3, .88, m.sill]] as const) {
      m.pose(step, 0)
      const box = new THREE.Box3().setFromObject(m.cloth, true), base = new THREE.Box3().setFromObject(support, true)
      expect(box.min.y).toBeCloseTo(top, 6); expect(base.max.y).toBeCloseTo(top, 6)
      expect(box.min.x).toBeGreaterThan(base.min.x); expect(box.max.x).toBeLessThan(base.max.x)
      expect(box.min.z).toBeGreaterThan(base.min.z); expect(box.max.z).toBeLessThan(base.max.z)
    }
    m.dispose(); disposeTree(m.root)
  })

  it('keeps every actual cloth vertex clear of wood and stone across 603 poses and mid-carry drapes', () => {
    const m = createBratBrideModel(), solids: THREE.Mesh[] = []
    m.root.traverse(o => { const mesh = o as THREE.Mesh; if (mesh.isMesh && mesh !== m.cloth) solids.push(mesh) })
    const bounds = solids.map(o => new THREE.Box3().setFromObject(o, true)), v = new THREE.Vector3()
    let penetration = 0
    const checkMesh = () => {
      const box = new THREE.Box3().setFromObject(m.cloth, true), p = m.cloth.geometry.getAttribute('position')
      for (const b of bounds) {
        if (!box.intersectsBox(b)) continue
        for (let i = 0; i < p.count; i++) {
          v.fromBufferAttribute(p, i).applyMatrix4(m.cloth.matrixWorld)
          if (v.x > b.min.x + 1e-5 && v.x < b.max.x - 1e-5 && v.y > b.min.y + 1e-5 && v.y < b.max.y - 1e-5 && v.z > b.min.z + 1e-5 && v.z < b.max.z - 1e-5) penetration++
        }
      }
    }
    for (let step = 0; step < 3; step++) for (let n = 0; n <= 200; n++) { m.pose(step, n / 200); checkMesh() }
    // Also verify carried low passes near the sill lip clear stone cleanly.
    for (const [y, z] of [[0.72, 1.15], [0.86, 0.96], [0.92, 0.85], [0.90, 0.48]] as const) {
      m.cloth.position.set(0, y, z)
      m.setCarryPose(0.85, 0.7, 0.15, -0.05, 0.12, 0.14)
      checkMesh()
    }
    expect(penetration).toBe(0)
    m.dispose(); disposeTree(m.root)
  })

  it('keeps coherent cloth proportions and finite thickness throughout lifting, gathering and laying', () => {
    const m = createBratBrideModel()
    let minThickness = Infinity
    for (let step = 0; step < 3; step++) {
      for (let n = 0; n <= 100; n++) {
        m.pose(step, n / 100)
        const size = clothSpan(m.cloth)
        expect(size.x).toBeGreaterThan(1.15); expect(size.x).toBeLessThanOrEqual(1.68)
        expect(size.z).toBeGreaterThan(0.50); expect(size.z).toBeLessThanOrEqual(0.78)
        minThickness = Math.min(minThickness, size.y)
      }
    }
    expect(minThickness).toBeGreaterThan(.008)
    m.dispose(); disposeTree(m.root)
  })

  it('reuses all position, normal and color buffers throughout motion', () => {
    const m = createBratBrideModel(), buffers = new Map<THREE.Mesh, [unknown, unknown, unknown]>()
    m.root.traverse(o => {
      const mesh = o as THREE.Mesh
      if (mesh.isMesh) buffers.set(mesh, [mesh.geometry.getAttribute('position').array, mesh.geometry.getAttribute('normal').array, mesh.geometry.getAttribute('color')?.array])
    })
    for (let step = 0; step < 3; step++) {
      for (let n = 0; n <= 100; n++) {
        m.pose(step, n / 100)
        for (const [mesh, [positions, normals, colors]] of buffers) {
          expect(mesh.geometry.getAttribute('position').array).toBe(positions)
          expect(mesh.geometry.getAttribute('normal').array).toBe(normals)
          expect(mesh.geometry.getAttribute('color')?.array).toBe(colors)
        }
      }
    }
    m.dispose(); disposeTree(m.root)
  })

  it('simulates unpinned 3D cloth stretching & sill contact with real Rapier soft-body and clean snapshot rollback', async () => {
    const m = createBratBrideModel(); m.pose(3, 0); m.smoothing.begin()
    await m.smoothing.activate()
    expect(m.smoothing.rapierReady).toBe(true)
    const p = m.cloth.geometry.getAttribute('position'), buf = p.array
    const snap = m.smoothing.snapshot()
    const before = Array.from(p.array)
    const spanBefore = clothSpan(m.cloth)
    for (const z of [-.24, 0, .24]) m.smoothing.stroke(new THREE.Vector2(-.76, z), new THREE.Vector2(.76, z))
    for (let i = 0; i < 36; i++) m.smoothing.update(1 / 60, false)
    const spanAfter = clothSpan(m.cloth)
    expect(p.array).toBe(buf)
    expect(Array.from(p.array)).not.toEqual(before)
    // Real unpinned 3D Rapier cloth expands laterally and flattens vertically onto the sill.
    expect(spanAfter.x).toBeGreaterThan(spanBefore.x + 0.06)
    expect(spanAfter.y).toBeLessThan(spanBefore.y - 0.05)
    for (let i = 0; i < p.count; i++) {
      expect(Number.isFinite(p.getY(i))).toBe(true)
      expect(p.getY(i)).toBeGreaterThanOrEqual(0)
      expect(p.getZ(i)).toBeGreaterThanOrEqual(-0.42)
    }
    m.smoothing.restore(snap)
    expect(Array.from(p.array)).toEqual(before)
    m.dispose(); disposeTree(m.root)
  })
})
