import {describe,it,expect} from 'vitest'
import * as THREE from 'three'
import {createLannaSandPagodaModel as make} from './model'
describe('Sand pagoda and a carried paper tung',()=>{
 it('physically attaches the paper top to the supporting bamboo crossbar',()=>{const m=make();const paper=new THREE.Box3().setFromObject(m.root.getObjectByName('lanna-tung')!),bar=new THREE.Box3().setFromObject(m.root.getObjectByName('lanna-crossbar')!);expect(paper.max.y).toBeGreaterThanOrEqual(bar.min.y);for(const name of['lanna-binding-0','lanna-binding-1']){const tie=m.root.getObjectByName(name);expect(tie).toBeDefined();const box=new THREE.Box3().setFromObject(tie!);expect(box.intersectsBox(paper)).toBe(true);expect(box.intersectsBox(bar)).toBe(true)}})
 it('lifts the actual pole, traverses beside the tower, and embeds only its bare tip in sand',()=>{
  const m=make();m.pose(0,0);expect(m.flag.position.toArray()).toEqual([-1.02,.04,.58]);m.pose(1,0);expect(m.flag.position.toArray()).toEqual([-1.02,.44,.58]);m.pose(2,0);expect(m.flag.position.toArray()).toEqual([.68,.44,.58]);m.pose(3,0);expect(m.flag.position.toArray()).toEqual([.68,-.045,.58]);
  const paper=new THREE.Box3().setFromObject(m.root.getObjectByName('lanna-tung')!);expect(paper.min.y).toBeGreaterThan(.4);const pole=new THREE.Box3().setFromObject(m.root.getObjectByName('lanna-pole')!);expect(pole.min.y).toBeCloseTo(-.045,6);expect(pole.max.y).toBeGreaterThan(1.4)
 })
 it('keeps paper and pole clear of the actual sand tower and support during all 303 poses',()=>{
  const m=make(),tower=m.root.getObjectByName('lanna-tower')!,flag=m.root.getObjectByName('lanna-flag')!,paper=m.root.getObjectByName('lanna-tung')!;
  for(let step=0;step<3;step++)for(let i=0;i<=100;i++){m.pose(step,i/100);const towerBox=new THREE.Box3().setFromObject(tower),paperBox=new THREE.Box3().setFromObject(paper);expect(paperBox.intersectsBox(towerBox)).toBe(false);const poleBox=new THREE.Box3().setFromObject(m.root.getObjectByName('lanna-pole')!);expect(poleBox.intersectsBox(towerBox)).toBe(false);expect(paperBox.min.y).toBeGreaterThan(.4);expect(flag.rotation.toArray().slice(0,3)).toEqual([0,0,0])}
 })
 it('is continuous at each checkpoint and retains all geometry and material references',()=>{
  const m=make(),resources:unknown[]=[];m.root.traverse((o:THREE.Object3D)=>{const x=o as THREE.Mesh;if(x.geometry)resources.push(x.geometry,x.material)});
  for(let step=0;step<3;step++){m.pose(step,1);const end=m.flag.matrixWorld.clone();m.pose(step+1,0);expect(m.flag.matrixWorld.elements).toEqual(end.elements)}
  for(let step=0;step<4;step++)m.pose(step,.37);const after:unknown[]=[];m.root.traverse((o:THREE.Object3D)=>{const x=o as THREE.Mesh;if(x.geometry)after.push(x.geometry,x.material)});expect(after).toEqual(resources)
 })
})
