import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { createStylizedWater } from './stylized-water'

describe('shallow stylized water', () => {
  it('preserves the authored hit surface while the visible lighting moves and reduced motion freezes it', () => {
    const geometry = new THREE.CircleGeometry(1.35, 48)
    const positions = Array.from(geometry.attributes.position.array)
    const effect = createStylizedWater({ geometry, radius: 1.35, depth: .2 })
    effect.surface.rotation.x = -Math.PI / 2
    effect.surface.position.y = .02
    effect.surface.updateMatrixWorld(true)
    const ray = new THREE.Raycaster(new THREE.Vector3(.21, 2, .13), new THREE.Vector3(0, -1, 0))
    const originalHit = ray.intersectObject(effect.surface, true)
    expect(originalHit).toHaveLength(1)
    expect(originalHit[0].point.y).toBeCloseTo(.02)
    for (let i = 0; i < 60; i++) effect.update(1 / 60)
    expect(effect.time).toBeCloseTo(1)
    effect.update(10, true)
    expect(effect.time).toBeCloseTo(1)
    effect.update(1 / 60)
    expect(effect.time).toBeCloseTo(1 + 1 / 60)
    expect(Array.from(geometry.attributes.position.array)).toEqual(positions)
    const nextHit = ray.intersectObject(effect.surface, true)
    expect(nextHit).toHaveLength(1)
    expect(nextHit[0].object).toBe(effect.surface)
    expect(nextHit[0].point.distanceTo(originalHit[0].point)).toBeLessThan(1e-6)
    expect(effect.bed.getWorldPosition(new THREE.Vector3()).y).toBeCloseTo(-.18)
    effect.dispose()
  })

  it('resumes gently after a suspended frame and ignores invalid frame deltas', () => {
    const effect = createStylizedWater({ geometry: new THREE.PlaneGeometry(3, 5), normal: 'y' })
    for (const dt of [NaN, Infinity, -1, 0]) effect.update(dt)
    expect(effect.time).toBe(0)
    effect.update(100)
    expect(effect.time).toBeLessThan(.11)
    effect.update(.02)
    expect(effect.time).toBeCloseTo(.12)
    effect.dispose()
  })

  it('manages an interactive multi-source ripple ring buffer, flow direction, and CPU surface sampling', () => {
    const geometry = new THREE.PlaneGeometry(4, 4, 8, 8).rotateX(-Math.PI / 2)
    const positions = Array.from(geometry.attributes.position.array)
    const effect = createStylizedWater({
      geometry,
      normal: 'y',
      waveAmplitude: 0.012,
      rippleSpeed: 1.0,
      rippleDamping: 1.2,
      rippleWavelength: 0.25,
    })

    expect(effect.activeRippleCount).toBe(0)
    effect.setFlowDirection(0, -1, 0.65)
    effect.triggerRipple(0, 0, 1.4, 1.5)
    expect(effect.activeRippleCount).toBe(1)

    // Advance 0.3s -> wavefront is around r = 0.30 m; surface height and normal respond cleanly.
    for (let i = 0; i < 6; i++) effect.update(0.05)
    const sampleAtFront = effect.sampleSurface(0.3, 0)
    expect(Number.isFinite(sampleAtFront.height)).toBe(true)
    expect(sampleAtFront.normal.length()).toBeCloseTo(1, 5)
    expect(Math.abs(sampleAtFront.height)).toBeGreaterThan(0.002)

    // Overflowing past 8 ripples wraps cleanly inside the 8-slot ring buffer.
    for (let i = 0; i < 12; i++) effect.triggerRipple(i * 0.1, -i * 0.05, 0.9, 1.2)
    expect(effect.activeRippleCount).toBe(8)

    // Non-finite ripple coordinates are safely ignored.
    effect.triggerRipple(NaN, 0)
    expect(effect.activeRippleCount).toBe(8)

    // Reduced motion calms sampled wave displacement to zero.
    effect.update(0.05, true)
    const calm = effect.sampleSurface(0.3, 0)
    expect(calm.height).toBe(0)
    expect(calm.normal.y).toBeCloseTo(1, 6)

    // Resume and let ripples naturally decay and expire.
    for (let i = 0; i < 90; i++) effect.update(0.1, false)
    expect(effect.activeRippleCount).toBe(0)

    // Reset restores deterministic initial state; authored geometry buffer stays untouched.
    effect.triggerRipple(0.2, 0.1, 1.2, 1.0)
    effect.reset()
    expect(effect.time).toBe(0)
    expect(effect.activeRippleCount).toBe(0)
    expect(Array.from(geometry.attributes.position.array)).toEqual(positions)
    effect.dispose()
  })

  it('produces identical deterministic surface samples for two independent instances', () => {
    const a = createStylizedWater({ geometry: new THREE.PlaneGeometry(3, 3), normal: 'y', seed: 901 })
    const b = createStylizedWater({ geometry: new THREE.PlaneGeometry(3, 3), normal: 'y', seed: 901 })
    a.triggerRipple(0.2, -0.3, 1.1, 1.4)
    b.triggerRipple(0.2, -0.3, 1.1, 1.4)
    for (let i = 0; i < 10; i++) {
      a.update(0.04)
      b.update(0.04)
    }
    const sa = a.sampleSurface(0.45, -0.1)
    const sb = b.sampleSurface(0.45, -0.1)
    expect(sa.height).toBe(sb.height)
    expect(sa.slopeX).toBe(sb.slopeX)
    expect(sa.slopeZ).toBe(sb.slopeZ)
    a.dispose()
    b.dispose()
  })

  it('releases both layers exactly once and stops updates after the scene leaves', () => {
    const parent = new THREE.Group()
    const effect = createStylizedWater({ geometry: new THREE.CircleGeometry(1) })
    parent.add(effect.surface)
    const resources = [effect.surface.geometry, effect.surface.material, effect.bed.geometry, effect.bed.material]
    const releases = resources.map(resource => vi.spyOn(resource, 'dispose'))
    effect.update(.05)
    effect.dispose()
    effect.dispose()
    effect.update(.05)
    expect(effect.time).toBe(.05)
    expect(parent.children).toHaveLength(0)
    expect(effect.surface.children).toHaveLength(0)
    releases.forEach(release => expect(release).toHaveBeenCalledOnce())
  })
})
