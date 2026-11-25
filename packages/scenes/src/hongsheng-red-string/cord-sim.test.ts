import { afterEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { _resetRapierLoaderForTest, isRapierLoaded } from '@wbr/scene-runtime/rapier-soft-body'
import {
  arcPoint,
  clampCordClearOfFixtures,
  CLASP_HOME_POS,
  createBraidedBraceletStrandGeometry,
  createHelicalSpoolLayerGeometry,
  createRedStringCordSim,
  FEED_PARTICLES,
  FEED_RADIUS,
  setBraceletArcReveal,
  SOCKET_POS,
  SPOOL_EXIT,
  SPOOL_PAD_TOP_Y,
  TAIL_PARTICLES,
  TAIL_RADIUS,
  tailSocketExit,
  WORKBOARD_TOP_Y,
} from './cord-sim'

const sims: ReturnType<typeof createRedStringCordSim>[] = []
const mats: THREE.Material[] = []

afterEach(() => {
  sims.splice(0).forEach(s => s.dispose())
  mats.splice(0).forEach(m => m.dispose())
  _resetRapierLoaderForTest()
})

function makeMats() {
  const red = new THREE.MeshStandardMaterial({ color: 0xbd4845, roughness: .91 })
  const twist = new THREE.MeshStandardMaterial({ color: 0x9e3838, roughness: .92 })
  mats.push(red, twist)
  return { red, twist }
}

function allPositionsFinite(obj: THREE.Object3D): boolean {
  let ok = true
  obj.traverse(child => {
    const m = child as THREE.Mesh
    if (!m.isMesh || !m.geometry) return
    const pos = m.geometry.getAttribute('position')
    if (!pos) return
    for (let i = 0; i < pos.count; i++) {
      if (!Number.isFinite(pos.getX(i) + pos.getY(i) + pos.getZ(i))) ok = false
    }
  })
  return ok
}

describe('hongsheng-red-string braided geometry & Rapier cord simulation', () => {
  it('builds seamless boundary-matched braided bracelet arcs with outward normals and smooth lockstep reveal', () => {
    const arcs0 = Array.from({ length: 12 }, (_, i) => createBraidedBraceletStrandGeometry(i, 0, 12, 22, 10, 24))
    const arcs1 = Array.from({ length: 12 }, (_, i) => createBraidedBraceletStrandGeometry(i, 1, 12, 22, 10, 24))
    const stride = 11 // radialSegments + 1
    const lastRing = 22 * stride
    for (const group of [arcs0, arcs1]) {
      for (let i = 0; i < 12; i++) {
        const cur = group[i]!
        const next = group[(i + 1) % 12]!
        const curOrigin = arcPoint((i + .5) / 12)
        const nextOrigin = arcPoint(((i + 1) % 12 + .5) / 12)
        const pCur = cur.getAttribute('position')
        const pNext = next.getAttribute('position')
        const nCur = cur.getAttribute('normal')
        const nNext = next.getAttribute('normal')
        for (let j = 0; j < stride; j++) {
          const a = new THREE.Vector3().fromBufferAttribute(pCur, lastRing + j).add(curOrigin)
          const b = new THREE.Vector3().fromBufferAttribute(pNext, j).add(nextOrigin)
          expect(a.distanceTo(b)).toBeLessThan(1e-5)
          const na = new THREE.Vector3().fromBufferAttribute(nCur, lastRing + j)
          const nb = new THREE.Vector3().fromBufferAttribute(nNext, j)
          expect(na.distanceTo(nb)).toBeLessThan(1e-5)
        }
        // Smooth progressive reveal scales drawRange monotonically.
        setBraceletArcReveal(cur, 0)
        expect(cur.drawRange.count).toBe(0)
        setBraceletArcReveal(cur, .5)
        const half = cur.drawRange.count
        expect(half).toBeGreaterThan(0)
        setBraceletArcReveal(cur, 1)
        expect(cur.drawRange.count).toBeGreaterThan(half)
        expect(cur.drawRange.count % 3).toBe(0)
        cur.dispose()
      }
    }
  })

  it('builds finite continuous helical spool layers without NaNs', () => {
    for (const layer of [0, 1] as const) {
      const geo = createHelicalSpoolLayerGeometry(layer)
      const pos = geo.getAttribute('position')
      expect(pos.count).toBeGreaterThan(500)
      for (let i = 0; i < pos.count; i++) {
        expect(Number.isFinite(pos.getX(i) + pos.getY(i) + pos.getZ(i))).toBe(true)
      }
      geo.dispose()
    }
  })

  it('never loads Rapier WASM on construction or in reduced motion and stays completely still when reduced', () => {
    const { red, twist } = makeMats()
    let reduced = true
    const sim = createRedStringCordSim(red, twist, {
      isActive: () => true,
      isReducedMotion: () => reduced,
    })
    sims.push(sim)
    expect(isRapierLoaded()).toBe(false)
    expect(sim.rapierReady).toBe(false)

    sim.start(0, CLASP_HOME_POS)
    for (let i = 0; i < 30; i++) {
      sim.update(1 / 60, { checkpoint: 0, claspPos: CLASP_HOME_POS, windProgress: 0, windingActive: false, claspMoving: false })
    }
    expect(isRapierLoaded()).toBe(false)
    expect(sim.rapierReady).toBe(false)
    const snapFeedA = sim.sampleFeedPoints().map(p => p.toArray())
    const snapTailA = sim.sampleTailPoints().map(p => p.toArray())
    for (let i = 0; i < 20; i++) {
      sim.update(1 / 60, { checkpoint: 0, claspPos: CLASP_HOME_POS, windProgress: 0, windingActive: false, claspMoving: false })
    }
    expect(sim.sampleFeedPoints().map(p => p.toArray())).toEqual(snapFeedA)
    expect(sim.sampleTailPoints().map(p => p.toArray())).toEqual(snapTailA)
    expect(allPositionsFinite(sim.feedGroup)).toBe(true)
    expect(allPositionsFinite(sim.tailGroup)).toBe(true)
    // All sample points clear workboard and holder foot.
    for (const p of sim.sampleFeedPoints().slice(1, -1)) {
      const copy = p.clone()
      expect(clampCordClearOfFixtures(copy, FEED_RADIUS, 0)).toBe(false)
      expect(p.y).toBeGreaterThanOrEqual(WORKBOARD_TOP_Y + FEED_RADIUS)
    }
    for (const p of sim.sampleTailPoints().slice(1, -1)) {
      const copy = p.clone()
      expect(clampCordClearOfFixtures(copy, TAIL_RADIUS, 0)).toBe(false)
      expect(p.y).toBeGreaterThanOrEqual(WORKBOARD_TOP_Y + TAIL_RADIUS)
    }
    void SPOOL_PAD_TOP_Y
  })

  it('lazily loads real Rapier WASM when active and non-reduced, simulates clasp tail motion, clears fixtures, and freezes when paused or toggled reduced', async () => {
    const { red, twist } = makeMats()
    let active = true
    let reduced = false
    const sim = createRedStringCordSim(red, twist, {
      isActive: () => active,
      isReducedMotion: () => reduced,
    })
    sims.push(sim)
    expect(isRapierLoaded()).toBe(false)

    sim.start(1, CLASP_HOME_POS)
    // Wait for lazy WASM initialization to settle.
    for (let wait = 0; wait < 80 && !sim.rapierReady; wait++) {
      await new Promise(resolve => setTimeout(resolve, 25))
    }
    expect(sim.rapierReady).toBe(true)
    expect(isRapierLoaded()).toBe(true)

    // Verify endpoints stay pinned to spool/ring (feed) and socket/clasp (tail).
    const feed0 = sim.sampleFeedPoints()
    expect(feed0).toHaveLength(FEED_PARTICLES)
    expect(feed0[0]!.distanceTo(SPOOL_EXIT)).toBeLessThan(.005)
    expect(feed0[FEED_PARTICLES - 1]!.distanceTo(arcPoint(0))).toBeLessThan(.005)

    const tailBefore = sim.sampleTailPoints().map(p => p.clone())
    expect(tailBefore).toHaveLength(TAIL_PARTICLES)
    expect(tailBefore[0]!.distanceTo(tailSocketExit())).toBeLessThan(.005)
    expect(tailBefore[TAIL_PARTICLES - 1]!.distanceTo(CLASP_HOME_POS)).toBeLessThan(.005)

    // Move clasp toward socket across 25 steps and verify dynamic interior rope response + fixture clearance.
    const movedPos = CLASP_HOME_POS.clone()
    for (let i = 1; i <= 25; i++) {
      movedPos.lerpVectors(CLASP_HOME_POS, SOCKET_POS, i / 25)
      sim.update(1 / 60, { checkpoint: 1, claspPos: movedPos, windProgress: 1, windingActive: false, claspMoving: true })
    }
    const tailAfter = sim.sampleTailPoints()
    expect(tailAfter[TAIL_PARTICLES - 1]!.distanceTo(SOCKET_POS)).toBeLessThan(.005)
    expect(tailAfter[10]!.distanceTo(tailBefore[10]!)).toBeGreaterThan(.04)
    expect(allPositionsFinite(sim.tailGroup)).toBe(true)
    for (const p of tailAfter.slice(1, -1)) {
      expect(p.y).toBeGreaterThanOrEqual(WORKBOARD_TOP_Y + TAIL_RADIUS)
    }

    // Pause gating: positions stay bit-identical while inactive.
    active = false
    const pausedTail = sim.sampleTailPoints().map(p => p.toArray())
    for (let i = 0; i < 12; i++) {
      sim.update(1 / 60, { checkpoint: 1, claspPos: movedPos, windProgress: 1, windingActive: false, claspMoving: true })
    }
    expect(sim.sampleTailPoints().map(p => p.toArray())).toEqual(pausedTail)

    // Runtime toggle reduced motion: snaps cleanly and remains bit-identical.
    active = true
    reduced = true
    sim.update(1 / 60, { checkpoint: 1, claspPos: CLASP_HOME_POS, windProgress: 1, windingActive: false, claspMoving: false })
    const reducedTail = sim.sampleTailPoints().map(p => p.toArray())
    for (let i = 0; i < 12; i++) {
      sim.update(1 / 60, { checkpoint: 1, claspPos: CLASP_HOME_POS, windProgress: 1, windingActive: false, claspMoving: false })
    }
    expect(sim.sampleTailPoints().map(p => p.toArray())).toEqual(reducedTail)
  })
})
