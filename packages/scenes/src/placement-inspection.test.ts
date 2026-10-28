// @vitest-environment jsdom
import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { createPosePlacement } from './pose-placement'
import { addKeyboardPlacementInspection } from './placement-inspection'

function fixture() {
  const canvas=document.createElement('canvas'), button=document.createElement('button')
  canvas.getBoundingClientRect=()=>({left:0,top:0,width:390,height:408}) as DOMRect
  const scene=new THREE.Scene(), root=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial())
  scene.add(root)
  const model={roots:[root],targets:[root],pose:(_step:number,n:number)=>{root.position.set(-1+2*n,0,0);root.quaternion.identity();scene.updateMatrixWorld(true)}}
  const camera=new THREE.PerspectiveCamera(40,390/408,.1,20);camera.position.z=6;camera.updateMatrixWorld(true)
  const placement=createPosePlacement(canvas,camera,model,scene), prepare=vi.fn(()=>true)
  let active=true
  const stop=addKeyboardPlacementInspection(button,canvas,camera,model,placement,{isActive:()=>active,step:()=>0,prepare,reset:()=>model.pose(0,0)})
  const key=(key:string)=>button.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}))
  return{root,placement,prepare,stop,key,inactive:()=>{active=false}}
}
describe('optional keyboard inspection',()=>{
  it('turns either way without translating or committing, and Esc restores the saved pose',()=>{
    const s=fixture(), position=s.root.position.clone()
    s.key('ArrowRight');expect(s.root.quaternion.angleTo(new THREE.Quaternion())).toBeCloseTo(.2)
    expect(s.root.position.toArray()).toEqual(position.toArray())
    s.key('ArrowLeft');expect(s.root.quaternion.angleTo(new THREE.Quaternion())).toBeLessThan(1e-7)
    s.key('ArrowUp');s.key('Escape');expect(s.root.quaternion.angleTo(new THREE.Quaternion())).toBeLessThan(1e-7)
    expect(s.prepare).toHaveBeenCalledTimes(3);s.stop()
  })
  it('does not react after host inactivity or cleanup',()=>{
    const s=fixture();s.inactive();s.key('ArrowRight');expect(s.prepare).not.toHaveBeenCalled()
    s.stop();s.key('ArrowDown');expect(s.root.quaternion.angleTo(new THREE.Quaternion())).toBe(0)
  })
})
