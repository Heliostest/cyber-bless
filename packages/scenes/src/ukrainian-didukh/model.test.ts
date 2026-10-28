import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { OBB } from 'three/addons/math/OBB.js'
import { createDidukhModel } from './model'

const meshes = (root: THREE.Object3D) => {
  const found: THREE.Mesh[] = []
  root.traverse(object => { if (object instanceof THREE.Mesh) found.push(object) })
  return found
}
const bounds = (root: THREE.Object3D) => new THREE.Box3().setFromObject(root)
const solids = (mesh: THREE.Mesh) => {
  mesh.geometry.computeBoundingBox()
  const box = mesh.geometry.boundingBox!
  const matrix = new THREE.Matrix4()
  const count = mesh instanceof THREE.InstancedMesh ? mesh.count : 1
  return Array.from({ length: count }, (_, i) => {
    if (mesh instanceof THREE.InstancedMesh) mesh.getMatrixAt(i, matrix)
    else matrix.identity()
    const obb = new OBB().fromBox3(box).applyMatrix4(mesh.matrixWorld.clone().multiply(matrix))
    obb.halfSize.subScalar(1e-6)
    return obb
  })
}
const snapshot = (root: THREE.Object3D) => {
  const state: number[][] = []
  root.traverse(object => state.push([...object.position.toArray(), ...object.quaternion.toArray(), ...object.scale.toArray()]))
  return state
}

// These checks catch missing ears, open/inverted tubes, invisible gesture cues,
// feet that float or cut through the tray, discontinuous restoration and leaks.
describe('Didukh wheat sheaf with intact ears and a real splayed standing base', () => {
  it('offers visible front mesh targets for gathering, tying and placement', () => {
    const model = createDidukhModel()
    try {
      expect(model.root.name).toBe('didukh-subject')
      expect(model.actor.name).toBe('didukh-sheaf')
      const names: string[] = []
      model.root.traverse(object => { expect(object.name).not.toBe(''); names.push(object.name) })
      expect(new Set(names).size).toBe(names.length)
      expect(model.targets).toHaveLength(3)
      for (let step = 0; step < 3; step++) {
        model.pose(step, 0)
        const point = model.roots[step]!.localToWorld(new THREE.Vector3(...model.anchors[step]!))
        const direction = new THREE.Vector3(0, 2, 7).normalize()
        const ray = new THREE.Raycaster(point.clone().addScaledVector(direction, 6), direction.negate())
        expect(ray.intersectObject(model.targets[step]!, true).length, `step ${step}`).toBeGreaterThan(0)
      }
      expect(model.actor.getObjectByName('didukh-blue-waist-band')).toBeInstanceOf(THREE.Mesh)
      expect(model.actor.getObjectByName('didukh-coral-knot')).toBeInstanceOf(THREE.Mesh)
    } finally { model.dispose() }
  })

  it('builds recognizable grain ears with separate attached kernels and slender awns', () => {
    const model = createDidukhModel()
    try {
      const ears: THREE.Object3D[] = []
      model.actor.traverse(object => { if (/^didukh-ear-\d+$/.test(object.name)) ears.push(object) })
      expect(ears.length).toBeGreaterThanOrEqual(13)
      let totalKernels = 0
      for (const ear of ears) {
        const kernels = ear.children.find(child => child.name.endsWith('-kernels')) as THREE.InstancedMesh
        const awns = ear.children.find(child => child.name.endsWith('-awns')) as THREE.InstancedMesh
        const rachis = ear.children.find(child => child.name.endsWith('-rachis')) as THREE.Mesh
        expect(kernels).toBeInstanceOf(THREE.InstancedMesh)
        expect(kernels.count).toBeGreaterThanOrEqual(10)
        expect(awns.count).toBeGreaterThanOrEqual(kernels.count)
        expect(rachis).toBeInstanceOf(THREE.Mesh)
        totalKernels += kernels.count
        kernels.geometry.computeBoundingBox()
        const matrix = new THREE.Matrix4()
        // The thin central rachis must not run through the grain interiors.
        for (let i = 0; i < kernels.count; i++) {
          kernels.getMatrixAt(i, matrix)
          const grain = kernels.geometry.boundingBox!.clone().applyMatrix4(matrix)
          expect(Math.min(Math.abs(grain.min.x), Math.abs(grain.max.x)), ear.name).toBeGreaterThan(.009)
          expect(grain.min.x * grain.max.x, ear.name).toBeGreaterThan(0)
        }
      }
      expect(totalKernels).toBeGreaterThanOrEqual(150)
    } finally { model.dispose() }
  })

  it('uses finite, outward-facing, closed and nondegenerate solids for every owned geometry', () => {
    const model = createDidukhModel()
    try {
      const checked = new Set<THREE.BufferGeometry>()
      for (const mesh of meshes(model.root)) {
        if (checked.has(mesh.geometry)) continue
        checked.add(mesh.geometry)
        const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry
        const position = geometry.getAttribute('position')
        const edges = new Map<string, number>()
        let volume = 0
        for (let i = 0; i < position.count; i += 3) {
          const triangle = [0, 1, 2].map(j => new THREE.Vector3().fromBufferAttribute(position, i + j)) as [THREE.Vector3, THREE.Vector3, THREE.Vector3]
          const [a, b, c] = triangle
          for (const point of triangle) expect(point.toArray().every(Number.isFinite), mesh.name).toBe(true)
          expect(b.clone().sub(a).cross(c.clone().sub(a)).length(), mesh.name).toBeGreaterThan(1e-11)
          volume += a.dot(b.clone().cross(c)) / 6
          const keys = triangle.map(point => point.toArray().map(n => (Math.abs(n) < 5e-7 ? 0 : n).toFixed(6)).join(','))
          for (let j = 0; j < 3; j++) {
            const key = [keys[j]!, keys[(j + 1) % 3]!].sort().join('/')
            edges.set(key, (edges.get(key) ?? 0) + 1)
          }
        }
        expect([...edges.values()].every(count => count === 2), mesh.name).toBe(true)
        expect(volume, mesh.name).toBeGreaterThan(1e-10)
        if (geometry !== mesh.geometry) geometry.dispose()
      }
    } finally { model.dispose() }
  })

  it('rests every cut stalk foot on the preparation tray, then stands on the floor with a broad base', () => {
    const model = createDidukhModel()
    try {
      const feet = meshes(model.actor).filter(mesh => /^didukh-leg-\d+-stalk-\d+$/.test(mesh.name))
      expect(feet.length).toBeGreaterThanOrEqual(18)
      const tray = bounds(model.root.getObjectByName('didukh-work-tray')!)
      for (const foot of feet) {
        const box = bounds(foot)
        expect(box.min.y, foot.name).toBeCloseTo(tray.max.y, 6)
        expect(box.min.x).toBeGreaterThanOrEqual(tray.min.x)
        expect(box.max.x).toBeLessThanOrEqual(tray.max.x)
        expect(box.min.z).toBeGreaterThanOrEqual(tray.min.z)
        expect(box.max.z).toBeLessThanOrEqual(tray.max.z)
      }
      model.pose(2, 1)
      const floor = bounds(model.root.getObjectByName('didukh-honeywood-floor')!)
      for (const foot of feet) expect(bounds(foot).min.y, foot.name).toBeCloseTo(floor.max.y, 6)
      const footCenters = feet.map(mesh => {
        const point = mesh.geometry.getAttribute('position')
        return new THREE.Vector3().fromBufferAttribute(point, 0).applyMatrix4(mesh.matrixWorld)
      })
      expect(Math.max(...footCenters.map(point => point.x)) - Math.min(...footCenters.map(point => point.x))).toBeGreaterThan(.6)
      expect(Math.max(...footCenters.map(point => point.z)) - Math.min(...footCenters.map(point => point.z))).toBeGreaterThan(.6)
      expect(bounds(model.actor).min.y).toBeCloseTo(0, 6)
    } finally { model.dispose() }
  })

  it('keeps the entire sheaf above its supports and away from the corner walls throughout all gestures', () => {
    const model = createDidukhModel()
    try {
      const moving = meshes(model.actor)
      const ids = new Set(moving.map(mesh => mesh.id))
      const obstacles = meshes(model.root).filter(mesh => !ids.has(mesh.id)).flatMap(mesh => solids(mesh).map(obb => ({ name: mesh.name, obb })))
      for (let step = 0; step < 3; step++) for (let frame = 0; frame <= 30; frame++) {
        model.pose(step, frame / 30)
        for (const mesh of moving) for (const obb of solids(mesh)) for (const obstacle of obstacles) {
          expect(obb.intersectsOBB(obstacle.obb), `${mesh.name} / ${obstacle.name} at ${step}:${frame}`).toBe(false)
        }
        expect(bounds(model.actor).min.y).toBeGreaterThanOrEqual(-1e-7)
        expect(bounds(model.actor).max.y).toBeLessThan(2.9)
        const grains = moving.filter(mesh => mesh.name.endsWith('-kernels'))
        for (const grain of grains) expect(bounds(grain).min.y).toBeGreaterThan(1.2)
      }
    } finally { model.dispose() }
  })

  it('restores every child pose exactly at adjacent endpoints and clamps excess gesture progress', () => {
    const model = createDidukhModel()
    try {
      model.pose(0, 0)
      const initial = snapshot(model.root)
      model.pose(-4, -2)
      expect(snapshot(model.root)).toEqual(initial)
      for (let step = 0; step < 3; step++) {
        model.pose(step, 1)
        const end = snapshot(model.root)
        model.pose(step + 1, 0)
        expect(snapshot(model.root)).toEqual(end)
        model.pose(0, .73)
        model.pose(step + 1, 0)
        expect(snapshot(model.root)).toEqual(end)
      }
      const final = snapshot(model.root)
      model.pose(12, 4)
      expect(snapshot(model.root)).toEqual(final)
      model.pose(1, 0)
      const loose = bounds(model.actor.getObjectByName('didukh-blue-waist-band')!).getSize(new THREE.Vector3())
      model.pose(1, 1)
      const tied = bounds(model.actor.getObjectByName('didukh-blue-waist-band')!).getSize(new THREE.Vector3())
      expect(tied.x).toBeLessThan(loose.x)
      expect(tied.z).toBeLessThan(loose.z)
    } finally { model.dispose() }
  })

  it('releases every instanced GPU batch exactly once when the shared renderer survives the scene', () => {
    const model = createDidukhModel()
    const batches = meshes(model.root).filter((mesh): mesh is THREE.InstancedMesh => mesh instanceof THREE.InstancedMesh)
    expect(batches).toHaveLength(57)
    const releases = new Map<THREE.InstancedMesh, number>()
    for (const batch of batches) batch.addEventListener('dispose', () => releases.set(batch, (releases.get(batch) ?? 0) + 1))
    for (let step = 0; step < 3; step++) model.pose(step, .5)
    expect(releases.size).toBe(0)
    model.dispose()
    model.dispose()
    expect(releases.size).toBe(batches.length)
    for (const batch of batches) expect(releases.get(batch), batch.name).toBe(1)
  })
  it('allocates no gesture resources and disposes each shared owned geometry and material once', () => {
    const model = createDidukhModel()
    const resources = () => new Set(meshes(model.root).flatMap(mesh => [mesh.geometry, ...(Array.isArray(mesh.material) ? mesh.material : [mesh.material])]))
    const owned = resources()
    const releases = new Map<object, number>()
    for (const resource of owned) resource.addEventListener('dispose', () => releases.set(resource, (releases.get(resource) ?? 0) + 1))
    for (let step = 0; step < 3; step++) for (let frame = 0; frame <= 20; frame++) model.pose(step, frame / 20)
    expect(resources()).toEqual(owned)
    expect(releases.size).toBe(0)
    model.dispose()
    model.dispose()
    expect(releases.size).toBe(owned.size)
    expect([...releases.values()].every(count => count === 1)).toBe(true)
  })
})
