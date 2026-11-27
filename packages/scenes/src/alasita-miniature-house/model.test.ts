import {describe,it,expect} from 'vitest'
import * as THREE from 'three'
import {createAlasitaModel} from './model'
import {disposeTree} from '../procedural-kit'

describe('miniature wish house and real support surfaces',()=>{
 it('joins every checkpoint continuously and keeps names unambiguous',()=>{
  const m=createAlasitaModel(),names:string[]=[];m.root.traverse(o=>names.push(o.name));expect(new Set(names).size).toBe(names.length)
  for(let step=0;step<3;step++){
   m.pose(step,1);const ends=new Map<string,number[]>();m.root.traverse(o=>ends.set(o.name,[...o.matrixWorld.elements]))
   m.pose(step+1,0);m.root.traverse(o=>o.matrixWorld.elements.forEach((v,i)=>expect(v,o.name).toBeCloseTo(ends.get(o.name)![i]!,8)))
  }disposeTree(m.root)
 })
 it('rests on the stall initially and places the entire base onto the front pad finally',()=>{
  const m=createAlasitaModel();m.pose(0,0)
  expect(new THREE.Box3().setFromObject(m.base,true).min.y).toBeCloseTo(new THREE.Box3().setFromObject(m.benchTop,true).max.y,7)
  m.pose(3,0);const base=new THREE.Box3().setFromObject(m.base,true),pad=new THREE.Box3().setFromObject(m.pad,true)
  expect(base.min.y).toBeCloseTo(pad.max.y,7)
  for(const axis of ['x','z'] as const){expect(base.min[axis]).toBeGreaterThan(pad.min[axis]);expect(base.max[axis]).toBeLessThan(pad.max[axis])}
  expect(m.house.rotation.y).toBeCloseTo(Math.PI/3,8);disposeTree(m.root)
 })
 it('lifts clear before translating and moves beyond the stall before lowering, across 603 poses',()=>{
  const m=createAlasitaModel(),bench=new THREE.Box3().setFromObject(m.benchTop,true),pad=new THREE.Box3().setFromObject(m.pad,true)
  for(let step=0;step<3;step++)for(let i=0;i<=200;i++){
   m.pose(step,i/200);const house=new THREE.Box3().setFromObject(m.house,true)
   expect(house.min.y).toBeGreaterThanOrEqual(-1e-7)
   if(house.min.y<bench.max.y-1e-7)expect(house.min.z).toBeGreaterThan(bench.max.z)
   if(house.min.y<pad.max.y-1e-7)throw Error('house entered the pad')
  }disposeTree(m.root)
 })
 it('reuses all geometry buffers throughout the three paths',()=>{
  const m=createAlasitaModel(),buffers=new Map<THREE.Mesh,unknown>();m.root.traverse(o=>{const mesh=o as THREE.Mesh;if(mesh.isMesh)buffers.set(mesh,mesh.geometry.getAttribute('position').array)})
  for(let step=0;step<3;step++)for(let i=0;i<=100;i++){m.pose(step,i/100);for(const [mesh,array]of buffers)expect(mesh.geometry.getAttribute('position').array).toBe(array)}
  disposeTree(m.root)
 })
})
