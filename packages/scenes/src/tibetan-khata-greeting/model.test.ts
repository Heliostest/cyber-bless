import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { isRapierLoaded, _resetRapierLoaderForTest } from '@wbr/scene-runtime/rapier-soft-body'
import { createKhataModel } from './model'
import { disposeTree } from '../procedural-kit'

describe('Khata supported transfer', () => {
  it('has continuous checkpoints for both people, scarf and fringe', () => {
    const m = createKhataModel()
    for (let n = 0; n < 3; n++) {
      m.pose(n, 1)
      const end = new Map<string, number[]>()
      m.root.traverse((o) => end.set(o.name, [...o.matrixWorld.elements]))
      m.pose(n + 1, 0)
      m.root.traverse((o) =>
        o.matrixWorld.elements.forEach((v, i) => expect(v, o.name).toBeCloseTo(end.get(o.name)![i]!, 8)),
      )
    }
    m.dispose()
    disposeTree(m.root)
  })

  it('keeps every scarf vertex above the ground through all three steps', () => {
    const m = createKhataModel(), p = new THREE.Vector3()
    let minY = Infinity
    for (let n = 0; n < 3; n++) {
      for (let i = 0; i <= 100; i++) {
        m.pose(n, i / 100)
        m.scarf.traverse((o) => {
          const a = (o as THREE.Mesh).geometry?.getAttribute('position')
          if (a) {
            for (let j = 0; j < a.count; j++) {
              minY = Math.min(minY, p.fromBufferAttribute(a, j).applyMatrix4(o.matrixWorld).y)
            }
          }
        })
      }
    }
    expect(minY).toBeGreaterThan(.35)
    m.dispose()
    disposeTree(m.root)
  })

  it('preserves a folded connected cross-section, non-collapsed triangles and finite solid meshes', () => {
    const m = createKhataModel()
    let count = 0
    m.root.traverse((o) => {
      const g = (o as THREE.Mesh).geometry
      if (!g) return
      count++
      expect(g.index?.count).toBeGreaterThan(0)
      const pos = g.getAttribute('position')
      for (const v of pos.array) expect(Number.isFinite(v)).toBe(true)
    })
    expect(count).toBe(54)
    // Verify non-degenerate cloth triangles and preserved 2-material open-edge grouping.
    const pos = m.cloth.geometry.getAttribute('position')
    const ix = m.cloth.geometry.index!
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
    let minArea = Infinity
    for (let i = 0; i < ix.count; i += 3) {
      a.fromBufferAttribute(pos, ix.getX(i))
      b.fromBufferAttribute(pos, ix.getX(i + 1))
      c.fromBufferAttribute(pos, ix.getX(i + 2))
      minArea = Math.min(minArea, b.sub(a).cross(c.sub(a)).length())
    }
    expect(minArea).toBeGreaterThan(1e-9)
    expect(m.cloth.geometry.groups).toHaveLength(2)
    m.dispose()
    disposeTree(m.root)
  })

  it('lifts, presents and cascades the constant-length folded silk deeper over the guest hands without reallocating buffers', () => {
    const m = createKhataModel()
    const posAttr = m.cloth.geometry.getAttribute('position')
    const buf = posAttr.array
    const giverBox = new THREE.Box3().setFromObject(m.cloth)
    m.pose(1, 0)
    expect(m.scarf.position.y).toBeCloseTo(1.16)
    m.pose(2, 0)
    expect(m.scarf.position.x).toBeCloseTo(0)
    m.pose(3, 0)
    expect(m.scarf.position.x).toBeCloseTo(.35)
    expect(m.cloth.geometry.getAttribute('position').array).toBe(buf)
    // Narrower guest hand span (±0.20 vs ±0.34) visibly cascades the hanging ends deeper in scarf-local Y.
    const guestBox = new THREE.Box3().setFromObject(m.cloth)
    expect(guestBox.min.y - m.scarf.position.y).toBeLessThan((giverBox.min.y - .92) - .08)
    m.dispose()
    disposeTree(m.root)
  })

  it('keeps both sets of feet grounded during the transfer', () => {
    const m = createKhataModel()
    for (let n = 0; n < 3; n++) {
      for (const t of [0, .1, .22, .3, .5, .8, 1]) {
        m.pose(n, t)
        for (const person of m.people) {
          for (const foot of person.feet) expect(foot.position.y - foot.scale.y).toBeCloseTo(0, 8)
        }
      }
    }
    m.dispose()
    disposeTree(m.root)
  })

  it('never loads Rapier WASM on construction or in reduced motion, and simulates hanging silk & fringes when active', async () => {
    _resetRapierLoaderForTest()
    const quiet = createKhataModel({ isReducedMotion: () => true })
    expect(isRapierLoaded()).toBe(false)
    await quiet.startPhysics()
    expect(isRapierLoaded()).toBe(false)
    expect(quiet.rapierReady).toBe(false)
    const quietSnap = Array.from(quiet.cloth.geometry.getAttribute('position').array)
    expect(quiet.stepPhysics(1 / 60)).toBe(false)
    expect(Array.from(quiet.cloth.geometry.getAttribute('position').array)).toEqual(quietSnap)
    quiet.dispose()
    disposeTree(quiet.root)

    let active = true
    let reduced = false
    const live = createKhataModel({ isActive: () => active, isReducedMotion: () => reduced })
    expect(isRapierLoaded()).toBe(false)
    live.pose(3, 0)
    const posBuf = live.cloth.geometry.getAttribute('position').array
    const resting = Array.from(posBuf)
    await live.startPhysics()
    expect(live.rapierReady).toBe(true)
    for (let i = 0; i < 35; i++) live.stepPhysics(1 / 60)
    expect(live.cloth.geometry.getAttribute('position').array).toBe(posBuf)
    const animated = Array.from(posBuf)
    expect(animated.every(Number.isFinite)).toBe(true)
    expect(animated).not.toEqual(resting)

    // Keep all simulated vertices safely off the ground.
    const box = new THREE.Box3().setFromObject(live.scarf)
    expect(box.min.y).toBeGreaterThan(.35)

    // Pause freezes simulation completely.
    active = false
    const paused = Array.from(posBuf)
    for (let i = 0; i < 10; i++) live.stepPhysics(1 / 60)
    expect(Array.from(posBuf)).toEqual(paused)

    // Reduced-motion toggle calms back to exact resting equilibrium and stays still.
    active = true
    reduced = true
    live.stepPhysics(1 / 60)
    const calmed = Array.from(posBuf)
    expect(calmed).toEqual(resting)
    for (let i = 0; i < 10; i++) live.stepPhysics(1 / 60)
    expect(Array.from(posBuf)).toEqual(calmed)

    live.dispose()
    expect(live.stepPhysics(1 / 60)).toBe(false)
    disposeTree(live.root)
  })
})
