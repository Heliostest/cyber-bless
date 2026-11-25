import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { isRapierLoaded } from '@wbr/scene-runtime/rapier-soft-body'
import {
  buildCalmTailPoints,
  clampThreadClearOfSupport,
  createSpoolThreadSim,
  SPOOL_EXIT_LOCAL,
  TABLE_TOP_Y,
  TAIL_PARTICLES,
  TAIL_RADIUS,
  writeFlossTubeInPlace,
} from './thread-sim'

const SPOOL_HOME = new THREE.Vector3(-.98, .99, .64)

describe('hungarian-embroidery-hoop spool thread simulation', () => {
  it('keeps WASM unloaded on construction and fresh reduced-motion start, staying finite and seated on the table', () => {
    const beforeLoaded = isRapierLoaded()
    const sim = createSpoolThreadSim({
      spoolPos: SPOOL_HOME,
      isActive: () => true,
      isReducedMotion: () => true,
    })
    expect(sim.ready).toBe(false)
    sim.start()
    expect(sim.ready).toBe(false)
    if (!beforeLoaded) expect(isRapierLoaded()).toBe(false)

    const pts0 = sim.step(1 / 60, SPOOL_HOME, null, false).map(p => p.clone())
    const pts1 = sim.step(1 / 60, SPOOL_HOME, null, false).map(p => p.clone())
    expect(pts0).toHaveLength(TAIL_PARTICLES)
    const exit = SPOOL_HOME.clone().add(SPOOL_EXIT_LOCAL)
    expect(pts0[0]!.distanceTo(exit)).toBeLessThan(1e-6)
    for (let i = 0; i < TAIL_PARTICLES; i++) {
      expect(pts0[i]!.toArray().every(Number.isFinite)).toBe(true)
      expect(pts0[i]!.y).toBeGreaterThanOrEqual(TABLE_TOP_Y + TAIL_RADIUS - 1e-5)
      expect(pts0[i]!.distanceTo(pts1[i]!)).toBeLessThan(1e-7)
    }
    sim.dispose()
    expect(sim.disposed).toBe(true)
  })

  it('produces continuous finite catenary points when guiding to an active embroidery stitch target', () => {
    const out = Array.from({ length: TAIL_PARTICLES }, () => new THREE.Vector3())
    const stitchTarget = new THREE.Vector3(-.47, 1.315, .04)
    buildCalmTailPoints(SPOOL_HOME, out, stitchTarget)
    const exit = SPOOL_HOME.clone().add(SPOOL_EXIT_LOCAL)
    expect(out[0]!.distanceTo(exit)).toBeLessThan(1e-6)
    expect(out[TAIL_PARTICLES - 1]!.distanceTo(stitchTarget)).toBeLessThan(1e-6)
    for (let i = 1; i < TAIL_PARTICLES; i++) {
      expect(out[i]!.toArray().every(Number.isFinite)).toBe(true)
      expect(out[i]!.distanceTo(out[i - 1]!)).toBeLessThan(.12)
    }
  })

  it('clamps points clear of both tabletop and spool cylinder', () => {
    const low = new THREE.Vector3(-.7, .50, .7)
    expect(clampThreadClearOfSupport(low, SPOOL_HOME)).toBe(true)
    expect(low.y).toBeGreaterThanOrEqual(TABLE_TOP_Y + TAIL_RADIUS)

    const insideSpool = new THREE.Vector3(SPOOL_HOME.x + .03, SPOOL_HOME.y, SPOOL_HOME.z + .03)
    expect(clampThreadClearOfSupport(insideSpool, SPOOL_HOME)).toBe(true)
    expect(Math.hypot(insideSpool.x - SPOOL_HOME.x, insideSpool.z - SPOOL_HOME.z)).toBeGreaterThanOrEqual(.144 + TAIL_RADIUS - 1e-5)
  })

  it('writes plied floss tube geometry in-place without reallocating buffers or producing NaNs', () => {
    const pts = Array.from({ length: TAIL_PARTICLES }, () => new THREE.Vector3())
    buildCalmTailPoints(SPOOL_HOME, pts, null)
    const curve = new THREE.CatmullRomCurve3(pts)
    const geo = new THREE.TubeGeometry(curve, 36, TAIL_RADIUS, 8, false)
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute
    const normAttr = geo.getAttribute('normal') as THREE.BufferAttribute
    const origPosArr = posAttr.array
    const origNormArr = normAttr.array

    writeFlossTubeInPlace(geo, pts, { turns: 7, plyDepth: .075, taperEnd: true })
    expect(geo.getAttribute('position').array).toBe(origPosArr)
    expect(geo.getAttribute('normal').array).toBe(origNormArr)
    for (let i = 0; i < posAttr.count; i++) {
      expect(Number.isFinite(posAttr.getX(i) + posAttr.getY(i) + posAttr.getZ(i))).toBe(true)
      expect(Number.isFinite(normAttr.getX(i) + normAttr.getY(i) + normAttr.getZ(i))).toBe(true)
    }
    geo.dispose()
  })

  it('steps real Rapier soft-body physics on active non-reduced start, respects pause/reduced toggles, and disposes cleanly', async () => {
    let active = true
    let reduced = false
    const sim = createSpoolThreadSim({
      spoolPos: SPOOL_HOME,
      isActive: () => active,
      isReducedMotion: () => reduced,
    })
    sim.start()
    // Wait for lazy WASM initialization to settle.
    for (let i = 0; i < 60 && !sim.ready; i++) {
      await new Promise(resolve => setTimeout(resolve, 25))
    }
    expect(sim.ready).toBe(true)

    // Move spool upward as during drag and step Rapier: free end must track attachment and stay above table.
    const lifted = SPOOL_HOME.clone().add(new THREE.Vector3(.22, .32, -.14))
    let pts: readonly THREE.Vector3[] = []
    for (let i = 0; i < 15; i++) {
      pts = sim.step(1 / 60, lifted, null, true)
    }
    const exit = lifted.clone().add(SPOOL_EXIT_LOCAL)
    expect(pts[0]!.distanceTo(exit)).toBeLessThan(1e-5)
    for (const p of pts) {
      expect(p.toArray().every(Number.isFinite)).toBe(true)
      expect(p.y).toBeGreaterThanOrEqual(TABLE_TOP_Y + TAIL_RADIUS - 1e-5)
    }

    // Pause freezes points identically.
    active = false
    const paused0 = sim.step(1 / 60, lifted, null, false).map(p => p.clone())
    const paused1 = sim.step(1 / 60, lifted, null, false).map(p => p.clone())
    for (let i = 0; i < TAIL_PARTICLES; i++) {
      expect(paused0[i]!.distanceTo(paused1[i]!)).toBeLessThan(1e-7)
    }

    // Runtime reduced toggle snaps to calm pose and remains bit-identical across frames.
    active = true
    reduced = true
    const red0 = sim.step(1 / 60, SPOOL_HOME, null, false).map(p => p.clone())
    const red1 = sim.step(1 / 60, SPOOL_HOME, null, false).map(p => p.clone())
    for (let i = 0; i < TAIL_PARTICLES; i++) {
      expect(red0[i]!.distanceTo(red1[i]!)).toBeLessThan(1e-7)
    }

    sim.dispose()
    expect(sim.disposed).toBe(true)
  })
})
