import {describe,expect,it} from 'vitest'
import * as THREE from 'three'
import {createNadeushiModel} from './model'
import {disposeTree} from '../procedural-kit'

describe('stone ox and visitor hand',()=>{
  it('faces the tapered horn walls outward for the ordinary front-face material',()=>{
    const m=createNadeushiModel();let minDot=Infinity
    for(const side of[-1,1]){
      const horn=m.ox.getObjectByName('horn-'+side) as THREE.Mesh,p=horn.geometry.getAttribute('position'),normal=horn.geometry.getAttribute('normal')
      const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(-.63,1.40,.18+side*.19),new THREE.Vector3(-.49,1.56,.18+side*.28),new THREE.Vector3(-.52,1.72,.18+side*.32)])
      for(let ring=0;ring<18;ring++)for(let j=0;j<12;j++){
        const offset=(ring*12+j)*6,centroid=new THREE.Vector3()
        for(let k=0;k<3;k++)centroid.add(new THREE.Vector3().fromBufferAttribute(p,offset+k))
        const radial=centroid.multiplyScalar(1/3).sub(curve.getPoint((ring+2/3)/18))
        minDot=Math.min(minDot,radial.dot(new THREE.Vector3().fromBufferAttribute(normal,offset)))
      }
    }
    expect(minDot).toBeGreaterThan(0);disposeTree(m.root)
  })
  it('keeps the sacred stone animal completely still throughout the interaction',()=>{
    const m=createNadeushiModel(),initial=new Map<number,number[]>()
    m.ox.traverse(o=>initial.set(o.id,[...o.matrixWorld.elements]))
    for(let step=0;step<3;step++)for(let i=0;i<=50;i++){m.pose(step,i/50);m.ox.traverse(o=>expect(o.matrixWorld.elements).toEqual(initial.get(o.id)))}
    disposeTree(m.root)
  })
  it('restores the exact hand pose at each checkpoint without teleportation',()=>{
    const m=createNadeushiModel()
    for(let step=0;step<3;step++){m.pose(step,1);const end=m.hand.matrixWorld.clone();m.pose(step+1,0);expect(m.hand.matrixWorld.elements).toEqual(end.elements)}
    disposeTree(m.root)
  })
  it('keeps the visible hand outside the head volume while making contact along the forehead',()=>{
    const m=createNadeushiModel(),p=new THREE.Vector3();let min=Infinity
    for(let step=0;step<3;step++)for(let n=0;n<=100;n++){
      m.pose(step,n/100);const headInverse=m.head.matrixWorld.clone().invert()
      let poseMin=Infinity
      m.hand.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.geometry)return;const a=mesh.geometry.getAttribute('position');for(let i=0;i<a.count;i++){
        p.fromBufferAttribute(a,i).applyMatrix4(mesh.matrixWorld).applyMatrix4(headInverse)
        const radius=p.length();min=Math.min(min,radius);poseMin=Math.min(poseMin,radius)
      }})
      expect(poseMin,`${step}:${n}`).toBeGreaterThanOrEqual(.995)
    }
    expect(min).toBeLessThan(1.03);disposeTree(m.root)
  })
})
