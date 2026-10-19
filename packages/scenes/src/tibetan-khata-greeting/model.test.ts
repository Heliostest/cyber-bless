import {describe,it,expect} from 'vitest'
import * as THREE from 'three'
import {createKhataModel} from './model'
import {disposeTree} from '../procedural-kit'
describe('Khata supported transfer',()=>{
 it('has continuous checkpoints for both people, scarf and fringe',()=>{
  const m=createKhataModel();for(let n=0;n<3;n++){m.pose(n,1);const end=new Map<string,number[]>();m.root.traverse(o=>end.set(o.name,[...o.matrixWorld.elements]));m.pose(n+1,0);m.root.traverse(o=>o.matrixWorld.elements.forEach((v,i)=>expect(v,o.name).toBeCloseTo(end.get(o.name)![i]!,8)))}disposeTree(m.root)
 })
 it('keeps every scarf vertex above the ground through all three steps',()=>{
  const m=createKhataModel(),p=new THREE.Vector3();let minY=Infinity;for(let n=0;n<3;n++)for(let i=0;i<=100;i++){m.pose(n,i/100);m.scarf.traverse(o=>{const a=(o as THREE.Mesh).geometry?.getAttribute('position');if(a)for(let j=0;j<a.count;j++)minY=Math.min(minY,p.fromBufferAttribute(a,j).applyMatrix4(o.matrixWorld).y)})}expect(minY).toBeGreaterThan(.35);disposeTree(m.root)
 })
 it('preserves a folded connected cross-section and finite solid meshes',()=>{
  const m=createKhataModel();let count=0;m.root.traverse(o=>{const g=(o as THREE.Mesh).geometry;if(!g)return;count++;expect(g.index?.count).toBeGreaterThan(0);for(const v of g.getAttribute('position').array)expect(Number.isFinite(v)).toBe(true)});expect(count).toBe(54);expect(m.cloth.geometry.getAttribute('position').count).toBe(3222);disposeTree(m.root)
 })
 it('lifts, presents and hands the same cloth to the guest without changing its shape',()=>{
  const m=createKhataModel(),initial=Array.from(m.cloth.geometry.getAttribute('position').array);m.pose(1,0);expect(m.scarf.position.y).toBeCloseTo(1.16);m.pose(2,0);expect(m.scarf.position.x).toBeCloseTo(0);m.pose(3,0);expect(m.scarf.position.x).toBeCloseTo(.35);expect(Array.from(m.cloth.geometry.getAttribute('position').array)).toEqual(initial);disposeTree(m.root)
 })
 it('keeps both sets of feet grounded during the transfer',()=>{
  const m=createKhataModel();for(let n=0;n<3;n++)for(const t of[0,.1,.22,.3,.5,.8,1]){m.pose(n,t);for(const person of m.people)for(const foot of person.feet)expect(foot.position.y-foot.scale.y).toBeCloseTo(0,8)}disposeTree(m.root)
 })
})
