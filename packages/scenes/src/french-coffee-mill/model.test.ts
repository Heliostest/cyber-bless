import {it,expect} from 'vitest'
import * as THREE from 'three'
import {createCoffeeMillModel} from './model'
import {disposeTree} from '../procedural-kit'
const world=(o:THREE.Object3D,p=new THREE.Vector3())=>o.localToWorld(p.clone())
const meshes=(o:THREE.Object3D)=>{const a:THREE.Mesh[]=[];o.traverse(v=>{if((v as THREE.Mesh).isMesh)a.push(v as THREE.Mesh)});return a}
const bounds=(m:THREE.Mesh)=>{
 const box=new THREE.Box3(),position=m.geometry.attributes.position!,point=new THREE.Vector3()
 for(let i=0;i<position.count;i++)box.expandByPoint(point.fromBufferAttribute(position,i))
 return box.applyMatrix4(m.matrixWorld)
}
it('joins all cabinet walls to the top underside without coplanar overlapping face strips',()=>{
 const m=createCoffeeMillModel(),items=meshes(m.subject),top=items.filter(o=>o.name.startsWith('coffee-top-')),walls=items.filter(o=>/^coffee-case-(side-|back$|front-upper$)/.test(o.name))
 const underside=Math.min(...top.map(o=>bounds(o).min.y));expect(walls).toHaveLength(4)
 for(const wall of walls)expect(bounds(wall).max.y,wall.name).toBeCloseTo(underside,7)
 disposeTree(m.subject)
})
it('grounds the wooden case and keeps every actual vertex finite and all object scales rigid at1803poses',()=>{
 const m=createCoffeeMillModel();let minY=Infinity,nonfinite=0,scale=0,ground=0
 for(let s=0;s<3;s++)for(let k=0;k<=600;k++){m.pose(s,k/600);ground=Math.max(ground,Math.abs(bounds(m.caseBase).min.y));for(const o of meshes(m.subject)){scale=Math.max(scale,o.scale.distanceTo(new THREE.Vector3(1,1,1)));const p=o.geometry.attributes.position!;for(let i=0;i<p.count;i++){const v=world(o,new THREE.Vector3().fromBufferAttribute(p,i));minY=Math.min(minY,v.y);if(!Number.isFinite(v.x+v.y+v.z))nonfinite++}}}
 expect(minY).toBeGreaterThanOrEqual(-1e-9);expect(ground).toBeLessThan(1e-9);expect(nonfinite).toBe(0);expect(scale).toBe(0);disposeTree(m.subject)
})
it('rotates the rigid crank about its real shaft through two halfturns without grip detachment',()=>{
 const m=createCoffeeMillModel();let drift=0,radiusError=0
 for(let s=0;s<2;s++)for(let k=0;k<=600;k++){m.pose(s,k/600);const a=world(m.grip),b=world(m.pin);radiusError=Math.max(radiusError,Math.abs(Math.hypot(a.x,a.z)-.72));drift=Math.max(drift,Math.hypot(a.x-b.x,a.z-b.z),Math.abs(a.y-2.3),Math.abs(world(m.shaft).x),Math.abs(world(m.shaft).z))}
 m.pose(0,1);expect(m.crank.rotation.y).toBeCloseTo(-.6+Math.PI,12);m.pose(1,1);expect(m.crank.rotation.y).toBeCloseTo(-.6+2*Math.PI,12);expect(drift).toBeLessThan(1e-12);expect(radiusError).toBeLessThan(1e-12);disposeTree(m.subject)
})
it('keeps all moving drawer solids clear of the physical cabinet through the entire supported slide',()=>{
 const m=createCoffeeMillModel();let minSeparation=Infinity,minSupport=Infinity,powderDrift=0
 for(let k=0;k<=600;k++){m.pose(2,k/600);const moving=meshes(m.drawer).map(bounds),fixed=m.frameSolids.map(bounds)
  for(const a of moving)for(const b of fixed)minSeparation=Math.min(minSeparation,Math.max(b.min.x-a.max.x,a.min.x-b.max.x,b.min.y-a.max.y,a.min.y-b.max.y,b.min.z-a.max.z,a.min.z-b.max.z))
  const floor=bounds(m.drawerFloor),rail=bounds(m.rails[0]!);minSupport=Math.min(minSupport,Math.min(floor.max.z,rail.max.z)-Math.max(floor.min.z,rail.min.z));powderDrift=Math.max(powderDrift,Math.abs(world(m.powder).z-m.drawer.position.z-.03),Math.abs(bounds(m.powder).min.y-floor.max.y))
 }
 expect(minSeparation).toBeGreaterThanOrEqual(-1e-7);expect(minSupport).toBeGreaterThan(.30);expect(powderDrift).toBeLessThan(1e-7);expect(m.drawer.position.z).toBe(.75);disposeTree(m.subject)
})
it('places every real bean vertex inside the faceted hopper above its inner surface and clear of the shaft',()=>{
 const m=createCoffeeMillModel();let gap=Infinity,top=Infinity,shaft=Infinity,pair=Infinity
 for(const b of m.beans){const p=b.geometry.attributes.position!;for(let j=0;j<p.count;j++){const v=world(b,new THREE.Vector3().fromBufferAttribute(p,j));top=Math.min(top,1.72-v.y);shaft=Math.min(shaft,Math.hypot(v.x,v.z)-.035);for(let i=0;i<32;i++){const a=(i+.5)*2*Math.PI/32,inside=.21+(v.y-1.28)*(.30/.44);gap=Math.min(gap,inside*Math.cos(Math.PI/32)-v.x*Math.cos(a)-v.z*Math.sin(a))}}
  for(const c of m.beans)if(c!==b)pair=Math.min(pair,b.position.distanceTo(c.position)-.14)
 }
 expect(gap).toBeGreaterThan(.001);expect(top).toBeGreaterThan(.08);expect(shaft).toBeGreaterThan(.15);expect(pair).toBeGreaterThan(.08);disposeTree(m.subject)
})
it('keeps the real shaft clear of the top square opening, hollow bearing and open hopper throat',()=>{
 const m=createCoffeeMillModel();let bore=Infinity,opening=Infinity
 for(let s=0;s<2;s++)for(let k=0;k<=600;k++){m.pose(s,k/600);const p=m.shaft.geometry.attributes.position!;for(let i=0;i<p.count;i++){const v=world(m.shaft,new THREE.Vector3().fromBufferAttribute(p,i));opening=Math.min(opening,.12-Math.abs(v.x),.12-Math.abs(v.z));for(let j=0;j<24;j++){const a=(j+.5)*2*Math.PI/24;bore=Math.min(bore,.055*Math.cos(Math.PI/24)-v.x*Math.cos(a)-v.z*Math.sin(a))}}}
 expect(bore).toBeGreaterThan(.019);expect(opening).toBeGreaterThan(.084);disposeTree(m.subject)
})
it('preserves all geometry buffers and restores each persistent checkpoint with identical vertices and transforms',()=>{
 const m=createCoffeeMillModel(),items=meshes(m.subject),refs=items.map(o=>o.geometry),positions=items.map(o=>Array.from(o.geometry.attributes.position!.array))
 for(let s=0;s<3;s++){m.pose(s,1);const matrices=items.map(o=>[...o.matrixWorld.elements]);m.pose(0,.37);m.pose(s+1,0);items.forEach((o,i)=>{expect(o.matrixWorld.elements).toEqual(matrices[i]);expect(o.geometry).toBe(refs[i]);expect(Array.from(o.geometry.attributes.position!.array)).toEqual(positions[i])})}
 disposeTree(m.subject)
})
it('uses35 closed outward solids without unpaired or oppositely oriented seams',()=>{
 const m=createCoffeeMillModel(),items=meshes(m.subject);expect(items).toHaveLength(35)
 for(const o of items){const p=o.geometry.attributes.position!,idx=o.geometry.index,edges=new Map<string,{count:number,balance:number}>();let volume=0,area=Infinity;const key=(p:THREE.Vector3)=>p.toArray().map(x=>Math.round(x*1e6)).join(',')
  for(let i=0;i<(idx?.count??p.count);i+=3){const t=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,idx?idx.getX(i+k):i+k));volume+=t[0]!.dot(t[1]!.clone().cross(t[2]!))/6;area=Math.min(area,t[1]!.clone().sub(t[0]!).cross(t[2]!.clone().sub(t[0]!)).length());for(let k=0;k<3;k++){const a=key(t[k]!),b=key(t[(k+1)%3]!),id=[a,b].sort().join('|'),r=edges.get(id)??{count:0,balance:0};r.count++;r.balance+=a<b?1:-1;edges.set(id,r)}}
  expect(volume,o.name).toBeGreaterThan(0);expect(area,o.name).toBeGreaterThan(1e-10);expect([...edges.values()].every(e=>e.count===2&&e.balance===0),o.name).toBe(true)
 }disposeTree(m.subject)
})
