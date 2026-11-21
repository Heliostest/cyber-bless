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

it('deforms the closed cloth pouch and gravel-resting drawstrings under stone weight with damped landing cushion and calm equilibrium', () => {
 const m = createGodairikiModel()
 const pouchPos = m.pouch.geometry.attributes.position!
 const pouchArr = pouchPos.array
 const rim = m.root.getObjectByName('godairiki-soft-rim') as THREE.Mesh
 const leftCord = m.root.getObjectByName('godairiki-cord--1') as THREE.Mesh
 const rightCord = m.root.getObjectByName('godairiki-cord-1') as THREE.Mesh
 expect(rim).toBeTruthy(); expect(leftCord).toBeTruthy(); expect(rightCord).toBeTruthy()

 const rimMeanY = () => {
  const rp = rim.geometry.attributes.position!
  let sum = 0
  for (let i = 0; i < rp.count; i++) sum += rp.getY(i)
  return sum / rp.count
 }

 // Empty pose (checkpoint 0)
 m.pose(0, 0)
 const emptySnap = Array.from(pouchArr)
 const emptyBox = new THREE.Box3().setFromObject(m.pouch)
 const emptyRimY = rimMeanY()

 // Mid-landing cushion pulse during 3rd stone drop (t=0.85)
 m.pose(2, 0.85)
 const landingSnap = Array.from(pouchArr)
 expect(m.pouch.geometry.attributes.position!.array).toBe(pouchArr)
 expect(landingSnap.every(Number.isFinite)).toBe(true)

 // Loaded pose (checkpoint 3, all 3 stones seated)
 m.pose(3, 0)
 const loadedSnap = Array.from(pouchArr)
 const loadedBox = new THREE.Box3().setFromObject(m.pouch)
 const loadedRimY = rimMeanY()

 expect(loadedSnap).not.toEqual(emptySnap)
 expect(landingSnap).not.toEqual(loadedSnap)
 // Stone weight broadens the lower belly and settles the gathered collar lower.
 expect(loadedBox.max.x - loadedBox.min.x).toBeGreaterThan((emptyBox.max.x - emptyBox.min.x) + 0.04)
 expect(loadedRimY).toBeLessThan(emptyRimY - 0.035)

 // Pouch remains a closed positive-volume 2-manifold when fully loaded.
 const ix = m.pouch.geometry.index!
 let vol = 0
 for (let i = 0; i < ix.count; i += 3) {
  const a = new THREE.Vector3().fromBufferAttribute(pouchPos, ix.getX(i))
  const b = new THREE.Vector3().fromBufferAttribute(pouchPos, ix.getX(i + 1))
  const c = new THREE.Vector3().fromBufferAttribute(pouchPos, ix.getX(i + 2))
  vol += a.dot(b.clone().cross(c)) / 6
 }
 expect(vol).toBeGreaterThan(0.15)

 // Both gravity-draped drawstring loops rest above ground (y >= 0) and stay within the gravel disc ellipse.
 for (const cord of [leftCord, rightCord]) {
  const cp = cord.geometry.attributes.position!
  let minY = Infinity
  for (let i = 0; i < cp.count; i++) {
   const wp = cord.localToWorld(new THREE.Vector3().fromBufferAttribute(cp, i))
   expect(Number.isFinite(wp.x) && Number.isFinite(wp.y) && Number.isFinite(wp.z)).toBe(true)
   minY = Math.min(minY, wp.y)
   const ellipse = ((wp.x + 0.08) / 1.85) ** 2 + (wp.z / (1.85 * 0.72)) ** 2
   expect(ellipse, `${cord.name} stays over gravel disc`).toBeLessThan(1.01)
  }
  expect(minY, `${cord.name} rests on gravel`).toBeGreaterThanOrEqual(-0.002)
  expect(minY, `${cord.name} actually reaches gravel surface`).toBeLessThan(0.03)
 }

 // Calm equilibrium: pose(2, 1) and repeated pose(3, 0) yield bit-for-bit identical geometry.
 m.pose(2, 1)
 expect(Array.from(pouchArr)).toEqual(loadedSnap)
 m.pose(3, 0)
 expect(Array.from(pouchArr)).toEqual(loadedSnap)
 disposeTree(m.root)
})
