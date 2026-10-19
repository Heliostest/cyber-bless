import {describe,it,expect} from 'vitest'
import * as THREE from 'three'
import {createSetsubunModel} from './model'
import {disposeTree} from '../procedural-kit'

describe('Setsubun objects and destinations',()=>{
 it('starts all six roasted beans supported inside the hollow masu',()=>{
  const m=createSetsubunModel()
  for(const batch of m.bodies)for(const b of batch){const bounds=new THREE.Box3().setFromObject(b);expect(bounds.min.y).toBeCloseTo(.135,6);expect(bounds.min.x).toBeGreaterThan(-.99);expect(bounds.max.x).toBeLessThan(-.25);expect(bounds.min.z).toBeGreaterThan(.23);expect(bounds.max.z).toBeLessThan(.87)}
  disposeTree(m.root)
 })
 it('leaves the first handful outdoors and the second indoors without moving the wooden masu',()=>{
  const m=createSetsubunModel(),cup=m.root.getObjectByName('beans-masu')!.matrixWorld.clone();m.pose(3,0)
  m.bodies.forEach((batch,i)=>batch.forEach(b=>{const bounds=new THREE.Box3().setFromObject(b);expect(bounds.min.y).toBeCloseTo(i===0?.035:.095,6);if(i===0)expect(bounds.max.z).toBeLessThan(-.9);else expect(bounds.min.z).toBeGreaterThan(1.1)}))
  expect(m.root.getObjectByName('beans-masu')!.matrixWorld.elements).toEqual(cup.elements);disposeTree(m.root)
 })
 it('keeps the sliding panel on its two tracks and returns exact geometry at every checkpoint',()=>{
  const m=createSetsubunModel()
  for(let i=0;i<=100;i++){m.pose(0,i/100);const b=new THREE.Box3().setFromObject(m.roots[0]!);expect(b.min.y).toBeCloseTo(.145,6);expect(b.max.y).toBeCloseTo(2.245,6)}
  const snapshot=()=>{const a:unknown[]=[];m.root.traverse(o=>a.push([o.name,[...o.matrixWorld.elements],o.visible]));return a}
  for(let step=0;step<3;step++){m.pose(step,1);const last=snapshot();m.pose(step+1,0);expect(snapshot()).toEqual(last)}
  disposeTree(m.root)
 })
})
