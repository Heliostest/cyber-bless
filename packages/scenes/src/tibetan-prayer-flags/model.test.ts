import {describe,it,expect} from 'vitest'
import * as THREE from 'three'
import {createPrayerFlagsModel} from './model'
describe('Complete mantra prayer flag string',()=>{
 it('can carry either real cord end off the old screen rail without stretching or detaching cloth',()=>{
  const m=createPrayerFlagsModel(), fixed=m.right.clone(), goal=new THREE.Vector3(-.8,1.95,.25)
  m.holdEnd(0,goal)
  expect(m.left.distanceTo(goal)).toBeLessThan(1e-8);expect(m.right.toArray()).toEqual(fixed.toArray())
  expect(m.loops[0]!.position.toArray()).toEqual(goal.toArray());expect(m.lengths.at(-1)).toBeCloseTo(2.5,5)
  m.holdEnd(1,new THREE.Vector3(10,10,10));expect(m.lengths.at(-1)).toBeCloseTo(2.5,5)
  for(const flag of m.flags)expect(Array.from(flag.geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true)
 })
 it('keeps the complete string and cloth above ground while a free end is dragged too low',()=>{
  const m=createPrayerFlagsModel();m.holdEnd(0,m.right.clone().add(new THREE.Vector3(0,-3,0)))
  for(const flag of m.flags)expect(new THREE.Box3().setFromObject(flag,true).min.y).toBeGreaterThan(.049)
  expect(m.lengths.at(-1)).toBeCloseTo(2.5,5)
 })
 it('retains five opaque cloths, the documented colour order and readable mantra syllables',()=>{
  const m=createPrayerFlagsModel();expect(m.flags.map(f=>f.userData.mantra)).toEqual(['OM','MA','NI','PAD ME','HUM']);expect(m.flags.map(f=>f.material.color.getHex())).toEqual([0x5079be,0xf6f0dd,0xd76054,0x659e76,0xe9c257]);expect(m.flags.every(f=>!f.material.transparent&&f.material.map instanceof THREE.DataTexture)).toBe(true)
  expect(m.targets).toEqual([m.flags[0],m.flags[4],m.flags[4]])
 })
 it('keeps a constant-length connected rope and all cloth above ground along all three paths',()=>{
  const m=createPrayerFlagsModel(),p=new THREE.Vector3();let min=Infinity,ropeError=0
  for(let step=0;step<3;step++)for(let n=0;n<=100;n++){m.pose(step,n/100);ropeError=Math.max(ropeError,Math.abs(m.lengths.at(-1)!-2.5));for(const f of m.flags){const pos=f.geometry.getAttribute('position');for(let i=0;i<pos.count;i++){p.fromBufferAttribute(pos,i).add(f.position);min=Math.min(min,p.y);expect(Number.isFinite(p.x+p.y+p.z)).toBe(true)}}
   expect(m.points[0]!.distanceTo(m.left.clone().add(new THREE.Vector3(.060,0,0)))).toBeLessThan(1e-6);expect(m.points.at(-1)!.distanceTo(m.right.clone().add(new THREE.Vector3(-.060,0,0)))).toBeLessThan(1e-6)
  }expect(ropeError).toBeLessThan(1e-5);expect(min).toBeGreaterThan(.05)
 })
 it('has closed manifold cloth and rope meshes with two opposite faces per edge',()=>{
  const m=createPrayerFlagsModel();for(const mesh of[...m.flags,m.rope]){const edges=new Map<string,number[]>(),index=mesh.geometry.index!,p=mesh.geometry.getAttribute('position'),ids=new Map<string,number>(),weld=Array.from({length:p.count},(_,i)=>{const key=[p.getX(i),p.getY(i),p.getZ(i)].join(',');if(!ids.has(key))ids.set(key,ids.size);return ids.get(key)!});for(let i=0;i<index.count;i+=3){const a=[weld[index.getX(i)]!,weld[index.getX(i+1)]!,weld[index.getX(i+2)]!];for(let j=0;j<3;j++){const x=a[j]!,y=a[(j+1)%3]!,key=[Math.min(x,y),Math.max(x,y)].join(',');edges.set(key,[...(edges.get(key)??[]),x<y?1:-1])}}for(const values of edges.values())expect(values.sort()).toEqual([-1,1])}
 })
 it('pins every top edge while free edges and their texture vertices flutter',()=>{
  const m=createPrayerFlagsModel();m.pose(3,0);const before=m.flags.map(f=>Array.from(f.geometry.getAttribute('position').array));m.tick(.5)
  for(let k=0;k<5;k++){const f=m.flags[k]!,after=f.geometry.getAttribute('position');for(let i=0;i<9;i++)expect(Array.from(after.array.slice(i*3,i*3+3))).toEqual(before[k]!.slice(i*3,i*3+3));expect(Array.from(after.array)).not.toEqual(before[k]);expect(after.getZ(5*9+4)).toBeCloseTo(.003,6)}
 })
 it('hangs both endpoints on real pegs and grounds each support at all settled checkpoints',()=>{
  const m=createPrayerFlagsModel();for(let step=0;step<4;step++){m.pose(step,0);for(const loop of m.loops)expect(m.pegs.some(p=>{const q=p.getWorldPosition(new THREE.Vector3());return Math.hypot(q.x-loop.position.x,q.y-loop.position.y-.015)<1e-8})).toBe(true)}
  for(const name of['post--1.15','post-1.15','foot--1.15','foot-1.15'])expect(new THREE.Box3().setFromObject(m.root.getObjectByName('prayer-flags-'+name)!).min.y).toBeCloseTo(0,6)
 })
 it('restores exactly continuous checkpoint transforms without leftover movement',()=>{
  const a=createPrayerFlagsModel(),b=createPrayerFlagsModel();for(let step=0;step<3;step++){a.pose(step,1);b.pose(step+1,0);for(let i=0;i<5;i++){expect(a.flags[i]!.position.toArray()).toEqual(b.flags[i]!.position.toArray());expect(Array.from(a.flags[i]!.geometry.getAttribute('position').array)).toEqual(Array.from(b.flags[i]!.geometry.getAttribute('position').array))}}
 })
})
