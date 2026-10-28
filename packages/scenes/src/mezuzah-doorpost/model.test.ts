import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { OBB } from 'three/addons/math/OBB.js'
import { createMezuzahModel } from './model'

const bounds = (object: THREE.Object3D) => new THREE.Box3().setFromObject(object)
const meshes = (object: THREE.Object3D) => {
  const result: THREE.Mesh[] = []
  object.traverse(child => { if (child instanceof THREE.Mesh) result.push(child) })
  return result
}
const vertices = (mesh: THREE.Mesh) => {
  const positions = mesh.geometry.getAttribute('position')
  return Array.from({ length: positions.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld))
}
const solidBounds = (mesh: THREE.Mesh) => {
  mesh.geometry.computeBoundingBox()
  const obb = new OBB().fromBox3(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld)
  // Strict penetration only: the starting seats and final adhesive are meant to touch.
  obb.halfSize.subScalar(.0000005)
  return obb
}

describe('A prepared closed mezuzah case carried to the entrance right doorpost', () => {
  it('keeps one hit-testable whole case with unique names and front-facing anchors', () => {
    const model = createMezuzahModel()
    try {
      const names: string[] = []
      model.root.traverse(object => { expect(object.name).not.toBe(''); names.push(object.name) })
      expect(new Set(names).size).toBe(names.length)
      expect(model.root.name).toBe('mezuzah-subject')
      expect(model.actor.name).toBe('mezuzah-case')
      expect(model.actor.getObjectByName('mezuzah-case-body')).toBeInstanceOf(THREE.Mesh)
      expect(model.actor.getObjectByName('mezuzah-shin')).toBeInstanceOf(THREE.Mesh)
      expect(model.targets).toEqual([model.actor, model.actor, model.actor])
      expect(model.roots).toEqual([model.actor, model.actor, model.actor])
      for (const anchor of model.anchors) {
        expect(anchor).toEqual([0, 0, .12])
        const point = model.actor.localToWorld(new THREE.Vector3(...anchor))
        const ray = new THREE.Raycaster(point.clone().add(new THREE.Vector3(0, 0, 1)), new THREE.Vector3(0, 0, -1))
        expect(ray.intersectObject(model.actor, true).length).toBeGreaterThan(0)
      }
    } finally { model.dispose() }
  })

  it('uses finite, nondegenerate closed solids for the case, doorway, door and rests', () => {
    const model = createMezuzahModel()
    try {
      expect(meshes(model.root).length).toBeGreaterThan(12)
      for (const mesh of meshes(model.root)) {
        const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry
        const position = geometry.getAttribute('position')
        const edgeCounts = new Map<string, number>()
        let volume = 0
        for (let i = 0; i < position.count; i += 3) {
          const triangle = [0, 1, 2].map(j => new THREE.Vector3().fromBufferAttribute(position, i + j))
          for (const point of triangle) expect(point.toArray().every(Number.isFinite), mesh.name).toBe(true)
          const [a, b, c] = triangle as [THREE.Vector3, THREE.Vector3, THREE.Vector3]
          expect(b.clone().sub(a).cross(c.clone().sub(a)).length(), mesh.name).toBeGreaterThan(1e-10)
          volume += a.dot(b.clone().cross(c)) / 6
          const keys = triangle.map(point => point.toArray().map(n => (Math.abs(n) < .0000005 ? 0 : n).toFixed(6)).join(','))
          for (let edge = 0; edge < 3; edge++) {
            const key = [keys[edge]!, keys[(edge + 1) % 3]!].sort().join('/')
            edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1)
          }
        }
        expect([...edgeCounts.values()].every(count => count === 2), mesh.name).toBe(true)
        expect(volume, mesh.name).toBeGreaterThan(1e-9)
        if (geometry !== mesh.geometry) geometry.dispose()
      }
    } finally { model.dispose() }
  })

  it('starts horizontal with the actual case underside resting on both wooden seats', () => {
    const model = createMezuzahModel()
    try {
      model.pose(0, 0)
      expect(model.actor.rotation.z).toBeCloseTo(-Math.PI / 2, 10)
      const body = model.actor.getObjectByName('mezuzah-case-body')!
      for (let i = 0; i < 2; i++) {
        const seat = bounds(model.root.getObjectByName(`mezuzah-rest-seat-${i}`)!)
        const ray = new THREE.Raycaster(new THREE.Vector3((seat.min.x + seat.max.x) / 2, seat.max.y - .1, (seat.min.z + seat.max.z) / 2), new THREE.Vector3(0, 1, 0))
        const hits = ray.intersectObject(body)
        expect(hits.length).toBeGreaterThan(0)
        expect(hits[0]!.point.y).toBeCloseTo(seat.max.y, 6)
      }
    } finally { model.dispose() }
  })

  it('finishes on the inner face of the entrance right post above the upper-third line, with its top toward the interior and exact adhesive contact', () => {
    const model = createMezuzahModel()
    try {
      model.pose(2, 1)
      const post = bounds(model.root.getObjectByName('mezuzah-right-jamb')!)
      const actor = bounds(model.actor)
      const top = model.actor.localToWorld(new THREE.Vector3(0, .36, 0))
      const bottom = model.actor.localToWorld(new THREE.Vector3(0, -.36, 0))
      expect(actor.max.x).toBeCloseTo(post.min.x, 7)
      expect(actor.min.z).toBeGreaterThan(post.min.z)
      expect(actor.max.z).toBeLessThan(post.max.z)
      expect(actor.min.y).toBeGreaterThanOrEqual(3.1 * 2 / 3)
      expect(top.z).toBeLessThan(bottom.z)
      expect(model.actor.rotation.z).toBeCloseTo(Math.PI / 12, 10)
      const backing = model.actor.getObjectByName('mezuzah-adhesive-backing') as THREE.Mesh
      const back = vertices(backing).filter(point => Math.abs(point.x - bounds(backing).max.x) < 1e-7)
      expect(back.length).toBeGreaterThan(3)
      for (const point of back) expect(point.x).toBeCloseTo(post.min.x, 7)
      for (const mesh of meshes(model.actor)) expect(bounds(mesh).max.x, mesh.name).toBeLessThanOrEqual(post.min.x + 1e-7)
      const left = bounds(model.root.getObjectByName('mezuzah-left-jamb')!)
      const lintel = bounds(model.root.getObjectByName('mezuzah-lintel')!)
      expect(left.max.x).toBeLessThan(0)
      expect(lintel.min.x).toBeLessThan(left.min.x + .001)
      expect(lintel.max.x).toBeGreaterThan(post.max.x - .001)
      expect(lintel.max.y).toBeCloseTo(3.1, 6)
      expect(model.root.getObjectByName('mezuzah-door-panel')).toBeInstanceOf(THREE.Mesh)
    } finally { model.dispose() }
  })

  it('lifts, carries and presses the complete case without intersecting the door, frame or rests', () => {
    const model = createMezuzahModel()
    try {
      const moving = meshes(model.actor)
      const movingIds = new Set(moving.map(mesh => mesh.id))
      const fixed = meshes(model.root).filter(mesh => !movingIds.has(mesh.id)).map(mesh => ({ name: mesh.name, bounds: solidBounds(mesh) }))
      for (let step = 0; step < 3; step++) for (let i = 0; i <= 60; i++) {
        model.pose(step, i / 60)
        for (const mesh of moving) for (const obstacle of fixed) {
          expect(solidBounds(mesh).intersectsOBB(obstacle.bounds), `${mesh.name} / ${obstacle.name} at ${step}:${i}`).toBe(false)
        }
        const all = bounds(model.root)
        expect(all.min.x).toBeGreaterThanOrEqual(-1.6)
        expect(all.max.x).toBeLessThanOrEqual(1.7)
        expect(all.min.y).toBeGreaterThanOrEqual(-1e-7)
        expect(all.max.y).toBeLessThanOrEqual(3.2)
        expect(all.min.z).toBeGreaterThanOrEqual(-.7)
        expect(all.max.z).toBeLessThanOrEqual(1.4)
      }
    } finally { model.dispose() }
  })

  it('has exact adjacent endpoints and restores any stored step directly without animation history', () => {
    const model = createMezuzahModel()
    try {
      for (let step = 0; step < 3; step++) {
        model.pose(step, 1)
        const end = model.actor.matrixWorld.elements.slice()
        model.pose(step + 1, 0)
        expect(model.actor.matrixWorld.elements).toEqual(end)
        model.pose(0, .37)
        model.pose(step + 1, 0)
        expect(model.actor.matrixWorld.elements).toEqual(end)
      }
      model.pose(2, 1)
      const end = model.actor.matrixWorld.elements.slice()
      model.pose(3, 1)
      expect(model.actor.matrixWorld.elements).toEqual(end)
      model.pose(0, -1)
      const start = model.actor.matrixWorld.elements.slice()
      model.pose(0, 0)
      expect(model.actor.matrixWorld.elements).toEqual(start)
    } finally { model.dispose() }
  })

  it('retains all resources during gestures and releases each owned resource exactly once', () => {
    const model = createMezuzahModel()
    const resources = () => new Set(meshes(model.root).flatMap(mesh => [mesh.geometry, ...(Array.isArray(mesh.material) ? mesh.material : [mesh.material])]))
    const before = resources()
    const releases = new Map<object, number>()
    for (const resource of before) resource.addEventListener('dispose', () => releases.set(resource, (releases.get(resource) ?? 0) + 1))
    for (let step = 0; step < 3; step++) for (let i = 0; i <= 20; i++) model.pose(step, i / 20)
    expect(resources()).toEqual(before)
    expect(releases.size).toBe(0)
    model.dispose()
    model.dispose()
    expect(releases.size).toBe(before.size)
    expect([...releases.values()].every(count => count === 1)).toBe(true)
  })
})
