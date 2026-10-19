import {describe,expect,it} from 'vitest'
import * as THREE from 'three'
import {createSurvakaneModel} from './model'
import {disposeTree} from '../procedural-kit'

describe('Survakane physical contact and support',()=>{
  it('touches the back at mid action, stays clear of the stool, then fully withdraws',()=>{
    const m=createSurvakaneModel(),p=new THREE.Vector3()
    // The main stem's front surface reaches the back, rather than a proxy or an invisible target.
    m.pose(2,.5)
    const stem=m.root.getObjectByName('surva-stem') as THREE.Mesh
    const front=stem.getWorldPosition(new THREE.Vector3()).z-.018
    expect(front).toBeCloseTo(.22,6)
    const backRay=new THREE.Raycaster(new THREE.Vector3(.50,1.13,1),new THREE.Vector3(0,0,-1))
    const hit=backRay.intersectObject(m.back)[0]!
    expect(hit).toBeTruthy();expect(front-hit.point.z).toBeCloseTo(0,6)
    // Every branch vertex remains in front of the torso/head and above the stool at the tap.
    let minY=Infinity,minZ=Infinity
    m.branch.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;const a=mesh.geometry.getAttribute('position')
      for(let i=0;i<a.count;i++){p.fromBufferAttribute(a,i).applyMatrix4(mesh.matrixWorld);minY=Math.min(minY,p.y);minZ=Math.min(minZ,p.z)}
    })
    expect(minY).toBeGreaterThan(.65)
    expect(minZ).toBeGreaterThan(.20)
    const contact=m.branch.position.z;m.pose(3,0);expect(m.branch.position.z-contact).toBeGreaterThan(.25)
    disposeTree(m.root)
  })
  it('has continuous checkpoints and finite geometry along all three motions',()=>{
    const m=createSurvakaneModel()
    for(let step=0;step<3;step++){
      m.pose(step,1);const end=m.branch.matrixWorld.clone();m.pose(step+1,0)
      expect(m.branch.matrixWorld.elements).toEqual(end.elements)
      for(let i=0;i<=200;i++){m.pose(step,i/200);m.root.traverse(o=>expect(o.matrixWorld.elements.every(Number.isFinite)).toBe(true))}
    }
    for(const x of [NaN,Infinity,-Infinity]){m.pose(0,x);expect(m.branch.position.toArray()).toEqual([-.67,.16,.54])}
    disposeTree(m.root)
  })
  it('keeps both bent twig loops attached to the main stem and popcorn on yarn',()=>{
    const m=createSurvakaneModel()
    for(let index=0;index<2;index++){
      const loop=m.root.getObjectByName('surva-loop-'+index) as THREE.Mesh
      loop.geometry.computeBoundingBox()
      const b=loop.geometry.boundingBox!
      expect(b.min.x).toBeLessThan(0);expect(b.max.x).toBeGreaterThan(0)
      expect(m.root.getObjectByName('surva-wool-loop-'+index)).toBeTruthy()
      expect(Array.from({length:7},(_,i)=>m.root.getObjectByName('surva-popcorn-'+index+'-'+i)).every(Boolean)).toBe(true)
    }
    expect(m.root.getObjectByName('surva-stool-seat')).toBeTruthy()
    expect(m.targets.every(o=>o===m.root.getObjectByName('surva-grip'))).toBe(true)
    disposeTree(m.root)
  })
  it('grounds the stool and shoes, supports the hips, and keeps the whole branch outside the back',()=>{
    const m=createSurvakaneModel();m.pose(2,.5)
    const bounds=(name:string)=>new THREE.Box3().setFromObject(m.root.getObjectByName(name)!)
    const ground=bounds('surva-paving').max.y,seat=bounds('surva-stool-seat')
    for(let i=0;i<4;i++){const leg=bounds('surva-stool-leg-'+i);expect(leg.min.y).toBeCloseTo(ground,6);expect(leg.max.y).toBeCloseTo(seat.min.y,6)}
    for(let i=0;i<2;i++)expect(bounds('surva-shoe-'+i).min.y).toBeCloseTo(ground,6)
    expect(bounds('surva-hips').min.y).toBeCloseTo(seat.max.y,6)
    // Back geometry is a transformed unit sphere. Requiring every branch vertex outside
    // its enclosing smooth ellipsoid also excludes penetration of the faceted surface.
    const inv=m.back.matrixWorld.clone().invert(),p=new THREE.Vector3();let minimum=Infinity
    m.branch.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;const positions=mesh.geometry.getAttribute('position')
      for(let i=0;i<positions.count;i++){p.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld).applyMatrix4(inv);minimum=Math.min(minimum,p.lengthSq())}
    })
    expect(minimum).toBeGreaterThanOrEqual(1-1e-6)
    disposeTree(m.root)
  })
})
