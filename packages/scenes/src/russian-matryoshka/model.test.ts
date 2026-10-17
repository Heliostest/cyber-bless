import {describe,it,expect} from 'vitest'
import * as THREE from 'three'
import {createMatryoshkaModel} from './model'
import {disposeTree} from '../procedural-kit'

describe('wooden shell geometry and nesting clearances',()=>{
  it('has a real open lower cavity with a solid wooden floor',()=>{
    const m=createMatryoshkaModel();m.pose(1,0)
    const lower=m.subject.getObjectByName('matryoshka-lower-shell') as THREE.Mesh
    const ray=new THREE.Raycaster(new THREE.Vector3(0,2,0),new THREE.Vector3(0,-1,0))
    const hits=ray.intersectObject(lower,false)
    expect(hits.length).toBeGreaterThan(0);expect(hits[0]!.point.y).toBeCloseTo(.10,3)
    for(const x of [-.3,0,.3]){
      ray.set(new THREE.Vector3(x,1.3,0),new THREE.Vector3(0,-1,0));expect(ray.intersectObject(lower,false)[0]!.point.y).toBeLessThan(.3)
    }
    disposeTree(m.subject)
  })
  it('has a hollow upper shell with an inward-facing cavity and no invisible cap',()=>{
    const m=createMatryoshkaModel();m.pose(0,0)
    const upper=m.subject.getObjectByName('matryoshka-upper-shell') as THREE.Mesh
    const ray=new THREE.Raycaster(new THREE.Vector3(0,1.045,0),new THREE.Vector3(0,1,0))
    const hits=ray.intersectObject(upper,false);expect(hits.length).toBeGreaterThan(0);expect(hits[0]!.point.y).toBeGreaterThan(2.05)
    const side=new THREE.Raycaster(new THREE.Vector3(0,1.12,0),new THREE.Vector3(1,0,0))
    expect(side.intersectObject(upper,false)[0]!.distance).toBeGreaterThan(.43)
    disposeTree(m.subject)
  })
  it('moves the small doll above the rim before crossing it, then descends into the cavity',()=>{
    const m=createMatryoshkaModel(),small=m.subject.getObjectByName('matryoshka-small')!
    for(let i=0;i<=80;i++){
      m.pose(1,i/80);const bounds=new THREE.Box3().setFromObject(small,true)
      if(bounds.min.y<1.11 && Math.abs(small.position.x)>.04)expect(bounds.min.x).toBeGreaterThan(.60)
    }
    m.pose(2,0);expect(small.position.x).toBe(0);expect(small.position.y).toBeCloseTo(.10);expect(new THREE.Box3().setFromObject(small,true).max.y).toBeLessThan(1.30)
    disposeTree(m.subject)
  })
  it('lifts the upper shell above the complete inner doll before closing sideways',()=>{
    const m=createMatryoshkaModel(),upper=m.subject.getObjectByName('matryoshka-upper')!,small=m.subject.getObjectByName('matryoshka-small')!
    for(let i=0;i<=80;i++){
      m.pose(2,i/80)
      const cap=new THREE.Box3().setFromObject(upper,true),inner=new THREE.Box3().setFromObject(small,true)
      if(Math.abs(upper.position.x)>.01 && cap.max.x>inner.min.x)expect(cap.min.y).toBeGreaterThan(inner.max.y+.025)
    }
    m.pose(3,0);expect(upper.position.length()).toBe(0);expect(small.visible).toBe(true)
    disposeTree(m.subject)
  })
  it('keeps the small doll within the real inner radii in its final nested position',()=>{
    const m=createMatryoshkaModel();m.pose(3,0)
    const small=m.subject.getObjectByName('matryoshka-small')!,outer=m.subject.getObjectByName('matryoshka-lower-shell') as THREE.Mesh,top=m.subject.getObjectByName('matryoshka-upper-shell') as THREE.Mesh
    const ray=new THREE.Raycaster()
    small.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.geometry)return;const vertices=mesh.geometry.getAttribute('position')
      for(let i=0;i<vertices.count;i+=3){
        const q=mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(vertices,i)),r=Math.hypot(q.x,q.z)
        if(r<.01||q.y<.105)continue
        ray.set(new THREE.Vector3(0,q.y,0),new THREE.Vector3(q.x,0,q.z).normalize())
        const hit=ray.intersectObjects([outer,top],false)[0];expect(hit,`containing wooden wall: ${mesh.name} ${i} at ${q.toArray()}`).toBeDefined();expect(hit!.distance-r).toBeGreaterThan(.035)
      }
    });disposeTree(m.subject)
  })
  it('keeps permanent objects grounded and uses stable geometry through all movements',()=>{
    const m=createMatryoshkaModel(),resources=new Map<THREE.Mesh,THREE.BufferGeometry>();m.subject.traverse(o=>{if((o as THREE.Mesh).geometry)resources.set(o as THREE.Mesh,(o as THREE.Mesh).geometry)})
    for(const at of [0,1,2,3])for(const n of [0,.25,.5,.75,1]){m.pose(at,n);for(const [mesh,g] of resources){expect(mesh.geometry).toBe(g);expect(Array.from(g.getAttribute('position').array).every(Number.isFinite)).toBe(true)}}
    m.pose(1,0);expect(new THREE.Box3().setFromObject(m.subject.getObjectByName('matryoshka-upper')!,true).min.y).toBeCloseTo(0,5)
    expect(new THREE.Box3().setFromObject(m.subject.getObjectByName('matryoshka-pad')!,true).max.y).toBeCloseTo(0,5)
    disposeTree(m.subject)
  })
})
