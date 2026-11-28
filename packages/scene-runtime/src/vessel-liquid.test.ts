import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import {
  createLivingPourStream,
  createVesselLiquid,
  LIQUID_PRESETS,
  type LiquidPreset,
} from './vessel-liquid'

const ALL_PRESETS: LiquidPreset[] = [
  'clear-water',
  'amber-tea',
  'sake',
  'herbal-porridge',
  'sumalak',
  'spiced-cocoa',
  'churned-cream',
  'viscous-honey',
  'lamp-oil',
  'pigment-dye',
  'sumi-ink',
  'ebru-bath',
]

describe('vessel-liquid engine', () => {
  it('supports every documented liquid preset with valid polar disc meniscus geometry', () => {
    for (const preset of ALL_PRESETS) {
      expect(LIQUID_PRESETS[preset]).toBeDefined()
      const liquid = createVesselLiquid({ preset, radius: 0.14, radialSegments: 10, angularSegments: 24 })
      const pos = liquid.geometry.getAttribute('position') as THREE.BufferAttribute
      const norm = liquid.geometry.getAttribute('normal') as THREE.BufferAttribute
      // Polar disc must have interior concentric vertices (not just center + single rim like CircleGeometry).
      expect(pos.count).toBe(1 + 10 * 24)
      expect(norm.count).toBe(pos.count)
      // Center sits at y = 0 while outer rim climbs upward due to capillary meniscus.
      expect(pos.getY(0)).toBeCloseTo(0, 6)
      const rimIndex = pos.count - 1
      expect(pos.getY(rimIndex)).toBeGreaterThan(0.002)
      expect(liquid.mesh.userData.toonSurface?.outline).toBe(false)
      expect(liquid.material).toBeInstanceOf(THREE.MeshPhysicalMaterial)
      liquid.dispose()
    }
  })

  it('simulates 2D damped spring-pendulum slosh, swirl, dip depression, and ripples, then settles smoothly', () => {
    const liquid = createVesselLiquid({
      preset: 'spiced-cocoa',
      radius: 0.16,
      radialSegments: 12,
      angularSegments: 28,
    })

    liquid.addTiltImpulse(3.2, -1.8)
    liquid.addSwirlImpulse(6.5)
    liquid.triggerRipple(0.02, -0.01, 1.2)
    liquid.addDipDepression(0, 0, 0.022, 0.06)

    for (let i = 0; i < 6; i++) liquid.update(1 / 60)
    expect(Math.hypot(liquid.state.sloshX, liquid.state.sloshZ)).toBeGreaterThan(0.01)
    expect(liquid.state.swirlVelocity).toBeGreaterThan(1.0)
    expect(liquid.state.swirlPhase).toBeGreaterThan(0.1)
    expect(liquid.state.activeRipples).toBeGreaterThanOrEqual(1)

    // Verify vertices deformed smoothly and stay bounded inside vessel safety amplitude.
    const pos = liquid.geometry.getAttribute('position') as THREE.BufferAttribute
    let maxAbsY = 0
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i)
      expect(Number.isFinite(y)).toBe(true)
      maxAbsY = Math.max(maxAbsY, Math.abs(y))
    }
    expect(maxAbsY).toBeGreaterThan(0.002)
    expect(maxAbsY).toBeLessThan(0.08)

    // After sustained damping with no further impulses, slosh, swirl, dip, and ripples settle to rest.
    for (let i = 0; i < 360; i++) liquid.update(1 / 30)
    expect(Math.abs(liquid.state.sloshX)).toBeLessThan(0.002)
    expect(Math.abs(liquid.state.sloshZ)).toBeLessThan(0.002)
    expect(liquid.state.swirlVelocity).toBe(0)
    expect(liquid.state.activeRipples).toBe(0)
    expect(Math.abs(liquid.state.dipDepth)).toBeLessThan(0.0005)
    liquid.dispose()
  })

  it('tracks a moving and tilting container and levels liquid dynamically toward gravity', () => {
    const bowl = new THREE.Group()
    const liquid = createVesselLiquid({ preset: 'clear-water', radius: 0.12 })
    bowl.add(liquid.mesh)
    liquid.trackContainer(bowl)

    // First frame establishes baseline without spurious impulse.
    liquid.update(1 / 60)
    expect(Math.hypot(liquid.state.sloshX, liquid.state.sloshZ)).toBeLessThan(1e-5)

    // Translate sharply sideways and tilt the bowl.
    bowl.position.set(0.25, 0, 0)
    bowl.rotation.z = 0.22
    bowl.updateMatrixWorld(true)
    for (let i = 0; i < 12; i++) liquid.update(1 / 60)
    expect(Math.hypot(liquid.state.sloshX, liquid.state.sloshZ)).toBeGreaterThan(0.05)

    // Return upright and verify setFillLevel moves height & radius smoothly.
    const sized = createVesselLiquid({
      preset: 'amber-tea',
      radius: 0.10,
      heightRange: [0.02, 0.14],
      hideWhenEmpty: true,
    })
    sized.setFillLevel(0.5, 0.12)
    expect(sized.mesh.position.y).toBeCloseTo(0.08, 6)
    expect(sized.mesh.scale.x).toBeCloseTo(1.2, 6)
    expect(sized.mesh.visible).toBe(true)
    sized.setFillLevel(0)
    expect(sized.mesh.visible).toBe(false)

    liquid.dispose()
    sized.dispose()
  })

  it('guarantees bit-for-bit deterministic checkpoint restoration via reset() and supports immutable gpu mode', () => {
    const a = createVesselLiquid({ preset: 'herbal-porridge', radius: 0.18, seed: 777 })
    const b = createVesselLiquid({ preset: 'herbal-porridge', radius: 0.18, seed: 777 })
    const initialA = Array.from(a.geometry.getAttribute('position').array)
    const initialB = Array.from(b.geometry.getAttribute('position').array)
    expect(initialA).toEqual(initialB)

    // Excite instance A heavily, then reset() -> must match fresh instance B bit-for-bit!
    a.addTiltImpulse(4.5, -3.1)
    a.addSwirlImpulse(5.0)
    a.triggerRipple(0.04, 0.03, 1.5)
    a.addDipDepression(-0.02, 0.02, 0.025, 0.05)
    for (let i = 0; i < 20; i++) a.update(1 / 60)
    expect(Array.from(a.geometry.getAttribute('position').array)).not.toEqual(initialB)

    a.reset()
    expect(Array.from(a.geometry.getAttribute('position').array)).toEqual(initialB)
    expect(a.state.sloshX).toBe(0)
    expect(a.state.sloshZ).toBe(0)
    expect(a.state.swirlVelocity).toBe(0)
    expect(a.state.activeRipples).toBe(0)
    expect(a.state.time).toBe(0)

    // GPU deformMode keeps CPU vertex buffer strictly immutable during live slosh/ripples.
    const gpu = createVesselLiquid({ preset: 'clear-water', radius: 0.11, deformMode: 'gpu' })
    const gpuBefore = Array.from(gpu.geometry.getAttribute('position').array)
    gpu.addTiltImpulse(3.0, 2.0)
    gpu.triggerRipple(0.01, -0.01, 1.3)
    for (let i = 0; i < 20; i++) gpu.update(1 / 60)
    expect(Array.from(gpu.geometry.getAttribute('position').array)).toEqual(gpuBefore)
    expect(Math.hypot(gpu.state.sloshX, gpu.state.sloshZ)).toBeGreaterThan(0.01)

    a.dispose()
    b.dispose()
    gpu.dispose()
  })

  it('honors reducedMotion and disposes all vessel liquid resources exactly once', () => {
    const parent = new THREE.Group()
    const liquid = createVesselLiquid({ preset: 'viscous-honey', radius: 0.14 })
    parent.add(liquid.mesh)
    const restPos = Array.from(liquid.geometry.getAttribute('position').array)
    liquid.addTiltImpulse(2.0, 1.0)
    liquid.update(0.05, 1.2, true)
    expect(Array.from(liquid.geometry.getAttribute('position').array)).toEqual(restPos)

    const gDispose = vi.spyOn(liquid.geometry, 'dispose')
    const mDispose = vi.spyOn(liquid.material, 'dispose')
    liquid.dispose()
    liquid.dispose()
    expect(parent.children).toHaveLength(0)
    expect(gDispose).toHaveBeenCalledOnce()
    expect(mDispose).toHaveBeenCalledOnce()
  })
})

describe('living pour stream', () => {
  it('forms a gravity-tapered parabolic arc with simplex pulsation, splash crown, and deterministic reduced state', () => {
    const stream = createLivingPourStream({
      preset: 'clear-water',
      topRadius: 0.020,
      bottomRadius: 0.010,
      arcForward: 0.35,
      showSplashCrown: true,
    })

    expect(stream.mesh.visible).toBe(false)
    expect(stream.splashCrown.visible).toBe(false)
    expect(stream.material).toBeInstanceOf(THREE.MeshStandardMaterial)

    const start = new THREE.Vector3(-0.3, 1.2, 0)
    const end = new THREE.Vector3(0.0, 0.2, 0)
    stream.updateArc(start, end, 1, 0.45, false)
    expect(stream.mesh.visible).toBe(true)
    expect(stream.splashCrown.visible).toBe(true)
    expect(stream.flow).toBe(1)

    // Verify top ring is wider than bottom ring (gravity-accelerated vena contracta taper).
    const pos = stream.mesh.geometry.getAttribute('position') as THREE.BufferAttribute
    const ringStride = 11 // default radialSegments = 10 -> 11 vertices per ring
    let topMaxDist = 0
    let bottomMaxDist = 0
    for (let k = 0; k < ringStride; k++) {
      const tx = pos.getX(k) - start.x
      const tz = pos.getZ(k) - start.z
      topMaxDist = Math.max(topMaxDist, Math.hypot(tx, tz))
      const bi = pos.count - ringStride + k
      const bx = pos.getX(bi) - end.x
      const bz = pos.getZ(bi) - end.z
      bottomMaxDist = Math.max(bottomMaxDist, Math.hypot(bx, bz))
    }
    expect(topMaxDist).toBeGreaterThan(bottomMaxDist * 1.25)

    // Deterministic equality across two instances at identical inputs.
    const twin = createLivingPourStream({
      preset: 'clear-water',
      topRadius: 0.020,
      bottomRadius: 0.010,
      arcForward: 0.35,
      showSplashCrown: true,
    })
    twin.updateArc(start, end, 1, 0.45, false)
    expect(Array.from(stream.mesh.geometry.getAttribute('position').array)).toEqual(
      Array.from(twin.mesh.geometry.getAttribute('position').array),
    )

    // Turning flow off hides both column and splash crown.
    stream.updateArc(start, end, 0, 0.6, false)
    expect(stream.mesh.visible).toBe(false)
    expect(stream.splashCrown.visible).toBe(false)

    // Idempotent disposal frees geometries and materials once.
    const parent = new THREE.Group()
    parent.add(stream.root)
    const spies = [
      vi.spyOn(stream.mesh.geometry, 'dispose'),
      vi.spyOn(stream.material, 'dispose'),
      vi.spyOn(stream.splashCrown.geometry, 'dispose'),
      vi.spyOn(stream.splashCrown.material as THREE.Material, 'dispose'),
    ]
    stream.dispose()
    stream.dispose()
    expect(parent.children).toHaveLength(0)
    spies.forEach(spy => expect(spy).toHaveBeenCalledOnce())
    twin.dispose()
  })
})
