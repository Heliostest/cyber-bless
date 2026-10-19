import {it,expect} from 'vitest'
import * as THREE from 'three'
import {createBonfimModel} from './model'
import {disposeTree} from '../procedural-kit'
const items=(r:THREE.Object3D)=>{const a:THREE.Mesh[]=[];r.traverse(o=>{if((o as THREE.Mesh).isMesh)a.push(o as THREE.Mesh)});return a}
it('builds five necessary fence solids and one continuous closed thick ribbon',()=>{
 const m=createBonfimModel();expect(items(m.root).map(o=>o.name).sort()).toEqual(['bonfim-bar-0','bonfim-bar-1','bonfim-bar-2','bonfim-rail-0','bonfim-rail-1','bonfim-ribbon'].sort())
 for(const o of items(m.root)){const p=o.geometry.attributes.position!,ix=o.geometry.index!,edges=new Map<string,{n:number,b:number}>(),verts=new Set<string>();let volume=0,minArea=Infinity;const key=(v:THREE.Vector3)=>v.toArray().map(n=>Math.round(n*1e6)).join(',')
  for(let i=0;i<ix.count;i+=3){const v=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,ix.getX(i+k)));minArea=Math.min(minArea,v[1]!.clone().sub(v[0]!).cross(v[2]!.clone().sub(v[0]!)).length());volume+=v[0]!.dot(v[1]!.clone().cross(v[2]!))/6;for(let j=0;j<3;j++){const a=key(v[j]!),b=key(v[(j+1)%3]!);verts.add(a);const id=[a,b].sort().join('|'),e=edges.get(id)??{n:0,b:0};e.n++;e.b+=a<b?1:-1;edges.set(id,e)}}
  expect(volume,o.name).toBeGreaterThan(0);expect(minArea,o.name).toBeGreaterThan(1e-11);expect([...edges.values()].every(e=>e.n===2&&e.b===0),o.name).toBe(true);expect(verts.size-edges.size+ix.count/3,o.name).toBe(2)
 }m.dispose();disposeTree(m.root)
})
it('tightens only the current preformed knot and exactly restores every endpoint',()=>{
 const m=createBonfimModel(),g=m.ribbon.geometry,ref=g.attributes.position,metals=items(m.root).filter(o=>o!==m.ribbon),before=metals.map(o=>Array.from(o.geometry.attributes.position!.array))
 for(let s=0;s<3;s++){m.pose(s,0);const initial=Array.from(ref!.array);m.pose(s,.5);expect(Array.from(ref!.array)).not.toEqual(initial);expect(m.knotLevels).toEqual([0,1,2].map(i=>i<s?1:i===s?.5:0));m.pose(s,1);const end=Array.from(ref!.array);m.pose(0,.27);m.pose(s+1,0);expect(Array.from(ref!.array)).toEqual(end)}
 for(let s=0;s<3;s++)for(let k=0;k<=60;k++){m.pose(s,k/60);expect(m.ribbon.geometry).toBe(g);expect(g.attributes.position).toBe(ref);expect(Array.from(ref!.array).every(Number.isFinite)).toBe(true);expect(m.ribbon.scale.toArray()).toEqual([1,1,1])}
 metals.forEach((o,i)=>expect(Array.from(o.geometry.attributes.position!.array)).toEqual(before[i]));m.dispose();disposeTree(m.root)
})
it('owns and releases its locally generated cloth texture once',()=>{
 const m=createBonfimModel(),map=(m.ribbon.material as THREE.MeshStandardMaterial).map!;let disposed=0;map.addEventListener('dispose',()=>disposed++);m.dispose();m.dispose();expect(disposed).toBe(1);disposeTree(m.root)
})
it('draws the original BONFIM label with a distinct B corner and O upper stroke',()=>{
 const m=createBonfimModel(),data=((m.ribbon.material as THREE.MeshStandardMaterial).map!.image as {data:Uint8Array}).data
 expect(data[(9*256+7)*4]).toBeGreaterThan(200)
 expect(data[(9*256+13)*4]).toBeLessThan(180)
 m.dispose();disposeTree(m.root)
})
it('draws the slack into three compact knots near the wrapped standing part',()=>{
 const m=createBonfimModel();m.pose(3,0);const p=m.ribbon.geometry.attributes.position!
 for(const [begin,end]of m.knotRanges){const b=new THREE.Box3();for(let i=begin!*4;i<(end!+1)*4;i++)b.expandByPoint(new THREE.Vector3().fromBufferAttribute(p,i));const size=b.getSize(new THREE.Vector3());expect(size.x).toBeLessThan(.30);expect(size.z).toBeLessThan(.30);expect(size.y).toBeLessThan(.15);expect(b.min.y).toBeGreaterThan(1.35)}
 m.dispose();disposeTree(m.root)
})
it('keeps ribbon face winding aligned with its vertex normals at every checkpoint',()=>{
 const m=createBonfimModel();for(const s of[0,1,2,3]){m.pose(s,0);const g=m.ribbon.geometry,p=g.attributes.position!,n=g.attributes.normal!,ix=g.index!;let min=1
  for(let i=0;i<ix.count;i+=3){const ids=[ix.getX(i),ix.getX(i+1),ix.getX(i+2)],v=ids.map(j=>new THREE.Vector3().fromBufferAttribute(p,j)),face=v[1]!.clone().sub(v[0]!).cross(v[2]!.clone().sub(v[0]!)).normalize();for(const j of ids)min=Math.min(min,face.dot(new THREE.Vector3().fromBufferAttribute(n,j)))}expect(min).toBeGreaterThan(0)
 }m.dispose();disposeTree(m.root)
})
it('leaves positive room between each tight knot and the standing ribbon inside it',()=>{
 const m=createBonfimModel();m.pose(3,0);const p=m.ribbon.geometry.attributes.position!;for(const[begin,end]of m.knotRanges){let minimum=Infinity;for(let i=begin!*4;i<(end!+1)*4;i++)minimum=Math.min(minimum,Math.hypot(p.getX(i)-.5,p.getZ(i)-.8));expect(minimum).toBeGreaterThan(.023)}m.dispose();disposeTree(m.root)
})
