import {describe,it,expect} from 'vitest'
import * as THREE from 'three'
import {OBB} from 'three/examples/jsm/math/OBB.js'
import {createTortillaPressModel} from './model'
import {disposeTree} from '../procedural-kit'

describe('manual wood tortilla press actual mechanism',()=>{
 it('has two solid wood plates, two liners, one closed masa body and supported physical pivots',()=>{
  const m=createTortillaPressModel();expect(m.lower.geometry.type).toBe('BoxGeometry');expect(m.upper.geometry.type).toBe('BoxGeometry')
  expect(m.lowerLiner.name).toBe('tortilla-lower-liner');expect(m.topLiner.name).toBe('tortilla-top-liner');expect(m.masa.geometry.index).not.toBeNull()
  for(const name of ['tortilla-back-axle','tortilla-front-axle','tortilla-hinge-ear--1','tortilla-hinge-ear-1','tortilla-lever-ear--1','tortilla-lever-ear-1'])expect(m.subject.getObjectByName(name)).toBeDefined()
  const p=new THREE.Vector3();m.lidJoint.getWorldPosition(p);expect(p.toArray()).toEqual([0,.38,-1.1]);m.leverJoint.getWorldPosition(p);expect(p.toArray()).toEqual([0,.635,1.35])
  expect(new THREE.Box3().setFromObject(m.subject).min.y).toBeGreaterThanOrEqual(-.000001)
  disposeTree(m.subject)
 })
 it('keeps one constant-volume masa body and retains the flattened shape on release/opening',()=>{
  const m=createTortillaPressModel(),volume=4/3*Math.PI*.28**3,body=m.masa
  for(const at of [0,1,2,3]){m.pose(at,0);expect(4/3*Math.PI*.28**3*m.masa.scale.x*m.masa.scale.y*m.masa.scale.z).toBeCloseTo(volume,10);expect(m.masa).toBe(body)}
  m.pose(0,0);expect(m.state.halfHeight).toBeCloseTo(.28,8)
  m.pose(2,0);const shape=m.masa.scale.clone();expect(m.state.radius).toBeGreaterThan(.90);expect(m.state.halfHeight).toBeLessThan(.03)
  for(let i=0;i<=100;i++){m.pose(2,i/100);expect(m.masa.scale.toArray()).toEqual(shape.toArray())}
  m.pose(3,0);expect(m.state.lidAngle).toBeCloseTo(1.8,8);expect(m.state.leverAngle).toBeCloseTo(1.4,8)
  disposeTree(m.subject)
 })
 it('keeps the real lever bar and grip clear of the upper wood plate across the complete paths',()=>{
  const m=createTortillaPressModel(),lid=new OBB(),tool=new OBB()
  for(const mesh of [m.upper,m.bar,m.grip])mesh.geometry.computeBoundingBox()
  for(const step of [0,1,2])for(let i=0;i<=2000;i++){
   m.pose(step,i/2000);lid.fromBox3(m.upper.geometry.boundingBox!).applyMatrix4(m.upper.matrixWorld)
   for(const mesh of [m.bar,m.grip]){tool.fromBox3(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld);if(lid.intersectsOBB(tool))throw Error(`wood intersects lever/grip ${step}/${i}`)}
  }
  disposeTree(m.subject)
 })
 it('maintains actual roller contact during pressing and clear dough/liner surfaces against both plates',()=>{
  const m=createTortillaPressModel(),p=new THREE.Vector3(),normal=new THREE.Vector3(),inverse=new THREE.Matrix4(),h=new THREE.Vector3(0,.38,-1.1)
  let bodyClear=Infinity,filmClear=Infinity,rollerClear=Infinity,contactError=0,bottomClear=Infinity,rollerInsideWood=0
  for(const step of [0,1,2])for(let i=0;i<=300;i++){
   m.pose(step,i/300);normal.set(0,Math.cos(m.state.lidAngle),-Math.sin(m.state.lidAngle))
   m.roller.getWorldPosition(p);const distance=p.sub(h).dot(normal)-.075-.10
   if(step===1&&m.state.leverAngle<=.8){rollerClear=Math.min(rollerClear,distance);contactError=Math.max(contactError,Math.abs(distance))}
   inverse.copy(m.upper.matrixWorld).invert()
   const rollerVertices=m.roller.geometry.getAttribute('position')
   for(let j=0;j<rollerVertices.count;j++){
    p.fromBufferAttribute(rollerVertices,j).applyMatrix4(m.roller.matrixWorld).applyMatrix4(inverse)
    if(Math.abs(p.x)<1.08&&Math.abs(p.z)<1.08&&p.y>-.075+.00001&&p.y<.075-.00001)rollerInsideWood++
   }
   for(const [mesh,kind]of[[m.masa,'masa'],[m.topLiner,'film']]as const){const a=mesh.geometry.getAttribute('position')
    for(let j=0;j<a.count;j++){
     p.fromBufferAttribute(a,j).applyMatrix4(mesh.matrixWorld);bottomClear=Math.min(bottomClear,p.y-.25)
     p.applyMatrix4(inverse);if(Math.abs(p.x)<=1.08&&Math.abs(p.z)<=1.08){const gap=-.075-p.y;if(kind==='masa')bodyClear=Math.min(bodyClear,gap);else filmClear=Math.min(filmClear,gap)}
    }
   }
  }
  expect(rollerClear).toBeGreaterThanOrEqual(-.00001);expect(contactError).toBeLessThan(.00001);expect(rollerInsideWood).toBe(0);expect(bodyClear).toBeGreaterThanOrEqual(.0059);expect(filmClear).toBeGreaterThanOrEqual(-.00001);expect(bottomClear).toBeGreaterThanOrEqual(.0039)
  disposeTree(m.subject)
 })
 it('has continuous checkpoints and exactly reproducible restoration without replacing resources',()=>{
  const m=createTortillaPressModel(),resources:unknown[]=[],objects:THREE.Object3D[]=[]
  m.subject.traverse(o=>{objects.push(o);const x=o as THREE.Mesh;if(x.geometry)resources.push(x.geometry,x.material)})
  for(const step of [0,1,2]){
   m.pose(step,1);const transforms=new Map<THREE.Object3D,number[]>();m.subject.traverse(o=>transforms.set(o,[...o.matrixWorld.elements]));const shape=m.masa.scale.clone()
   m.pose(step+1,0);m.subject.traverse(o=>expect(o.matrixWorld.elements).toEqual(transforms.get(o)));expect(m.masa.scale.toArray()).toEqual(shape.toArray())
  }
  for(let i=0;i<30;i++)m.pose(i%3,(i%11)/10)
  const after:THREE.Object3D[]=[],r:unknown[]=[];m.subject.traverse(o=>{after.push(o);const x=o as THREE.Mesh;if(x.geometry)r.push(x.geometry,x.material)})
  expect(after).toEqual(objects);expect(r).toEqual(resources);disposeTree(m.subject)
 })
})
