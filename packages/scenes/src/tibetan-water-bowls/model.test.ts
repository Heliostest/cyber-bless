import {describe,it,expect} from 'vitest'
import * as THREE from 'three'
import {getEnvironmentSurfaceY} from '@wbr/scene-runtime'
import {createWaterBowlsModel} from './model'
import {disposeTree} from '../procedural-kit'
describe('Seven water bowl offering',()=>{
 it('restores identical complete poses and liquid levels at every checkpoint',()=>{const m=createWaterBowlsModel();for(let n=0;n<3;n++){m.pose(n,1);const end=new Map<string,number[]>();m.root.traverse(o=>end.set(o.name,[...o.matrixWorld.elements]));m.pose(n+1,0);m.root.traverse(o=>o.matrixWorld.elements.forEach((v,i)=>expect(v,o.name).toBeCloseTo(end.get(o.name)![i]!,8)))}disposeTree(m.root)})
 it('keeps seven identical copper bowls on the elevated altar with small gaps',()=>{const m=createWaterBowlsModel();expect(m.bowls).toHaveLength(7);m.bowls.forEach((b,i)=>{expect(new THREE.Box3().setFromObject(b).min.y).toBeCloseTo(.988,6);if(i)expect(b.position.x-m.bowls[i-1]!.position.x-.38).toBeCloseTo(.014,6);expect(b.geometry.attributes.position.array).toEqual(m.bowls[0]!.geometry.attributes.position.array)});disposeTree(m.root)})
 it('adds water in left-to-right order without filling future bowls or overflowing',()=>{const m=createWaterBowlsModel();for(let i=0;i<7;i++){m.pose(1,(i+.5)/7);for(let j=0;j<7;j++){const bounds=new THREE.Box3().setFromObject(m.waters[j]!);expect(bounds.max.y).toBeLessThan(1.173);if(j<i)expect(bounds.max.y).toBeCloseTo(1.148,5);if(j>i)expect(bounds.max.y).toBeCloseTo(1.053,5)}}disposeTree(m.root)})
 it('stops the real stream between bowls and starts it at the jug lip over a bowl',()=>{const m=createWaterBowlsModel();for(let i=0;i<7;i++)for(const q of[.05,.3,.5,.75,.95]){m.pose(1,(i+q)/7);expect(m.stream.visible).toBe(q>.12&&q<.7);if(m.stream.visible){const tip=m.jug.localToWorld(m.tip.clone());expect(tip.z).toBeCloseTo(.2,6);expect(tip.x).toBeCloseTo((i-3)*.394);const end=m.stream.localToWorld(new THREE.Vector3(0,.5,0));expect(end.distanceTo(tip)).toBeLessThan(1e-6)}}disposeTree(m.root)})
 it('keeps bowls fixed and returns the jug to full contact on the altar',()=>{const m=createWaterBowlsModel();const fixed=m.bowls.map(b=>[...b.matrixWorld.elements]);for(let s=0;s<3;s++)for(let i=0;i<=50;i++){m.pose(s,i/50);m.bowls.forEach((b,n)=>expect(b.matrixWorld.elements).toEqual(fixed[n]));expect(new THREE.Box3().setFromObject(m.body).min.y).toBeGreaterThanOrEqual(.987999)}m.pose(3,0);expect(new THREE.Box3().setFromObject(m.body).min.y).toBeCloseTo(.988,6);expect(new Set(m.roots).size).toBe(1);m.root.traverse(o=>{const g=(o as THREE.Mesh).geometry;if(g){expect(g.attributes.normal.count,o.name).toBe(g.attributes.position.count);expect(Array.from(g.attributes.normal.array).every(Number.isFinite),o.name).toBe(true)}});disposeTree(m.root)})
 it('grounds the chamfered offering table on garden sand with vertical-grain legs and calm moulded statue plinth',()=>{const m=createWaterBowlsModel(),stand=m.root.getObjectByName('altar-table-furniture')!,plinth=m.root.getObjectByName('buddha-plinth') as THREE.Mesh;expect(new THREE.Box3().setFromObject(stand,true).min.y).toBeCloseTo(getEnvironmentSurfaceY('tibetan-water-bowls'),5);const legs:THREE.Mesh[]=[];stand.traverse(o=>{if((o as THREE.Mesh).isMesh&&!o.userData?.effect&&o.name.startsWith('altar-table-leg'))legs.push(o as THREE.Mesh)});expect(legs).toHaveLength(4);for(const leg of legs)expect((leg.material as THREE.Material).userData.craftSurface).toMatchObject({kind:'wood',axis:'y'});expect((plinth.material as THREE.Material).userData.craftSurface).toBeUndefined();for(let i=0;i<7;i++){expect(m.bowls[i]!.geometry.getAttribute('color')).toBeDefined();expect(m.root.getObjectByName('offering-bowl-contact-ao-'+i)).toBeDefined()}expect(m.root.getObjectByName('water-jug-contact-ao')).toBeDefined();disposeTree(m.root)})
 it('sculpts a Loop-subdivided seated Buddha and triggers live vessel-liquid ripples on the active bowl',()=>{
  const m=createWaterBowlsModel()
  const body=m.root.getObjectByName('buddha-body') as THREE.Mesh
  const head=m.root.getObjectByName('buddha-head') as THREE.Mesh
  expect(body.geometry.getAttribute('color')).toBeDefined()
  expect(head.geometry.getAttribute('color')).toBeDefined()
  expect(body.userData.toonSurface?.outline).toBe(false)
  expect(m.bowlLiquids).toHaveLength(7)
  m.pose(1,(2+.42)/7)
  m.updateLiquid(.04,false)
  expect(m.bowlLiquids[2]!.state.activeRipples).toBeGreaterThan(0)
  expect(m.livingStream.mesh.visible).toBe(true)
  expect(m.livingStream.splashCrown.visible).toBe(true)
  m.updateLiquid(.04,true)
  expect(m.livingStream.splashCrown.visible).toBe(false)
  m.dispose()
  disposeTree(m.root)
 })
})

