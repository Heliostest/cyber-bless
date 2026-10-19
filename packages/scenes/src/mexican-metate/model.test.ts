import {describe,it,expect} from 'vitest'
import * as THREE from 'three'
import {createMetateModel} from './model'
import {disposeTree} from '../procedural-kit'

function actualSection(m:ReturnType<typeof createMetateModel>){
 const p=m.bed.geometry.getAttribute('position'),rows=new Map<number,number>()
 for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i))<1e-7)rows.set(p.getZ(i),Math.max(rows.get(p.getZ(i))??-Infinity,p.getY(i)))
 const list=[...rows].sort((a,b)=>a[0]-b[0])
 return {rows:list,height:(z:number)=>{for(let i=0;i<list.length-1;i++){const a=list[i]!,b=list[i+1]!;if(z>=a[0]-1e-8&&z<=b[0]+1e-8)return THREE.MathUtils.lerp(a[1],b[1],(z-a[0])/(b[0]-a[0]))}throw Error('out of bed '+z)}}
}
function toolSection(m:ReturnType<typeof createMetateModel>){const p=m.body.geometry.getAttribute('position'),seen=new Map<string,THREE.Vector3>();for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i);if(Math.hypot(v.y,v.z)<.1)continue;const key=[v.y,v.z].map(x=>Math.round(x*1e6)).join();if(!seen.has(key))seen.set(key,m.body.localToWorld(v.setX(0)))}return [...seen.values()].sort((a,b)=>Math.atan2(a.y-m.joint.position.y,a.z-m.joint.position.z)-Math.atan2(b.y-m.joint.position.y,b.z-m.joint.position.z))}
function lowerAt(poly:THREE.Vector3[],z:number){let lo=Infinity;for(let i=0;i<poly.length;i++){const a=poly[i]!,b=poly[(i+1)%poly.length]!;if(z<Math.min(a.z,b.z)-1e-10||z>Math.max(a.z,b.z)+1e-10)continue;if(Math.abs(a.z-b.z)<1e-10){lo=Math.min(lo,a.y,b.y);continue}lo=Math.min(lo,THREE.MathUtils.lerp(a.y,b.y,(z-a.z)/(b.z-a.z)))}return lo}
describe('actual stone bed, mano and material geometry',()=>{
 it('keeps every nondegenerate rendered triangle normal in its face hemisphere',()=>{
  const m=createMetateModel();let worst=1
  for(const mesh of[m.bed,...m.feet,m.body]){const p=mesh.geometry.getAttribute('position'),n=mesh.geometry.getAttribute('normal'),idx=mesh.geometry.index;for(let k=0;k<(idx?.count??p.count);k+=3){const ids=[0,1,2].map(j=>idx?idx.getX(k+j):k+j),v=ids.map(i=>new THREE.Vector3().fromBufferAttribute(p,i)),face=v[1]!.clone().sub(v[0]!).cross(v[2]!.clone().sub(v[0]!));if(face.lengthSq()<1e-20)continue;face.normalize();for(const i of ids)worst=Math.min(worst,new THREE.Vector3().fromBufferAttribute(n,i).dot(face))}}
  expect(worst).toBeGreaterThanOrEqual(-1e-6);disposeTree(m.subject)
 })
 it('has a closed shallow bed and three grounded feet as its only supports',()=>{
  const m=createMetateModel();expect(m.feet).toHaveLength(3)
  for(const mesh of[m.bed,...m.feet,m.body]){const p=mesh.geometry.getAttribute('position'),idx=mesh.geometry.index,edges=new Map<string,number>();for(let k=0;k<(idx?.count??p.count);k+=3){const v=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,idx?idx.getX(k+j):k+j));if(v[1]!.clone().sub(v[0]!).cross(v[2]!.clone().sub(v[0]!)).lengthSq()<1e-20)continue;for(let j=0;j<3;j++){const key=(q:THREE.Vector3)=>q.toArray().map(x=>Math.round(x*1e6)).join(),a=key(v[j]!),b=key(v[(j+1)%3]!),e=a<b?a+'|'+b:b+'|'+a;edges.set(e,(edges.get(e)??0)+1)}}expect([...edges.values()].every(n=>n===2),mesh.name).toBe(true)}
  for(const foot of m.feet){const p=foot.geometry.getAttribute('position');expect(Math.min(...Array.from({length:p.count},(_,i)=>p.getY(i)))).toBe(0)}
  const s=actualSection(m);expect(s.height(0)).toBeLessThan((s.height(-1.5)+s.height(1.5))/2);disposeTree(m.subject)
 })
 it('keeps the actual mano outside the actual bed over1803poses, with measured contact on both grinding passes',()=>{
  const m=createMetateModel(),s=actualSection(m);let min=Infinity,maxTouch=0
  for(let step=0;step<3;step++)for(let k=0;k<=600;k++){
   m.pose(step,k/600);const poly=toolSection(m),zs=[...poly.map(p=>p.z),...s.rows.map(r=>r[0])].filter(z=>z>=Math.min(...poly.map(p=>p.z))&&z<=Math.max(...poly.map(p=>p.z)))
   let gap=Infinity;for(const z of zs)gap=Math.min(gap,lowerAt(poly,z)-s.height(z));min=Math.min(min,gap);if(step<2)maxTouch=Math.max(maxTouch,gap)
  }
  expect(min).toBeGreaterThan(.0009997);expect(maxTouch).toBeLessThan(.0010003);disposeTree(m.subject)
 })
 it('keeps actual grain and powder vertices outside bed and mano during303material states',()=>{
  const m=createMetateModel(),s=actualSection(m),mat=new THREE.Matrix4(),p=new THREE.Vector3();let minBed=Infinity,minMano=Infinity,finite=true
  for(let step=0;step<3;step++)for(let k=0;k<=100;k++){
   m.pose(step,k/100);const poly=toolSection(m)
   for(const mesh of[m.grains,m.powder])for(let i=0;i<mesh.count;i++){
    mesh.getMatrixAt(i,mat);mat.premultiply(mesh.matrixWorld);const pos=mesh.geometry.getAttribute('position')
    for(let v=0;v<pos.count;v++){p.fromBufferAttribute(pos,v).applyMatrix4(mat);finite&&=Number.isFinite(p.x+p.y+p.z);minBed=Math.min(minBed,p.y-s.height(p.z));if(Math.abs(p.x)<1.075)minMano=Math.min(minMano,lowerAt(poly,p.z)-p.y)}
   }
  }
  expect(finite).toBe(true);expect(minBed).toBeGreaterThan(-1e-6);expect(minMano).toBeGreaterThan(-1e-6);disposeTree(m.subject)
 })
 it('restores exact endpoint transforms and material instance matrices',()=>{
  const m=createMetateModel(),snap=()=>[...m.joint.position.toArray(),...m.joint.quaternion.toArray(),...m.grains.instanceMatrix.array,...m.powder.instanceMatrix.array]
  for(let step=0;step<3;step++){m.pose(step,1);const end=snap();m.pose(step+1,0);expect(snap()).toEqual(end)}
  m.pose(0,0);const initial=snap();m.pose(0,-4);expect(snap()).toEqual(initial);m.pose(2,.5);expect(snap()).not.toEqual(initial);disposeTree(m.subject)
 })
})
