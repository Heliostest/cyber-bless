import{describe,it,expect}from'vitest'
import * as THREE from'three'
import{createWishingMalletModel}from'./model'
const points=(o:THREE.Object3D)=>{o.updateWorldMatrix(true,true);const result:THREE.Vector3[]=[];o.traverse(n=>{const m=n as THREE.Mesh;if(m.isMesh){const p=m.geometry.getAttribute('position');for(let i=0;i<p.count;i++)result.push(new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld))}});return result}
describe('supported wish-shaking mallet',()=>{
 it('rests the barrel and handle pommel on two actual supports at both ends of the experience',()=>{const m=createWishingMalletModel();for(const step of[0,3]){m.pose(step,0);expect(Math.min(...points(m.head).map(p=>p.y))).toBeCloseTo(new THREE.Box3().setFromObject(m.headRest).max.y,6);expect(Math.min(...points(m.pommel).map(p=>p.y))).toBeCloseTo(new THREE.Box3().setFromObject(m.handleRest).max.y,6)}})
 it('clears both supports and the ground across all603 actual vertex poses',()=>{const m=createWishingMalletModel(),supports=[m.headRest,m.handleRest].map(o=>new THREE.Box3().setFromObject(o));let checked=0;for(const step of[0,1,2])for(let i=0;i<=200;i++){m.pose(step,i/200);for(const p of points(m.actor)){checked++;if(p.y<.20-1e-6)throw Error('below resting envelope');if(step===1&&p.y<.85-1e-6)throw Error('sway clearance');for(const b of supports)if(p.x>b.min.x+1e-6&&p.x<b.max.x-1e-6&&p.z>b.min.z+1e-6&&p.z<b.max.z-1e-6&&p.y<b.max.y-1e-6)throw Error('support penetration')}}expect(checked).toBeGreaterThan(1_000_000)})
 it('swings the actual head right then left in the air, with a solid capped barrel and attached shaft',()=>{const m=createWishingMalletModel(),center=new THREE.Vector3(0,.36,-1.15),position=()=>m.actor.localToWorld(center.clone());m.pose(1,0);const home=position();m.pose(1,.25);expect(position().x-home.x).toBeGreaterThan(.3);m.pose(1,.75);expect(position().x-home.x).toBeLessThan(-.3);m.pose(1,1);expect(position().distanceTo(home)).toBeLessThan(1e-10);m.head.updateWorldMatrix(true,false);const ray=new THREE.Raycaster(m.actor.localToWorld(new THREE.Vector3(2,.36,-1.15)),new THREE.Vector3(-1,0,0));expect(m.actor.worldToLocal(ray.intersectObject(m.head,false)[0]!.point).x).toBeCloseTo(.68,5);expect(new THREE.Box3().setFromObject(m.handle).intersectsBox(new THREE.Box3().setFromObject(m.head))).toBe(true)})
 it('keeps all checkpoints continuous without reallocating or deforming geometry',()=>{const m=createWishingMalletModel(),buffers=new Map<THREE.Mesh,{geometry:THREE.BufferGeometry;data:THREE.BufferAttribute;values:number[]}>();m.root.traverse(o=>{const p=o as THREE.Mesh;if(p.isMesh){const data=p.geometry.getAttribute('position') as THREE.BufferAttribute;buffers.set(p,{geometry:p.geometry,data,values:Array.from(data.array)})}});for(let step=0;step<3;step++){m.pose(step,1);const a=points(m.actor);m.pose(step+1,0);points(m.actor).forEach((p,i)=>expect(p.distanceTo(a[i]!)).toBeLessThan(1e-10))}for(const[p,old]of buffers){expect(p.geometry).toBe(old.geometry);expect(p.geometry.getAttribute('position')).toBe(old.data);expect(Array.from(old.data.array)).toEqual(old.values)}})
 it('preserves smooth curved normals, restrained lacquer finish, and part-aligned wood grain axes',()=>{
  const m=createWishingMalletModel()
  for(const mesh of[m.head,m.handle,m.pommel]){
   const n=mesh.geometry.getAttribute('normal'),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3()
   let smoothTriangles=0
   for(let i=0;i<n.count;i+=3){a.fromBufferAttribute(n,i);b.fromBufferAttribute(n,i+1);c.fromBufferAttribute(n,i+2);if(a.distanceTo(b)>1e-3||b.distanceTo(c)>1e-3)smoothTriangles++}
   expect(smoothTriangles,mesh.name).toBeGreaterThanOrEqual(n.count/6)
  }
  const barrelMat=m.head.material as THREE.MeshPhysicalMaterial,pommelMat=m.pommel.material as THREE.MeshPhysicalMaterial
  expect(barrelMat).toBeInstanceOf(THREE.MeshPhysicalMaterial)
  expect(barrelMat.clearcoat).toBeGreaterThanOrEqual(.35);expect(barrelMat.clearcoat).toBeLessThanOrEqual(.48)
  expect(barrelMat.clearcoatRoughness).toBeGreaterThanOrEqual(.22);expect(barrelMat.clearcoatRoughness).toBeLessThanOrEqual(.32)
  expect(barrelMat.userData.craftSurface).toMatchObject({kind:'wood',axis:'x'})
  expect(pommelMat).toBeInstanceOf(THREE.MeshPhysicalMaterial)
  expect(pommelMat.clearcoat).toBeGreaterThanOrEqual(.35);expect(pommelMat.clearcoat).toBeLessThanOrEqual(.48)
  expect(pommelMat.clearcoatRoughness).toBeGreaterThanOrEqual(.22);expect(pommelMat.clearcoatRoughness).toBeLessThanOrEqual(.32)
  expect((m.headRest.material as THREE.Material).userData.craftSurface).toMatchObject({kind:'wood',axis:'x'})
  expect((m.handleRest.material as THREE.Material).userData.craftSurface).toMatchObject({kind:'wood',axis:'y'})
  expect((m.handle.material as THREE.Material).userData.craftSurface).toMatchObject({kind:'wood',axis:'z'})
  expect(pommelMat.userData.craftSurface).toMatchObject({kind:'wood',axis:'z'})
  const headRestMat=m.headRest.material as THREE.MeshStandardMaterial,handleRestMat=m.handleRest.material as THREE.MeshStandardMaterial,handleMat=m.handle.material as THREE.MeshPhysicalMaterial
  expect(new Set([headRestMat.userData.craftSurface.scale,handleRestMat.userData.craftSurface.scale,handleMat.userData.craftSurface.scale]).size).toBe(3)
  expect(barrelMat.map).toBeNull();expect(barrelMat.userData.craftSurface.strength).toBeLessThanOrEqual(.15)
  for(const mat of[headRestMat,handleRestMat,handleMat,pommelMat]){
   expect(mat.map).toBeInstanceOf(THREE.DataTexture)
   expect(mat.bumpMap).toBeInstanceOf(THREE.DataTexture)
   expect(mat.roughnessMap).toBeInstanceOf(THREE.DataTexture)
  }
  expect(headRestMat.map).not.toBe(handleRestMat.map);expect(handleMat.map).not.toBe(headRestMat.map)
  for(const mesh of[m.headRest,m.handleRest,m.handle,m.pommel])expect(mesh.geometry.getAttribute('uv')).toBeDefined()
  const textures=new Set<THREE.Texture>()
  for(const mat of[headRestMat,handleRestMat,handleMat,pommelMat])for(const tex of[mat.map,mat.bumpMap,mat.roughnessMap])if(tex)textures.add(tex)
  const counts=new Map<THREE.Texture,number>()
  textures.forEach(t=>t.addEventListener('dispose',()=>counts.set(t,(counts.get(t)??0)+1)))
  m.dispose();m.dispose()
  expect(counts.size).toBe(textures.size);expect([...counts.values()].every(n=>n===1)).toBe(true)
 })
})
