import {describe,it,expect} from 'vitest'
import * as THREE from 'three'
import {createHiiragiModel} from './model'
import {disposeTree} from '../procedural-kit'
describe('Hiiragi iwashi material assembly',()=>{
 it('restores identical complete poses across all checkpoints',()=>{const m=createHiiragiModel();for(let n=0;n<3;n++){m.pose(n,1);const end=new Map<string,number[]>();m.root.traverse(o=>end.set(o.name,[...o.matrixWorld.elements]));m.pose(n+1,0);m.root.traverse(o=>o.matrixWorld.elements.forEach((v,i)=>expect(v,o.name).toBeCloseTo(end.get(o.name)![i]!,8)))}disposeTree(m.root)})
 it('models opposite thorned leaves at paired twig nodes without berries',()=>{const m=createHiiragiModel();expect(m.leaves).toHaveLength(4);for(const pair of[0,1]){expect(m.leaves[pair*2]!.position.y).toBe(m.leaves[pair*2+1]!.position.y);expect(Math.abs(m.leaves[pair*2]!.rotation.y-m.leaves[pair*2+1]!.rotation.y)).toBeCloseTo(Math.PI)}expect(m.root.getObjectByName('berry')).toBeUndefined();disposeTree(m.root)})
 it('provides a real open insertion passage through the closed head body',()=>{const m=createHiiragiModel();const origin=m.head.localToWorld(new THREE.Vector3(0,-.1,0)),ray=new THREE.Raycaster(origin,new THREE.Vector3(0,1,0),0,.5);expect(ray.intersectObject(m.body)).toHaveLength(0);const solidRay=new THREE.Raycaster(m.head.localToWorld(new THREE.Vector3(.08,.5,0)),new THREE.Vector3(0,-1,0),0,1);expect(solidRay.intersectObject(m.body).length).toBeGreaterThan(0);disposeTree(m.root)})
 it('seats the head on the branch bearing and the twig on the holder floor',()=>{const m=createHiiragiModel();m.pose(3,0);expect(new THREE.Box3().setFromObject(m.body,true).min.y).toBeCloseTo(new THREE.Box3().setFromObject(m.collar,true).max.y,6);expect(new THREE.Box3().setFromObject(m.stem,true).min.y).toBeCloseTo(m.holder.getWorldPosition(new THREE.Vector3()).y+.08,6);expect(m.head.position.clone().sub(m.twig.position).distanceTo(m.joined)).toBeLessThan(1e-8);disposeTree(m.root)})
 it('keeps every moving part above the doorstep throughout all three paths',()=>{const m=createHiiragiModel(),floor=new THREE.Box3().setFromObject(m.threshold,true).max.y;for(let s=0;s<3;s++)for(let i=0;i<=100;i++){m.pose(s,i/100);for(const moving of[m.twig,m.head])expect(new THREE.Box3().setFromObject(moving,true).min.y).toBeGreaterThanOrEqual(floor-1e-6)}disposeTree(m.root)})
})

