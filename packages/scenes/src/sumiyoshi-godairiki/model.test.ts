import { expect, it } from 'vitest'
import * as THREE from 'three'
import { createGodairikiModel } from './model'
import { disposeTree } from '../procedural-kit'

it('faces every ink triangle upwards without degenerate joints so all three characters remain visible',()=>{
 const m=createGodairikiModel();let count=0
 m.root.traverse(o=>{if(!o.name.startsWith('godairiki-ink-'))return;const g=(o as THREE.Mesh).geometry,p=g.attributes.position!,ix=g.index!
  for(let i=0;i<ix.count;i+=3){const [a,b,c]=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,ix.getX(i+k)));expect(b!.sub(a!).cross(c!.sub(a!)).y,o.name).toBeGreaterThan(1e-9);count++}
 });expect(count).toBeGreaterThan(100);disposeTree(m.root)
})

// Catches inverted/open shells, degenerate triangles and unsupported landing positions.
it('constructs closed positive stone and pouch shells', () => {
 const m=createGodairikiModel()
 for(const mesh of [...m.targets,m.pouch]) {
  const p=mesh.geometry.attributes.position!,ix=mesh.geometry.index!,edges=new Map<string,{n:number,b:number}>();let volume=0
  const key=(v:THREE.Vector3)=>v.toArray().map(n=>Math.round(n*1e6)).join(',')
  for(let i=0;i<ix.count;i+=3){const t=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,ix.getX(i+k)))
   expect(t[1]!.clone().sub(t[0]!).cross(t[2]!.clone().sub(t[0]!)).length(),mesh.name).toBeGreaterThan(1e-10)
   volume+=t[0]!.dot(t[1]!.clone().cross(t[2]!))/6
   for(let j=0;j<3;j++){const a=key(t[j]!),b=key(t[(j+1)%3]!),id=[a,b].sort().join('|'),e=edges.get(id)??{n:0,b:0};e.n++;e.b+=a<b?1:-1;edges.set(id,e)}
  }
  expect(volume,mesh.name).toBeGreaterThan(0);expect([...edges.values()].every(e=>e.n===2&&e.b===0),mesh.name).toBe(true)
 }
 disposeTree(m.root)
})
it('lifts each stone clear of the lip before moving horizontally, then lowers inside the open bag', () => {
 const m=createGodairikiModel()
 for(let step=0;step<3;step++)for(let k=0;k<=100;k++){
  const t=k/100;m.pose(step,t);const moving=new THREE.Box3().setFromObject(m.roots[step]!)
  expect(moving.min.y).toBeGreaterThanOrEqual(-1e-7)
  if(t>=.25&&t<=.70)expect(moving.min.y).toBeGreaterThan(.94)
  for(let i=0;i<3;i++)if(i!==step){const b=new THREE.Box3().setFromObject(m.roots[i]!);expect(moving.intersectsBox(b),`stone ${step}/${i} t=${t}`).toBe(false)}
 }
 m.pose(3,0)
 for(const stone of m.targets){const b=new THREE.Box3().setFromObject(stone);expect(b.min.y).toBeCloseTo(.05,6);expect(b.max.y).toBeLessThan(.63);expect(b.min.x).toBeGreaterThan(.15);expect(b.max.x).toBeLessThan(1.55)}
 disposeTree(m.root)
})
it('restores exactly each deposited-stone checkpoint without changing shape or scale', () => {
 const m=createGodairikiModel(),positions=m.targets.map(s=>Array.from(s.geometry.attributes.position!.array))
 for(let s=0;s<3;s++){m.pose(s,1);const prior=m.roots.map(o=>o.matrixWorld.elements.slice());m.pose(0,.43);m.pose(s+1,0);expect(m.roots.map(o=>o.matrixWorld.elements)).toEqual(prior)}
 for(let s=0;s<3;s++)for(const t of [0,.1,.25,.4,.7,.9,1]){m.pose(s,t);m.targets.forEach((o,i)=>{expect(o.scale.toArray()).toEqual([1,1,1]);expect(Array.from(o.geometry.attributes.position!.array)).toEqual(positions[i]);expect(o.matrixWorld.elements.every(Number.isFinite)).toBe(true)})}
 disposeTree(m.root)
})
