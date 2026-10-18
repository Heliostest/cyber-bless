import {describe,it,expect} from 'vitest'
import * as THREE from 'three'
import {disposeTree} from '../procedural-kit'
import {createVillageSwingModel} from './model'

describe('original rigid-arm village swing geometry',()=>{
 it('uses a fixed timber frame, one moving platform and real front-plank targets',()=>{
  const m=createVillageSwingModel();expect(m.subject.name).toBe('swing-subject');expect(m.targets.map(o=>o.name)).toEqual(Array(3).fill('swing-front-plank'));expect(new Set(m.roots).size).toBe(1);expect(m.arms).toHaveLength(2);expect(m.planks).toHaveLength(4);expect(m.legs).toHaveLength(4);expect(m.target.material.roughness).toBeGreaterThan(.7);disposeTree(m.subject)
 })
 it('keeps every moving vertex above ground and outside the frame legs through1803poses',()=>{
  const m=createVillageSwingModel(),p=new THREE.Vector3();let minY=Infinity,maxX=0,minLegX=Infinity
  for(const mesh of m.legs){const ps=mesh.geometry.getAttribute('position');for(let k=0;k<ps.count;k++)minLegX=Math.min(minLegX,Math.abs(p.fromBufferAttribute(ps,k).applyMatrix4(mesh.matrixWorld).x))}
  for(let at=0;at<3;at++)for(let k=0;k<=600;k++){m.pose(at,k/600);m.joint.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.geometry)return;const vs=mesh.geometry.getAttribute('position');for(let i=0;i<vs.count;i++){p.fromBufferAttribute(vs,i).applyMatrix4(mesh.matrixWorld);minY=Math.min(minY,p.y);maxX=Math.max(maxX,Math.abs(p.x))}})}
  expect(minY).toBeGreaterThan(.45);expect(minLegX-maxX).toBeGreaterThan(.2);disposeTree(m.subject)
 })
 it('maintains actual rigid-arm endpoint distances and fixed coaxial upper attachments',()=>{
  const m=createVillageSwingModel(),a=new THREE.Vector3(),b=new THREE.Vector3()
  for(let at=0;at<3;at++)for(let k=0;k<=200;k++){m.pose(at,k/200);for(let i=0;i<2;i++){const x=i===0?-1.1:1.1;a.copy(m.armPivots[i]!.getWorldPosition(a));b.set(x,-2.43,0);m.joint.localToWorld(b);expect(a.distanceTo(new THREE.Vector3(x,3.08,0))).toBeLessThan(1e-12);expect(a.distanceTo(b)).toBeCloseTo(2.43,12)}}disposeTree(m.subject)
 })
 it('never moves the timber frame, axles or bearing rings and keeps all four feet on the ground',()=>{
  const m=createVillageSwingModel(),before=m.frame.children.map(o=>o.matrixWorld.toArray()),p=new THREE.Vector3()
  for(let at=0;at<3;at++)for(let k=0;k<=200;k++){m.pose(at,k/200);expect(m.frame.children.map(o=>o.matrixWorld.toArray())).toEqual(before)}
  for(const leg of m.legs){let low=Infinity;const ps=leg.geometry.getAttribute('position');for(let i=0;i<ps.count;i++)low=Math.min(low,p.fromBufferAttribute(ps,i).applyMatrix4(leg.matrixWorld).y);expect(low).toBe(0)}disposeTree(m.subject)
 })
 it('uses closed positive-volume meshes, finite outward face normals and bounded subtle wood grain',()=>{
  const m=createVillageSwingModel();let meshes=0
  m.subject.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.geometry)return;meshes++;const g=mesh.geometry,p=g.getAttribute('position'),n=g.getAttribute('normal'),idx=g.index!,edges=new Map<string,{count:number,balance:number}>();let volume=0,minArea=Infinity,minDot=1;const key=(v:THREE.Vector3)=>v.toArray().map(x=>(Math.abs(x)<.0000005?0:x).toFixed(6)).join(',')
   for(let i=0;i<idx.count;i+=3){const ids=[0,1,2].map(j=>idx.getX(i+j)),v=ids.map(j=>new THREE.Vector3().fromBufferAttribute(p,j)),f=v[1]!.clone().sub(v[0]!).cross(v[2]!.clone().sub(v[0]!));minArea=Math.min(minArea,f.length());volume+=v[0]!.dot(v[1]!.clone().cross(v[2]!))/6;f.normalize();for(let j=0;j<3;j++){const normal=new THREE.Vector3().fromBufferAttribute(n,ids[j]!);expect(normal.toArray().every(Number.isFinite)).toBe(true);minDot=Math.min(minDot,f.dot(normal));const a=key(v[j]!),b=key(v[(j+1)%3]!),e=a<b?a+'|'+b:b+'|'+a,r=edges.get(e)??{count:0,balance:0};r.count++;r.balance+=a<b?1:-1;edges.set(e,r)}}
   expect(volume,mesh.name).toBeGreaterThan(0);expect(minArea,mesh.name).toBeGreaterThan(1e-7);expect(minDot,mesh.name).toBeGreaterThan(.8);expect([...edges.values()].every(e=>e.count===2&&e.balance===0),mesh.name).toBe(true)
   const color=g.getAttribute('color');if(color)for(let i=0;i<color.count;i++)for(const value of[color.getX(i),color.getY(i),color.getZ(i)]){expect(value).toBeGreaterThan(.85);expect(value).toBeLessThanOrEqual(1)}
  });expect(meshes).toBeGreaterThanOrEqual(20);disposeTree(m.subject)
 })
 it('keeps the fixed bearing bores clear of the coaxial pins and clear of the wooden arm bodies',()=>{
  const m=createVillageSwingModel()
  for(const ring of m.rings){let min=Infinity;const vs=ring.geometry.getAttribute('position');for(let i=0;i<vs.count;i++)min=Math.min(min,Math.hypot(vs.getX(i),vs.getY(i)));expect(min).toBeGreaterThan(.0649)}
  expect(m.pinRadius).toBe(.06);expect(m.rings[1]!.position.x-(1.1+.075)-.035).toBeGreaterThan(.019);disposeTree(m.subject)
 })
 it('restores exact checkpoints and reaches a final neutral platform without touching fixed parts',()=>{
  const m=createVillageSwingModel(),snapshot=()=>{const rows:unknown[]=[];m.subject.traverse(o=>rows.push([o.name,o.position.toArray(),o.quaternion.toArray(),o.scale.toArray(),o.visible,(o as THREE.Mesh).geometry?.attributes.position?.array.slice()]));return rows}
  for(let at=0;at<3;at++){m.pose(at,1);const reached=snapshot();m.pose(at+1,0);expect(snapshot()).toEqual(reached)}m.pose(3,0);expect(m.joint.rotation.x).toBe(0);expect(m.joint.quaternion.toArray()).toEqual([0,0,0,1]);disposeTree(m.subject)
 })
})
