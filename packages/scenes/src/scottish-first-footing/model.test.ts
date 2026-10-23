import {describe,it,expect} from 'vitest'
import * as THREE from 'three'
import type {createFirstFootingModel} from './model'
import {disposeTree} from '../procedural-kit'

// The empty glob makes the initial missing implementation fail as an assertion.
const modules=import.meta.glob<{createFirstFootingModel:typeof createFirstFootingModel}>('./model.ts',{eager:true})
function build(){const factory=modules['./model.ts']?.createFirstFootingModel;expect(factory,'the coal-gift scene model exists').toBeTypeOf('function');return factory!()}
const points=(mesh:THREE.Mesh)=>{const attr=mesh.geometry.getAttribute('position'),result:THREE.Vector3[]=[];for(let i=0;i<attr.count;i++)result.push(mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(attr,i)));return result}

describe('first-footing coal gift through an open threshold',()=>{
 it('has one tangible coal gift, a real open doorway, a cold step and an open receiving hearth',()=>{
  const m=build();expect(m.coal.isMesh).toBe(true)
  expect(m.targets).toEqual([m.coal,m.coal,m.coal]);expect(m.roots).toEqual(m.targets)
  for(const name of['door-post-left','door-post-right','door-lintel','stone-threshold','outside-step','inside-floor','hearth-floor','hearth-back','hearth-left','hearth-right'])expect(m.root.getObjectByName(name),name).toBeDefined()
  const ray=new THREE.Raycaster(new THREE.Vector3(.36,1.05,1.4),new THREE.Vector3(0,0,-1));expect(ray.intersectObjects(m.solids,false).some(h=>h.distance<1.5)).toBe(false)
  const fireRay=new THREE.Raycaster(new THREE.Vector3(-.75,.4,-.1),new THREE.Vector3(0,0,-1));expect(fireRay.intersectObjects(m.solids,false)[0]?.object.name).toBe('hearth-back');disposeTree(m.root)
 })
 it('moves the real coal from outside to inside before it enters the household fire',()=>{
  const m=build(),p=new THREE.Vector3();m.coal.getWorldPosition(p);expect(p.z).toBeGreaterThan(.5)
  m.pose(0,1);m.coal.getWorldPosition(p);expect(p.y).toBeGreaterThan(.8);expect(p.z).toBeGreaterThan(.5)
  m.pose(1,1);m.coal.getWorldPosition(p);expect(p.z).toBeLessThan(.1)
  m.pose(2,1);m.coal.getWorldPosition(p);expect(p.x).toBeLessThan(-.5);expect(p.z).toBeLessThan(-.5)
  const bottom=Math.min(...points(m.coal).map(v=>v.y));expect(bottom).toBeCloseTo(.12,5);disposeTree(m.root)
 })
 it('keeps every actual coal vertex out of all structural solids throughout all303poses',()=>{
  const m=build(),bounds=m.solids.map(mesh=>{mesh.geometry.computeBoundingBox();return mesh.geometry.boundingBox!.clone()}),inverses=m.solids.map(mesh=>mesh.matrixWorld.clone().invert())
  for(let step=0;step<3;step++)for(let n=0;n<=100;n++){
   m.pose(step,n/100)
   for(const p of points(m.coal)){
    if(p.y<-.00001)throw Error('coal below floor at '+[step,n])
    for(let i=0;i<m.solids.length;i++){const local=p.clone().applyMatrix4(inverses[i]!);const box=bounds[i]!.clone().expandByScalar(-1e-5);if(box.containsPoint(local))throw Error('coal in '+m.solids[i]!.name+' at '+[step,n,...local.toArray()])}
   }
  }
  disposeTree(m.root)
 })
 it('preserves exact pose boundaries, all geometry allocations and a quiet fixed final state',()=>{
  const m=build(),snapshot=()=>points(m.coal).map(p=>p.toArray()),allocated=new Map<THREE.Mesh,THREE.BufferGeometry>();m.root.traverse(o=>{const mesh=o as THREE.Mesh;if(mesh.geometry)allocated.set(mesh,mesh.geometry)})
  for(let step=0;step<3;step++){m.pose(step,1);const previous=snapshot();m.pose(step+1,0);expect(snapshot()).toEqual(previous)}
  const final=snapshot();m.pose(3,1);expect(snapshot()).toEqual(final)
  for(let step=0;step<3;step++)for(const n of[0,.1,.5,.9,1]){m.pose(step,n);for(const[mesh,geometry]of allocated)expect(mesh.geometry).toBe(geometry)}
  disposeTree(m.root)
 })
 it('grounds all permanent structures and releases every unique geometry/material',()=>{
  const m=build(),geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();m.root.traverse(o=>{const mesh=o as THREE.Mesh;if(mesh.geometry)geometries.add(mesh.geometry);if(mesh.material)for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material])materials.add(mat)})
  let released=0;for(const g of geometries)g.addEventListener('dispose',()=>released++);for(const mat of materials)mat.addEventListener('dispose',()=>released++)
  for(const name of['outside-step','inside-floor'])expect(new THREE.Box3().setFromObject(m.root.getObjectByName(name)!,true).max.y).toBeCloseTo(0,5)
  disposeTree(m.root);expect(released).toBe(geometries.size+materials.size)
 })
})
