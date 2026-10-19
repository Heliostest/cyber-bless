import {describe,it,expect} from 'vitest'
import * as THREE from 'three'
import {createBellowsModel} from './model'
import {disposeTree} from '../procedural-kit'

describe('actual wooden leaves, flexible leather and open nozzle',()=>{
 it('joins wooden leaf and handle edges without overlapping their coplanar visible top faces',()=>{
  const m=createBellowsModel(),board=m.subject.getObjectByName('bellows-upper-board') as THREE.Mesh
  const a=new THREE.Box3().setFromBufferAttribute(board.geometry.getAttribute('position') as THREE.BufferAttribute),b=new THREE.Box3().setFromBufferAttribute(m.handle.geometry.getAttribute('position') as THREE.BufferAttribute)
  b.translate(m.handle.position);expect(a.max.x-b.min.x).toBeLessThan(2e-7);expect(Math.abs(a.max.x-b.min.x)).toBeLessThan(2e-7);disposeTree(m.subject)
 })
 it('keeps actual rigid-surface vertex normals in every rendered face hemisphere',()=>{
  const m=createBellowsModel();let worst=1
  for(const name of ['bellows-upper-board','bellows-upper-handle','bellows-brass-nozzle']){
   const mesh=m.subject.getObjectByName(name) as THREE.Mesh,p=mesh.geometry.getAttribute('position'),n=mesh.geometry.getAttribute('normal'),idx=mesh.geometry.index
   for(let k=0;k<(idx?.count??p.count);k+=3){const ids=[0,1,2].map(j=>idx?idx.getX(k+j):k+j),v=ids.map(j=>new THREE.Vector3().fromBufferAttribute(p,j)),face=v[1]!.clone().sub(v[0]!).cross(v[2]!.clone().sub(v[0]!));if(face.lengthSq()<1e-20)continue;face.normalize();for(const j of ids)worst=Math.min(worst,new THREE.Vector3().fromBufferAttribute(n,j).dot(face))}
  }
  expect(worst).toBeGreaterThan(0);disposeTree(m.subject)
 })
 it('keeps the assembled wind channel clear through the cloth throat over63poses',()=>{
  const m=createBellowsModel();let minClothHit=Infinity
  for(let at=0;at<3;at++)for(let n=0;n<=20;n++){
   m.pose(at,n/20)
   for(const [y,z]of [[0,0],[.012,0],[-.012,0],[0,.05],[0,-.05]]){
    const ray=new THREE.Raycaster(new THREE.Vector3(-3,.23+y!,z!),new THREE.Vector3(1,0,0))
    const hits=ray.intersectObject(m.subject,true).filter(h=>h.object!==m.nozzle&&h.object.parent!==m.air)
    for(const h of hits)minClothHit=Math.min(minClothHit,h.point.x)
   }
  }
  expect(minClothHit).toBeGreaterThan(-1.0999);disposeTree(m.subject)
 })
 it('attaches all actual leather boundary vertices to both inner wooden planes through601poses',()=>{
  const m=createBellowsModel(),p=m.leather.geometry.getAttribute('position'),v=new THREE.Vector3();let seamError=0,minBottom=Infinity,maxTop=-Infinity,finite=true
  for(let k=0;k<=600;k++){
   const step=Math.min(2,Math.floor(k/201)),n=(k%201)/200;m.pose(step,n)
   for(let i=0;i<p.count;i++){
    v.fromBufferAttribute(p,i).applyMatrix4(m.leather.matrixWorld);finite&&=v.toArray().every(Number.isFinite)
    minBottom=Math.min(minBottom,v.y-.16)
    const local=m.joint.worldToLocal(v.clone());maxTop=Math.max(maxTop,local.y)
    const row=Math.floor(i/64)
    if(row===0)seamError=Math.max(seamError,Math.abs(v.y-.16))
    if(row===8)seamError=Math.max(seamError,Math.abs(local.y))
   }
  }
  expect(finite).toBe(true);expect(seamError).toBeLessThan(2e-7);expect(minBottom).toBeGreaterThan(-2e-7);expect(maxTop).toBeLessThan(2e-7);disposeTree(m.subject)
 })
 it('keeps the fixed leaf and annular nozzle still while the real handle rises and closes',()=>{
  const m=createBellowsModel(),home=m.lower.matrixWorld.clone(),nozzle=m.nozzle.matrixWorld.clone(),p=()=>m.handle.getWorldPosition(new THREE.Vector3()).y
  const y0=p();m.pose(0,1);const y1=p();m.pose(1,1);const y2=p();m.pose(2,1);const y3=p()
  expect(y1-y0).toBeGreaterThan(.65);expect(y1-y2).toBeGreaterThan(.65);expect(y3-y2).toBeGreaterThan(.2)
  expect(m.lower.matrixWorld.elements).toEqual(home.elements);expect(m.nozzle.matrixWorld.elements).toEqual(nozzle.elements)
  expect(new THREE.Box3().setFromObject(m.lower).min.y).toBeGreaterThanOrEqual(.01999);disposeTree(m.subject)
 })
 it('has a genuine unobstructed nozzle bore and closed consistently directed brass tube',()=>{
  const m=createBellowsModel(),p=m.nozzle.geometry.getAttribute('position'),idx=m.nozzle.geometry.index,edges=new Map<string,{count:number;balance:number}>();let minRadius=Infinity,volume=0
  const key=(v:THREE.Vector3)=>v.toArray().map(x=>Math.round(x*1e6)).join(',')
  for(let k=0;k<(idx?.count??p.count);k+=3){const vs=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,idx?idx.getX(k+j):k+j));volume+=vs[0]!.dot(vs[1]!.clone().cross(vs[2]!))/6;for(let j=0;j<3;j++){const a=key(vs[j]!),b=key(vs[(j+1)%3]!),e=a<b?a+'|'+b:b+'|'+a,r=edges.get(e)??{count:0,balance:0};r.count++;r.balance+=a<b?1:-1;edges.set(e,r)}}
  for(let i=0;i<p.count;i++)minRadius=Math.min(minRadius,Math.hypot(p.getY(i),p.getZ(i)))
  expect(minRadius).toBeGreaterThan(.0209);expect(volume).toBeGreaterThan(0);expect([...edges.values()].every(e=>e.count===2&&e.balance===0)).toBe(true)
  const ray=new THREE.Raycaster(new THREE.Vector3(-3,.23,0),new THREE.Vector3(1,0,0));expect(ray.intersectObject(m.nozzle,false)).toHaveLength(0);disposeTree(m.subject)
 })
 it('keeps every actual leather triangle finite, nondegenerate and with outward-facing finite normals',()=>{
  const m=createBellowsModel();let minArea=Infinity,worstNormal=1,finite=true
  for(let k=0;k<=120;k++){
   m.pose(k%3,k/120);const p=m.leather.geometry.getAttribute('position'),n=m.leather.geometry.getAttribute('normal'),idx=m.leather.geometry.index!
   for(let i=0;i<idx.count;i+=3){const ids=[0,1,2].map(j=>idx.getX(i+j)),v=ids.map(j=>new THREE.Vector3().fromBufferAttribute(p,j)),face=v[1]!.clone().sub(v[0]!).cross(v[2]!.clone().sub(v[0]!));minArea=Math.min(minArea,face.length());face.normalize();for(const j of ids){const normal=new THREE.Vector3().fromBufferAttribute(n,j);finite&&=normal.toArray().every(Number.isFinite);worstNormal=Math.min(worstNormal,normal.dot(face))}}
  }
  expect(finite).toBe(true);expect(minArea).toBeGreaterThan(1e-6);expect(worstNormal).toBeGreaterThan(0);disposeTree(m.subject)
 })
 it('shows illustrative air only while the wooden leaf compresses, and restores all exact endpoint vertices',()=>{
  const m=createBellowsModel(),snapshot=()=>{const rows:unknown[]=[];m.subject.traverse(o=>{rows.push([o.name,o.position.toArray(),o.quaternion.toArray(),o.scale.toArray(),o.visible,(o as THREE.Mesh).geometry?.attributes.position?.array.slice()])});return rows}
  for(let at=0;at<3;at++){m.pose(at,1);const reached=snapshot();m.pose(at+1,0);expect(snapshot()).toEqual(reached)}
  for(const at of[0,1,2,3]){m.pose(at,0);expect(m.air.visible).toBe(false)}
  m.pose(0,.5);expect(m.air.visible).toBe(false);m.pose(1,.5);expect(m.air.visible).toBe(true);m.pose(2,.5);expect(m.air.visible).toBe(false);disposeTree(m.subject)
 })
})
