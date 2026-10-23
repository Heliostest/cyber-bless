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
 it('builds closed positive-volume meshes with nondegenerate finite triangles',()=>{
  const m=createAlasitaModel();let count=0
  m.root.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;count++;const p=mesh.geometry.getAttribute('position'),edges=new Map<string,{count:number;balance:number}>();let volume=0
   const key=(v:THREE.Vector3)=>v.toArray().map(n=>Math.round(n*1e5)).join(',')
   for(let i=0;i<p.count;i+=3){const v=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,i+k));expect(v.every(p=>p.toArray().every(Number.isFinite)),mesh.name).toBe(true);expect(new THREE.Triangle(...v as [THREE.Vector3,THREE.Vector3,THREE.Vector3]).getArea(),mesh.name).toBeGreaterThan(1e-12);volume+=v[0]!.dot(v[1]!.clone().cross(v[2]!))/6
    for(let k=0;k<3;k++){const a=key(v[k]!),b=key(v[(k+1)%3]!),name=[a,b].sort().join('|'),e=edges.get(name)??{count:0,balance:0};e.count++;e.balance+=a<b?1:-1;edges.set(name,e)}
   }
   expect(volume,mesh.name).toBeGreaterThan(0);expect([...edges.values()].every(e=>e.count===2&&e.balance===0),mesh.name).toBe(true)
  });expect(count).toBeGreaterThan(40);disposeTree(m.root)
 })
 it('reuses all geometry buffers throughout the three paths',()=>{
  const m=createAlasitaModel(),buffers=new Map<THREE.Mesh,unknown>();m.root.traverse(o=>{const mesh=o as THREE.Mesh;if(mesh.isMesh)buffers.set(mesh,mesh.geometry.getAttribute('position').array)})
  for(let step=0;step<3;step++)for(let i=0;i<=100;i++){m.pose(step,i/100);for(const [mesh,array]of buffers)expect(mesh.geometry.getAttribute('position').array).toBe(array)}
  disposeTree(m.root)
 })
})
