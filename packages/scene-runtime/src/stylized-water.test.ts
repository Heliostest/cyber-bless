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
