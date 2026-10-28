import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { OBB } from 'three/addons/math/OBB.js'
import { createBodhiPujaModel } from './model'

const meshes = (root: THREE.Object3D) => {
  const found: THREE.Mesh[] = []
  root.traverse(object => { if (object instanceof THREE.Mesh) found.push(object) })
  return found
}
const bounds = (root: THREE.Object3D) => new THREE.Box3().setFromObject(root)
const snapshot = (root: THREE.Object3D) => {
  const state: unknown[] = []
  root.traverse(object => state.push([object.visible, ...object.position.toArray(), ...object.quaternion.toArray(), ...object.scale.toArray()]))
  return state
}
const obb = (mesh: THREE.Mesh) => {
  mesh.geometry.computeBoundingBox()
  const result = new OBB().fromBox3(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld)
  result.halfSize.subScalar(2e-6)
  return result
}
const named = (root: THREE.Object3D, name: string) => {
  const object = root.getObjectByName(name)
  expect(object, name).toBeDefined()
  return object!
}

// These checks verify the actual artifact: leaf silhouette, a hollow closed pot,
// two real supports, the complete carry path, soil contact and repeatable cleanup.
describe('Bodhi root watering model', () => {
  it('provides visible pitcher belly targets for all three gestures', () => {
    const model = createBodhiPujaModel()
    try {
      expect(model.root.name).toBe('bodhi-puja-subject')
      expect(model.actor.name).toBe('bodhi-water-pitcher')
      const names: string[] = []
      model.root.traverse(object => { expect(object.name).not.toBe(''); names.push(object.name) })
      expect(new Set(names).size).toBe(names.length)
      expect(model.targets).toHaveLength(3)
      for (let step = 0; step < 3; step++) {
        model.pose(step, 0)
        const point = model.roots[step]!.localToWorld(new THREE.Vector3(...model.anchors[step]!))
        const direction = new THREE.Vector3(0, 2, 7).normalize()
        const ray = new THREE.Raycaster(point.clone().addScaledVector(direction, 6), direction.negate())
        const hits = ray.intersectObject(model.targets[step]!, true)
        expect(hits.length, `step ${step}`).toBeGreaterThan(0)
        expect(hits.some(hit => hit.object.name === 'bodhi-pitcher-closed-wall-and-interior')).toBe(true)
      }
    } finally { model.dispose() }
  })

  it('has a pale forked tree, exposed roots and solid cordate leaves with long drip tips', () => {
    const model = createBodhiPujaModel()
    try {
      const batches = meshes(model.root).filter((mesh): mesh is THREE.InstancedMesh => mesh.name.startsWith('bodhi-cordate-drip-tip-leaves-') && mesh instanceof THREE.InstancedMesh)
      expect(batches).toHaveLength(3)
      expect(batches.reduce((count, mesh) => count + mesh.count, 0)).toBe(144)
      for (const batch of batches) {
        const box = new THREE.Box3().setFromBufferAttribute(batch.geometry.getAttribute('position') as THREE.BufferAttribute)
        expect(box.max.y).toBeGreaterThan(.15)
        expect(box.min.y).toBeLessThan(-.44)
        expect(box.getSize(new THREE.Vector3()).y / box.getSize(new THREE.Vector3()).x).toBeGreaterThan(2)
        expect(box.getSize(new THREE.Vector3()).z).toBeGreaterThan(.008)
        expect(batch.castShadow).toBe(true)
        const positions = batch.geometry.getAttribute('position')
        const tip = Array.from({ length: positions.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(positions, i)).filter(point => point.y < -.3)
        expect(tip.every(point => Math.abs(point.x) < .025)).toBe(true)
      }
      const petioles = named(model.root, 'bodhi-attached-leaf-petioles') as THREE.InstancedMesh
      expect(petioles.count).toBe(144)
      const leafMatrix = new THREE.Matrix4(), petioleMatrix = new THREE.Matrix4()
      for (let i = 0; i < 144; i++) {
        const leaf = named(model.root, `bodhi-cordate-drip-tip-leaves-${i % 3}`) as THREE.InstancedMesh
        leaf.getMatrixAt(Math.floor(i / 3), leafMatrix)
        petioles.getMatrixAt(i, petioleMatrix)
        const actualBase = new THREE.Vector3(0, .115, .0045).applyMatrix4(leafMatrix).applyMatrix4(leaf.matrixWorld)
        const leafEnd = new THREE.Vector3(0, .5, 0).applyMatrix4(petioleMatrix).applyMatrix4(petioles.matrixWorld)
        const branchEnd = new THREE.Vector3(0, -.5, 0).applyMatrix4(petioleMatrix).applyMatrix4(petioles.matrixWorld)
        const branch = named(model.root, `bodhi-canopy-branch-${Math.floor(i / 12)}`) as THREE.Mesh
        const branchPositions = branch.geometry.getAttribute('position')
        const actualBranch = new THREE.Vector3().fromBufferAttribute(branchPositions, branchPositions.count - 1).applyMatrix4(branch.matrixWorld)
        expect(leafEnd.distanceTo(actualBase), `leaf ${i} is attached`).toBeLessThan(1e-6)
        expect(branchEnd.distanceTo(actualBranch), `petiole ${i} joins branch`).toBeLessThan(1e-6)
      }
      expect(meshes(model.root).filter(mesh => mesh.name.startsWith('bodhi-visible-root-'))).toHaveLength(7)
      expect(named(model.root, 'bodhi-trunk-fork-right')).toBeInstanceOf(THREE.Mesh)
      expect(named(model.root, 'bodhi-pale-forked-trunk')).toBeInstanceOf(THREE.Mesh)
      const tree = bounds(model.root)
      expect(tree.min.x).toBeGreaterThanOrEqual(-1.651)
      expect(tree.max.x).toBeLessThanOrEqual(1.651)
      expect(tree.min.z).toBeGreaterThanOrEqual(-1.201)
      expect(tree.max.z).toBeLessThanOrEqual(1.201)
      expect(tree.max.y).toBeLessThan(3.1)
    } finally { model.dispose() }
  })

  it('owns only finite outward-facing closed nondegenerate geometries, including the hollow pitcher', () => {
    const model = createBodhiPujaModel()
    try {
      const checked = new Set<THREE.BufferGeometry>()
      for (const mesh of meshes(model.root)) {
        if (checked.has(mesh.geometry)) continue
        checked.add(mesh.geometry)
        const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry
        try {
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
          expect(volume, mesh.name).toBeGreaterThan(1e-11)
        } finally { if (geometry !== mesh.geometry) geometry.dispose() }
      }
      const pitcher = named(model.actor, 'bodhi-pitcher-closed-wall-and-interior') as THREE.Mesh
      const ray = new THREE.Raycaster(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0))
      // Mouth center stays open: the first hit is the interior floor, not a lid.
      pitcher.updateMatrixWorld(true)
      const localRay = ray.ray.clone().applyMatrix4(pitcher.matrixWorld)
      ray.ray.copy(localRay)
      const hits = ray.intersectObject(pitcher)
      expect(hits.length).toBeGreaterThan(0)
      expect(pitcher.worldToLocal(hits[0]!.point.clone()).y).toBeCloseTo(.055, 5)
    } finally { model.dispose() }
  })

  it('starts and finishes upright on separate solid perches supported by the paving slab', () => {
    const model = createBodhiPujaModel()
    try {
      const slab = bounds(named(model.root, 'bodhi-flagstone-slab'))
      expect(slab.min.y).toBeCloseTo(-.14, 6)
      expect(slab.max.y).toBeCloseTo(0, 6)
      for (const [step, progress, support] of [[0, 0, 'bodhi-initial-perch'], [2, 1, 'bodhi-destination-perch']] as const) {
        model.pose(step, progress)
        const perch = bounds(named(model.root, support))
        const body = bounds(named(model.actor, 'bodhi-pitcher-closed-wall-and-interior'))
        expect(perch.min.y).toBeCloseTo(slab.max.y, 6)
        expect(body.min.y).toBeCloseTo(perch.max.y, 6)
        expect(model.actor.rotation.z).toBe(0)
        for (const [x, z] of [[-.18, -.18], [.18, .18]]) {
          const foot = model.actor.localToWorld(new THREE.Vector3(x, 0, z))
          expect(foot.x).toBeGreaterThan(perch.min.x)
          expect(foot.x).toBeLessThan(perch.max.x)
          expect(foot.z).toBeGreaterThan(perch.min.z)
          expect(foot.z).toBeLessThan(perch.max.z)
        }
      }
      expect(named(model.root, 'bodhi-water-stream').visible).toBe(false)
      expect(named(model.root, 'bodhi-damp-soil').visible).toBe(true)
    } finally { model.dispose() }
  })

  it('carries the complete vessel clear of the trunk, bed wall, soil and both stone supports', () => {
    const model = createBodhiPujaModel()
    try {
      const moving = meshes(model.actor)
      const obstacles = meshes(model.root).filter(mesh => !moving.includes(mesh) && !mesh.name.includes('cordate') && !mesh.name.includes('midribs') && !mesh.name.includes('water-') && !mesh.name.includes('damp-soil'))
      for (let step = 0; step < 3; step++) for (let frame = 0; frame <= 40; frame++) {
        model.pose(step, frame / 40)
        const fixed = obstacles.map(mesh => ({ name: mesh.name, solid: obb(mesh) }))
        for (const mesh of moving) for (const obstacle of fixed) expect(obb(mesh).intersectsOBB(obstacle.solid), `${mesh.name} / ${obstacle.name} at ${step}:${frame}`).toBe(false)
        expect(bounds(model.actor).min.y).toBeGreaterThanOrEqual(.12 - 1e-6)
      }
    } finally { model.dispose() }
  })

  it('joins a live stream to the real lip and exposed soil while water falls and dampness persists', () => {
    const model = createBodhiPujaModel()
    try {
      const level = named(model.actor, 'bodhi-pitcher-water-level')
      const high = level.position.y
      const soil = bounds(named(model.root, 'bodhi-exposed-root-soil'))
      const impact = named(model.root, 'bodhi-soil-water-impact').getWorldPosition(new THREE.Vector3())
      expect(Math.hypot(impact.x - .28, impact.z + .25)).toBeLessThan(.79)
      expect(impact.y).toBeGreaterThan(soil.max.y)
      expect(impact.y - soil.max.y).toBeLessThan(.012)
      for (const progress of [.24, .27, .32, .40, .48, .55, .61]) {
        model.pose(2, progress)
        expect(named(model.root, 'bodhi-water-stream').visible).toBe(true)
        const first = named(model.root, 'bodhi-water-stream-segment-0')
        const last = named(model.root, 'bodhi-water-stream-segment-15')
        const start = first.localToWorld(new THREE.Vector3(0, -.5, 0))
        const end = last.localToWorld(new THREE.Vector3(0, .5, 0))
        const lip = named(model.actor, 'bodhi-pitcher-pour-lip-origin').getWorldPosition(new THREE.Vector3())
        expect(start.distanceTo(lip)).toBeLessThan(1e-6)
        expect(end.distanceTo(impact)).toBeLessThan(1e-6)
        const direction = new THREE.Vector3(0, 1, 0).applyQuaternion(level.getWorldQuaternion(new THREE.Quaternion()))
        expect(direction.distanceTo(new THREE.Vector3(0, 1, 0))).toBeLessThan(1e-6)
        expect(level.position.y).toBeLessThan(high)
        const levelWorld = level.getWorldPosition(new THREE.Vector3())
        expect(levelWorld.y + .004, `wet lip at ${progress}`).toBeGreaterThan(lip.y)
        const vessel = named(model.actor, 'bodhi-pitcher-closed-wall-and-interior') as THREE.Mesh
        const waterPositions = (level as THREE.Mesh).geometry.getAttribute('position')
        // Every sampled surface vertex is below the rim and has an inner wall
        // ahead of it; an exterior or wall-penetrating meniscus fails this ray.
        for (let vertex = 0; vertex < waterPositions.count; vertex += 4) {
          const world = level.localToWorld(new THREE.Vector3().fromBufferAttribute(waterPositions, vertex))
          const local = model.actor.worldToLocal(world.clone())
          expect(local.y, `liquid below rim at ${progress}`).toBeLessThan(.65)
          expect(local.y).toBeGreaterThan(.055)
          const radial = new THREE.Vector3(local.x, 0, local.z)
          if (radial.lengthSq() < 1e-10) radial.set(1, 0, 0)
          radial.normalize().transformDirection(model.actor.matrixWorld)
          const cavityRay = new THREE.Raycaster(world, radial)
          const walls = cavityRay.intersectObject(vessel)
          expect(walls.length, `liquid remains inside at ${progress}:${vertex}`).toBeGreaterThan(0)
          expect(walls[0]!.distance).toBeGreaterThan(.003)
        }
        for (let i = 0; i < 16; i++) {
          const segment = named(model.root, `bodhi-water-stream-segment-${i}`)
          expect(segment.localToWorld(new THREE.Vector3(0, .5, 0)).y).toBeGreaterThanOrEqual(impact.y - 1e-6)
          expect(bounds(segment).min.y).toBeGreaterThanOrEqual(soil.max.y - 1e-6)
        }
      }
      model.pose(2, 1)
      expect(level.position.y).toBeCloseTo(.24)
      expect(level.userData.remainingFraction).toBeCloseTo(.32)
      expect(named(model.root, 'bodhi-water-stream').visible).toBe(false)
      expect(named(model.root, 'bodhi-damp-soil').visible).toBe(true)
      expect(bounds(named(model.root, 'bodhi-damp-soil')).min.y).toBeCloseTo(soil.max.y, 6)
      expect(impact.y).toBeCloseTo(bounds(named(model.root, 'bodhi-damp-soil')).max.y, 6)
      const wetPatch = named(model.root, 'bodhi-damp-soil') as THREE.Mesh
      const wetPositions = wetPatch.geometry.getAttribute('position')
      for (let vertex = 0; vertex < wetPositions.count; vertex++) {
        const point = wetPatch.localToWorld(new THREE.Vector3().fromBufferAttribute(wetPositions, vertex))
        expect(Math.hypot(point.x - .28, point.z + .25), 'wet soil remains inside enclosure').toBeLessThan(.79)
      }
    } finally { model.dispose() }
  })

  it('restores all poses exactly, including adjacent endpoints, and clamps invalid progress', () => {
    const model = createBodhiPujaModel()
    try {
      const initial = snapshot(model.root)
      model.pose(-9, -2)
      expect(snapshot(model.root)).toEqual(initial)
      model.pose(Number.NaN, Number.NaN)
      expect(snapshot(model.root)).toEqual(initial)
      for (let step = 0; step < 3; step++) {
        model.pose(step, 1)
        const end = snapshot(model.root)
        model.pose(step + 1, 0)
        expect(snapshot(model.root)).toEqual(end)
        model.pose(2, .48)
        model.pose(step + 1, 0)
        expect(snapshot(model.root)).toEqual(end)
      }
      const final = snapshot(model.root)
      model.pose(20, 4)
      expect(snapshot(model.root)).toEqual(final)
    } finally { model.dispose() }
  })

  it('reuses gesture geometry and frees every instance batch, shared geometry and material exactly once', () => {
    const model = createBodhiPujaModel()
    const resources = () => new Set(meshes(model.root).flatMap(mesh => [mesh.geometry, ...(Array.isArray(mesh.material) ? mesh.material : [mesh.material])]))
    const owned = resources()
    const batches = meshes(model.root).filter((mesh): mesh is THREE.InstancedMesh => mesh instanceof THREE.InstancedMesh)
    expect(batches).toHaveLength(5)
    const releases = new Map<object, number>()
    for (const resource of owned) resource.addEventListener('dispose', () => releases.set(resource, (releases.get(resource) ?? 0) + 1))
    for (const resource of batches) resource.addEventListener('dispose', () => releases.set(resource, (releases.get(resource) ?? 0) + 1))
    for (let step = 0; step < 3; step++) for (let frame = 0; frame <= 20; frame++) model.pose(step, frame / 20)
    expect(resources()).toEqual(owned)
    expect(releases.size).toBe(0)
    model.dispose()
    model.dispose()
    expect(releases.size).toBe(owned.size + batches.length)
    expect([...releases.values()].every(count => count === 1)).toBe(true)
  })
})
