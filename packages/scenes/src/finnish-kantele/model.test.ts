import {describe,it,expect} from 'vitest'
import * as THREE from 'three'
import {disposeTree} from '../procedural-kit'
import {createKanteleModel} from './model'

describe('original five-string kantele geometry',()=>{
 it('uses five actual closed steel strings and three distinct physical targets without a stand',()=>{
  const m=createKanteleModel();expect(m.subject.name).toBe('kantele-subject');expect(m.wires).toHaveLength(5);expect(m.targets.map(o=>o.name)).toEqual(['kantele-string-0','kantele-string-2','kantele-string-4']);expect(m.roots).toEqual(m.targets);expect(m.pegs).toHaveLength(5);expect(m.wires[0]!.material.metalness).toBeGreaterThan(.6);expect(m.top.material.roughness).toBeGreaterThan(.7);expect(m.subject.getObjectByName('table')).toBeUndefined();disposeTree(m.subject)
 })
 it('keeps all actual vertices above ground and strings clear of the body and each other through1803poses',()=>{
  const m=createKanteleModel(),p=new THREE.Vector3();let low=Infinity,minGap=Infinity
  for(let at=0;at<3;at++)for(let n=0;n<=600;n++){m.pose(at,n/600);for(const wire of m.wires){const a=wire.geometry.getAttribute('position');for(let i=0;i<a.count;i++){p.fromBufferAttribute(a,i).applyMatrix4(wire.matrixWorld);low=Math.min(low,p.y)}}for(let i=0;i<4;i++){const a=m.wires[i]!,b=m.wires[i+1]!,pa=a.geometry.getAttribute('position'),pb=b.geometry.getAttribute('position');let za=-Infinity,zb=Infinity;for(let k=0;k<pa.count;k++)za=Math.max(za,pa.getZ(k)+a.position.z);for(let k=0;k<pb.count;k++)zb=Math.min(zb,pb.getZ(k)+b.position.z);minGap=Math.min(minGap,zb-za)}}
  expect(low).toBeGreaterThan(.45);expect(minGap).toBeGreaterThan(.075);disposeTree(m.subject)
 })
 it('fixes both actual endpoint rings and all wood, pegs and transverse anchor parts',()=>{
  const m=createKanteleModel(),fixed=m.fixed.children.map(o=>o.matrixWorld.toArray()),ends=m.wires.map(w=>{const p=w.geometry.getAttribute('position');return [0,32*8].flatMap(start=>Array.from({length:8},(_,i)=>[p.getX(start+i),p.getY(start+i),p.getZ(start+i)]))})
  for(let at=0;at<3;at++)for(let k=0;k<=200;k++){m.pose(at,k/200);expect(m.fixed.children.map(o=>o.matrixWorld.toArray())).toEqual(fixed);for(let j=0;j<5;j++){const p=m.wires[j]!.geometry.getAttribute('position');expect([0,32*8].flatMap(start=>Array.from({length:8},(_,i)=>[p.getX(start+i),p.getY(start+i),p.getZ(start+i)]))).toEqual(ends[j])}}disposeTree(m.subject)
 })
 it('changes only the selected string, releases through both sides and restores exact neutral geometry',()=>{
  const m=createKanteleModel(),neutral=m.wires.map(w=>Array.from(w.geometry.attributes.position!.array));for(let at=0;at<3;at++){m.pose(at,.6);for(let i=0;i<5;i++)if(i!==at*2)expect(Array.from(m.wires[i]!.geometry.attributes.position!.array)).toEqual(neutral[i]);const selected=m.wires[at*2]!,z=()=>selected.geometry.getAttribute('position').getZ(16*8+2)-m.radius;const held=z();expect(Math.abs(held)).toBeGreaterThan(.119);m.pose(at,.68);expect(z()*held).toBeLessThan(0);m.pose(at,1);expect(m.wires.map(w=>Array.from(w.geometry.attributes.position!.array))).toEqual(neutral);m.pose(at+1,0);expect(m.wires.map(w=>Array.from(w.geometry.attributes.position!.array))).toEqual(neutral)}disposeTree(m.subject)
 })
 it('uses closed positive-volume meshes with finite outward normals and nondegenerate faces',()=>{
  const m=createKanteleModel();let meshes=0
  for(const amount of [0,.6,.68,.9,1]){m.pose(1,amount);m.subject.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.geometry)return;meshes++;const g=mesh.geometry,p=g.getAttribute('position'),n=g.getAttribute('normal'),idx=g.index,edges=new Map<string,{count:number,balance:number}>();let volume=0,minArea=Infinity,minDot=1;const key=(v:THREE.Vector3)=>v.toArray().map(x=>(Math.abs(x)<.0000005?0:x).toFixed(6)).join(',');const count=idx?.count??p.count
   for(let i=0;i<count;i+=3){const ids=[0,1,2].map(j=>idx?idx.getX(i+j):i+j),v=ids.map(j=>new THREE.Vector3().fromBufferAttribute(p,j)),f=v[1]!.clone().sub(v[0]!).cross(v[2]!.clone().sub(v[0]!));minArea=Math.min(minArea,f.length());volume+=v[0]!.dot(v[1]!.clone().cross(v[2]!))/6;f.normalize();for(let j=0;j<3;j++){const normal=new THREE.Vector3().fromBufferAttribute(n,ids[j]!);expect(normal.toArray().every(Number.isFinite)).toBe(true);minDot=Math.min(minDot,f.dot(normal));const a=key(v[j]!),b=key(v[(j+1)%3]!),e=a<b?a+'|'+b:b+'|'+a,r=edges.get(e)??{count:0,balance:0};r.count++;r.balance+=a<b?1:-1;edges.set(e,r)}}
   expect(volume,mesh.name).toBeGreaterThan(0);expect(minArea,mesh.name).toBeGreaterThan(1e-9);expect(minDot,mesh.name).toBeGreaterThan(0);expect([...edges.values()].every(e=>e.count===2&&e.balance===0),mesh.name).toBe(true)
  })}expect(meshes/5).toBe(20);disposeTree(m.subject)
 })
 it('has an actual circular sound opening over an open underside and a grounded rim',()=>{
  const m=createKanteleModel(),ray=new THREE.Raycaster(new THREE.Vector3(.20,2,.635),new THREE.Vector3(0,-1,0));expect(ray.intersectObjects([m.top,m.rim],false)).toHaveLength(0);const p=m.rim.geometry.getAttribute('position');let low=Infinity;for(let i=0;i<p.count;i++)low=Math.min(low,p.getY(i)+m.rim.position.y);expect(low).toBe(0);disposeTree(m.subject)
 })
 it('keeps material vertex shades bounded and disposes every owned resource once',()=>{
  const m=createKanteleModel(),resources=new Set<THREE.BufferGeometry|THREE.Material>();m.subject.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.geometry)return;resources.add(mesh.geometry);resources.add(mesh.material as THREE.Material);const c=mesh.geometry.getAttribute('color');if(c)for(let i=0;i<c.count;i++)expect(c.getX(i)).toBeGreaterThan(.85)});const freed=new Map<unknown,number>();resources.forEach(r=>r.addEventListener('dispose',()=>freed.set(r,(freed.get(r)??0)+1)));disposeTree(m.subject);expect(freed.size).toBe(resources.size);expect([...freed.values()].every(x=>x===1)).toBe(true)
 })
 it('seats the complete wire endpoint rings inside the wooden pegs and transverse anchor instead of tangency',()=>{
  const m=createKanteleModel();let pegExtent=0,barExtent=0;for(let i=0;i<5;i++){const w=m.wires[i]!,p=w.geometry.getAttribute('position'),peg=m.pegs[i]!;for(let j=0;j<8;j++){pegExtent=Math.max(pegExtent,Math.hypot(p.getX(j)-peg.position.x,p.getZ(j)));barExtent=Math.max(barExtent,Math.hypot(p.getX(32*8+j)-m.bar.position.x,p.getY(32*8+j)))}}expect(pegExtent).toBeLessThan(.074);expect(barExtent).toBeLessThan(.044);disposeTree(m.subject)
 })
 it('shows the actual sound opening from the production camera without a string obscuring its centre',()=>{
  const m=createKanteleModel(),shape=(m.top.geometry as THREE.ExtrudeGeometry).parameters.shapes as THREE.Shape,hole=shape.holes[0]!,centre=new THREE.Box2().setFromPoints(hole.getPoints(64)).getCenter(new THREE.Vector2()),p=m.top.geometry.getAttribute('position');let high=-Infinity;for(let i=0;i<p.count;i++)high=Math.max(high,p.getY(i));const target=m.top.localToWorld(new THREE.Vector3(centre.x,high,-centre.y)),origin=new THREE.Vector3(2.3,5,5.8).normalize().multiplyScalar(10).add(new THREE.Vector3(0,.28,0)),ray=new THREE.Raycaster(origin,target.clone().sub(origin).normalize(),0,origin.distanceTo(target)-.0001);expect(ray.intersectObjects(m.subject.children,true).map(h=>h.object.name)).toEqual([]);disposeTree(m.subject)
 })
})
