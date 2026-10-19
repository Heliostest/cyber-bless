import {describe,it,expect} from 'vitest'
import * as THREE from 'three'
import {createShishiOdoshiModel} from './model'

// Breaks caught: solid/blocked mouth, moving axis, scaling the bamboo,
// sloped/outside liquid, reset discontinuities and a hovering striking tail.
describe('bamboo tipping water feature geometry',()=>{
 it('keeps an open diagonal mouth, with an actual hollow cavity and closed node',()=>{
  const m=createShishiOdoshiModel(),ray=new THREE.Raycaster();m.pose(1,0)
  const localA=new THREE.Vector3(1.5,0,0),localD=new THREE.Vector3(-1,0,0);m.pivot.updateWorldMatrix(true,true)
  ray.set(m.pivot.localToWorld(localA),localD.transformDirection(m.pivot.matrixWorld));const hits=ray.intersectObject(m.tube)
  expect(hits[0]!.distance).toBeGreaterThan(1.4);expect(hits[0]!.distance).toBeLessThan(1.7)
 })
 it('settles to filled upright, empty tipped and empty upright states',()=>{
  const m=createShishiOdoshiModel();m.pose(1,0);expect(m.pivot.rotation.z).toBe(.2);expect(m.liquid.visible).toBe(true);expect(m.inlet.visible).toBe(false)
  m.pose(2,0);expect(m.pivot.rotation.z).toBe(-.55);expect(m.liquid.visible).toBe(false)
  m.pose(3,0);expect(m.pivot.rotation.z).toBe(.2);expect(m.liquid.visible).toBe(false)
  expect(m.tailContact().distanceTo(m.strikePoint)).toBeLessThan(1e-7)
 })
 it('keeps bamboo geometry rigid and its axle fixed through1803 sampled poses',()=>{
  const m=createShishiOdoshiModel(),source=Array.from(m.tube.geometry.attributes.position!.array),axis=new THREE.Vector3(0,1.15,0)
  for(const step of[0,1,2])for(let i=0;i<=600;i++){
   m.pose(step,i/600);expect(m.pivot.position.distanceTo(axis)).toBe(0);expect(m.pivot.scale.toArray()).toEqual([1,1,1]);expect(m.tube.scale.toArray()).toEqual([1,1,1])
  }
  expect(Array.from(m.tube.geometry.attributes.position!.array)).toEqual(source)
 })
 it('keeps every visible liquid vertex horizontal and inside the real cavity through1803poses',()=>{
  const m=createShishiOdoshiModel(),point=new THREE.Vector3(),walls:{a:THREE.Vector3;n:THREE.Vector3}[]=[];let minimumFacetMargin=Infinity
  const raw=m.tube.geometry.attributes.position!
  for(let i=0;i<raw.count;i+=3){const v=[0,1,2].map(n=>new THREE.Vector3().fromBufferAttribute(raw,i+n)),normal=v[1]!.clone().sub(v[0]!).cross(v[2]!.clone().sub(v[0]!)).normalize();if(v.every(p=>Math.abs(Math.hypot(p.y,p.z)-.125)<1e-7)&&Math.abs(normal.x)<1e-7)walls.push({a:v[0]!,n:normal})}
  expect(walls.length).toBeGreaterThan(16)
  for(const step of[0,1,2])for(let i=0;i<=600;i++){
   m.pose(step,i/600);if(!m.liquid.visible)continue
   const p=m.liquid.geometry.attributes.position!;let ymin=Infinity,ymax=-Infinity
   for(let n=0;n<p.count;n++){
    point.fromBufferAttribute(p,n).applyMatrix4(m.liquid.matrixWorld);ymin=Math.min(ymin,point.y);ymax=Math.max(ymax,point.y);m.pivot.worldToLocal(point)
    for(const wall of walls)minimumFacetMargin=Math.min(minimumFacetMargin,wall.n.dot(point.clone().sub(wall.a)));expect(point.y**2+point.z**2).toBeLessThan(.125**2+1e-8);expect(point.x).toBeGreaterThan(-.08);expect(point.x).toBeLessThanOrEqual(1.2-.6*point.y+1e-7)
   }
   expect(ymax-ymin).toBeLessThan(1e-7)
  }
  expect(minimumFacetMargin).toBeGreaterThanOrEqual(-1e-7)
 })
 it('joins each settled state to the next without moving the device or water surface',()=>{
  for(const step of[0,1,2]){
   const a=createShishiOdoshiModel(),b=createShishiOdoshiModel();a.pose(step,1);b.pose(step+1,0)
   a.subject.traverse(o=>{const other=b.subject.getObjectByName(o.name)!;expect(other,o.name).toBeDefined();expect(o.visible,o.name).toBe(other.visible);o.matrixWorld.elements.forEach((v,i)=>expect(v,o.name).toBeCloseTo(other.matrixWorld.elements[i]!,10))})
   if(a.liquid.visible)expect(Array.from(a.liquid.geometry.attributes.position!.array)).toEqual(Array.from(b.liquid.geometry.attributes.position!.array))
  }
 })
 it('grounds supports and the contained pool without negative world vertices',()=>{
  const m=createShishiOdoshiModel(),v=new THREE.Vector3();let min=Infinity
  for(const step of[0,1,2])for(let i=0;i<=20;i++){
   m.pose(step,i/20);m.subject.traverse(o=>{const g=(o as THREE.Mesh).geometry;if(!g||!o.visible)return;const p=g.attributes.position!;for(let n=0;n<p.count;n++){v.fromBufferAttribute(p,n).applyMatrix4(o.matrixWorld);min=Math.min(min,v.y)}})
  }
  expect(min).toBeGreaterThanOrEqual(-1e-7);expect(min).toBeLessThan(1e-6)
 })
})
// Independent actual mesh boundaries catch a falling stream through the bamboo wall.
it('keeps the finite falling stream and spill sheet outside the actual bamboo solid',()=>{
 const m=createShishiOdoshiModel(),raw=m.tube.geometry.attributes.position!,outer:{a:THREE.Vector3;n:THREE.Vector3}[]=[],inner:{a:THREE.Vector3;n:THREE.Vector3}[]=[];let mouth:{a:THREE.Vector3;n:THREE.Vector3}|undefined,nodeX=-Infinity,minX=Infinity
 for(let i=0;i<raw.count;i+=3){const v=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(raw,i+k)),n=v[1]!.clone().sub(v[0]!).cross(v[2]!.clone().sub(v[0]!)).normalize();minX=Math.min(minX,...v.map(p=>p.x));for(const p of v)if(Math.hypot(p.y,p.z)<1e-9&&p.x>-.5)nodeX=Math.max(nodeX,p.x)
  if(v.every(p=>Math.abs(Math.hypot(p.y,p.z)-.16)<1e-7)&&Math.abs(n.x)<1e-7)outer.push({a:v[0]!,n})
  if(v.every(p=>Math.abs(Math.hypot(p.y,p.z)-.125)<1e-7)&&Math.abs(n.x)<1e-7)inner.push({a:v[0]!,n})
  if(n.x>.5&&n.y>.1)mouth={a:v[0]!,n}
 }
 expect(mouth).toBeDefined();expect(nodeX).toBeGreaterThan(-.1);let penetrations=0
 for(const step of[0,1])for(let i=0;i<=600;i++){
  m.pose(step,i/600);for(const water of[m.inlet,m.outlet,...(m.subject.getObjectByName('sozu-spill-film')?[m.subject.getObjectByName('sozu-spill-film') as THREE.Mesh]:[])]){
   if(!water.visible)continue;const p=water.geometry.attributes.position!
   for(let k=0;k<p.count;k++){
    const q=m.pivot.worldToLocal(water.localToWorld(new THREE.Vector3().fromBufferAttribute(p,k)))
    if(q.x<minX-1e-7||mouth!.n.dot(q.clone().sub(mouth!.a))>1e-7||outer.some(w=>w.n.dot(q.clone().sub(w.a))>1e-7))continue
    const cavity=q.x>=nodeX-1e-7&&inner.every(w=>w.n.dot(q.clone().sub(w.a))>=-1e-7)
    if(!cavity)penetrations++
   }
  }
 }
 expect(penetrations).toBe(0)
})
it('keeps the sliding feed sleeve clear of the fixed upright source stem',()=>{
 const m=createShishiOdoshiModel(),stem=m.subject.getObjectByName('sozu-feed-stem')!;let minimum=Infinity
 for(let i=0;i<=600;i++){m.pose(0,i/600);const a=new THREE.Box3().setFromObject(m.sleeve),b=new THREE.Box3().setFromObject(stem);minimum=Math.min(minimum,b.min.x-a.max.x)}
 expect(minimum).toBeGreaterThan(.03)
})
