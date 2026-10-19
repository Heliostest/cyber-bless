import {describe,it,expect} from 'vitest'
import * as THREE from 'three'
import {createOvooModel} from './model'
import {disposeTree} from '../procedural-kit'
describe('Ovoo physical path',()=>{
 it('makes exactly one clockwise orbit per step without entering the cairn',()=>{
  const m=createOvooModel()
  for(let step=0;step<3;step++){
   let total=0,last=m.angle0
   for(let i=0;i<=1000;i++){m.pose(step,.15+.63*i/1000);const p=m.visitor.position,theta=Math.atan2(p.x,p.z);let d=theta-last;while(d>Math.PI)d-=Math.PI*2;while(d< -Math.PI)d+=Math.PI*2;expect(d).toBeLessThanOrEqual(1e-8);total+=d;last=theta;expect(Math.hypot(p.x,p.z)).toBeCloseTo(m.radius,8)}
   expect(total).toBeCloseTo(-Math.PI*2,8)
  }disposeTree(m.root)
 })
 it('keeps every checkpoint continuous including hand, legs, torso and all three stones',()=>{
  const m=createOvooModel()
  for(let step=0;step<3;step++){
   m.pose(step,1);const end=new Map<string,number[]>();m.root.traverse(o=>end.set(o.name,[...o.matrixWorld.elements]))
   m.pose(step+1,0);m.root.traverse(o=>o.matrixWorld.elements.forEach((v,i)=>expect(v,o.name).toBeCloseTo(end.get(o.name)![i]!,7)))
  }disposeTree(m.root)
 })
 it('starts with grounded stones and moves only the current offering',()=>{
  const m=createOvooModel()
  for(let step=0;step<3;step++)for(const t of[0,.1,.3,.6,.9,1]){m.pose(step,t);for(let i=0;i<3;i++)if(i!==step)expect(m.stones[i]!.position.distanceTo(i<step?m.land[i]!:m.initial[i]!)).toBeLessThan(1e-9)}
  for(const p of m.initial)expect(p.y-.1).toBe(0);disposeTree(m.root)
 })
 it('holds the moving stone against the palm until its release and keeps the hand above ground',()=>{
  const m=createOvooModel(),hand=m.root.getObjectByName('ovoo-hand-1')!
  for(let s=0;s<3;s++)for(let i=0;i<780;i++){m.pose(s,i/1000);expect(hand.position.y-.045).toBeGreaterThanOrEqual(-1e-8);expect(hand.position.distanceTo(m.stones[s]!.position)).toBeLessThan(.1)}disposeTree(m.root)
 })
 it('uses finite closed solid geometry and a sash that contacts the pole',()=>{
  const m=createOvooModel();m.root.traverse(o=>{const g=(o as THREE.Mesh).geometry;if(g){expect(g.index?.count).toBeGreaterThan(0);for(const v of g.getAttribute('position').array)expect(Number.isFinite(v)).toBe(true)}})
  const sash=m.root.getObjectByName('ovoo-sash') as THREE.Mesh<THREE.TorusGeometry>;expect(sash.geometry.parameters.radius-sash.geometry.parameters.tube).toBeLessThanOrEqual(.022);disposeTree(m.root)
 })
})
