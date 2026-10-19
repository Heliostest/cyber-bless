import {describe,it,expect} from 'vitest'
import * as THREE from 'three'
import {createEsfandModel} from './model'

const bounds=(o:THREE.Object3D)=>new THREE.Box3().setFromObject(o,true)
describe('Esfand physical support and heat sequence',()=>{
 it('rests the actual pan bottom on counter and then on the stove burner',()=>{const m=createEsfandModel();expect(bounds(m.bowl).min.y).toBeCloseTo(bounds(m.counter).max.y,7);m.pose(2,0);expect(bounds(m.bowl).min.y).toBeCloseTo(bounds(m.burner).max.y,7)})
 it('keeps the pan clear of its supports throughout transport',()=>{const m=createEsfandModel();for(const step of[0,1])for(let i=1;i<200;i++){m.pose(step,i/200);const b=bounds(m.bowl);expect(b.min.y).toBeGreaterThan(bounds(m.counter).max.y-1e-7);if(b.intersectsBox(bounds(m.burner)))expect(b.min.y).toBeGreaterThanOrEqual(bounds(m.burner).max.y-1e-7)}})
 it('keeps every seed resting inside the pan without disappearing or crossing its bottom',()=>{const m=createEsfandModel();for(const step of[0,1,2,3]){m.pose(step,.5);for(const seed of m.seeds){const b=bounds(seed);expect(b.min.y).toBeCloseTo(m.pan.position.y+.022,7);expect(Math.hypot(seed.position.x,seed.position.z)+.022).toBeLessThan(.28);expect(seed.visible).toBe(true)}}})
 it('starts and ends the cloth on the counter and only waves it clear of the pan',()=>{const m=createEsfandModel();for(const at of[0,3]){m.pose(at,0);expect(bounds(m.cloth).min.y).toBeCloseTo(bounds(m.counter).max.y,7)}for(let i=1;i<200;i++){m.pose(2,i/200);expect(bounds(m.cloth).min.y).toBeGreaterThanOrEqual(bounds(m.counter).max.y-1e-7);expect(bounds(m.cloth).intersectsBox(bounds(m.bowl))).toBe(false)}})
 it('shows smoke only after the seed pan reaches heat and never uses it as a target',()=>{const m=createEsfandModel();for(const at of[0,1]){m.pose(at,.99);expect(m.smoke.visible).toBe(false)}for(const at of[2,3]){m.pose(at,0);expect(m.smoke.visible).toBe(true)}expect(m.targets.every(o=>!o.userData.effect)).toBe(true)})
 it('keeps the cloth clear of the wooden handle while lifting and returning',()=>{const m=createEsfandModel();for(let i=0;i<=1000;i++){m.pose(2,i/1000);expect(bounds(m.cloth).intersectsBox(bounds(m.grip)),String(i/1000)).toBe(false)}})
 it('connects the cupboard pull to its door and keeps the stove dial above the counter',()=>{const m=createEsfandModel();expect(bounds(m.rail).min.z).toBeCloseTo(bounds(m.door).max.z,7);expect(bounds(m.dial).min.y).toBeGreaterThanOrEqual(bounds(m.counter).max.y)})
 it('keeps smoke dispersion continuous when the cloth returns and completion is restored',()=>{const m=createEsfandModel(),material=(m.smoke.children[0] as THREE.Mesh).material as THREE.ShaderMaterial;m.pose(2,.999999);const spread=material.uniforms.spread!.value;m.pose(3,0);expect(material.uniforms.spread!.value).toBeCloseTo(spread,9);expect(spread).toBe(1)})
})
