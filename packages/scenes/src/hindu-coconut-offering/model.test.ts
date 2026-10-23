import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createCoconutOfferingModel } from './model'

const allMeshes = (root: THREE.Object3D) => {
  const result: THREE.Mesh[] = []
  root.traverse(object => { if ((object as THREE.Mesh).isMesh) result.push(object as THREE.Mesh) })
  return result
}
const visibleVertices = (root: THREE.Object3D) => {
  const vertices: THREE.Vector3[] = []
  root.traverseVisible(object => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh) return
    const positions = mesh.geometry.getAttribute('position')
    for (let i = 0; i < positions.count; i++) vertices.push(new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld))
  })
  return vertices
}
const visibleBounds = (root: THREE.Object3D) => new THREE.Box3().setFromPoints(visibleVertices(root))
const snapshot = (root: THREE.Object3D) => {
  const result: unknown[] = []
  root.traverse(object => result.push([object.name, object.visible, [...object.matrixWorld.elements]]))
  return result
}
const shellHalves = (root: THREE.Object3D) => ['left', 'right'].map(side => root.getObjectByName(`coconut-half-shell-${side}`) as THREE.Mesh)

// These tests catch unsupported motion, flat painted cavities, open shell surfaces,
// missed phase endpoints and repeated GPU allocation during scrubbing.
describe('coconut offering geometry', () => {
  it('supports the hard-shell coconut on the preparation ring before lifting only the fruit', () => {
    const model = createCoconutOfferingModel()
    const ring = model.root.getObjectByName('coconut-preparation-ring')!
    const stone = model.root.getObjectByName('coconut-striking-stone')!
    const shell = model.root.getObjectByName('coconut-shell') as THREE.Mesh
    const ringTransform = [...ring.matrixWorld.elements], stoneTransform = [...stone.matrixWorld.elements]
    expect(model.actor.position.x).toBe(-1)
    expect(model.actor.position.z).toBe(.4)
    const top = new THREE.Box3().setFromObject(ring).max.y
    const supported = visibleVertices(shell).filter(v => {
      const radius = Math.hypot(v.x + 1, v.z - .4)
      return radius >= .17602 && radius <= .34
    })
    expect(supported.length).toBeGreaterThan(0)
    expect(Math.min(...supported.map(v => v.y))).toBeCloseTo(top, 5)
    const start = model.actor.position.y
    model.pose(0, 1)
    expect(model.actor.position.y - start).toBeCloseTo(.6, 10)
    expect(ring.matrixWorld.elements).toEqual(ringTransform)
    expect(stone.matrixWorld.elements).toEqual(stoneTransform)
    model.pose(1, 1)
    expect(model.actor.position.x).toBe(.65)
    expect(model.actor.position.y - start).toBeCloseTo(.6, 10)
    model.dispose()
  })

  it('contacts the actual stone before any shell opens and keeps each half supported while opening', () => {
    const model = createCoconutOfferingModel()
    const stone = model.root.getObjectByName('coconut-striking-stone')!
    const whole = model.root.getObjectByName('coconut-whole')!
    expect(new THREE.Box3().setFromObject(stone).max.y).toBeCloseTo(.34, 7)
    model.pose(2, .3)
    expect(whole.visible).toBe(true)
    expect(visibleBounds(model.actor).min.y).toBeGreaterThan(.34)
    model.pose(2, .42)
    expect(whole.visible).toBe(false)
    expect(visibleBounds(model.actor).min.y).toBeCloseTo(.34, 6)
    for (let i = 0; i <= 60; i++) {
      model.pose(2, .42 + .58 * i / 60)
      for (const side of ['left', 'right']) {
        const half = model.root.getObjectByName(`coconut-half-${side}`)!
        expect(half.visible).toBe(true)
        const bottom = visibleVertices(half).reduce((a, b) => a.y < b.y ? a : b)
        expect(bottom.y).toBeCloseTo(.34, 6)
        const hit = new THREE.Raycaster(bottom.clone().add(new THREE.Vector3(0, .05, 0)), new THREE.Vector3(0, -1, 0)).intersectObject(stone)[0]
        expect(hit, side).toBeDefined()
        expect(hit!.point.y).toBeCloseTo(bottom.y, 6)
      }
    }
    model.dispose()
  })

  it('separates both complete halves continuously from contact and leaves at least .04 final clearance', () => {
    const model = createCoconutOfferingModel()
    const left = model.root.getObjectByName('coconut-half-left')!, right = model.root.getObjectByName('coconut-half-right')!
    let previousLeft = new THREE.Vector3(), previousRight = new THREE.Vector3()
    for (let i = 0; i <= 120; i++) {
      model.pose(2, .42 + .58 * i / 120)
      const leftBounds = visibleBounds(left), rightBounds = visibleBounds(right)
      const clearance = rightBounds.min.x - leftBounds.max.x
      expect(clearance, `crack frame ${i}`).toBeGreaterThanOrEqual(-1e-7)
      if (i > 0) {
        expect(clearance).toBeGreaterThan(0)
        expect(left.position.distanceTo(previousLeft)).toBeLessThan(.02)
        expect(right.position.distanceTo(previousRight)).toBeLessThan(.02)
      } else expect(clearance).toBeCloseTo(0, 7)
      previousLeft.copy(left.position); previousRight.copy(right.position)
      if (i === 120) expect(clearance).toBeGreaterThanOrEqual(.04)
    }
    // The middle of the spilled water must remain visible between the separated shells.
    const water = model.root.getObjectByName('coconut-water-spill')!
    const ray = new THREE.Raycaster(new THREE.Vector3(.65, 2, .4), new THREE.Vector3(0, -1, 0))
    expect(ray.intersectObject(left, true)).toHaveLength(0)
    expect(ray.intersectObject(right, true)).toHaveLength(0)
    expect(ray.intersectObject(water)[0]).toBeDefined()
    model.dispose()
  })

  it('places all final contact vertices inside the actual stone top polygon', () => {
    const model = createCoconutOfferingModel()
    model.pose(3, 0)
    const stone = model.root.getObjectByName('coconut-striking-stone') as THREE.Mesh
    const topPolygon = visibleVertices(stone).filter(v => Math.abs(v.y - .34) < 1e-6 && Math.hypot(v.x - .65, v.z - .4) > .1)
      .sort((a, b) => Math.atan2(a.z - .4, a.x - .65) - Math.atan2(b.z - .4, b.x - .65))
    expect(topPolygon).toHaveLength(64)
    for (const side of ['left', 'right']) {
      const contact = visibleVertices(model.root.getObjectByName(`coconut-half-${side}`)!).filter(v => Math.abs(v.y - .34) < .0001)
      expect(contact.length).toBeGreaterThan(0)
      for (const point of contact) {
        const crosses = topPolygon.map((a, i) => {
          const b = topPolygon[(i + 1) % topPolygon.length]!
          return (b.x - a.x) * (point.z - a.z) - (b.z - a.z) * (point.x - a.x)
        })
        expect(crosses.every(value => value >= -1e-7) || crosses.every(value => value <= 1e-7), side).toBe(true)
      }
    }
    model.dispose()
  })

  it('uses two indexed closed positive shell volumes with real inner surfaces and annular flesh rims', () => {
    const model = createCoconutOfferingModel()
    for (const [halfIndex, mesh] of shellHalves(model.root).entries()) {
      const geometry = mesh.geometry, positions = geometry.getAttribute('position'), indices = geometry.index!
      expect(indices).not.toBeNull()
      const edges = new Map<string, { count: number, balance: number }>()
      let volume = 0, minimumArea = Infinity
      for (let i = 0; i < indices.count; i += 3) {
        const ids = [indices.getX(i), indices.getX(i + 1), indices.getX(i + 2)]
        const [a, b, c] = ids.map(index => new THREE.Vector3().fromBufferAttribute(positions, index)) as [THREE.Vector3, THREE.Vector3, THREE.Vector3]
        volume += a.dot(b.clone().cross(c)) / 6
        minimumArea = Math.min(minimumArea, b.clone().sub(a).cross(c.clone().sub(a)).length())
        for (let e = 0; e < 3; e++) {
          const from = ids[e]!, to = ids[(e + 1) % 3]!, key = [from, to].sort((a, b) => a - b).join(':')
          const edge = edges.get(key) ?? { count: 0, balance: 0 }
          edge.count++; edge.balance += from < to ? 1 : -1; edges.set(key, edge)
        }
      }
      expect(volume, mesh.name).toBeGreaterThan(.07)
      expect(minimumArea, mesh.name).toBeGreaterThan(1e-8)
      expect([...edges.values()].every(edge => edge.count === 2 && edge.balance === 0), mesh.name).toBe(true)
      expect(geometry.groups.some(group => group.materialIndex === 0)).toBe(true)
      expect(geometry.groups.some(group => group.materialIndex === 1)).toBe(true)
      const sign = halfIndex === 0 ? -1 : 1
      // A ray enters the opening, travels through empty space, then meets white concave flesh.
      const ray = new THREE.Raycaster(new THREE.Vector3(-sign * .8, 0, 0), new THREE.Vector3(sign, 0, 0))
      mesh.updateMatrixWorld(true)
      const localOrigin = ray.ray.origin.clone(), localDirection = ray.ray.direction.clone()
      ray.set(mesh.localToWorld(localOrigin), localDirection.transformDirection(mesh.matrixWorld))
      const cavity = ray.intersectObject(mesh)[0]!
      const localHit = mesh.worldToLocal(cavity.point.clone())
      expect(sign * localHit.x).toBeGreaterThan(.33)
      expect(sign * localHit.x).toBeLessThan(.39)
      expect(cavity.face!.materialIndex).toBe(1)
      const rimOrigin = mesh.localToWorld(new THREE.Vector3(-sign * .8, .45, 0))
      ray.set(rimOrigin, new THREE.Vector3(sign, 0, 0).transformDirection(mesh.matrixWorld))
      const rim = ray.intersectObject(mesh)[0]!
      expect(mesh.worldToLocal(rim.point.clone()).x).toBeCloseTo(0, 7)
      expect(rim.face!.materialIndex).toBe(1)
    }
    model.dispose()
  })

  it('changes from the whole shell to matching outer halves at contact without a smaller replacement', () => {
    const model = createCoconutOfferingModel()
    model.pose(2, .42)
    const whole = model.root.getObjectByName('coconut-shell') as THREE.Mesh
    const halves = shellHalves(model.root)
    const key = (v: THREE.Vector3) => v.toArray().map(value => Math.round(value * 1e5)).join(',')
    const halfPoints = new Set(halves.flatMap(mesh => {
      const p = mesh.geometry.getAttribute('position')
      return Array.from({ length: p.count }, (_, i) => key(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld)))
    }))
    const p = whole.geometry.getAttribute('position')
    for (let i = 0; i < p.count; i++) expect(halfPoints.has(key(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(whole.matrixWorld)))).toBe(true)
    model.pose(3, 0)
    for (const side of ['left', 'right']) {
      const half = model.root.getObjectByName(`coconut-half-${side}`)!
      const inward = new THREE.Vector3(side === 'left' ? 1 : -1, 0, 0).applyQuaternion(half.quaternion)
      expect(inward.y).toBeGreaterThan(.75)
      expect(inward.z).toBeGreaterThan(.45)
    }
    model.dispose()
  })

  it('preserves exact phase checkpoints and preallocated geometry through reversible scrubbing', () => {
    const model = createCoconutOfferingModel(), meshes = allMeshes(model.root)
    const buffers = meshes.map(mesh => ({ geometry: mesh.geometry, position: mesh.geometry.getAttribute('position'), index: mesh.geometry.index }))
    for (let step = 0; step < 3; step++) {
      model.pose(step, 1)
      const complete = snapshot(model.root)
      model.pose(0, .37)
      model.pose(step + 1, 0)
      expect(snapshot(model.root)).toEqual(complete)
    }
    for (const step of [0, 1, 2, 3]) for (const t of [0, .13, .5, .83, 1]) {
      model.pose(step, t)
      meshes.forEach((mesh, i) => {
        expect(mesh.geometry).toBe(buffers[i]!.geometry)
        expect(mesh.geometry.getAttribute('position')).toBe(buffers[i]!.position)
        expect(mesh.geometry.index).toBe(buffers[i]!.index)
      })
    }
    model.dispose()
  })

  it('keeps every visible pose and hidden buffer within the scene frame without nonfinite transforms', () => {
    const model = createCoconutOfferingModel()
    for (const step of [0, 1, 2, 3]) for (let i = 0; i <= 30; i++) {
      model.pose(step, i / 30)
      const bounds = new THREE.Box3().setFromObject(model.root, true)
      expect(bounds.min.x).toBeGreaterThan(-1.6)
      expect(bounds.max.x).toBeLessThan(1.9)
      expect(bounds.min.y).toBeGreaterThanOrEqual(0)
      expect(bounds.max.y).toBeLessThan(2.25)
      expect(bounds.min.z).toBeGreaterThan(-1.25)
      expect(bounds.max.z).toBeLessThan(1.25)
      model.root.traverse(object => expect(object.matrixWorld.elements.every(Number.isFinite)).toBe(true))
    }
    model.pose(0, Number.NaN)
    const start = snapshot(model.root)
    model.pose(0, -1)
    expect(snapshot(model.root)).toEqual(start)
    model.pose(2, Infinity)
    expect(model.actor.position.toArray().every(Number.isFinite)).toBe(true)
    model.dispose()
  })

  it('anchors all three gestures to the visible front of the fruit and includes fibers, three eyes and a small spill', () => {
    const model = createCoconutOfferingModel()
    expect(model.root.name).toBe('coconut-subject')
    expect(model.actor.name).toBe('coconut-carrier')
    expect(model.targets).toEqual([model.actor, model.actor, model.actor])
    expect(model.roots).toEqual(model.targets)
    expect(model.anchors).toEqual([[0, 0, .43], [0, 0, .43], [0, 0, .43]])
    const shell = model.root.getObjectByName('coconut-shell')!
    for (const step of [0, 1, 2]) {
      model.pose(step, 0)
      const anchor = model.actor.localToWorld(new THREE.Vector3(...model.anchors[step]!))
      const hit = new THREE.Raycaster(anchor.clone().add(new THREE.Vector3(0, 0, .5)), new THREE.Vector3(0, 0, -1)).intersectObject(shell)[0]!
      expect(hit.point.distanceTo(anchor)).toBeLessThan(.005)
    }
    const whole = model.root.getObjectByName('coconut-whole')!
    expect(whole.children.filter(object => object.name.startsWith('coconut-fiber-')).length).toBeGreaterThan(24)
    expect(whole.children.filter(object => object.name.startsWith('coconut-eye-'))).toHaveLength(3)
    const water = model.root.getObjectByName('coconut-water-spill') as THREE.Mesh
    expect(water.visible).toBe(false)
    model.pose(3, 0)
    expect(water.visible).toBe(true)
    const waterBounds = visibleBounds(water)
    expect(waterBounds.max.x - waterBounds.min.x).toBeLessThan(1)
    expect(waterBounds.min.y).toBeGreaterThanOrEqual(.339)
    model.dispose()
  })

  it('gives every object a unique name so restore and host hit lookup select the same physical part', () => {
    const model = createCoconutOfferingModel(), names: string[] = []
    model.root.traverse(object => names.push(object.name))
    expect(new Set(names).size).toBe(names.length)
    model.dispose()
  })

  it('disposes each shared geometry and material once even when called twice', () => {
    const model = createCoconutOfferingModel()
    const resources = new Set<THREE.BufferGeometry | THREE.Material>()
    for (const mesh of allMeshes(model.root)) {
      resources.add(mesh.geometry)
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) resources.add(material)
    }
    const disposed = new Map<object, number>()
    for (const resource of resources) resource.addEventListener('dispose', () => disposed.set(resource, (disposed.get(resource) ?? 0) + 1))
    model.dispose(); model.dispose()
    expect(resources.size).toBeGreaterThan(10)
    for (const resource of resources) expect(disposed.get(resource)).toBe(1)
  })
})
