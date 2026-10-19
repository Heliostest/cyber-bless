import {afterEach,describe,it,expect} from 'vitest'
import * as THREE from 'three'
import {disposeTree} from '../procedural-kit'
import {createTamagushiModel} from './model'
const models:ReturnType<typeof createTamagushiModel>[]=[]
const create=()=>{const m=createTamagushiModel();models.push(m);return m}
// Narrow-phase regression probe: world-space triangles, never box overlap alone.
function solid(mesh:THREE.Mesh){
 const positions=mesh.geometry.getAttribute('position'),index=mesh.geometry.index
 const vertices=Array.from({length:positions.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld))
 const triangles:THREE.Triangle[]=[]
 for(let i=0;i<(index?.count??positions.count);i+=3){
  const triangle=new THREE.Triangle(...[0,1,2].map(j=>vertices[index?index.getX(i+j):i+j]!) as [THREE.Vector3,THREE.Vector3,THREE.Vector3])
  if(triangle.getArea()>1e-12)triangles.push(triangle)
 }
 return{vertices,triangles,box:new THREE.Box3().setFromPoints(vertices)}
}
const probeDirections=[[.371,.619,.697],[.913,.279,-.299],[-.403,.827,.392]].map(v=>new THREE.Vector3(...v as [number,number,number]).normalize())
function inside(s:ReturnType<typeof solid>,point:THREE.Vector3){
 if(!s.box.clone().expandByScalar(-2e-7).containsPoint(point))return false
 return probeDirections.every(direction=>{
  const ray=new THREE.Ray(point,direction),hits:number[]=[]
  for(const triangle of s.triangles){const p=ray.intersectTriangle(triangle.a,triangle.b,triangle.c,false,new THREE.Vector3());if(p)hits.push(p.distanceTo(point))}
  hits.sort((a,b)=>a-b)
  return (hits[0]??Infinity)>2e-7&&hits.filter((n,i)=>i===0||n-hits[i-1]!>2e-7).length%2===1
 })
}
function penetrates(a:ReturnType<typeof solid>,b:ReturnType<typeof solid>){
 if(!a.box.clone().expandByScalar(-2e-7).intersectsBox(b.box))return false
 for(const [source,target] of [[a,b],[b,a]])for(const first of source!.triangles){
  const edges=[first.a,first.b,first.c],firstBox=new THREE.Box3().setFromPoints(edges)
  for(const second of target!.triangles){
   if(!firstBox.intersectsBox(new THREE.Box3().setFromPoints([second.a,second.b,second.c])))continue
   const normal=second.getNormal(new THREE.Vector3())
   for(let edge=0;edge<3;edge++){
    const p=edges[edge]!,q=edges[(edge+1)%3]!,d0=p.clone().sub(second.a).dot(normal),d1=q.clone().sub(second.a).dot(normal)
    if(!(d0>2e-7&&d1< -2e-7||d0< -2e-7&&d1>2e-7))continue
    const crossing=p.clone().lerp(q,d0/(d0-d1)),bary=second.getBarycoord(crossing,new THREE.Vector3())
    if(!bary||Math.min(bary.x,bary.y,bary.z)<=1e-8)continue
    const inward=first.getNormal(new THREE.Vector3()).add(normal).negate().normalize()
    for(const amount of [8e-7,2e-6,1e-5]){const witness=crossing.clone().addScaledVector(inward,amount);if(inside(a,witness)&&inside(b,witness))return true}
   }
  }
 }
 return [[a,b],[b,a]].some(([source,target])=>[...source!.vertices,...source!.triangles.map(t=>t.getMidpoint(new THREE.Vector3()))].some(p=>inside(target!,p)))
}
afterEach(()=>models.splice(0).forEach(m=>disposeTree(m.root)))
describe('Held sakaki and shide offering',()=>{
 it('keeps the branch, white paper and visible hands opaque and targets a real leaf',()=>{
  const m=create();expect(m.papers).toHaveLength(2);expect(m.leaves).toHaveLength(5);expect(m.hands).toHaveLength(2)
  expect(m.roots).toEqual([m.branch,m.branch,m.branch]);expect(m.targets).toEqual([m.leaves[0],m.leaves[0],m.leaves[0]])
  m.root.traverse(o=>{const mesh=o as THREE.Mesh;if(mesh.isMesh)for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material]){expect(mat.transparent).toBe(false);expect(mat.opacity).toBe(1)}})
 })
 it('turns clockwise from left foliage to forward foliage, then root toward the shrine',()=>{
  const m=create(),tip=new THREE.Vector3(-.8,0,0),base=new THREE.Vector3(.8,0,0)
  m.pose(0,0);expect(m.branch.localToWorld(tip.clone()).x).toBeLessThan(0)
  m.pose(1,0);expect(m.branch.localToWorld(tip.clone()).z).toBeLessThan(-.79);expect(m.branch.rotation.y).toBeCloseTo(-Math.PI/2)
  m.pose(2,0);expect(m.branch.localToWorld(base.clone()).z).toBeLessThan(-.79);expect(m.branch.rotation.y).toBeCloseTo(-Math.PI*1.5)
  m.pose(3,0);expect(m.branch.localToWorld(base.clone()).z).toBeLessThan(-1.14)
 })
 it('keeps rigid actual vertices finite, above the floor and the held branch clear of the supports',()=>{
  const m=create(),meshes:THREE.Mesh[]=[],v=new THREE.Vector3();m.root.traverse(o=>{if((o as THREE.Mesh).isMesh)meshes.push(o as THREE.Mesh)})
  const originals=meshes.map(o=>Array.from(o.geometry.getAttribute('position').array));let floor=Infinity,held=Infinity
  for(let step=0;step<3;step++)for(let n=0;n<=200;n++){m.pose(step,n/200);for(const mesh of meshes){const p=mesh.geometry.getAttribute('position');for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);if(!Number.isFinite(v.x+v.y+v.z))throw Error(mesh.name);floor=Math.min(floor,v.y);if(step<2&&m.branch.getObjectById(mesh.id))held=Math.min(held,v.y)}}}
  expect(floor).toBeGreaterThan(-1e-6);expect(held).toBeGreaterThan(1.4);meshes.forEach((m,i)=>expect(Array.from(m.geometry.getAttribute('position').array)).toEqual(originals[i]))
 })
 it('keeps the left hand beneath its contact point while the right hand changes its grip',()=>{
  const m=create();for(let i=0;i<=100;i++){m.pose(1,i/100*.30);const support=m.branchPoint(.35),p=m.hands[0]!.group.position;expect(p.x-support.x).toBeCloseTo(-.12);expect(p.y+.035).toBeCloseTo(support.y-.025);expect(p.z-support.z).toBeCloseTo(.04)}
  m.pose(1,.15);expect(m.hands[1]!.group.position.y).toBeLessThan(1.25)
 })
 it('settles the actual stem on both supports before withdrawing the hands and keeps their palms above the table',()=>{
  const m=create();m.pose(2,.80);const stemBottom=new THREE.Box3().setFromObject(m.stem).min.y
  for(const rail of m.rails){const b=new THREE.Box3().setFromObject(rail);expect(stemBottom).toBeCloseTo(b.max.y,6);expect(b.max.y).toBeCloseTo(1.16)}
  const before=m.hands.map(h=>h.group.position.clone());m.pose(3,0);expect(new THREE.Box3().setFromObject(m.stem).min.y).toBeCloseTo(stemBottom)
  m.hands.forEach((h,i)=>{expect(h.group.position.distanceTo(before[i]!)).toBeCloseTo(.38);expect(new THREE.Box3().setFromObject(h.palm).min.y).toBeGreaterThan(1.01)})
 })
 it('uses closed welded surfaces, including thin paper, with matching directed edges',()=>{
  const m=create();m.root.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;const p=mesh.geometry.getAttribute('position'),index=mesh.geometry.index,ids=new Map<string,number>(),weld=Array.from({length:p.count},(_,i)=>{const key=[p.getX(i),p.getY(i),p.getZ(i)].map(x=>Math.round(x*1e6)).join(',');if(!ids.has(key))ids.set(key,ids.size);return ids.get(key)!}),edges=new Map<string,number[]>()
   for(let i=0;i<(index?.count??p.count);i+=3){const a=[0,1,2].map(n=>weld[index?index.getX(i+n):i+n]!);if(new Set(a).size<3)continue;for(let j=0;j<3;j++){const x=a[j]!,y=a[(j+1)%3]!,key=[Math.min(x,y),Math.max(x,y)].join(',');edges.set(key,[...(edges.get(key)??[]),x<y?1:-1])}}
   for(const values of edges.values())expect(values.sort(),mesh.name).toEqual([-1,1])
  })
 })
 it('restores each checkpoint continuously with unchanged branch and hand geometry',()=>{
  const a=create(),b=create();for(let step=0;step<3;step++){a.pose(step,1);b.pose(step+1,0);a.root.traverse(o=>{const p=b.root.getObjectByName(o.name)!;expect(o.matrixWorld.elements).toEqual(p.matrixWorld.elements)})}
 })
 it('avoids the witnessed hand, branch, paper and support penetrations during turning and placement',()=>{
  const m=create(),mesh=(name:string)=>m.root.getObjectByName('tamagushi-'+name) as THREE.Mesh
  const pairs=[['thumb-0','stem'],['thumb-1','stem'],['thumb-0','table-top'],['thumb-1','table-top'],['paper-tie-0','palm-0'],['paper-tie-0','thumb-0'],['paper-tie-1','palm-0'],['paper-tie-0','support-1'],['stem','forearm-0'],['stem','forearm-1'],['support-1','palm-1'],['support-1','forearm-1'],['leaf-2','leaf-4'],['stem','leaf-4']]
  for(const [step,t] of [[0,0],[0,.88],[1,.50],[1,.75],[2,.75],[2,.82],[2,1]]){
   m.pose(step!,t!);const shapes=new Map(pairs.flat().map(name=>[name,solid(mesh(name))]))
   for(const [a,b]of pairs)expect(penetrates(shapes.get(a!)!,shapes.get(b!)!),`step ${step}/${t}: ${a}/${b}`).toBe(false)
  }
  // Recreate two observed defects to ensure the probe detects interpenetration.
  m.pose(0,0);mesh('thumb-0').position.y=-.005;m.root.updateMatrixWorld(true)
  expect(penetrates(solid(mesh('thumb-0')),solid(m.stem))).toBe(true)
  mesh('thumb-0').position.y=-.042;m.rails[1]!.position.z=.05;m.pose(2,.82)
  expect(penetrates(solid(m.rails[1]!),solid(mesh('palm-1')))).toBe(true)
 })
 it('places the assembled branch center of volume between the longitudinal supports after withdrawing both hands',()=>{
  const m=create();m.pose(3,0)
  let volume=0;const moment=new THREE.Vector3()
  // Uniform component density is a geometric sanity check, not a dynamics simulation.
  m.branch.traverse(o=>{if(!(o as THREE.Mesh).isMesh)return
   for(const triangle of solid(o as THREE.Mesh).triangles){
    const tetra=triangle.a.dot(triangle.b.clone().cross(triangle.c))/6
    volume+=tetra;moment.add(triangle.a.clone().add(triangle.b).add(triangle.c).multiplyScalar(tetra/4))
   }
  })
  expect(volume).toBeGreaterThan(0);const center=moment.divideScalar(volume)
  const rear=new THREE.Box3().setFromObject(m.rails[0]!),front=new THREE.Box3().setFromObject(m.rails[1]!)
  expect(center.z).toBeGreaterThan(rear.max.z);expect(center.z).toBeLessThan(front.min.z)
  // The formerly accepted contact-only arrangement really puts the weight beyond its supports.
  m.rails[1]!.position.z=-.35;m.root.updateMatrixWorld(true)
  expect(center.z).toBeGreaterThan(new THREE.Box3().setFromObject(m.rails[1]!).max.z)
 })
})
