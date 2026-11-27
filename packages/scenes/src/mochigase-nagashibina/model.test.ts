import {describe,it,expect} from 'vitest'
import * as THREE from 'three'
import {createNagashibinaModel} from './model'
import {disposeTree} from '../procedural-kit'
const clean=(m:ReturnType<typeof createNagashibinaModel>)=>{m.dispose();disposeTree(m.root)}
describe('Paper hina supported river release',()=>{
 it('restores exactly the same object transforms at every checkpoint',()=>{const m=createNagashibinaModel();for(let n=0;n<3;n++){m.pose(n,1);const end=new Map<string,number[]>();m.root.traverse(o=>end.set(o.name,[...o.matrixWorld.elements]));m.pose(n+1,0);m.root.traverse(o=>o.matrixWorld.elements.forEach((v,i)=>expect(v,o.name).toBeCloseTo(end.get(o.name)![i]!,8)))}clean(m)})
 it('raises the round carrier clear of the bank before moving toward water',()=>{const m=createNagashibinaModel();m.pose(0,0);expect(m.tray.position.y).toBeCloseTo(.06);expect(m.tray.position.x+.58).toBeLessThan(-.21);for(let i=0;i<=100;i++){m.pose(1,i/100);expect(m.tray.position.y).toBeGreaterThan(.06)}clean(m)})
 it('keeps paper figures dry and only drifts after the straw base contacts water',()=>{const m=createNagashibinaModel(),p=new THREE.Vector3();for(let i=0;i<=100;i++){const t=i/100;m.pose(2,t);if(t<.6){expect(m.tray.position.x).toBeCloseTo(.48);expect(m.tray.position.z).toBeCloseTo(0)}else{expect(m.tray.position.y).toBeCloseTo(-.012);expect(m.tray.position.y+.06).toBeGreaterThan(0)}for(const f of m.figures){const a=f.robe.geometry.getAttribute('position');for(let j=0;j<a.count;j++)expect(p.fromBufferAttribute(a,j).applyMatrix4(f.robe.matrixWorld).y).toBeGreaterThan(.06)}}clean(m)})
 it('carries the same pair and companions on the round tray without deforming their meshes',()=>{const m=createNagashibinaModel();expect(m.figures).toHaveLength(2);const before=new Map<string,number[]>();m.tray.traverse(o=>{const g=(o as THREE.Mesh).geometry;if(g)before.set(o.name,Array.from(g.getAttribute('position').array))});m.pose(3,0);m.tray.traverse(o=>{const g=(o as THREE.Mesh).geometry;if(g)expect(Array.from(g.getAttribute('position').array)).toEqual(before.get(o.name))});expect((m.base.geometry as THREE.CylinderGeometry).parameters.radiusTop).toBe(.58);clean(m)})
 it('animates the water shader without moving the waterline or allocating geometry, and honors reduced motion',()=>{const m=createNagashibinaModel(),g=m.water.surface.geometry,a=Array.from(g.getAttribute('position').array),before=m.water.time;m.update(.05);expect(m.water.time).toBeGreaterThan(before);const held=m.water.time;m.update(.05,true);expect(m.water.time).toBe(held);expect(m.water.surface.geometry).toBe(g);expect(Array.from(g.getAttribute('position').array)).toEqual(a);expect(m.water.surface.position.y).toBe(0);clean(m)})
 it('builds watertight FrontSide cupped notched peach blossoms while keeping the straw boat hull unchanged',()=>{
  const m=createNagashibinaModel()
  const checkWatertight=(mesh:THREE.Mesh)=>{
   const mat=mesh.material as THREE.MeshStandardMaterial
   expect(mat.side,mesh.name).toBe(THREE.FrontSide)
   expect(mat.vertexColors,mesh.name).toBe(true)
   expect(mat.userData.botanicalFinish?.knee,mesh.name).toBeCloseTo(.74,4)
   expect(mat.userData.botanicalFinish?.headroom,mesh.name).toBeCloseTo(.24,4)
   const pos=mesh.geometry.getAttribute('position') as THREE.BufferAttribute
   const idx=mesh.geometry.index!
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
   expect(signedVol6,mesh.name).toBeGreaterThan(0)
   expect([...edges.values()].every(v=>v===0),mesh.name).toBe(true)
  }
  for(let i=0;i<3;i++)checkWatertight(m.root.getObjectByName(`peach-${i}-petal-0`) as THREE.Mesh)
  checkWatertight(m.root.getObjectByName('peach-leaf-0') as THREE.Mesh)
  const strawMat=(m.base.material as THREE.MeshStandardMaterial)
  expect(strawMat.userData.craftSurface?.kind).toBe('straw')
  clean(m)
 })
})
