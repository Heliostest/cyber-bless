import {describe,it,expect} from 'vitest'
import * as THREE from 'three'
import {createWagasaModel} from './model'
import {disposeTree} from '../procedural-kit'
const point=(o:THREE.Object3D,p:THREE.Vector3)=>o.localToWorld(p.clone())
describe('Connected rigid bamboo and paper umbrella',()=>{
 it('keeps the shaft grounded and the real runner bore clear through all1803poses',()=>{
  const m=createWagasaModel();let ground=0,gap=Infinity,nonfinite=0,scale=0
  for(let step=0;step<3;step++)for(let k=0;k<=600;k++){
   m.pose(step,k/600);m.subject.updateMatrixWorld(true)
   ground=Math.max(ground,Math.abs(point(m.shaft,new THREE.Vector3(0,-1.4,0)).y),Math.abs(point(m.grip,new THREE.Vector3(0,-.375,0)).y))
   gap=Math.min(gap,m.runner.userData.boreRadius-m.shaft.userData.radius)
   m.subject.traverse(o=>{scale=Math.max(scale,o.scale.distanceTo(new THREE.Vector3(1,1,1)));if(!o.matrixWorld.elements.every(Number.isFinite))nonfinite++})
  }
  expect(ground).toBeLessThan(1e-12);expect(gap).toBeGreaterThan(.0049);expect(scale).toBe(0);expect(nonfinite).toBe(0);disposeTree(m.subject)
 })
 it('preserves rigid rib and stretcher lengths and their actual mesh endpoint joints',()=>{
  const m=createWagasaModel();let lengthError=0,jointError=0
  for(let step=0;step<3;step++)for(let k=0;k<=600;k++){
   m.pose(step,k/600);m.subject.updateMatrixWorld(true)
   for(let i=0;i<24;i++){
    const rib=m.ribs[i]!,strut=m.stretchers[i]!,a=point(rib,new THREE.Vector3(0,-.7,0)),b=point(rib,new THREE.Vector3(0,.7,0)),c=point(strut,new THREE.Vector3(0,-.425,0)),d=point(strut,new THREE.Vector3(0,.425,0))
    lengthError=Math.max(lengthError,Math.abs(a.distanceTo(b)-1.4),Math.abs(c.distanceTo(d)-.85))
    const origin=point(m.spin,new THREE.Vector3(0,2.8,0)),joint=a.clone().lerp(b,.48),runner=point(m.runner,new THREE.Vector3(.095*Math.cos(i*2*Math.PI/24),0,.095*Math.sin(i*2*Math.PI/24)))
    jointError=Math.max(jointError,a.distanceTo(origin),d.distanceTo(joint),c.distanceTo(runner))
   }
  }
  expect(lengthError).toBeLessThan(1e-12);expect(jointError).toBeLessThan(1e-12);disposeTree(m.subject)
 })
 it('folds nondegenerate paper triangles without stretching any of their three edges',()=>{
  const m=createWagasaModel();m.pose(1,0);const reference=Array.from(m.paper.geometry.attributes.position!.array),edges:number[]=[];let error=0,minArea=Infinity,minY=Infinity
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3()
  for(let i=0;i<reference.length;i+=9){a.fromArray(reference,i);b.fromArray(reference,i+3);c.fromArray(reference,i+6);edges.push(a.distanceTo(b),b.distanceTo(c),c.distanceTo(a))}
  for(let step=0;step<3;step++)for(let k=0;k<=600;k++){
   m.pose(step,k/600);const p=m.paper.geometry.attributes.position!.array
   for(let i=0,j=0;i<p.length;i+=9){a.fromArray(p,i);b.fromArray(p,i+3);c.fromArray(p,i+6);for(const e of[a.distanceTo(b),b.distanceTo(c),c.distanceTo(a)])error=Math.max(error,Math.abs(e-edges[j++]!));minArea=Math.min(minArea,b.clone().sub(a).cross(c.clone().sub(a)).length());minY=Math.min(minY,a.y,b.y,c.y)}
  }
  expect(error).toBeLessThan(6e-7);expect(minArea).toBeGreaterThan(.23);expect(minY).toBeGreaterThan(1.4);disposeTree(m.subject)
 })
 it('opens by raising the ring, rotates the whole canopy and closes with the new azimuth retained',()=>{
  const m=createWagasaModel();const initial=m.runner.position.y;m.pose(0,1);const opened=m.runner.position.y;expect(opened-initial).toBeGreaterThan(.6);m.pose(1,1);expect(m.spin.rotation.y).toBeCloseTo(Math.PI/4,12);m.pose(2,1);expect(m.runner.position.y).toBeCloseTo(initial,12);expect(m.spin.rotation.y).toBeCloseTo(Math.PI/4,12);disposeTree(m.subject)
 })
 it('reuses all geometry and exactly restores persistent checkpoint vertices and transforms',()=>{
  const m=createWagasaModel(),refs=new Map<THREE.Object3D,THREE.BufferGeometry>();m.subject.traverse(o=>{if((o as THREE.Mesh).geometry)refs.set(o,(o as THREE.Mesh).geometry)})
  for(let step=0;step<3;step++){m.pose(step,1);m.subject.updateMatrixWorld(true);const old=Array.from(m.paper.geometry.attributes.position!.array),matrices: number[][]=[];m.subject.traverse(o=>matrices.push([...o.matrixWorld.elements]));m.pose(0,.237);m.pose(step+1,0);m.subject.updateMatrixWorld(true);expect(Array.from(m.paper.geometry.attributes.position!.array)).toEqual(old);let i=0;m.subject.traverse(o=>expect(o.matrixWorld.elements).toEqual(matrices[i++]));}
  refs.forEach((g,o)=>expect((o as THREE.Mesh).geometry).toBe(g));disposeTree(m.subject)
 })
 it('uses52 closed structural solids with outward volume and no unpaired welded edges',()=>{
  const m=createWagasaModel(),solids:THREE.Mesh[]=[];m.subject.traverse(o=>{const mesh=o as THREE.Mesh;if(mesh.isMesh&&mesh!==m.paper)solids.push(mesh)});expect(solids).toHaveLength(52)
  for(const mesh of solids){const g=mesh.geometry,p=g.attributes.position!,idx=g.index,edges=new Map<string,number>();let volume=0,minArea=Infinity;const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();const key=(v:THREE.Vector3)=>[v.x,v.y,v.z].map(x=>Math.round(x*1e6)).join(',')
   for(let i=0;i<(idx?.count??p.count);i+=3){a.fromBufferAttribute(p,idx?idx.getX(i):i);b.fromBufferAttribute(p,idx?idx.getX(i+1):i+1);c.fromBufferAttribute(p,idx?idx.getX(i+2):i+2);volume+=a.dot(b.clone().cross(c))/6;minArea=Math.min(minArea,b.clone().sub(a).cross(c.clone().sub(a)).length());for(const[x,y]of[[a,b],[b,c],[c,a]]){const u=key(x!),v=key(y!),k=u<v?u+'|'+v:v+'|'+u;edges.set(k,(edges.get(k)??0)+1)}}
   expect(volume,mesh.name).toBeGreaterThan(0);expect(minArea,mesh.name).toBeGreaterThan(1e-10);expect([...edges.values()].every(n=>n===2),mesh.name).toBe(true)
  }disposeTree(m.subject)
 })
})

it('keeps the actual folded paper and neighboring bamboo faces from crossing outside their hub',()=>{
 const m=createWagasaModel(),v=()=>new THREE.Vector3()
 const triangles=(o:THREE.Mesh)=>{const p=o.geometry.attributes.position!,idx=o.geometry.index,ts:THREE.Vector3[][]=[];for(let i=0;i<(idx?.count??p.count);i+=3)ts.push([0,1,2].map(k=>v().fromBufferAttribute(p,idx?idx.getX(i+k):i+k).applyMatrix4(o.matrixWorld)));return ts}
 const crosses=(first:THREE.Vector3[][],second:THREE.Vector3[][])=>{let found=0;for(const a of first)for(const b of second)for(const[s,t]of[[a,b],[b,a]])for(let k=0;k<3;k++){
  const start=s![k]!,end=s![(k+1)%3]!,length=start.distanceTo(end),ray=new THREE.Ray(start,end.clone().sub(start).normalize()),hit=ray.intersectTriangle(t![0]!,t![1]!,t![2]!,false,v());if(!hit)continue
  const along=hit.distanceTo(start);if(along<1e-7||along>length-1e-7)continue
  // Real top hub intentionally encloses the root joints; no exemptions below its actual lower face.
  const hubMin=2.82-Number((m.hub.geometry as THREE.CylinderGeometry).parameters.height)/2
  if(hit.y<hubMin-1e-7||hit.y>2.82+Number((m.hub.geometry as THREE.CylinderGeometry).parameters.height)/2+1e-7||Math.hypot(hit.x,hit.z)>.1189)found++
 }return found}
 let ribCrossings=0,paperCrossings=0
 for(const t of[0,.1,.2,.3,.4,.5,.6,.7,.8,.9,1]){
  m.pose(0,t);const paper=triangles(m.paper)
  for(let i=0;i<24;i++){
   const rib=triangles(m.ribs[i]!),strut=triangles(m.stretchers[i]!),near=paper.slice(i*2,i*2+2).concat(paper.slice(((i+23)%24)*2,((i+23)%24)*2+2))
   ribCrossings+=crosses(rib,triangles(m.ribs[(i+1)%24]!));paperCrossings+=crosses(near,rib)+crosses(near,strut)
  }
 }
 expect(ribCrossings,'actual neighboring rib triangle crossings outside hub').toBe(0);expect(paperCrossings,'actual paper triangle crossings with bamboo').toBe(0);disposeTree(m.subject)
})
