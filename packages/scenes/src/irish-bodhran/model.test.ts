import {it,expect} from 'vitest'
import * as THREE from 'three'
import {createBodhranModel} from './model'
import {disposeTree} from '../procedural-kit'
const meshes=(o:THREE.Object3D)=>{const a:THREE.Mesh[]=[];o.traverse(v=>{if((v as THREE.Mesh).isMesh)a.push(v as THREE.Mesh)});return a}
const vertices=(o:THREE.Mesh)=>{const p=o.geometry.attributes.position!;return Array.from({length:p.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld))}
it('keeps every actual vertex finite, rigid and above the grounded circular frame through1803poses',()=>{
 const m=createBodhranModel(),all=meshes(m.subject);let ground=0,minY=Infinity,bad=0,scale=0
 for(let s=0;s<3;s++)for(let k=0;k<=600;k++){m.pose(s,k/600);ground=Math.max(ground,Math.abs(Math.min(...vertices(m.frame).map(v=>v.y))));for(const o of all){scale=Math.max(scale,o.scale.distanceTo(new THREE.Vector3(1,1,1)));for(const v of vertices(o)){minY=Math.min(minY,v.y);if(!Number.isFinite(v.x+v.y+v.z))bad++}}}
 expect(ground).toBeLessThan(1e-10);expect(minY).toBeGreaterThanOrEqual(-1e-9);expect(bad).toBe(0);expect(scale).toBe(0);disposeTree(m.subject)
})
it('makes opposite real tip ends meet the actual drumhead halfway without any tipper vertex crossing its plane',()=>{
 const m=createBodhranModel();let minGap=Infinity,maxRadius=0
 for(let s=0;s<2;s++)for(let k=0;k<=600;k++){m.pose(s,k/600);for(const o of meshes(m.tipper))for(const v of vertices(o)){minGap=Math.min(minGap,v.z-.134);maxRadius=Math.max(maxRadius,Math.hypot(v.x,v.y-m.subject.position.y))}}
 expect(minGap).toBeGreaterThanOrEqual(-1e-7);expect(maxRadius).toBeLessThan(.65)
 for(const s of[0,1]){m.pose(s,.5);const striking=s===0?m.right:m.left,other=s===0?m.left:m.right;expect(Math.min(...vertices(striking).map(v=>v.z))).toBeCloseTo(.134,7);expect(Math.min(...vertices(other).map(v=>v.z))-.134).toBeGreaterThan(.50);m.pose(s,0);expect(Math.min(...meshes(m.tipper).flatMap(vertices).map(v=>v.z))-.134).toBeCloseTo(.25,7)}
 disposeTree(m.subject)
})
it('keeps both end knobs attached to the same rigid rod during each alternate stroke',()=>{
 const m=createBodhranModel();let distance=0,localDrift=0
 for(let s=0;s<3;s++)for(let k=0;k<=600;k++){m.pose(s,k/600);distance=Math.max(distance,Math.abs(m.left.getWorldPosition(new THREE.Vector3()).distanceTo(m.right.getWorldPosition(new THREE.Vector3()))-.92));localDrift=Math.max(localDrift,m.left.position.distanceTo(new THREE.Vector3(-.46,0,0)),m.right.position.distanceTo(new THREE.Vector3(.46,0,0)))}
 expect(distance).toBeLessThan(1e-12);expect(localDrift).toBe(0);disposeTree(m.subject)
})
it('has an actual open rear frame and a single supported front head, rather than a painted solid cylinder',()=>{
 const m=createBodhranModel(),origin=new THREE.Vector3(.3,.3,-.6);m.subject.worldToLocal(origin);origin.set(.3,.3,-.6).add(new THREE.Vector3(0,m.subject.position.y,0));const ray=new THREE.Raycaster(origin,new THREE.Vector3(0,0,1))
 expect(ray.intersectObject(m.frame,false)).toHaveLength(0);expect(ray.intersectObject(m.head,false).length).toBeGreaterThan(0)
 const inside=new THREE.Raycaster(new THREE.Vector3(0,m.subject.position.y+.3,0),new THREE.Vector3(1,0,0));const hit=inside.intersectObject(m.frame,false)[0]!;expect(hit.distance).toBeGreaterThan(.79);expect(hit.distance).toBeLessThan(.82)
 expect(m.braces).toHaveLength(2);for(const bar of m.braces){const v=vertices(bar);expect(Math.max(...v.map(p=>p.z))).toBeLessThan(.116);expect(Math.max(...v.map(p=>Math.hypot(p.x,p.y-m.subject.position.y)))).toBeGreaterThan(.90)}
 disposeTree(m.subject)
})
it('turns the complete frame with its mounted skin and resting tipper while keeping ground contact',()=>{
 const m=createBodhranModel();m.pose(2,1);expect(m.subject.rotation.z).toBe(.35);expect(m.tipper.rotation.y).toBe(0);expect(Math.min(...vertices(m.frame).map(v=>v.y))).toBeCloseTo(0,10);expect(m.head.parent).toBe(m.subject);expect(m.rim.parent).toBe(m.subject);expect(m.tipper.parent).toBe(m.subject);disposeTree(m.subject)
})
it('joins the rear cross braces with positive overlap and distinct exposed front/back planes',()=>{
 const m=createBodhranModel(),a=new THREE.Box3().setFromObject(m.braces[0]!),b=new THREE.Box3().setFromObject(m.braces[1]!)
 expect(Math.abs(a.min.z-b.min.z)).toBeGreaterThan(.005);expect(Math.abs(a.max.z-b.max.z)).toBeGreaterThan(.005);expect(Math.min(a.max.z,b.max.z)-Math.max(a.min.z,b.min.z)).toBeGreaterThan(.05);disposeTree(m.subject)
})
it('restores each persistent checkpoint exactly without reallocating or deforming the geometry',()=>{
 const m=createBodhranModel(),all=meshes(m.subject),refs=all.map(o=>o.geometry),buffers=all.map(o=>Array.from(o.geometry.attributes.position!.array))
 for(let s=0;s<3;s++){m.pose(s,1);const matrices=all.map(o=>[...o.matrixWorld.elements]);m.pose(0,.37);m.pose(s+1,0);all.forEach((o,i)=>{expect(o.matrixWorld.elements).toEqual(matrices[i]);expect(o.geometry).toBe(refs[i]);expect(Array.from(o.geometry.attributes.position!.array)).toEqual(buffers[i])})}
 disposeTree(m.subject)
})
it('uses eight closed positive outward solids with paired consistently oriented seams',()=>{
 const m=createBodhranModel(),all=meshes(m.subject);expect(all).toHaveLength(8)
 for(const o of all){const p=o.geometry.attributes.position!,idx=o.geometry.index,edges=new Map<string,{n:number,b:number}>();let volume=0,area=Infinity;const key=(v:THREE.Vector3)=>v.toArray().map(x=>Math.round(x*1e6)).join(',')
  for(let i=0;i<(idx?.count??p.count);i+=3){const t=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,idx?idx.getX(i+k):i+k));volume+=t[0]!.dot(t[1]!.clone().cross(t[2]!))/6;area=Math.min(area,t[1]!.clone().sub(t[0]!).cross(t[2]!.clone().sub(t[0]!)).length());for(let k=0;k<3;k++){const a=key(t[k]!),b=key(t[(k+1)%3]!),id=[a,b].sort().join('|'),r=edges.get(id)??{n:0,b:0};r.n++;r.b+=a<b?1:-1;edges.set(id,r)}}
  expect(volume,o.name).toBeGreaterThan(0);expect(area,o.name).toBeGreaterThan(1e-10);expect([...edges.values()].every(e=>e.n===2&&e.b===0),o.name).toBe(true)
 }disposeTree(m.subject)
})
