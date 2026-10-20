import {describe,it,expect} from 'vitest'
import * as THREE from 'three'
import {createChitoseAmeModel} from './model'
import {disposeTree} from '../procedural-kit'

// Use the rendered mesh faces: contact is allowed, transverse penetration is not.
function worldFaces(mesh:THREE.Mesh){
 const p=mesh.geometry.getAttribute('position'),index=mesh.geometry.index,faces=[]
 for(let i=0;i<(index?.count??p.count);i+=3){
  const vertices=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld))
  const triangle=new THREE.Triangle(vertices[0]!,vertices[1]!,vertices[2]!)
  if(triangle.getArea()>1e-12)faces.push({triangle,box:new THREE.Box3().setFromPoints(vertices)})
 }
 return faces
}
function edgeCrosses(a:THREE.Triangle,b:THREE.Triangle){
 const points=[a.a,a.b,a.c],normal=b.getNormal(new THREE.Vector3()),epsilon=2e-7
 for(let i=0;i<3;i++){
  const p=points[i]!,q=points[(i+1)%3]!,d0=p.clone().sub(b.a).dot(normal),d1=q.clone().sub(b.a).dot(normal)
  if(!((d0>epsilon&&d1< -epsilon)||(d0< -epsilon&&d1>epsilon)))continue
  const hit=p.clone().lerp(q,d0/(d0-d1)),bary=b.getBarycoord(hit,new THREE.Vector3())
  if(bary&&bary.x>1e-8&&bary.y>1e-8&&bary.z>1e-8)return true
 }
 return false
}
function meshesCross(a:ReturnType<typeof worldFaces>,b:ReturnType<typeof worldFaces>){
 for(const x of a)for(const y of b)if(x.box.intersectsBox(y.box)&&(edgeCrosses(x.triangle,y.triangle)||edgeCrosses(y.triangle,x.triangle)))return true
 return false
}
describe('Chitose Ame gift geometry',()=>{
 it('lifts before moving toward the child and settles the real handle onto both palms',()=>{
  const m=createChitoseAmeModel();m.pose(0,0);const start=m.bag.position.clone()
  m.pose(0,1);expect(m.bag.position.x).toBe(start.x);expect(m.bag.position.y).toBeGreaterThan(start.y+.4)
  m.pose(1,1);expect(m.bag.position.x).toBe(.4);expect(m.bag.position.y).toBe(.64)
  m.pose(2,1);expect(m.bag.position.y).toBe(.42)
  for(const i of [0,1]){const center=m.palms[i]!.getWorldPosition(new THREE.Vector3()),contact=m.contacts[i]!.clone().applyMatrix4(m.handle.matrixWorld);expect(center.distanceTo(contact)).toBeCloseTo(.047,7)}
  disposeTree(m.root)
 })
 it('keeps packaged red and white candy above the bag floor and inside all four walls',()=>{
  const m=createChitoseAmeModel();m.pose(3,0)
  for(const candy of m.candies){const p=new THREE.Vector3();const pos=candy.geometry.getAttribute('position');for(let i=0;i<pos.count;i++){p.fromBufferAttribute(pos,i).applyMatrix4(candy.matrixWorld);m.bag.worldToLocal(p);expect(Math.abs(p.x)).toBeLessThan(.178);expect(Math.abs(p.z)).toBeLessThan(.078);expect(p.y).toBeGreaterThanOrEqual(.018-1e-7)}}
  disposeTree(m.root)
 })
 it('keeps wrapper seals and the cord clear of hands and forearms throughout the previously colliding handoff samples',()=>{
  const m=createChitoseAmeModel(),names=['chitose-handle','chitose-wrapper-seal-0','chitose-wrapper-seal-1','chitose-palm-0','chitose-palm-1','chitose-forearm-0','chitose-forearm-1']
  for(const t of [.837,.910,.925,.937,.974,.99,1]){
   m.pose(2,t)
   const faces=new Map(names.map(name=>[name,worldFaces(m.root.getObjectByName(name) as THREE.Mesh)]))
   for(const part of names.slice(0,3))for(const hand of names.slice(3))expect(meshesCross(faces.get(part)!,faces.get(hand)!),`${part} / ${hand} at ${t}`).toBe(false)
  }
  disposeTree(m.root)
 })
 it('has exact checkpoint restoration and finite complete trajectories without resource rebuilding',()=>{
  const m=createChitoseAmeModel(),snapshot=()=>{const rows:number[][]=[];m.subject.traverse(o=>rows.push([...o.matrixWorld.elements,Number(o.visible)]));return rows},geometries:THREE.BufferGeometry[]=[]
  m.subject.traverse(o=>{if((o as THREE.Mesh).isMesh)geometries.push((o as THREE.Mesh).geometry)})
  for(let step=0;step<3;step++){for(let i=0;i<=100;i++){m.pose(step,i/100);m.subject.traverse(o=>expect(o.matrixWorld.elements.every(Number.isFinite),o.name).toBe(true))}const end=snapshot();m.pose(step+1,0);expect(snapshot()).toEqual(end)}
  const after:THREE.BufferGeometry[]=[];m.subject.traverse(o=>{if((o as THREE.Mesh).isMesh)after.push((o as THREE.Mesh).geometry)});expect(after).toEqual(geometries);disposeTree(m.root)
 })
})
