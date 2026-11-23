import {describe,it,expect} from 'vitest'
import * as THREE from 'three'
import {createMartisorModel} from './model'
const vertices=(root:THREE.Object3D)=>{const points:THREE.Vector3[]=[];root.updateMatrixWorld(true);root.traverse(o=>{const g=(o as THREE.Mesh).geometry;if(g){const a=g.attributes.position!;for(let i=0;i<a.count;i++)points.push(new THREE.Vector3().fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld))}});return points}
describe('a spring cord supported by an actual branch',()=>{
 it('roots the real trunk mesh into the ground surface',()=>{const m=createMartisorModel(),trunk=m.root.getObjectByName('martisor-trunk')!,ground=m.root.getObjectByName('martisor-ground')!;const bottom=Math.min(...vertices(trunk).map(p=>p.y)),base=new THREE.Box3().setFromObject(ground);expect(bottom).toBeLessThanOrEqual(base.max.y+1e-6);expect(bottom).toBeGreaterThan(base.min.y)})
 it('has an open two-colour loop and separate tassels instead of an opaque disc',()=>{const m=createMartisorModel();expect(m.root.getObjectByName('martisor-red-strand')).toBeTruthy();expect(m.root.getObjectByName('martisor-white-strand')).toBeTruthy();m.pose(1,0);const ray=new THREE.Raycaster(new THREE.Vector3(.55,1.5,2),new THREE.Vector3(0,0,-1));expect(ray.intersectObject(m.cord,true)).toHaveLength(0)})
 it('starts on the ground, clears it during lifting and keeps all moving cord vertices outside the branch cylinder',()=>{const m=createMartisorModel();let low=Infinity;for(const p of vertices(m.cord))low=Math.min(low,p.y);expect(low).toBeGreaterThanOrEqual(-1e-6);expect(low).toBeLessThan(.002);let ground=Infinity,branch=Infinity;for(let step=0;step<3;step++)for(let n=0;n<=100;n++){m.pose(step,n/100);for(const p of vertices(m.cord)){ground=Math.min(ground,p.y);if(p.z>=-.65&&p.z<=.40)branch=Math.min(branch,Math.hypot(p.x-.55,p.y-1.5))}}expect(ground).toBeGreaterThanOrEqual(-1e-6);expect(branch).toBeGreaterThanOrEqual(.055-1e-6)})
 it('threads through the open free end before settling against the upper branch surface',()=>{const m=createMartisorModel();m.pose(1,0);expect(m.cord.position.toArray()).toEqual([.55,1.5,.7]);m.pose(2,0);expect(m.cord.position.toArray()).toEqual([.55,1.5,-.05]);m.pose(3,0);expect(m.cord.position.y).toBeCloseTo(1.347,8);const surface=vertices(m.cord).filter(p=>p.z>-.65&&p.z<.4);expect(Math.min(...surface.map(p=>Math.hypot(p.x-.55,p.y-1.5)))).toBeCloseTo(.055,4)})
 it('uses exact adjacent checkpoints and finite transforms, with no geometry reallocation during motion',()=>{const m=createMartisorModel(),owned:THREE.BufferGeometry[]=[];m.cord.traverse(o=>{if((o as THREE.Mesh).geometry)owned.push((o as THREE.Mesh).geometry)});for(let step=0;step<3;step++){m.pose(step,1);const matrix=m.cord.matrixWorld.elements.slice();m.pose(step+1,0);expect(m.cord.matrixWorld.elements).toEqual(matrix)}for(const n of[NaN,Infinity,-1,2]){m.pose(0,n);expect(m.cord.matrixWorld.elements.every(Number.isFinite)).toBe(true)}const after:THREE.BufferGeometry[]=[];m.cord.traverse(o=>{if((o as THREE.Mesh).geometry)after.push((o as THREE.Mesh).geometry)});expect(after).toEqual(owned)})
 it('keeps outward winding on every custom cord/knot/tassel mesh, true 3D tassel volume, snug 2-ply strands, and idempotent texture disposal',()=>{
  const m=createMartisorModel()
  const va=new THREE.Vector3(),vb=new THREE.Vector3(),vc=new THREE.Vector3(),fn=new THREE.Vector3(),vn=new THREE.Vector3()
  let checkedMeshes=0
  m.cord.traverse(o=>{
   const mesh=o as THREE.Mesh
   if(!mesh.isMesh||!mesh.geometry||!mesh.geometry.index)return
   const pos=mesh.geometry.getAttribute('position') as THREE.BufferAttribute
   const norm=mesh.geometry.getAttribute('normal') as THREE.BufferAttribute
   const idx=mesh.geometry.index
   let nonDegenerate=0,outward=0,signedVol6=0
   for(let i=0;i<idx.count;i+=3){
    const ia=idx.getX(i),ib=idx.getX(i+1),ic=idx.getX(i+2)
    va.fromBufferAttribute(pos,ia);vb.fromBufferAttribute(pos,ib);vc.fromBufferAttribute(pos,ic)
    fn.copy(vb).sub(va).cross(vc.clone().sub(va))
    if(fn.length()>1e-10){
     nonDegenerate++
     vn.fromBufferAttribute(norm,ia)
     if(fn.dot(vn)>0)outward++
    }
    signedVol6+=va.dot(vb.clone().cross(vc))
   }
   expect(outward,mesh.name).toBe(nonDegenerate)
   // Closed/revolved crown, core, knot, and wrap meshes must have strictly positive signed volume.
   if(mesh.name.includes('head')||mesh.name.includes('knot')||mesh.name.includes('collar')||mesh.name.includes('core')){
    expect(signedVol6,`${mesh.name} signed volume`).toBeGreaterThan(0)
   }
   checkedMeshes++
  })
  expect(checkedMeshes).toBeGreaterThanOrEqual(12)

  // True 3D tassel fringe spans full front-to-back depth (not a flat 2D z=0 comb).
  for(const name of ['martisor-red-head-fringe','martisor-white-head-fringe']){
   const fringe=m.cord.getObjectByName(name) as THREE.Mesh
   expect(fringe,name).toBeDefined()
   const box=new THREE.Box3().setFromBufferAttribute(fringe.geometry.getAttribute('position') as THREE.BufferAttribute)
   expect(box.min.z,name).toBeLessThan(-0.015)
   expect(box.max.z,name).toBeGreaterThan(0.015)
   expect(Math.max(Math.abs(box.min.z),Math.abs(box.max.z)),name).toBeLessThanOrEqual(0.0215)
  }

  // Tassel sway rotates pivots smoothly and resets cleanly on pose().
  m.setTasselSway(0.12,-0.14)
  expect((m.cord.getObjectByName('martisor-red-head-pivot')!).rotation.z).toBeCloseTo(0.12,6)
  expect((m.cord.getObjectByName('martisor-white-head-pivot')!).rotation.z).toBeCloseTo(-0.14,6)
  m.pose(3,0)
  expect((m.cord.getObjectByName('martisor-red-head-pivot')!).rotation.z).toBe(0)
  expect((m.cord.getObjectByName('martisor-white-head-pivot')!).rotation.z).toBe(0)

  // Texture disposal is idempotent (exactly once).
  const mat=(m.cord.getObjectByName('martisor-red-strand') as THREE.Mesh).material as THREE.MeshStandardMaterial
  expect(mat.map).toBeTruthy(); expect(mat.bumpMap).toBeTruthy()
  let mapFreed=0,bumpFreed=0
  mat.map!.addEventListener('dispose',()=>{mapFreed++})
  mat.bumpMap!.addEventListener('dispose',()=>{bumpFreed++})
  m.dispose(); m.dispose()
  expect(mapFreed).toBe(1); expect(bumpFreed).toBe(1)
 })
})
