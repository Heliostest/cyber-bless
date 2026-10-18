import {describe,it,expect} from 'vitest'
import * as THREE from 'three'
import {disposeTree} from '../procedural-kit'
import {createPetanqueModel} from './model'

describe('pétanque actual geometry and assisted paths',()=>{
 it('keeps every procedural earth channel within the soft sand range without byte overflow',()=>{
  const m=createPetanqueModel(),pixels=m.court.material.map!.image.data as Uint8Array
  for(let i=0;i<pixels.length;i+=4){expect(pixels[i]).toBeGreaterThanOrEqual(201);expect(pixels[i]).toBeLessThanOrEqual(231);expect(pixels[i+1]).toBe(pixels[i]);expect(pixels[i+2]).toBe(pixels[i]);expect(pixels[i+3]).toBe(255)}m.court.material.map!.dispose();disposeTree(m.subject)
 })
 it('uses three distinct actual bodies and a flat earth surface without extra furniture',()=>{
  const m=createPetanqueModel();expect(m.subject.name).toBe('petanque-subject');expect(m.targets.map(o=>o.name)).toEqual(['petanque-jack','petanque-boule-0','petanque-boule-1']);expect(new Set(m.roots).size).toBe(3);expect(m.bodies.map(b=>b.radius)).toEqual([.13,.32,.32]);expect(m.court.material.roughness).toBeGreaterThan(.8);expect(m.boules[0]!.material.metalness).toBeGreaterThan(.3);disposeTree(m.subject)
 })
 it('keeps every actual body vertex above the earth in1803 poses, with separated sphere envelopes',()=>{
  const m=createPetanqueModel(),p=new THREE.Vector3();let minimum=Infinity,minGap=Infinity
  for(let at=0;at<3;at++)for(let k=0;k<=600;k++){
   m.pose(at,k/600);m.subject.updateMatrixWorld(true)
   for(const b of m.bodies){const vertices=b.mesh.geometry.getAttribute('position');for(let i=0;i<vertices.count;i++){p.fromBufferAttribute(vertices,i).applyMatrix4(b.mesh.matrixWorld);minimum=Math.min(minimum,p.y-m.groundHeight)}}
   for(let a=0;a<3;a++)for(let b=a+1;b<3;b++)minGap=Math.min(minGap,m.roots[a]!.position.distanceTo(m.roots[b]!.position)-m.bodies[a]!.radius-m.bodies[b]!.radius)
  }
  expect(minimum).toBeGreaterThan(.00099);expect(minGap).toBeGreaterThan(.025);disposeTree(m.subject)
 })
 it('lands each low arc and uses actual rotated mesh support for the remaining ground roll',()=>{
  const m=createPetanqueModel(),p=new THREE.Vector3()
  for(let at=0;at<3;at++)for(const n of [0,.1,.3,.5,.7,.9,1]){m.pose(at,n);m.subject.updateMatrixWorld(true);let low=Infinity;const b=m.bodies[at]!,vs=b.mesh.geometry.getAttribute('position');for(let i=0;i<vs.count;i++)low=Math.min(low,p.fromBufferAttribute(vs,i).applyMatrix4(b.mesh.matrixWorld).y-m.groundHeight);if(n===.1)expect(low).toBeGreaterThan(.1);if(n===0||n>=.3)expect(low).toBeCloseTo(.001,6)}disposeTree(m.subject)
 })
 it('has closed positive-volume nondegenerate spheres with outward finite normals and incised steel bands',()=>{
  const m=createPetanqueModel()
  for(const b of m.bodies){const g=b.mesh.geometry,p=g.getAttribute('position'),n=g.getAttribute('normal'),idx=g.index!,edges=new Map<string,{count:number,balance:number}>();let volume=0,minDot=1,minArea=Infinity;const key=(v:THREE.Vector3)=>v.toArray().map(x=>(Math.abs(x)<.0000005?0:x).toFixed(6)).join(',')
   for(let i=0;i<idx.count;i+=3){const ids=[0,1,2].map(j=>idx.getX(i+j)),v=ids.map(j=>new THREE.Vector3().fromBufferAttribute(p,j)),f=v[1]!.clone().sub(v[0]!).cross(v[2]!.clone().sub(v[0]!));minArea=Math.min(minArea,f.length());volume+=v[0]!.dot(v[1]!.clone().cross(v[2]!))/6;f.normalize();for(let j=0;j<3;j++){const normal=new THREE.Vector3().fromBufferAttribute(n,ids[j]!);expect(normal.toArray().every(Number.isFinite)).toBe(true);minDot=Math.min(minDot,normal.dot(f));const a=key(v[j]!),c=key(v[(j+1)%3]!),e=a<c?a+'|'+c:c+'|'+a,r=edges.get(e)??{count:0,balance:0};r.count++;r.balance+=a<c?1:-1;edges.set(e,r)}}
   expect(volume).toBeGreaterThan(0);expect(minArea).toBeGreaterThan(1e-7);expect(minDot).toBeGreaterThan(.3);expect([...edges.values()].every(e=>e.count===2&&e.balance===0)).toBe(true)
   if(b.radius>.2){let min=Infinity,max=0;for(let i=0;i<p.count;i++){const r=new THREE.Vector3().fromBufferAttribute(p,i).length();min=Math.min(min,r);max=Math.max(max,r)}expect(max-min).toBeGreaterThan(.006);expect(p.count).toBeGreaterThan(1000)}
  }disposeTree(m.subject)
 })
 it('restores exact checkpoint transforms, vertices and surface after every throw',()=>{
  const m=createPetanqueModel(),snapshot=()=>{const rows:unknown[]=[];m.subject.traverse(o=>rows.push([o.name,o.position.toArray(),o.quaternion.toArray(),o.scale.toArray(),o.visible,(o as THREE.Mesh).geometry?.attributes.position?.array.slice()]));return rows}
  for(let at=0;at<3;at++){m.pose(at,1);const reached=snapshot();m.pose(at+1,0);expect(snapshot()).toEqual(reached)}disposeTree(m.subject)
 })
 it('rolls grooved spheres around a horizontal perpendicular axis while settled bodies remain fixed',()=>{
  const m=createPetanqueModel();m.pose(1,0);const jack=m.roots[0]!.matrix.clone(),start=m.roots[1]!.quaternion.clone();m.pose(1,.6);expect(m.roots[1]!.quaternion.angleTo(start)).toBeGreaterThan(.1);m.roots[0]!.updateMatrix();expect(m.roots[0]!.matrix.elements).toEqual(jack.elements);expect(m.roots[1]!.quaternion.y).toBe(0);disposeTree(m.subject)
 })
})
