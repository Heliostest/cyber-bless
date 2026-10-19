import {describe,it,expect} from 'vitest'
import * as THREE from 'three'
import {createGuiroModel} from './model'
import {disposeTree} from '../procedural-kit'

describe('hollow calabash and contacting wooden scraper',()=>{
 it('renders the carved shell in one material pass with vertex colors',()=>{
  const m=createGuiroModel();expect(Array.isArray(m.body.material)).toBe(false)
  expect((m.body.material as THREE.MeshStandardMaterial).vertexColors).toBe(true);expect(m.body.geometry.groups).toHaveLength(0)
  expect(m.body.geometry.attributes.color!.count).toBe(m.body.geometry.attributes.position!.count);disposeTree(m.subject)
 })
 it('has an open mouth, solid bottom and real interior with safe thickness',()=>{
  const m=createGuiroModel();expect(m.outerPoints).toHaveLength(601);expect(m.profile.length).toBeGreaterThan(900)
  m.subject.updateMatrixWorld(true)
  const ray=new THREE.Raycaster(new THREE.Vector3(-.65,4,0),new THREE.Vector3(0,-1,0))
  const hit=ray.intersectObject(m.body,false)[0]!
  expect(hit.point.y).toBeCloseTo(.30,5)
  expect(m.radiusAt(3.2)).toBeCloseTo(.28,8)
  for(let i=180;i<450;i++){const p=m.outerPoints[i]!;expect(p.x-m.innerRadiusAt(p.y)).toBeGreaterThan(.030)}
  disposeTree(m.subject)
 })
 it('carves actual alternating recesses in the mesh rather than a painted stripe',()=>{
  const m=createGuiroModel();let recess=0,crest=0
  for(const p of m.outerPoints){if(p.y<.75||p.y>2.45)continue;const d=m.baseRadiusAt(p.y)-p.x;recess=Math.max(recess,d);if(d<.001)crest++}
  expect(recess).toBeGreaterThan(.033);expect(recess).toBeLessThanOrEqual(.034001);expect(crest).toBeGreaterThan(10)
  const pos=m.body.geometry.attributes.position!,norm=m.body.geometry.attributes.normal!
  for(let j=40;j<590;j+=17){const p=new THREE.Vector3().fromBufferAttribute(pos,j),n=new THREE.Vector3().fromBufferAttribute(norm,j);expect(p.x*n.x+p.z*n.z).toBeGreaterThan(0)}
  disposeTree(m.subject)
 })
 it('keeps the rounded tip and shaft outside the actual ridged shell in1503 poses',()=>{
  const m=createGuiroModel(),v=new THREE.Vector3(),inverse=m.holder.matrixWorld.clone().invert();let nearest=Infinity,furthestContact=0,shaftClearance=Infinity
  const distance=(y:number,z:number,a:THREE.Vector2,b:THREE.Vector2)=>{const dy=b.y-a.y,dz=b.x-a.x,t=THREE.MathUtils.clamp(((y-a.y)*dy+(z-a.x)*dz)/(dy*dy+dz*dz),0,1);return Math.hypot(y-a.y-t*dy,z-a.x-t*dz)}
  for(let step=0;step<3;step++)for(let n=0;n<=500;n++){
   m.pose(step,n/500)
   const c=m.scraper.position;let d=Infinity
   // For radial shell and a center atx0, nearest shell point lies on its front meridian.
   if(step<2){for(let i=0;i<m.outerPoints.length-1;i++)d=Math.min(d,distance(c.y,c.z,m.outerPoints[i]!,m.outerPoints[i+1]!));nearest=Math.min(nearest,d);furthestContact=Math.max(furthestContact,d-m.tipRadius)}
   for(const mesh of [m.shaft,m.grip]){const p=mesh.geometry.attributes.position!,matrix=inverse.clone().multiply(mesh.matrixWorld);for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(matrix);if(v.y>=0&&v.y<=3.2)shaftClearance=Math.min(shaftClearance,Math.hypot(v.x,v.z)-m.radiusAt(v.y))}}
  }
  expect(nearest).toBeGreaterThanOrEqual(m.tipRadius+.00005);expect(furthestContact).toBeLessThan(.0011);expect(shaftClearance).toBeGreaterThan(.00001)
  m.pose(2,1);expect(m.scraper.position.x).toBe(.45);expect(m.scraper.position.z-m.contactAt(2.05).z).toBeCloseTo(.5,8)
  disposeTree(m.subject)
 })
 it('shares exact stroke endpoints, clamps inputs and leaves the final stick clear',()=>{
  const m=createGuiroModel(),snapshot=()=>[...m.scraper.position.toArray(),...m.scraper.quaternion.toArray()]
  for(let i=0;i<3;i++){m.pose(i,1);const end=snapshot();m.pose(i+1,0);expect(snapshot()).toEqual(end)}
  m.pose(0,-10);const top=snapshot();m.pose(0,0);expect(snapshot()).toEqual(top)
  m.pose(0,2);const bottom=snapshot();m.pose(0,1);expect(snapshot()).toEqual(bottom)
  m.pose(1,1);expect(snapshot()).toEqual(top);disposeTree(m.subject)
 })
})
