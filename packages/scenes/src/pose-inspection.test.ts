// @vitest-environment jsdom
import * as THREE from 'three'
import { describe,expect,it } from 'vitest'
import { createPosePlacement } from './pose-placement'
import { createPucaraModel } from './pucara-rooftop-bulls/model'
import { createKadomatsuModel } from './japanese-kadomatsu/model'
import { disposeTree } from './procedural-kit'

function setup(factory:typeof createPucaraModel|typeof createKadomatsuModel){
 const model=factory(),canvas=document.createElement('canvas'),scene=new THREE.Scene();scene.add(model.root)
 canvas.getBoundingClientRect=()=>({left:0,top:0,width:600,height:600}) as DOMRect
 const camera=new THREE.PerspectiveCamera(50,1,.1,40);camera.position.set(4,4,9);camera.lookAt(0,1,1);camera.updateMatrixWorld(true)
 const placement=createPosePlacement(canvas,camera,model,scene),root=model.roots[0]!
 const source=()=>{scene.updateMatrixWorld(true);const p=model.targets[2]!.localToWorld(new THREE.Vector3(...model.anchors[2]!)).project(camera);return[(p.x+1)*300,(1-p.y)*300] as const}
 return{model,root,placement,source}
}
describe('inspection of real bottom-pivot assets',()=>{
 it('moves the inspection support baseline with the carried object before another turn',()=>{
  const s=setup(createPucaraModel),p=s.source();s.placement.begin(2,...p);s.placement.rotate(.2,0)
  s.placement.rebase(...p);s.placement.move(p[0],p[1]+55)
  const before=new THREE.Box3().setFromObject(s.root,true).getCenter(new THREE.Vector3())
  s.placement.rotate(.2,0)
  expect(new THREE.Box3().setFromObject(s.root,true).getCenter(new THREE.Vector3()).y).toBeCloseTo(before.y,6)
  s.placement.cancel();disposeTree(s.model.root)
 })
 it.each([createPucaraModel,createKadomatsuModel])('keeps the asset above its support during pitch without accumulating height over a complete turn',factory=>{
  const s=setup(factory),before=new THREE.Box3().setFromObject(s.root,true),center=before.getCenter(new THREE.Vector3())
  for(let i=0;i<16;i++){
   expect(s.placement.begin(2,...s.source())).toBe(true)
   s.placement.rotate(0,Math.PI/8);s.placement.release()
   expect(new THREE.Box3().setFromObject(s.root,true).min.y).toBeGreaterThanOrEqual(before.min.y-1e-6)
  }
  expect(new THREE.Box3().setFromObject(s.root,true).getCenter(new THREE.Vector3()).distanceTo(center)).toBeLessThan(1e-6)
  s.placement.cancel();disposeTree(s.model.root)
 })
 it('restores all canonical transform components after an ownerless inspection release',()=>{
  const s=setup(createPucaraModel),home={position:s.root.position.clone(),quaternion:s.root.quaternion.clone(),scale:s.root.scale.clone()}
  s.placement.begin(2,...s.source());s.placement.rotate(.6,.4);s.placement.release()
  s.root.position.x+=.7;s.root.position.z+=.4;s.model.pose(0,0)
  s.placement.restoreCheckpoint(0)
  expect(s.root.position.distanceTo(home.position)).toBeLessThan(1e-8)
  expect(s.root.quaternion.angleTo(home.quaternion)).toBeLessThan(1e-7)
  expect(s.root.scale.distanceTo(home.scale)).toBeLessThan(1e-8);disposeTree(s.model.root)
 })
})
