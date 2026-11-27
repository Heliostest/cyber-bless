import {describe,it,expect,vi} from 'vitest'
import * as THREE from 'three'
import {createKagamiBirakiModel} from './model'
import {disposeTree} from '../procedural-kit'
const clean=(m:ReturnType<typeof createKagamiBirakiModel>)=>{m.dispose();disposeTree(m.root)}
describe('Prepared sake cask and ribboned wooden mallet',()=>{
 it('restores the complete cask and mallet identically at all checkpoints',()=>{const m=createKagamiBirakiModel();for(let n=0;n<3;n++){m.pose(n,1);const end=new Map<string,number[]>();m.root.traverse(o=>end.set(o.name,[...o.matrixWorld.elements]));m.pose(n+1,0);m.root.traverse(o=>o.matrixWorld.elements.forEach((v,i)=>expect(v,o.name).toBeCloseTo(end.get(o.name)![i]!,8)))}clean(m)})
 it('rests the mallet on the lid initially and on the wooden mallet tray after returning',()=>{const m=createKagamiBirakiModel();const trayTop=new THREE.Box3().setFromObject(m.root.getObjectByName('mallet-tray-top')!).max.y;m.pose(0,0);expect(new THREE.Box3().setFromObject(m.head).min.y).toBeCloseTo(1.253,6);m.pose(3,0);expect(new THREE.Box3().setFromObject(m.head).min.y).toBeCloseTo(trayTop,6);expect(new THREE.Box3().setFromObject(m.handle).min.y).toBeCloseTo(trayTop+.040,6);expect(new THREE.Box3().setFromObject(m.malletTray).min.y).toBeCloseTo(-.012,6);clean(m)})
 it('opens the prepared lid only at the seam-end contact then rebounds clear',()=>{const m=createKagamiBirakiModel();for(const t of[0,.1,.39,.4]){m.pose(1,t);expect(m.lids[1]!.position.x).toBeCloseTo(.002)}m.pose(1,.4);expect(new THREE.Box3().setFromObject(m.head).min.y).toBeCloseTo(1.253,6);expect(m.mallet.position.z).toBeCloseTo(.45);m.pose(1,1);expect(m.lids[1]!.position.x).toBeCloseTo(.15);expect(new THREE.Box3().setFromObject(m.head).min.y).toBeGreaterThan(1.34);clean(m)})
 it('keeps both rigid lid halves level on the rim throughout opening',()=>{const m=createKagamiBirakiModel();const geometries=m.lids.map(o=>o.geometry);for(let s=0;s<3;s++)for(let i=0;i<=100;i++){m.pose(s,i/100);m.lids.forEach((o,n)=>{expect(new THREE.Box3().setFromObject(o).min.y).toBeCloseTo(1.208,6);expect(o.rotation.x).toBeCloseTo(-Math.PI/2);expect(o.position.x*Math.sign(n-.5)).toBeGreaterThanOrEqual(.002);expect(Math.abs(o.position.x)).toBeLessThanOrEqual(.15);expect(o.geometry).toBe(geometries[n])})}clean(m)})
 it('leaves the grounded cask stand, cask, and contained liquid stationary while the mallet moves',()=>{const m=createKagamiBirakiModel();const standTop=new THREE.Box3().setFromObject(m.root.getObjectByName('cask-stand-top')!).max.y;const trayTop=new THREE.Box3().setFromObject(m.root.getObjectByName('mallet-tray-top')!).max.y;const fixed=[m.caskStand,m.malletTray,m.barrel,m.wrap,m.liquid].map(o=>[...o.matrixWorld.elements]);for(let s=0;s<3;s++)for(let i=0;i<=50;i++){m.pose(s,i/50);[m.caskStand,m.malletTray,m.barrel,m.wrap,m.liquid].forEach((o,n)=>expect(o.matrixWorld.elements).toEqual(fixed[n]));expect(new THREE.Box3().setFromObject(m.head).min.y).toBeGreaterThanOrEqual(trayTop-.000001)}expect(new Set(m.roots).size).toBe(1);expect(new THREE.Box3().setFromObject(m.caskStand).min.y).toBeCloseTo(-.012,6);expect(new THREE.Box3().setFromObject(m.barrel).min.y).toBeCloseTo(standTop,6);const texture=(m.wrap.material as THREE.MeshStandardMaterial).map as THREE.DataTexture;expect(Math.min(...Array.from(texture.image.data))).toBeGreaterThan(180);clean(m)})

 it('builds taut twisted rope hoops, flush handle cloth bands and cleared curved ribbon tails with finite outward normals',()=>{
  const m=createKagamiBirakiModel()
  m.pose(3,0)
  const craftNames=[
   'woven-komo-wrap','komo-edge-trim-bottom','komo-edge-trim-top',
   'rope-hoop-0.2','rope-hoop-0.91',
   'ribbon-band-0','ribbon-band-1','ribbon-knot','ribbon-knot-accent','ribbon-tail-0','ribbon-tail-1',
  ]
  for(const name of craftNames){
   const o=m.root.getObjectByName(name) as THREE.Mesh
   expect(o,name).toBeDefined()
   const pos=o.geometry.getAttribute('position'),nrm=o.geometry.getAttribute('normal')
   expect(pos.count,name).toBeGreaterThan(60)
   for(let i=0;i<pos.count;i++){
    expect(Number.isFinite(pos.getX(i))&&Number.isFinite(pos.getY(i))&&Number.isFinite(pos.getZ(i)),name).toBe(true)
    expect(Number.isFinite(nrm.getX(i))&&Number.isFinite(nrm.getY(i))&&Number.isFinite(nrm.getZ(i)),name).toBe(true)
   }
  }
  // Both taut rope hoops remain tightly centered at y=0.20 and y=0.91 without sagging.
  for(const y of [.20,.91]){
   const hoop=m.root.getObjectByName('rope-hoop-'+y) as THREE.Mesh
   const box=new THREE.Box3().setFromBufferAttribute(hoop.geometry.getAttribute('position') as THREE.BufferAttribute)
   expect(Math.abs((box.min.y+box.max.y)/2)).toBeLessThan(.004)
   expect(box.max.y-box.min.y).toBeLessThan(.085)
  }
  // Cloth handle bands hug the 0.035 handle flush (zero air gap underneath) and outward faces point outward.
  for(const i of [0,1]){
   const band=m.root.getObjectByName('ribbon-band-'+i) as THREE.Mesh
   const pos=band.geometry.getAttribute('position')
   let minR=Infinity,maxR=0
   for(let k=0;k<pos.count;k++){const r=Math.hypot(pos.getX(k),pos.getY(k));minR=Math.min(minR,r);maxR=Math.max(maxR,r)}
   expect(minR,`band ${i} inner radius seats flush on handle`).toBeLessThanOrEqual(.0351)
   expect(maxR,`band ${i} outer radius stays snug`).toBeLessThan(.043)
  }
  // Folded cloth knot seats flush on top of the handle wrap; curved ribbon tails clear handle and ground.
  const knot=m.root.getObjectByName('ribbon-knot') as THREE.Mesh
  const knotBox=new THREE.Box3().setFromBufferAttribute(knot.geometry.getAttribute('position') as THREE.BufferAttribute)
  expect(knot.position.y+knotBox.min.y).toBeLessThan(.002)
  for(const i of [0,1]){
   const tail=m.root.getObjectByName('ribbon-tail-'+i) as THREE.Mesh
   const tailWorldBox=new THREE.Box3().setFromObject(tail)
   expect(tailWorldBox.min.y,`ribbon-tail-${i} clears ground at rest`).toBeGreaterThan(-.005)
   const pos=tail.geometry.getAttribute('position'),p=new THREE.Vector3(),invMallet=m.mallet.matrixWorld.clone().invert()
   let minHandleClearance=Infinity
   for(let k=0;k<pos.count;k++){
    p.fromBufferAttribute(pos,k).applyMatrix4(tail.matrixWorld).applyMatrix4(invMallet)
    minHandleClearance=Math.min(minHandleClearance,Math.hypot(p.x,p.y+.035))
   }
   expect(minHandleClearance,`ribbon-tail-${i} clears 0.035 handle`).toBeGreaterThan(.036)
  }
  clean(m)
 })

 it('applies deterministic ribbon tail trail during mid-strike and zeroes cleanly at checkpoints while disposing all textures once',()=>{
  const m=createKagamiBirakiModel()
  const p0=m.root.getObjectByName('ribbon-tail-pivot-0')!
  const p1=m.root.getObjectByName('ribbon-tail-pivot-1')!
  m.pose(1,0)
  expect(p0.rotation.x).toBe(0);expect(p1.rotation.x).toBe(0)
  m.pose(1,.2)
  expect(Math.abs(p0.rotation.x)).toBeGreaterThan(.10)
  expect(Math.abs(p1.rotation.x)).toBeGreaterThan(.10)
  m.pose(1,1)
  expect(p0.rotation.x).toBe(0);expect(p1.rotation.x).toBe(0)
  const textures=new Set<THREE.Texture>()
  m.root.traverse(o=>{
   if(o.userData?.effect)return
   const mat=(o as THREE.Mesh).material as THREE.MeshStandardMaterial|undefined
   if(mat?.map)textures.add(mat.map)
   if(mat?.bumpMap)textures.add(mat.bumpMap)
  })
  expect(textures.size).toBe(6)
  const spies=[...textures].map(t=>vi.spyOn(t,'dispose'))
  m.dispose();m.dispose()
  for(const spy of spies)expect(spy).toHaveBeenCalledTimes(1)
  disposeTree(m.root)
 })
})
