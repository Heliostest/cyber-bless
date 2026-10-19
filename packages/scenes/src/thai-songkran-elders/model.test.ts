import {describe,it,expect} from 'vitest'
import * as THREE from 'three'
import {createSongkranModel} from './model'
const V=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z)
describe('Songkran water and seated recipient geometry',()=>{
 it('keeps a closed hollow bowl with a real interior and supported basin',()=>{
  const m=createSongkranModel(),r=new THREE.Raycaster(V(-.80,.5,.60),V(0,-1,0));m.root.updateMatrixWorld(true)
  expect(r.intersectObject(m.bowl)[0]!.point.y).toBeCloseTo(.078,5)
  expect(new THREE.Box3().setFromObject(m.basin).min.y).toBeCloseTo(0,6)
  expect(new THREE.Box3().setFromObject(m.bowl).min.y).toBeCloseTo(new THREE.Box3().setFromObject(m.pad).max.y,5)
 })
 it('makes all three actions use the visible bowl, with no helper hit surface',()=>{
  const m=createSongkranModel();expect(m.targets).toEqual([m.bowl,m.bowl,m.bowl]);expect(m.roots).toEqual([m.cup,m.cup,m.cup]);expect(m.bowl.material.transparent).toBe(false)
 })
 it('keeps sharp vessel rim normals on the outward side of every nondegenerate face',()=>{
  const m=createSongkranModel(),a=V(0,0,0),b=V(0,0,0),c=V(0,0,0),n=V(0,0,0)
  for(const mesh of[m.bowl,m.basin]){const p=mesh.geometry.getAttribute('position'),normals=mesh.geometry.getAttribute('normal');for(let i=0;i<p.count;i+=3){a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);b.sub(a).cross(c.sub(a));if(b.lengthSq()<1e-15)continue;n.fromBufferAttribute(normals,i);expect(b.normalize().dot(n)).toBeGreaterThan(.999)}}
 })
 it('makes both elder palms actual first recipients of the poured water',()=>{
  const m=createSongkranModel(),seen=new Set<string>();let flowing=0
  for(let i=0;i<=100;i++){m.pose(2,i/100);if(!m.stream.visible)continue;flowing++;const hit=new THREE.Raycaster(m.streamStart,V(0,-1,0)).intersectObjects(m.hands,false)[0]!
   expect(hit).toBeDefined();seen.add(hit.object.name);expect(hit.point.distanceTo(m.streamEnd)).toBeLessThan(1e-6);expect(m.streamStart.y).toBeGreaterThan(m.streamEnd.y);expect(m.streamStart.distanceTo(m.cup.localToWorld(V(.28,.1801,0)))).toBeLessThan(1e-6);expect(m.lipFlow.visible).toBe(true);expect(m.handFlow.visible).toBe(true)
  }expect(flowing).toBeGreaterThan(20);expect(seen.has('songkran-palm--1')).toBe(true);expect(seen.has('songkran-palm-1')).toBe(true)
 })
 it('keeps water horizontal, inside the inner cavity and below the low rim throughout the path',()=>{
  const m=createSongkranModel(),p=V(0,0,0)
  for(const step of[0,1,2])for(let i=0;i<=40;i++){m.pose(step,i/40);const pos=m.water.geometry.getAttribute('position'),n=m.water.geometry.drawRange.count,ys=[]
   for(let j=0;j<n;j++){p.fromBufferAttribute(pos,j);ys.push(p.y);m.cup.worldToLocal(p);const maxR=.138+(p.y-.026)*(.244-.138)/(.18-.026);expect(p.y).toBeGreaterThanOrEqual(.026-1e-6);expect(p.y).toBeLessThanOrEqual(.18+1e-6);expect(Math.hypot(p.x,p.z)).toBeLessThanOrEqual(maxR+1e-6)}
   expect(Math.max(...ys)-Math.min(...ys)).toBeLessThan(1e-6)
  }
 })
 it('returns the bowl onto its pad with less water and collects runoff inside the basin',()=>{
  const m=createSongkranModel();m.pose(0,0);const before=m.water.geometry.getAttribute('position').getY(0);m.pose(3,0)
  expect(m.cup.position.distanceTo(m.home)).toBe(0);expect(m.cup.rotation.z).toBe(0);expect(m.water.geometry.getAttribute('position').getY(0)).toBeLessThan(before-.05);expect(m.caught.position.y).toBeCloseTo(.053);expect(m.stream.visible).toBe(false)
  for(let i=23;i<60;i++){m.pose(2,i/100);if(m.runoff.visible){expect(Math.hypot(m.runoffEnd.x,m.runoffEnd.z-.80)).toBeLessThan(.422);expect(m.runoffEnd.y).toBeCloseTo(m.caught.position.y)}}
  for(const t of[.221,.24,.351,.388,.40,.55]){m.pose(2,t);expect(m.runoff.visible).toBe(true);const direction=m.runoffEnd.clone().sub(m.runoffStart).normalize(),ray=new THREE.Raycaster(m.runoffStart,direction,0,m.runoffStart.distanceTo(m.runoffEnd));expect(ray.intersectObjects(m.hands,false),`outflow at ${t} must not cross a later finger`).toHaveLength(0)}
 })
 it('places bench feet, elder shoes and pad on the ground without floating supports',()=>{
  const m=createSongkranModel();m.root.traverse(o=>{if(o.name.startsWith('songkran-bench-leg')||o.name.startsWith('songkran-shoe')||o===m.pad)expect(new THREE.Box3().setFromObject(o).min.y).toBeCloseTo(0,6)})
 })
 it('restores identical boundary transforms and water geometry at every checkpoint',()=>{
  const a=createSongkranModel(),b=createSongkranModel()
  for(let step=0;step<3;step++){a.pose(step,1);b.pose(step+1,0);expect(a.cup.matrixWorld.elements).toEqual(b.cup.matrixWorld.elements);expect(Array.from(a.water.geometry.getAttribute('position').array)).toEqual(Array.from(b.water.geometry.getAttribute('position').array));expect(a.water.geometry.drawRange).toEqual(b.water.geometry.drawRange)}
 })
 it('keeps liquid at the low lip and the outgoing stream attached to the final hand film',()=>{
  const m=createSongkranModel(),p=V(0,0,0),a=V(0,0,0),b=V(0,0,0),c=V(0,0,0),nearest=V(0,0,0)
  for(let i=23;i<60;i+=2){m.pose(2,i/100);if(!m.stream.visible)continue
   const lip=m.cup.localToWorld(V(.244,.18,0)),pos=m.water.geometry.getAttribute('position');let distance=Infinity
   for(let j=0;j<m.water.geometry.drawRange.count;j++)distance=Math.min(distance,p.fromBufferAttribute(pos,j).distanceTo(lip));expect(distance).toBeLessThan(1e-6)
   const film=m.handFlow.geometry.getAttribute('position');distance=Infinity
   for(let j=0;j<m.handFlow.geometry.drawRange.count;j+=3){a.fromBufferAttribute(film,j);b.fromBufferAttribute(film,j+1);c.fromBufferAttribute(film,j+2);new THREE.Triangle(a,b,c).closestPointToPoint(m.runoffStart,nearest);distance=Math.min(distance,nearest.distanceTo(m.runoffStart))}expect(distance).toBeLessThan(1e-6)
  }
 })
 it('restores earlier checkpoints without stale hidden fluid transforms or geometry',()=>{
  for(const at of[0,1,2,3]){const reused=createSongkranModel(),fresh=createSongkranModel();reused.pose(2,.41);reused.pose(at,0);fresh.pose(at,0)
   reused.root.traverse(o=>{const other=fresh.root.getObjectByName(o.name)!;expect(o.matrixWorld.elements).toEqual(other.matrixWorld.elements);expect(o.visible).toBe(other.visible)})
   for(const key of['water','handFlow'] as const){expect(Array.from(reused[key].geometry.getAttribute('position').array)).toEqual(Array.from(fresh[key].geometry.getAttribute('position').array));expect(reused[key].geometry.drawRange).toEqual(fresh[key].geometry.drawRange)}
  }
 })
})
