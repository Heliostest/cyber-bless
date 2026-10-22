import {describe,it,expect} from 'vitest'
import * as THREE from 'three'
import {createVirpominenModel} from './model'
import {disposeTree} from '../procedural-kit'
describe('decorated willow handover and basket gift',()=>{
 it('joins every checkpoint continuously, including the final gift and open fingers',()=>{
  const m=createVirpominenModel()
  for(let step=0;step<3;step++){
   m.pose(step,1);const ends=new Map<string,number[]>();m.root.traverse(o=>ends.set(o.name,[...o.matrixWorld.elements]))
   m.pose(step+1,0);m.root.traverse(o=>o.matrixWorld.elements.forEach((v,i)=>expect(v,o.name).toBeCloseTo(ends.get(o.name)![i]!,8)))
  }disposeTree(m.root)
 })
 it('transfers the stem into the receiving grip and withdraws the visitor hand',()=>{
  const m=createVirpominenModel();m.pose(2,0)
  const grip=m.branch.localToWorld(new THREE.Vector3(0,.24,0)),hand=m.receiver.root.getWorldPosition(new THREE.Vector3())
  expect(grip.distanceTo(hand)).toBeLessThan(1e-8);expect(m.visitor.root.position.distanceTo(hand)).toBeGreaterThan(1)
  disposeTree(m.root)
 })
 it('places the chocolate egg exactly on the basket floor and inside the inner walls',()=>{
  const m=createVirpominenModel();m.pose(3,0)
  const egg=new THREE.Box3().setFromObject(m.eggBody,true),floor=new THREE.Box3().setFromObject(m.base,true).max.y
  expect(egg.min.y).toBeCloseTo(floor,7)
  expect(Math.abs(m.egg.position.x-m.basket.position.x)+.09).toBeLessThan(.38)
  expect(Math.abs(m.egg.position.z-m.basket.position.z)+.09).toBeLessThan(.28)
  expect(m.giver.root.position.distanceTo(m.egg.position)).toBeGreaterThan(1)
  disposeTree(m.root)
 })
 it('keeps the receiving fingers behind the moving branch until it stops, then releases the visitor through the open grip',()=>{
  const m=createVirpominenModel(),v=new THREE.Vector3()
  for(let n=0;n<=70;n++){
   m.pose(1,n/100)
   expect(m.receiver.root.position.z).toBeCloseTo(-.32,8)
   expect(m.receiver.root.position.y-m.visitor.root.position.y).toBeCloseTo(.33,8)
  }
  m.pose(1,.80);expect(m.receiver.root.position.z).toBeCloseTo(-.02,8)
  m.pose(1,.90);const start=m.visitor.root.getWorldPosition(v).clone()
  m.pose(1,.95);expect(m.visitor.root.position.x).toBeCloseTo(start.x,8)
  expect(m.visitor.root.position.z).toBeCloseTo(start.z-.30,8)
  disposeTree(m.root)
 })
 it('keeps real branch surfaces outside the closed finger meshes at the previously penetrating handover phases',()=>{
  const m=createVirpominenModel(),shaft=m.stem.geometry.getAttribute('position'),samples=new Map<string,THREE.Vector3[]>(),fingers:THREE.Mesh[]=[]
  m.branch.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;const p=mesh.geometry.getAttribute('position'),points:THREE.Vector3[]=[];for(let i=0;i<p.count;i++)points.push(new THREE.Vector3().fromBufferAttribute(p,i));samples.set(mesh.name,points)})
  // Long shaft triangles need interior samples: endpoint vertices alone miss the grip.
  for(let i=0;i<shaft.count;i+=3)for(let n=1;n<100;n++){
   const h=n/100
   const a=new THREE.Vector3().fromBufferAttribute(shaft,i),b=new THREE.Vector3().fromBufferAttribute(shaft,i+1),c=new THREE.Vector3().fromBufferAttribute(shaft,i+2)
   samples.get(m.stem.name)!.push(a.clone().lerp(b,h),b.clone().lerp(c,h),c.clone().lerp(a,h))
  }
  for(const hand of [m.visitor,m.receiver])hand.root.traverse(o=>{const mesh=o as THREE.Mesh;if(mesh.isMesh&&mesh.name.includes('-finger-')){mesh.geometry.computeBoundingBox();(mesh.material as THREE.Material).side=THREE.DoubleSide;fingers.push(mesh)}})
  const ray=new THREE.Raycaster(),direction=new THREE.Vector3(.842,.377,.221).normalize(),world=new THREE.Vector3(),local=new THREE.Vector3(),collisions:string[]=[]
  for(const t of [.665,.69,.80,.85,.91,.95,1]){
   m.pose(1,t)
   for(const finger of fingers){const inverse=finger.matrixWorld.clone().invert(),box=finger.geometry.boundingBox!;m.branch.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;for(const p of samples.get(mesh.name)!){world.copy(p).applyMatrix4(mesh.matrixWorld);local.copy(world).applyMatrix4(inverse);if(!box.containsPoint(local))continue;ray.set(world,direction);const hits=ray.intersectObject(finger,false).map(h=>h.distance).filter((d,i,a)=>!i||Math.abs(d-a[i-1]!)>1e-7);if(hits.length%2)collisions.push(`${t}: ${mesh.name}/${finger.name}`)}})}
  }
  expect(collisions).toEqual([]);disposeTree(m.root)
 })
 it('retains finite nondegenerate real geometry and reuses every position buffer across 303 poses',()=>{
  const m=createVirpominenModel(),buffers=new Map<THREE.Mesh,unknown>();let triangles=0,minArea=Infinity
  m.root.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.geometry)return;const p=mesh.geometry.getAttribute('position');buffers.set(mesh,p.array)
   for(let i=0;i<p.count;i+=3){const v=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,i+k));expect(v.every(p=>p.toArray().every(Number.isFinite))).toBe(true);minArea=Math.min(minArea,new THREE.Triangle(...v as [THREE.Vector3,THREE.Vector3,THREE.Vector3]).getArea());triangles++}
  })
  expect(triangles).toBeGreaterThan(1000);expect(minArea).toBeGreaterThan(1e-12)
  for(let step=0;step<3;step++)for(let i=0;i<=100;i++){m.pose(step,i/100);for(const [mesh,array]of buffers)expect(mesh.geometry.getAttribute('position').array).toBe(array)}
  disposeTree(m.root)
 })
})
