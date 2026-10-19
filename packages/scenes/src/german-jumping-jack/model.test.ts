import {describe,it,expect} from 'vitest'
import * as THREE from 'three'
import {disposeTree} from '../procedural-kit'
import {createJumpingJackModel} from './model'

describe('original cord-linked wooden jumping jack',()=>{
 it('uses four real rigid jointed limbs, five cords and the actual wooden bead target',()=>{
  const m=createJumpingJackModel();expect(m.subject.name).toBe('jack-subject');expect(m.limbs).toHaveLength(4);expect(m.pivots).toHaveLength(4);expect(m.ropes).toHaveLength(5);expect(m.targets).toEqual([m.handle,m.handle,m.handle]);expect(m.roots).toEqual(m.targets);expect(m.handle.name).toBe('jack-handle');expect(m.subject.getObjectByName('table')).toBeUndefined();expect(m.subject.getObjectByName('board')).toBeUndefined();disposeTree(m.subject)
 })
 it('keeps every actual mesh vertex above ground through1803coupled poses',()=>{
  const m=createJumpingJackModel(),v=new THREE.Vector3();let minimum=Infinity
  for(let at=0;at<3;at++)for(let k=0;k<=600;k++){m.pose(at,k/600);m.subject.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.geometry)return;const p=mesh.geometry.getAttribute('position');for(let j=0;j<p.count;j++){v.fromBufferAttribute(p,j).applyMatrix4(mesh.matrixWorld);minimum=Math.min(minimum,v.y)}})}
  expect(minimum).toBeGreaterThanOrEqual(0);disposeTree(m.subject)
 })
 it('conserves all five real mesh cord lengths and joins both limb pairs to the same moving pull cord',()=>{
  const m=createJumpingJackModel();let maxLengthError=0,maxEndpointError=0,maxJoinError=0
  for(let at=0;at<3;at++)for(let k=0;k<=600;k++){m.pose(at,k/600);for(let i=0;i<5;i++){const r=m.ropes[i]!,p=r.geometry.getAttribute('position');let lo=Infinity,hi=-Infinity;for(let j=0;j<p.count;j++){lo=Math.min(lo,p.getY(j));hi=Math.max(hi,p.getY(j))}const a=r.localToWorld(new THREE.Vector3(0,lo,0)),b=r.localToWorld(new THREE.Vector3(0,hi,0)),ends=m.cordEndpoints[i]!;maxLengthError=Math.max(maxLengthError,Math.abs(a.distanceTo(b)-m.cordLengths[i]!));maxEndpointError=Math.max(maxEndpointError,a.distanceTo(ends[0]),b.distanceTo(ends[1]))}const mid=m.cordEndpoints[4]!,leg=m.knots[1]!.getWorldPosition(new THREE.Vector3()),d=mid[1].clone().sub(mid[0]);maxJoinError=Math.max(maxJoinError,leg.clone().sub(mid[0]).cross(d).length()/d.length());expect(leg.y).toBeGreaterThan(mid[0].y);expect(leg.y).toBeLessThan(mid[1].y)}
  expect(maxLengthError).toBeLessThan(3e-7);expect(maxEndpointError).toBeLessThan(3e-7);expect(maxJoinError).toBeLessThan(1e-9);disposeTree(m.subject)
 })
 it('keeps real pivot centres, fixed body and all local geometry rigid while all four limbs articulate',()=>{
  const m=createJumpingJackModel(),fixed=m.fixed.children.map(o=>o.matrixWorld.toArray()),centres=m.pivots.map(o=>o.getWorldPosition(new THREE.Vector3())),geometry=new Map<THREE.BufferGeometry,number[]>();m.subject.traverse(o=>{const g=(o as THREE.Mesh).geometry;if(g)geometry.set(g,Array.from(g.attributes.position!.array))})
  for(let k=0;k<=200;k++){m.pose(2,k/200);expect(m.fixed.children.map(o=>o.matrixWorld.toArray())).toEqual(fixed);m.pivots.forEach((p,i)=>expect(p.getWorldPosition(new THREE.Vector3()).distanceTo(centres[i]!)).toBeLessThan(1e-10))}
  m.pose(2,.6);expect(m.pivots.every(p=>Math.abs(p.rotation.z)>1.3)).toBe(true);m.subject.traverse(o=>{const g=(o as THREE.Mesh).geometry;if(g)expect(Array.from(g.attributes.position!.array)).toEqual(geometry.get(g))});disposeTree(m.subject)
 })
 it('continues a smooth release from each held reach and returns exactly to the common resting checkpoint',()=>{
  const m=createJumpingJackModel(),rest=m.subject.children.flatMap(o=>o.matrixWorld.toArray());for(let at=0;at<3;at++){m.pose(at,.6);const held=m.pivots[1]!.rotation.z,drop=.55-m.handle.position.y;expect(held).toBeGreaterThan(.7);expect(drop).toBeGreaterThan(.1);m.pose(at,.72);expect(m.pivots[1]!.rotation.z).toBeGreaterThan(0);expect(m.pivots[1]!.rotation.z).toBeLessThan(held);m.pose(at,1);expect(m.subject.children.flatMap(o=>o.matrixWorld.toArray())).toEqual(rest);m.pose(at+1,0);expect(m.subject.children.flatMap(o=>o.matrixWorld.toArray())).toEqual(rest)}disposeTree(m.subject)
 })
 it('keeps cords behind plates and the hanging bead clear of both feet throughout the motion',()=>{
  const m=createJumpingJackModel();let gap=Infinity;for(let at=0;at<3;at++)for(let k=0;k<=200;k++){m.pose(at,k/200);const handle=new THREE.Box3().setFromObject(m.handle);for(const limb of m.limbs.slice(2)){const box=new THREE.Box3().setFromObject(limb);gap=Math.min(gap,box.min.y-handle.max.y)}for(const ends of m.cordEndpoints)expect(ends.every(p=>Math.abs(p.z+.2)<1e-10)).toBe(true)}expect(gap).toBeGreaterThan(.25);disposeTree(m.subject)
 })
 it('uses closed positive-volume meshes with finite outward normals and no degenerate triangles',()=>{
  const m=createJumpingJackModel();let count=0;m.subject.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.geometry)return;count++;const g=mesh.geometry,p=g.getAttribute('position'),n=g.getAttribute('normal'),idx=g.index,edges=new Map<string,{n:number,b:number}>();let volume=0,minArea=Infinity,minDot=1;const key=(v:THREE.Vector3)=>v.toArray().map(x=>(Math.abs(x)<.0000005?0:x).toFixed(6)).join(',')
   for(let i=0;i<(idx?.count??p.count);i+=3){const ids=[0,1,2].map(j=>idx?idx.getX(i+j):i+j),v=ids.map(j=>new THREE.Vector3().fromBufferAttribute(p,j)),normal=v[1]!.clone().sub(v[0]!).cross(v[2]!.clone().sub(v[0]!));minArea=Math.min(minArea,normal.length());volume+=v[0]!.dot(v[1]!.clone().cross(v[2]!))/6;normal.normalize();for(let j=0;j<3;j++){const nv=new THREE.Vector3().fromBufferAttribute(n,ids[j]!);expect(nv.toArray().every(Number.isFinite)).toBe(true);minDot=Math.min(minDot,normal.dot(nv));const a=key(v[j]!),b=key(v[(j+1)%3]!),k=a<b?a+'|'+b:b+'|'+a,e=edges.get(k)??{n:0,b:0};e.n++;e.b+=a<b?1:-1;edges.set(k,e)}}
   expect(volume,mesh.name).toBeGreaterThan(0);expect(minArea,mesh.name).toBeGreaterThan(1e-9);expect(minDot,mesh.name).toBeGreaterThan(0);expect([...edges.values()].every(e=>e.n===2&&e.b===0),mesh.name).toBe(true)
  });expect(count).toBeGreaterThan(20);disposeTree(m.subject)
 })
 it('disposes all owned geometry and materials once without external textures',()=>{
  const m=createJumpingJackModel(),resources=new Set<THREE.BufferGeometry|THREE.Material>();m.subject.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.geometry)return;resources.add(mesh.geometry);resources.add(mesh.material as THREE.Material);expect((mesh.material as THREE.MeshStandardMaterial).map).toBeNull()});const freed=new Map<unknown,number>();resources.forEach(r=>r.addEventListener('dispose',()=>freed.set(r,(freed.get(r)??0)+1)));disposeTree(m.subject);expect(freed.size).toBe(resources.size);expect([...freed.values()].every(x=>x===1)).toBe(true)
 })
 it('keeps non-joint limb solids disjoint through all1803poses including the lever ends',()=>{
  const m=createJumpingJackModel(),cross=(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)
  const hull=(points:THREE.Vector3[])=>{const p=[...new Map(points.map(p=>[p.x+','+p.y,p])).values()].sort((a,b)=>a.x-b.x||a.y-b.y),lo:THREE.Vector3[]=[],hi:THREE.Vector3[]=[];for(const v of p){while(lo.length>=2&&cross(lo.at(-2)!,lo.at(-1)!,v)<=0)lo.pop();lo.push(v)}for(const v of [...p].reverse()){while(hi.length>=2&&cross(hi.at(-2)!,hi.at(-1)!,v)<=0)hi.pop();hi.push(v)}return lo.slice(0,-1).concat(hi.slice(0,-1))}
  const shapes=m.limbs.map(l=>hull(Array.from({length:l.geometry.attributes.position!.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(l.geometry.attributes.position!,i))))
  const overlap=(a:THREE.Vector3[],b:THREE.Vector3[])=>{for(const p of [a,b])for(let i=0;i<p.length;i++){const s=p[i]!,e=p[(i+1)%p.length]!,axis=new THREE.Vector2(s.y-e.y,e.x-s.x).normalize(),da=a.map(v=>v.x*axis.x+v.y*axis.y),db=b.map(v=>v.x*axis.x+v.y*axis.y);if(Math.min(Math.max(...da),Math.max(...db))-Math.max(Math.min(...da),Math.min(...db))<1e-7)return false}return true}
  const collisions:{at:number,n:number,pair:number[]}[]=[]
  for(let at=0;at<3;at++)for(let k=0;k<=600;k++){m.pose(at,k/600);const p=shapes.map((h,i)=>h.map(v=>v.clone().applyMatrix4(m.limbs[i]!.matrixWorld))),boxes=m.limbs.map(l=>new THREE.Box3().setFromObject(l));for(let a=0;a<4;a++)for(let b=a+1;b<4;b++){const z=Math.min(boxes[a]!.max.z,boxes[b]!.max.z)-Math.max(boxes[a]!.min.z,boxes[b]!.min.z);if(z>1e-7&&overlap(p[a]!,p[b]!)&&collisions.length<12)collisions.push({at,n:k/600,pair:[a,b]})}}
  expect(collisions).toEqual([]);disposeTree(m.subject)
 })
})
