// @vitest-environment jsdom
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createFirstFootingModel } from './model'
import { createFirstFootingCarry } from './carry'

function mount(at=0){
  const canvas=document.createElement('canvas');canvas.getBoundingClientRect=()=>({left:17,top:89,width:390,height:408}) as DOMRect
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,390/408,.1,40);camera.position.set(.4,4.5,7);camera.lookAt(0,.9,.15);camera.updateMatrixWorld(true)
  const model=createFirstFootingModel();scene.add(model.root);const carry=createFirstFootingCarry(canvas,camera,model,scene);model.pose(at,0);carry.reset(at)
  const project=(point:THREE.Vector3):[number,number]=>{const p=point.clone().project(camera);return[17+(p.x+1)*390/2,89+(1-p.y)*408/2]}
  const source=()=>{model.root.updateMatrixWorld(true);return project(model.coal.localToWorld(new THREE.Vector3(0,.23,.16)))}
  const move=(x:number,z:number)=>carry.move(...project(new THREE.Vector3(x,.73,z+.16)))
  const clear=()=>{
    model.root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(model.coal,true)
    for(const solid of model.solids){const b=new THREE.Box3().setFromObject(solid,true);const overlap=new THREE.Vector3(Math.min(box.max.x,b.max.x)-Math.max(box.min.x,b.min.x),Math.min(box.max.y,b.max.y)-Math.max(box.min.y,b.min.y),Math.min(box.max.z,b.max.z)-Math.max(box.min.z,b.min.z));expect(Math.min(overlap.x,overlap.y,overlap.z),solid.name).toBeLessThanOrEqual(.0002)}
    if(box.min.z<.47&&box.max.z>.23){expect(box.min.x).toBeGreaterThanOrEqual(-.1002);expect(box.max.x).toBeLessThanOrEqual(1.0002)}
  }
  return{canvas,camera,scene,model,carry,source,project,move,clear}
}

describe('continuous coal carry through the actual doorway and hearth',()=>{
  it('follows one curved route, records a real doorway crossing, and only seats after entering the hearth',()=>{
    const s=mount();expect(s.carry.begin(0,...s.source())).toBe(true);expect(s.carry.entered).toBe(false)
    for(const[x,z]of[[.45,.85],[.45,.40],[.45,-.02]]){expect(s.move(x!,z!)).toBe(false);s.clear()}
    expect(s.carry.entered).toBe(true);expect(s.move(-.75,-.02)).toBe(false)
    expect(s.move(-.75,-.65)).toBe(true);s.carry.capture()
    for(let i=0;i<=30;i++){s.carry.settle(i/30);s.clear()}
    expect(s.model.coal.position.distanceTo(s.model.seat)).toBeLessThan(1e-7)
  })
  it('rejects a direct shortcut through the doorpost and does not invent entry from inspection',()=>{
    const s=mount();s.carry.begin(0,...s.source());const position=s.model.coal.position.clone()
    s.carry.rotate(Math.PI*2,0);expect(s.carry.entered).toBe(false);expect(s.model.coal.position.distanceTo(position)).toBeLessThan(1e-7)
    expect(s.move(-.75,-.65)).toBe(false);expect(s.carry.entered).toBe(false);s.clear()
  })
  it('rejects a turn whose coal bounds hit a jamb, rather than rotating through stone',()=>{
    const s=mount();s.carry.begin(0,...s.source());s.move(.23,.85);s.move(.23,.40)
    const q=s.model.coal.quaternion.clone();expect(s.carry.rotate(Math.PI/4,0)).toBe(false)
    expect(s.model.coal.quaternion.angleTo(q)).toBeLessThan(1e-7);s.clear()
  })
  it('checks the intermediate bounds of a whole revolution beside a jamb',()=>{
    const s=mount();s.carry.begin(0,...s.source());s.move(.23,.85);s.move(.23,.40)
    const position=s.model.coal.position.clone(),q=s.model.coal.quaternion.clone()
    expect(s.carry.rotate(Math.PI*2,0)).toBe(false)
    expect(s.model.coal.position.distanceTo(position)).toBeLessThan(1e-7);expect(s.model.coal.quaternion.angleTo(q)).toBeLessThan(1e-7);s.clear()
  })
  it.each([0,1,2])('plans one accessible continuous carry from legacy %i without crossing a solid',at=>{
    const s=mount(at);expect(s.carry.assist()).toBe(true)
    const before=s.model.coal.position.clone();s.carry.animateAssisted(0);expect(s.model.coal.position.distanceTo(before)).toBeLessThan(1e-7)
    for(let i=0;i<=100;i++){s.carry.animateAssisted(i/100);s.clear()}
    expect(s.model.coal.position.distanceTo(s.model.seat)).toBeLessThan(1e-7);expect(s.carry.entered).toBe(true)
  })
  it('can continue from a released inspected pose inside the doorway',()=>{
    const s=mount();s.carry.begin(0,...s.source());s.move(.45,.85);s.move(.45,-.02);s.carry.rotate(.4,0);s.carry.release()
    const position=s.model.coal.position.clone(),q=s.model.coal.quaternion.clone();s.carry.cancel()
    expect(s.model.coal.position.distanceTo(position)).toBeLessThan(1e-7);expect(s.model.coal.quaternion.angleTo(q)).toBeLessThan(1e-7)
    expect(s.carry.assist()).toBe(true)
    for(let i=0;i<=100;i++){s.carry.animateAssisted(i/100);s.clear()}
    expect(s.model.coal.position.distanceTo(s.model.seat)).toBeLessThan(1e-7)
  })
})
