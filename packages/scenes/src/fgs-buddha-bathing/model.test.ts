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
  it('upgrades only the three paving-edge flowers to watertight cupped FrontSide petals without altering the gilded metal lotus pedestal',()=>{
    const m=createBuddhaBathingModel()
    for(let i=0;i<3;i++){
      const petal=m.root.getObjectByName(`bathing-flower-${i}-0`) as THREE.Mesh
      expect(petal).toBeDefined()
      const mat=petal.material as THREE.MeshStandardMaterial
      expect(mat.side).toBe(THREE.FrontSide)
      expect(mat.vertexColors).toBe(true)
      expect(mat.userData.botanicalFinish?.knee).toBeCloseTo(.74,4)
      expect(mat.userData.botanicalFinish?.headroom).toBeCloseTo(.24,4)
      const pos=petal.geometry.getAttribute('position') as THREE.BufferAttribute
      const idx=petal.geometry.index!
      const edges=new Map<string,number>()
      const va=new THREE.Vector3(),vb=new THREE.Vector3(),vc=new THREE.Vector3()
      let signedVol6=0
      for(let k=0;k<idx.count;k+=3){
        const ia=idx.getX(k),ib=idx.getX(k+1),ic=idx.getX(k+2)
        va.fromBufferAttribute(pos,ia);vb.fromBufferAttribute(pos,ib);vc.fromBufferAttribute(pos,ic)
        signedVol6+=va.dot(vb.clone().cross(vc))
        for(const [u,v] of [[ia,ib],[ib,ic],[ic,ia]] as const){
          const key=u<v?`${u}:${v}`:`${v}:${u}`
          edges.set(key,(edges.get(key)??0)+(u<v?1:-1))
        }
      }
      expect(signedVol6).toBeGreaterThan(0)
      expect([...edges.values()].every(v=>v===0)).toBe(true)
    }
    // Gilded metal lotus pedestal remains untouched metallic gold.
    const lotusMat=(m.root.getObjectByName('bathing-lotus-petal-0') as THREE.Mesh).material as THREE.MeshStandardMaterial
    expect(lotusMat.metalness).toBeCloseTo(.3,4)
    expect(lotusMat.userData.botanicalFinish).toBeUndefined()
    disposeTree(m.root)
  })
})
