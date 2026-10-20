import {it, expect} from 'vitest'
import * as THREE from 'three'
import {createSternsingerModel} from './model'
import {disposeTree} from '../procedural-kit'

it('uses nondegenerate triangles for the closed chalk body',()=>{
 const m=createSternsingerModel(),g=m.chalkBody.geometry,p=g.attributes.position!,ix=g.index
 for(let i=0;i<(ix?.count??p.count);i+=3){const a=new THREE.Vector3().fromBufferAttribute(p,ix?ix.getX(i):i),b=new THREE.Vector3().fromBufferAttribute(p,ix?ix.getX(i+1):i+1),c=new THREE.Vector3().fromBufferAttribute(p,ix?ix.getX(i+2):i+2);expect(b.sub(a).cross(c.sub(a)).lengthSq()).toBeGreaterThan(1e-16)}
 m.dispose();disposeTree(m.root)
})

it('writes the sourced 2026 example with one star and three crosses on the door lintel',()=>{
 const m=createSternsingerModel();expect(m.inscription).toBe('20*C+M+B+26');expect(m.inscription.match(/\*/g)).toHaveLength(1);expect(m.inscription.match(/\+/g)).toHaveLength(3)
 expect(m.marks.every(o=>!o.visible)).toBe(true);m.pose(0,1);expect(m.marks.every(o=>!o.visible)).toBe(true)
 m.pose(2,0);expect(m.marks.every(o=>o.visible)).toBe(true)
 const header=new THREE.Box3().setFromObject(m.header,true)
 for(const mark of m.marks){const box=new THREE.Box3().setFromObject(mark,true);expect(box.min.x).toBeGreaterThan(header.min.x);expect(box.max.x).toBeLessThan(header.max.x);expect(box.min.y).toBeGreaterThan(header.min.y);expect(box.max.y).toBeLessThan(header.max.y);expect(box.min.z).toBeCloseTo(header.max.z+.001,5)}
 m.dispose();disposeTree(m.root)
})
it('deposits each new line at the physical chalk tip and lifts between disconnected strokes',()=>{
 const m=createSternsingerModel();let writing=0,lifted=0
 for(let i=0;i<=600;i++){m.pose(1,i/600);const active=m.activeStroke();if(active){writing++;expect(m.chalk.position.distanceTo(active.end)).toBeLessThan(1e-7);expect(Math.abs(m.chalk.position.z-m.surfaceZ)).toBeLessThan(1e-7)}else if(i>0&&i<600&&m.chalk.position.z>m.surfaceZ+.005)lifted++}
 expect(writing).toBeGreaterThan(200);expect(lifted).toBeGreaterThan(10);m.dispose();disposeTree(m.root)
})
it('keeps chalk above the threshold, in front of the door and restores all progress deterministically',()=>{
 const m=createSternsingerModel();for(let stage=0;stage<3;stage++){
  for(let i=0;i<=100;i++){m.pose(stage,i/100);const box=new THREE.Box3().setFromObject(m.chalk,true);expect(box.min.y).toBeGreaterThanOrEqual(m.floor-1e-6);expect(m.chalk.matrixWorld.elements.every(Number.isFinite)).toBe(true);if(stage===1)expect(box.min.z).toBeGreaterThanOrEqual(m.surfaceZ-1e-6)}
  m.pose(stage,1);const end=m.chalk.matrixWorld.elements.slice(),shown=m.marks.map(o=>[o.visible,...o.scale.toArray(),...o.position.toArray()]);m.pose(0,.3);m.pose(stage+1,0);expect(m.chalk.matrixWorld.elements).toEqual(end);expect(m.marks.map(o=>[o.visible,...o.scale.toArray(),...o.position.toArray()])).toEqual(shown)
 }
 for(const at of[0,3]){m.pose(at,0);expect(new THREE.Box3().setFromObject(m.chalk,true).min.y).toBeCloseTo(m.floor,5)}
 m.pose(1,.4);m.pose(1,0);expect(m.marks.every(o=>!o.visible)).toBe(true);m.dispose();disposeTree(m.root)
})
