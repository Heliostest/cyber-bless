import {describe,it,expect} from 'vitest'
import * as THREE from 'three'
import {createOwareModel} from './model'
import {disposeTree} from '../procedural-kit'

describe('Oware actual bowl and seed model',()=>{
 it('has12 open concave bowls and48 alike complete seed bodies, four in each pit at the start',()=>{
  const m=createOwareModel();expect(m.pits).toHaveLength(12);expect(m.seeds).toHaveLength(48);expect(new Set(m.seeds.map(s=>s.material)).size).toBe(1)
  expect(m.counts()).toEqual(Array(12).fill(4))
  m.pose(1,0);m.subject.updateMatrixWorld(true)
  const solids:THREE.Object3D[]=[];m.subject.traverse(o=>{if((o as THREE.Mesh).isMesh)solids.push(o)})
  const source=m.centers[4]!,r=new THREE.Raycaster(new THREE.Vector3(source.x,3,source.z),new THREE.Vector3(0,-1,0)),hit=r.intersectObjects(solids,false)[0]
  // Lifted seeds are offset from the empty center; actual bowl floor is below the top wood plane.
  expect(hit?.object.name).toBe('oware-pit-4');expect(hit!.point.y).toBeCloseTo(.10,3)
  const wall=new THREE.Raycaster(new THREE.Vector3(0,3,0),new THREE.Vector3(0,-1,0)).intersectObjects(solids,false)[0]
  expect(wall?.point.y).toBeCloseTo(.34,3);disposeTree(m.subject)
 })
 it('conserves48 bodies and performs one legal four-seed opening, with0/5/5/5/5 and no capture',()=>{
  const m=createOwareModel();m.pose(1,0);expect(m.counts()[4]).toBe(0);expect(m.counts().reduce((a,b)=>a+b,0)).toBe(44)
  m.pose(2,0);expect(m.counts()[5]).toBe(5);expect(m.counts()[6]).toBe(5);expect(m.counts().reduce((a,b)=>a+b,0)).toBe(46)
  m.pose(3,0);expect(m.counts()).toEqual([4,4,4,4,0,5,5,5,5,4,4,4]);expect(m.seeds.every(s=>s.visible)).toBe(true)
  expect(m.subject.children.some(x=>/table|stand|pedestal/i.test(x.name))).toBe(false);disposeTree(m.subject)
 })
 it('drops one and only one seed into each successive pit before moving to the next',()=>{
  const m=createOwareModel(),base=Array(12).fill(4);base[4]=0
  for(const [step,n,done]of [[1,.20,0],[1,.50,1],[1,.70,1],[1,1,2],[2,.20,2],[2,.50,3],[2,.70,3],[2,1,4]]){
   m.pose(step!,n!);const expected=[...base];for(const index of [5,6,7,8].slice(0,done))expected[index]++
   expect(m.counts(),`${step}/${n}`).toEqual(expected)
  }
  disposeTree(m.subject)
 })
 it('keeps every seed clear of bowl wood and every other seed throughout dense trajectories',()=>{
  const m=createOwareModel(),vertex=new THREE.Vector3(),p=new THREE.Vector3(),q=new THREE.Vector3()
  let separation=Infinity,clearance=Infinity,outside=0
  for(const step of [0,1,2])for(let sample=0;sample<=100;sample++){
   m.pose(step,sample/100);m.subject.updateMatrixWorld(true)
   const centers=m.seeds.map(s=>s.getWorldPosition(new THREE.Vector3()))
   for(let i=0;i<centers.length;i++)for(let j=i+1;j<centers.length;j++){
    p.copy(centers[i]!).sub(centers[j]!);separation=Math.min(separation,Math.hypot(p.x/.20,p.y/.15,p.z/.17))
   }
   for(const s of m.seeds){const v=s.geometry.getAttribute('position');for(let k=0;k<v.count;k++){
    vertex.fromBufferAttribute(v,k).applyMatrix4(s.matrixWorld)
    if(vertex.y>=.34)continue
    let inside=false
    for(const c of m.centers){q.copy(vertex).sub(c);const r=Math.hypot(q.x,q.z);if(r<=.36){inside=true;clearance=Math.min(clearance,vertex.y-m.bowlHeight(r));break}}
    if(!inside)outside++
   }}
  }
  expect(separation).toBeGreaterThanOrEqual(.998);expect(clearance).toBeGreaterThanOrEqual(-.0003);expect(outside).toBe(0)
  disposeTree(m.subject)
 })
 it('returns the same complete geometry at each checkpoint regardless of partial motion or restoration order',()=>{
  const a=createOwareModel(),b=createOwareModel()
  for(const at of [0,1,2,3,1,0,3]){
   a.pose(Math.min(at,2),.43);a.pose(at,0);b.pose(at,0)
   a.subject.traverse(o=>{const peer=b.subject.getObjectByName(o.name)!;expect(o.matrixWorld.elements).toEqual(peer.matrixWorld.elements)})
  }
  disposeTree(a.subject);disposeTree(b.subject)
 })
 it('keeps narrow alignment windows clear and prevents the independently reproduced actual mesh edge crossing',()=>{
  const m=createOwareModel(),a=new THREE.Vector3(),b=new THREE.Vector3(),d=new THREE.Vector3()
  m.pose(1,.3571)
  const seed=m.moving[0]!,positions=seed.geometry.getAttribute('position')
  a.fromBufferAttribute(positions,69).applyMatrix4(seed.matrixWorld);b.fromBufferAttribute(positions,87).applyMatrix4(seed.matrixWorld)
  d.copy(b).sub(a);const length=d.length(),hit=new THREE.Raycaster(a,d.normalize()).intersectObject(m.moving[1]!,false)[0]
  expect(hit?.distance??Infinity).toBeGreaterThanOrEqual(length-.00001)
  let minimum=Infinity
  const world=m.seeds.map(()=>new THREE.Vector3())
  for(const step of [1,2])for(const origin of [.32,.82])for(let sample=0;sample<=1200;sample++){
   m.pose(step,origin+sample*.00005);m.seeds.forEach((s,i)=>s.getWorldPosition(world[i]!))
   for(let i=44;i<48;i++)for(let j=0;j<i;j++){d.copy(world[i]!).sub(world[j]!);minimum=Math.min(minimum,Math.hypot(d.x/.20,d.y/.15,d.z/.17))}
  }
  expect(minimum).toBeGreaterThanOrEqual(1)
  disposeTree(m.subject)
 })
 it('updates poses without replacing or allocating render resources or seed bodies',()=>{
  const m=createOwareModel(),objects:THREE.Object3D[]=[],resources:unknown[]=[]
  m.subject.traverse(o=>{objects.push(o);const x=o as THREE.Mesh;if(x.geometry)resources.push(x.geometry,x.material)})
  for(let i=0;i<60;i++)m.pose(i%3,(i%11)/10)
  const after:THREE.Object3D[]=[],r:unknown[]=[];m.subject.traverse(o=>{after.push(o);const x=o as THREE.Mesh;if(x.geometry)r.push(x.geometry,x.material)})
  expect(after).toEqual(objects);expect(r).toEqual(resources);disposeTree(m.subject)
 })
})
