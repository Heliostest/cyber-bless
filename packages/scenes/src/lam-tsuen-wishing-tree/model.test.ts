import {describe,it,expect} from 'vitest'
import * as THREE from 'three'
import {createLamTsuenModel} from './model'
import {disposeTree} from '../procedural-kit'
describe('Lam Tsuen material relationships',()=>{
 it('places paper and plastic orange on paving before throwing, with both ends of the cord attached',()=>{
  const m=createLamTsuenModel();m.pose(2,0)
  for(const name of ['lamtsuen-paper','lamtsuen-orange']){const box=new THREE.Box3().setFromObject(m.root.getObjectByName(name)!);expect(box.min.y).toBeCloseTo(.035,6)}
  for(let i=0;i<=100;i++){m.pose(2,i/100);expect(m.points[0]!.distanceTo(m.roots[0]!.localToWorld(new THREE.Vector3(0,.425,.014)))).toBeLessThan(1e-8);expect(m.points[32]!.distanceTo(m.roots[1]!.localToWorld(new THREE.Vector3(0,.30,0)))).toBeLessThan(1e-8)}
  disposeTree(m.root)
 })
 it('keeps the orange clear of the branch through its full throw',()=>{
  const m=createLamTsuenModel();let gap=Infinity
  for(let i=0;i<=1000;i++){m.pose(2,i/1000);const p=m.roots[1]!.position;gap=Math.min(gap,Math.hypot(p.y-1.55,p.z+.10)-.21-.07)}
  expect(gap).toBeGreaterThan(0);disposeTree(m.root)
 })
 it('writes only during writing and binds before throwing, then restores exact visible details',()=>{
  const m=createLamTsuenModel(),visible=(prefix:string)=>{let n=0;m.root.traverseVisible(o=>{if(o.name.startsWith(prefix)&&o.name!=='lamtsuen-cord-saddle')n++});return n}
  expect(visible('lamtsuen-ink')).toBe(0);expect(visible('lamtsuen-cord')).toBe(0)
  m.pose(0,.5);expect(visible('lamtsuen-ink')).toBe(7);m.pose(1,0);expect(visible('lamtsuen-ink')).toBe(14)
  m.pose(1,.5);expect(visible('lamtsuen-cord')).toBe(16);m.pose(1,0);expect(visible('lamtsuen-cord')).toBe(0)
  m.pose(3,0);expect(visible('lamtsuen-cord')).toBe(32);expect(m.roots[0]!.position.y).toBe(.675);disposeTree(m.root)
 })
})
