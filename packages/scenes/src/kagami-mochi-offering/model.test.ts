import {describe,it,expect} from 'vitest'
import * as THREE from 'three'
import {createKagamiModel} from './model'
describe('Kagami offering physical assembly',()=>{
 it('rests three prepared foods on paper, then supports each stacked layer without floating',()=>{
  const m=createKagamiModel(),box=(name:string)=>new THREE.Box3().setFromObject(m.root.getObjectByName(name)!)
  for(const name of ['kagami-large','kagami-small','kagami-orange'])expect(box(name).min.y).toBeCloseTo(.016,6)
  m.pose(3,0)
  expect(box('kagami-large').min.y).toBeCloseTo(.016,6)
  expect(box('kagami-small').min.y).toBeCloseTo(box('kagami-large').max.y,6)
  expect(box('kagami-orange').min.y).toBeCloseTo(box('kagami-small').max.y,6)
 })
 it('moves only the current ingredient and keeps settled checkpoints continuous',()=>{
  const m=createKagamiModel()
  for(let step=0;step<3;step++){
   m.pose(step,0);const before=m.roots.map(o=>o.position.clone())
   m.pose(step,.5);m.roots.forEach((o,i)=>{if(i!==step)expect(o.position.distanceTo(before[i]!)).toBe(0);else expect(o.position.distanceTo(before[i]!)).toBeGreaterThan(.2)})
   m.pose(step,1);const settled=m.roots.map(o=>o.position.clone());m.pose(step+1,0)
   m.roots.forEach((o,i)=>expect(o.position.distanceTo(settled[i]!)).toBeLessThan(1e-8))
  }
 })
 it('lifts clear of other food before translation and never passes below the paper',()=>{
  const m=createKagamiModel()
  for(let step=0;step<3;step++)for(let i=0;i<=300;i++){
   m.pose(step,i/300)
   const boxes=m.targets.map(o=>new THREE.Box3().setFromObject(o))
   for(const b of boxes)expect(b.min.y).toBeGreaterThanOrEqual(.015999)
   for(let a=0;a<3;a++)for(let b=a+1;b<3;b++){
    const intersection=boxes[a]!.clone().intersect(boxes[b]!),size=intersection.getSize(new THREE.Vector3())
    expect(Math.min(size.x,size.y,size.z)).toBeLessThan(1e-6)
   }
  }
 })
})
