import {describe,it,expect} from 'vitest'
import * as THREE from 'three'
import {createFoldingFanModel} from './model'
import {disposeTree} from '../procedural-kit'

describe('real articulated folding fan',()=>{
 it('orients all fabric triangles towards the visible +Z face for correct normal-biased shadows',()=>{
  const m=createFoldingFanModel(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();let minimum=Infinity
  for(let n=0;n<=500;n++){
   m.pose(0,n/500)
   for(const leaf of m.leaves){const positions=leaf.geometry.attributes.position!,index=leaf.geometry.index!
    for(let k=0;k<index.count;k+=3){a.fromBufferAttribute(positions,index.getX(k));b.fromBufferAttribute(positions,index.getX(k+1));c.fromBufferAttribute(positions,index.getX(k+2));const cross=b.sub(a).cross(c.sub(a));minimum=Math.min(minimum,cross.z);if(cross.z<=0)throw Error('Back-facing fabric normal at '+[n,leaf.name,k])}
   }
  }
  expect(minimum).toBeGreaterThan(1e-6);disposeTree(m.subject)
 })
 it('has17 separate wood layers with real pivot holes, shared metal pin and16 cloth sectors',()=>{
  const m=createFoldingFanModel();expect(m.ribs).toHaveLength(17);expect(m.leaves).toHaveLength(16)
  for(const rib of m.ribs){expect(rib.geometry.type).toBe('ExtrudeGeometry');expect((rib.geometry.parameters.shapes as THREE.Shape).holes).toHaveLength(1)}
  for(const name of ['fan-pin','fan-front-cap','fan-back-cap','fan-front-washer','fan-back-washer'])expect(m.subject.getObjectByName(name)).toBeDefined()
  const pin=m.shaft.geometry as THREE.CylinderGeometry;expect(pin.parameters.radiusTop).toBeCloseTo(.052);expect(pin.parameters.height).toBeCloseTo(.34)
  const p=new THREE.Vector3();m.fan.getWorldPosition(p);expect(p.toArray()).toEqual([0,.28,0]);disposeTree(m.subject)
 })
 it('keeps all wood layers separate and pinned while all actual cloth vertices stay outside wood across1803poses',()=>{
  const m=createFoldingFanModel(),p=new THREE.Vector3(),inverse=m.ribs.map(()=>new THREE.Matrix4());let minimum=Infinity
  const bounds=m.ribs.map(r=>{r.geometry.computeBoundingBox();return r.geometry.boundingBox!})
  for(const step of [0,1,2])for(let n=0;n<=600;n++){
   m.pose(step,n/600);const origin=m.fan.localToWorld(new THREE.Vector3())
   for(let i=0;i<17;i++){const q=m.joints[i]!.getWorldPosition(new THREE.Vector3()),axis=m.fan.worldToLocal(q.clone());expect(Math.abs(axis.x)+Math.abs(axis.y)).toBeLessThan(1e-9);expect(Math.abs(axis.z)).toBeLessThan(.14);inverse[i]!.copy(m.ribs[i]!.matrixWorld).invert()}
   for(let i=1;i<17;i++){const a=bounds[i-1]!,b=bounds[i]!,gap=m.spacing+b.min.z-a.max.z;minimum=Math.min(minimum,gap)}
   for(const leaf of m.leaves){const v=leaf.geometry.attributes.position!;for(let k=0;k<v.count;k++){
    p.fromBufferAttribute(v,k).applyMatrix4(leaf.matrixWorld)
    expect(p.y).toBeGreaterThan(.1)
    for(let i=0;i<17;i++){const local=p.clone().applyMatrix4(inverse[i]!);if(bounds[i]!.containsPoint(local))throw Error('cloth vertex in wood at '+[step,n,k,i])}
   }}
   expect(origin.y).toBeCloseTo(.28,9)
  }
  expect(minimum).toBeGreaterThan(.001);disposeTree(m.subject)
 })
 it('joins every adjacent cloth sector exactly and retains each sampled half-pleat cross length while opening',()=>{
  const m=createFoldingFanModel(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3()
  for(let n=0;n<=200;n++){
   m.pose(0,n/200)
   for(let i=0;i<16;i++)for(let row=0;row<m.rows.length;row++){
    const v=m.leaves[i]!.geometry.attributes.position!;a.fromBufferAttribute(v,row*3);b.fromBufferAttribute(v,row*3+1);c.fromBufferAttribute(v,row*3+2)
    const r=m.rows[row]!,length=Math.hypot(r*Math.sin(m.maxSpread/32),m.spacing/2,.028)
    expect(a.distanceTo(b)).toBeCloseTo(length,6);expect(b.distanceTo(c)).toBeCloseTo(length,6)
    if(i<15){const next=m.leaves[i+1]!.geometry.attributes.position!;expect(c.distanceTo(new THREE.Vector3().fromBufferAttribute(next,row*3))).toBeLessThan(1e-7)}
   }
  }
  disposeTree(m.subject)
 })
 it('keeps exact checkpoint geometry including mutable cloth, waves without changing spread and disposes resources once',()=>{
  const m=createFoldingFanModel(),snapshot=()=>JSON.stringify({ribs:m.ribs.map(x=>x.matrixWorld.elements),leaf:m.leaves.map(x=>Array.from(x.geometry.attributes.position!.array))})
  m.pose(0,1);const opened=snapshot();m.pose(1,0);expect(snapshot()).toBe(opened);m.pose(1,1);expect(snapshot()).toBe(opened)
  m.pose(1,.25);expect(m.state.spread).toBe(m.maxSpread);expect(Math.abs(m.fan.rotation.y)).toBeGreaterThan(.2)
  m.pose(1,1);m.pose(2,0);expect(snapshot()).toBe(opened)
  m.pose(2,1);const gathered=snapshot();m.pose(3,0);expect(snapshot()).toBe(gathered);expect(m.state.spread).toBe(m.minSpread)
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();m.subject.traverse(o=>{const x=o as THREE.Mesh;if(x.geometry)geometries.add(x.geometry);if(x.material)for(const z of Array.isArray(x.material)?x.material:[x.material])materials.add(z)})
  let count=0;for(const g of geometries)g.addEventListener('dispose',()=>count++);for(const mat of materials)mat.addEventListener('dispose',()=>count++)
  disposeTree(m.subject);expect(count).toBe(geometries.size+materials.size)
 })
})
