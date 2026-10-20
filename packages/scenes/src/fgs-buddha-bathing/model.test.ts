import {describe,it,expect} from 'vitest'
import * as THREE from 'three'
import {createBuddhaBathingModel} from './model'
import {disposeTree} from '../procedural-kit'

describe('actual Buddha bathing geometry',()=>{
  it('pours from the physical cup rim onto right, left, right shoulder mesh',()=>{
    const m=createBuddhaBathingModel()
    for(let step=0;step<3;step++)for(const t of [.62,.67,.73,.77]){
      m.pose(step,t);const index=step===1?1:0,sign=index===0?-1:1
      expect(m.stream.visible).toBe(true);expect(m.contactObject).toBe(m.shoulders[index])
      const start=new THREE.Vector3(-sign*.14,0,0).applyMatrix4(m.ladle.matrixWorld)
      const upper=new THREE.Vector3(0,-.5,0).applyMatrix4(m.stream.matrixWorld)
      const lower=new THREE.Vector3(0,.5,0).applyMatrix4(m.stream.matrixWorld)
      expect(upper.distanceTo(start)).toBeLessThan(1e-7);expect(lower.distanceTo(m.contact)).toBeLessThan(1e-7)
      expect(start.y).toBeGreaterThan(m.contact.y);expect(m.contact.x*sign).toBeGreaterThan(.24)
    }
    disposeTree(m.root)
  })
  it('restores every transform exactly after a complete pour, including hidden runoff',()=>{
    const m=createBuddhaBathingModel(),snapshot=()=>{const a:number[][]=[];m.root.traverse(o=>a.push([...o.matrixWorld.elements,Number(o.visible)]));return a}
    for(let step=0;step<3;step++){
      m.pose(step,.70);m.pose(step,1);const end=snapshot();m.pose(step+1,0);expect(snapshot()).toEqual(end)
      expect(m.stream.visible).toBe(false);expect(m.drops.every(d=>!d.visible)).toBe(true)
    }
    disposeTree(m.root)
  })
  it('keeps finite meshes through complete trajectories and returns the ladle to the water',()=>{
    const m=createBuddhaBathingModel(),p=new THREE.Vector3()
    m.pose(0,0);const initial=m.ladle.position.clone()
    for(let step=0;step<3;step++)for(let i=0;i<=100;i++){
      m.pose(step,i/100);m.root.traverse(o=>expect(o.matrixWorld.elements.every(Number.isFinite),o.name).toBe(true))
      if(i===100)expect(m.ladle.position.equals(initial)).toBe(true)
    }
    m.cup.localToWorld(p.set(0,-.105,0));expect(p.y).toBeLessThan(.48);expect(p.y).toBeGreaterThan(.235)
    m.cup.localToWorld(p.set(0,.006,0));expect(p.y).toBeLessThan(.48)
    disposeTree(m.root)
  })
})
