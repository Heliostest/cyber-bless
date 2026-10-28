import { expect, it } from 'vitest'
import * as THREE from 'three'
import { createBaciModel } from './lao-baci-wrist/model'
import { createKhataModel } from './tibetan-khata-greeting/model'

const materialOf = (root: THREE.Object3D, name: string) => (root.getObjectByName(name) as THREE.Mesh).material as THREE.Material
function dispose(root: THREE.Object3D) {
  const materials = new Set<THREE.Material>()
  root.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => materials.add(m)) } })
  materials.forEach(m => m.dispose())
}

it('restricts skin backlighting to the hand rather than the thick forearm or cotton', () => {
  const model = createBaciModel()
  expect(materialOf(model.root, 'baci-forearm').userData.ritualOptics).toBeUndefined()
  expect(materialOf(model.root, 'baci-palm').userData.ritualOptics.kind).toBe('skin')
  expect(materialOf(model.root, 'baci-finger-0').userData.ritualOptics.kind).toBe('skin')
  expect(materialOf(model.root, 'baci-cotton-strand').userData.ritualOptics).toBeUndefined()
  dispose(model.root)
})

it('restricts silk scattering to free edges and fringes while the central folded faces stay opaque', () => {
  const model = createKhataModel(), cloth = model.cloth
  expect(Array.isArray(cloth.material)).toBe(true)
  const materials = cloth.material as THREE.Material[]
  expect(materials[0].userData.ritualOptics).toBeUndefined()
  expect(materials[1].userData.ritualOptics.kind).toBe('cloth')
  expect(materials[1].userData.ritualOptics.fiber).toBe(false)
  expect(cloth.geometry.groups).toHaveLength(2)
  const edges = cloth.geometry.groups.find(g => g.materialIndex === 1)!, index = cloth.geometry.index!, positions = cloth.geometry.getAttribute('position')
  for (let i = edges.start; i < edges.start + edges.count; i++) expect(positions.getX(index.getX(i))).toBeCloseTo(.095, 5)
  expect(materialOf(model.root, 'khata-fringe--1-0').userData.ritualOptics.kind).toBe('cloth')
  dispose(model.root)
})
