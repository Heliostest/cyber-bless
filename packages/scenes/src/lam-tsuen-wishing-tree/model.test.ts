import {describe,it,expect} from 'vitest'
import * as THREE from 'three'
import {createLamTsuenModel} from './model'
import {disposeTree} from '../procedural-kit'

describe('Lam Tsuen material relationships',()=>{
 it('places paper and plastic orange on paving before throwing, with both ends of the cord attached',()=>{
  const m=createLamTsuenModel();m.pose(2,0)
  for(const name of ['lamtsuen-paper','lamtsuen-orange']){const box=new THREE.Box3().setFromObject(m.root.getObjectByName(name)!);expect(box.min.y).toBeCloseTo(.035,6)}
  for(let i=0;i<=100;i++){m.pose(2,i/100);expect(m.points[0]!.distanceTo(m.roots[0]!.localToWorld(new THREE.Vector3(0,.425,.014)))).toBeLessThan(1e-8);expect(m.points[32]!.distanceTo(m.roots[1]!.localToWorld(new THREE.Vector3(0,.30,0)))).toBeLessThan(1e-8)}
  disposeTree(m.root)
 })
 it('keeps the orange clear of the branch through its full throw',()=>{
  const m=createLamTsuenModel();let gap=Infinity
  for(let i=0;i<=1000;i++){m.pose(2,i/1000);const p=m.roots[1]!.position;gap=Math.min(gap,Math.hypot(p.y-1.55,p.z+.10)-.21-.07)}
  expect(gap).toBeGreaterThan(0);disposeTree(m.root)
 })
 it('writes only during writing and binds before throwing, then restores exact visible details',()=>{
  const m=createLamTsuenModel(),visible=(prefix:string)=>{let n=0;m.root.traverseVisible(o=>{if(o.name.startsWith(prefix)&&o.name!=='lamtsuen-cord-saddle')n++});return n}
  expect(visible('lamtsuen-ink')).toBe(0);expect(visible('lamtsuen-cord')).toBe(0)
  m.pose(0,.5);expect(visible('lamtsuen-ink')).toBe(7);m.pose(1,0);expect(visible('lamtsuen-ink')).toBe(14)
  m.pose(1,.5);expect(visible('lamtsuen-cord')).toBe(16);m.pose(1,0);expect(visible('lamtsuen-cord')).toBe(0)
  m.pose(3,0);expect(visible('lamtsuen-cord')).toBe(32);expect(m.roots[0]!.position.y).toBe(.675);disposeTree(m.root)
 })
 it('builds replica limbs and a staggered outline-free canopy inside the original envelope',()=>{
  const m=createLamTsuenModel();m.root.updateMatrixWorld(true)
  const canopyBounds=new THREE.Box3()
  let limbCount=0,clusterCount=0,tuftCount=0
  m.subject.traverse(o=>{
   if(!(o instanceof THREE.Mesh))return
   const isLimb=o.name==='lamtsuen-trunk'||o.name==='lamtsuen-fork'||o.name==='lamtsuen-wish-branch'||o.name==='lamtsuen-crown-stem'||o.name==='lamtsuen-crown-bough'||o.name.startsWith('lamtsuen-crown-twig-')||o.name.startsWith('lamtsuen-fork-collar-')
   const isFoliage=o.name.startsWith('lamtsuen-leaf-cluster-')||o.name.startsWith('lamtsuen-leaf-tuft-')
   if(!isLimb&&!isFoliage)return
   const mat=o.material as THREE.MeshStandardMaterial
   expect(mat.side,o.name).toBe(THREE.FrontSide)
   if(isLimb)limbCount++
   if(isFoliage){
    expect(o.userData.toonSurface?.outline,`${o.name} outline disabled`).toBe(false)
    expect(mat.userData.treeClusterNormals,`${o.name} cluster normals`).toBe(true)
    canopyBounds.expandByObject(o,true)
    if(o.name.startsWith('lamtsuen-leaf-cluster-'))clusterCount++
    else tuftCount++
   }
  })
  expect(limbCount).toBeGreaterThanOrEqual(10)
  expect(clusterCount).toBeGreaterThanOrEqual(12)
  expect(tuftCount).toBeGreaterThanOrEqual(20)
  // Stay strictly within original canopy envelope & behind thrown plastic orange (z_min ≈ -0.61).
  expect(canopyBounds.min.x).toBeGreaterThanOrEqual(-1.22)
  expect(canopyBounds.max.x).toBeLessThanOrEqual(1.22)
  expect(canopyBounds.max.y).toBeLessThanOrEqual(2.50)
  expect(canopyBounds.min.z).toBeGreaterThanOrEqual(-1.30)
  expect(canopyBounds.max.z).toBeLessThanOrEqual(-0.64)
  const trunkBox=new THREE.Box3().setFromObject(m.root.getObjectByName('lamtsuen-trunk')!)
  expect(trunkBox.min.y).toBeCloseTo(.035,4)
  disposeTree(m.root)
 })
 it('preserves the plastic orange, equatorial mold seam, stem, tie ring, and wish-branch landing clearance',()=>{
  const m=createLamTsuenModel();m.root.updateMatrixWorld(true)
  expect(m.root.getObjectByName('lamtsuen-orange')).not.toBeNull()
  expect(m.root.getObjectByName('lamtsuen-plastic-seam')).not.toBeNull()
  expect(m.root.getObjectByName('lamtsuen-orange-stem')).not.toBeNull()
  expect(m.root.getObjectByName('lamtsuen-orange-tie')).not.toBeNull()
  const branchPos=(m.branch.geometry as THREE.BufferGeometry).getAttribute('position') as THREE.BufferAttribute
  // Verify every vertex in the throw/cord landing band (x ∈ [0.10, 0.62]) stays within r=0.070 of (y=1.55, z=-0.10).
  let checked=0
  const p=new THREE.Vector3()
  for(let i=0;i<branchPos.count;i++){
   p.fromBufferAttribute(branchPos,i).applyMatrix4(m.branch.matrixWorld)
   if(p.x>=.10&&p.x<=.62){
    const r=Math.hypot(p.y-1.55,p.z+.10)
    expect(r).toBeLessThanOrEqual(.0701)
    checked++
   }
  }
  expect(checked).toBeGreaterThan(20)
  disposeTree(m.root)
 })
})
