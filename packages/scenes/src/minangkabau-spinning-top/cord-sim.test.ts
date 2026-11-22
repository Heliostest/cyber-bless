// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { isRapierLoaded, _resetRapierLoaderForTest } from '@wbr/scene-runtime/rapier-soft-body'
import {
  BOARD_TOP_Y,
  COIL_TURNS,
  CORD_PARTICLES,
  CORD_RADIUS,
  TOP_AXLE,
  createTopCordSim,
  topOuterRadiusAtWorldY,
} from './cord-sim'

const sims: ReturnType<typeof createTopCordSim>[] = []
afterEach(() => {
  sims.splice(0).forEach(s => s.dispose())
})

async function waitForReady(sim: ReturnType<typeof createTopCordSim>, timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs
  while (!sim.rapierReady && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 15))
  }
  expect(sim.rapierReady).toBe(true)
}

function assertAllClearAndFinite(sim: ReturnType<typeof createTopCordSim>, stage: string) {
  const pts = sim.samplePoints()
  expect(pts).toHaveLength(CORD_PARTICLES)
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!
    expect(Number.isFinite(p.x), `${stage} p[${i}].x`).toBe(true)
    expect(Number.isFinite(p.y), `${stage} p[${i}].y`).toBe(true)
    expect(Number.isFinite(p.z), `${stage} p[${i}].z`).toBe(true)
    // Stay on or above wooden tabletop.
    if (Math.abs(p.x) <= 1.44 && Math.abs(p.z) <= .80) {
      expect(p.y, `${stage} p[${i}] board clearance`).toBeGreaterThanOrEqual(BOARD_TOP_Y + CORD_RADIUS - .002)
    }
    // Interior and released points must never penetrate the wooden spinning-top body profile.
    if (i > 0 && p.y - TOP_AXLE.y > .02 && p.y - TOP_AXLE.y <= .85) {
      const dist = Math.hypot(p.x - TOP_AXLE.x, p.z - TOP_AXLE.z)
      const bodyR = topOuterRadiusAtWorldY(p.y, false)
      expect(dist, `${stage} p[${i}] top body clearance at y=${p.y.toFixed(3)}`).toBeGreaterThanOrEqual(bodyR + CORD_RADIUS - .002)
    }
  }
}

describe('spinning-top cotton cord & helical coil simulation', () => {
  it('never loads Rapier WASM on construction or in pure reduced-motion mode, and keeps exact radius 0.021 with full shoulder clearance', () => {
    _resetRapierLoaderForTest()
    const mat = new THREE.MeshStandardMaterial({ color: 0xeee2bd, roughness: .96 })
    const sim = createTopCordSim(mat, { isActive: () => true, isReducedMotion: () => true })
    sims.push(sim)

    expect(isRapierLoaded()).toBe(false)
    expect(sim.mesh.geometry.parameters.radius).toBe(CORD_RADIUS)
    expect(sim.coilsGroup.children).toHaveLength(COIL_TURNS)

    const home = new THREE.Vector3(.38, .34, .52)
    const target = new THREE.Vector3(1.08, .34, .52)
    sim.start('wound', home)
    assertAllClearAndFinite(sim, 'reduced-wound')

    const snap0 = Float32Array.from(sim.mesh.geometry.getAttribute('position').array as Float32Array)
    for (let i = 0; i < 30; i++) {
      sim.update(1 / 60, { mode: 'wound', beadPos: home, unwindProgress: 0, rotorAngleY: 0 })
    }
    expect(isRapierLoaded()).toBe(false)
    expect(Array.from(sim.mesh.geometry.getAttribute('position').array as Float32Array)).toEqual(Array.from(snap0))

    sim.snap('released', target, 1)
    assertAllClearAndFinite(sim, 'reduced-released')
    expect(sim.coilsGroup.visible).toBe(false)
    expect(isRapierLoaded()).toBe(false)
  })

  it('loads Rapier lazily in active non-reduced mode, unwinds coils smoothly, whips free onto the board, and respects pause/reduced toggle/dispose', async () => {
    let active = true
    let reduced = false
    const mat = new THREE.MeshStandardMaterial({ color: 0xeee2bd, roughness: .96 })
    const sim = createTopCordSim(mat, { isActive: () => active, isReducedMotion: () => reduced })
    sims.push(sim)

    const home = new THREE.Vector3(.38, .34, .52)
    const target = new THREE.Vector3(1.08, .34, .52)
    const initialGeo = sim.mesh.geometry
    sim.start('wound', home)
    await waitForReady(sim)
    expect(isRapierLoaded()).toBe(true)
    assertAllClearAndFinite(sim, 'rapier-wound')

    // Unwind phase: bead pulls toward target while coils unwind smoothly and cord stays clear of top body.
    const bead = home.clone()
    for (let step = 0; step < 26; step++) {
      const frac = step / 26
      bead.lerpVectors(home, target, frac * .72)
      sim.update(1 / 60, { mode: 'unwinding', beadPos: bead, unwindProgress: frac, rotorAngleY: step * .16 })
      assertAllClearAndFinite(sim, `rapier-unwind-${step}`)
    }
    // Mid-unwind should reduce coil draw range without detaching top-only floating donuts.
    const topCoil = sim.coilsGroup.getObjectByName(`top-cotton-coil-${COIL_TURNS - 1}`)!
    const bottomCoil = sim.coilsGroup.getObjectByName('top-cotton-coil-0')!
    expect(topCoil.visible).toBe(false)
    expect(bottomCoil.visible).toBe(true)

    // Release & whip/settle onto board.
    const beforeReleaseTail = sim.samplePoints()[0]!.clone()
    for (let step = 0; step < 75; step++) {
      const frac = Math.min(1, .72 + (step / 20) * .28)
      bead.lerpVectors(home, target, frac)
      sim.update(1 / 60, { mode: 'released', beadPos: bead, unwindProgress: 1, rotorAngleY: (26 + step) * .16 })
      assertAllClearAndFinite(sim, `rapier-released-${step}`)
    }
    const landedTail = sim.samplePoints()[0]!
    expect(landedTail.y).toBeLessThan(beforeReleaseTail.y - .35)
    expect(landedTail.y).toBeLessThan(BOARD_TOP_Y + CORD_RADIUS + .12)
    expect(sim.mesh.geometry).toBe(initialGeo)

    // Pause freeze check.
    active = false
    const pausedSnap = Float32Array.from(sim.mesh.geometry.getAttribute('position').array as Float32Array)
    for (let i = 0; i < 15; i++) {
      sim.update(1 / 60, { mode: 'released', beadPos: target, unwindProgress: 1, rotorAngleY: 0 })
    }
    expect(Array.from(sim.mesh.geometry.getAttribute('position').array as Float32Array)).toEqual(Array.from(pausedSnap))

    // Runtime reduced toggle snaps to calm analytical pose and stays strictly still.
    active = true
    reduced = true
    sim.update(1 / 60, { mode: 'released', beadPos: target, unwindProgress: 1, rotorAngleY: 0 })
    const reducedSnap = Float32Array.from(sim.mesh.geometry.getAttribute('position').array as Float32Array)
    for (let i = 0; i < 20; i++) {
      sim.update(1 / 60, { mode: 'released', beadPos: target, unwindProgress: 1, rotorAngleY: 0 })
    }
    expect(Array.from(sim.mesh.geometry.getAttribute('position').array as Float32Array)).toEqual(Array.from(reducedSnap))

    sim.dispose()
    expect(sim.rapierReady).toBe(false)
  })
})
