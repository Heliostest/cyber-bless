import {describe,expect,it} from 'vitest'
import * as THREE from 'three'
import {createCanangModel} from './model'
import {disposeTree} from '../procedural-kit'

describe('Canang sari material and offering path',()=>{
 it('keeps the complete documented food, porosan, round flower mat and four flower groups',()=>{
  const m=createCanangModel();m.pose(3,0)
  for(const name of ['canang-ceper-floor','canang-porosan','canang-sugarcane','canang-banana','canang-cake','canang-sampiyan','canang-white-flower','canang-red-flower','canang-yellow-flower','canang-blue-flower','canang-pandan'])expect(m.root.getObjectByName(name),name).toBeDefined()
  const world=(name:string)=>m.root.getObjectByName(name)!.getWorldPosition(new THREE.Vector3())
  expect(world('canang-white-flower').x).toBeGreaterThan(world('canang-yellow-flower').x)
  expect(world('canang-red-flower').z).toBeGreaterThan(world('canang-blue-flower').z)
  disposeTree(m.root)
 })
 it('takes the tray from paving to the shrine top without moving its contents after filling',()=>{
  const m=createCanangModel();m.pose(0,0);const initial=m.tray.position.clone();m.pose(1,0);const flower=m.flower.position.clone()
  for(const stage of [1,2])for(let i=0;i<=100;i++){m.pose(stage,i/100);expect(m.flower.position.distanceTo(flower)).toBeLessThan(1e-9);expect(m.tray.position.y).toBeGreaterThanOrEqual(initial.y)}
  expect(m.tray.position.x).toBeLessThan(initial.x);expect(m.tray.position.y).toBeCloseTo(.9);expect(m.tray.position.z).toBeLessThan(initial.z)
  disposeTree(m.root)
 })
 it('settles continuously and restores every checkpoint without residual motion',()=>{
  const m=createCanangModel();const matrices=()=>{m.root.updateMatrixWorld(true);const result:number[][]=[];m.root.traverse(o=>result.push([...o.matrixWorld.elements]));return result}
  for(const stage of[0,1,2]){m.pose(stage,1);const before=matrices();m.pose(stage+1,0);expect(matrices()).toEqual(before);m.pose(stage,.37);m.pose(stage+1,0);expect(matrices()).toEqual(before)}
  disposeTree(m.root)
 })
 it('rests the central pandan on the real woven flower mat',()=>{
  const m=createCanangModel();m.pose(3,0)
  const pandanBounds=new THREE.Box3().setFromObject(m.root.getObjectByName('canang-pandan')!)
  const matBounds=new THREE.Box3().setFromObject(m.root.getObjectByName('canang-sampiyan-weave-0')!)
  expect(Math.abs(pandanBounds.min.y-matBounds.max.y)).toBeLessThan(1e-6)
  disposeTree(m.root)
 })
 it('uses finite, volumetric meshes with no collapsed triangles in all resting poses',()=>{
  const m=createCanangModel();m.root.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;const p=mesh.geometry.attributes.position!,indices=mesh.geometry.index;expect([...p.array].every(Number.isFinite),mesh.name).toBe(true);const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();for(let i=0;i<(indices?.count??p.count);i+=3){a.fromBufferAttribute(p,indices?indices.getX(i):i);b.fromBufferAttribute(p,indices?indices.getX(i+1):i+1);c.fromBufferAttribute(p,indices?indices.getX(i+2):i+2);expect(b.sub(a).cross(c.sub(a)).lengthSq(),mesh.name).toBeGreaterThan(1e-18)}});disposeTree(m.root)
 })
})
