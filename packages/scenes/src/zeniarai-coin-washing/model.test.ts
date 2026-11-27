import {it,expect} from 'vitest'
import * as THREE from 'three'
import {createCoinWashingModel} from './model'
import {disposeTree} from '../procedural-kit'
const all=(root:THREE.Object3D)=>{const rows:THREE.Mesh[]=[];root.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh)rows.push(m)});return rows}
const opaque=(root:THREE.Object3D)=>all(root).filter(o=>(Array.isArray(o.material)?o.material:[o.material]).some(m=>!m.transparent))
it('builds nine opaque solids including an actual nine-hole sieve',()=>{
 const m=createCoinWashingModel(),items=opaque(m.root);expect(items).toHaveLength(9)
 expect(items.some(o=>o.name==='wash-sieve')).toBe(true)
 disposeTree(m.root)
})
it('keeps all opaque geometry and unit rigid transforms stable through1803poses with exact checkpoint restore',()=>{
 const m=createCoinWashingModel(),items=opaque(m.root),refs=items.map(o=>o.geometry),bytes=items.map(o=>Array.from(o.geometry.attributes.position!.array));let nonfinite=0,scale=0
 for(let s=0;s<3;s++)for(let k=0;k<=600;k++){m.pose(s,k/600);for(const o of items){scale=Math.max(scale,o.scale.distanceTo(new THREE.Vector3(1,1,1)));const p=o.geometry.attributes.position!;for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);if(!Number.isFinite(v.x+v.y+v.z))nonfinite++}}}
 expect(nonfinite).toBe(0);expect(scale).toBe(0);items.forEach((o,i)=>{expect(o.geometry).toBe(refs[i]);expect(Array.from(o.geometry.attributes.position!.array)).toEqual(bytes[i])});for(let s=0;s<3;s++){m.pose(s,1);const a=all(m.root).map(o=>[...o.matrixWorld.elements]);m.pose(0,.37);m.pose(s+1,0);expect(all(m.root).map(o=>[...o.matrixWorld.elements])).toEqual(a)}disposeTree(m.root)
})
it('supports the coin on the perforated floor and the cloth on its stone throughout rest states',()=>{
 const m=createCoinWashingModel();for(const s of[0,1,2,3]){m.pose(s,0);const coin=new THREE.Box3().setFromObject(m.coin);expect(coin.min.y).toBeCloseTo(.745,7);expect(m.cloth.position.y-.015).toBeCloseTo(.68,7)}disposeTree(m.root)
})
it('only pours during the accepted second phase and removes wet droplets after the cloth wipe',()=>{
 const m=createCoinWashingModel();m.pose(0,.8);expect(m.stream.visible).toBe(false);m.pose(1,.5);expect(m.stream.visible).toBe(true);expect(m.droplets.every(o=>o.visible)).toBe(true);m.pose(2,.55);expect(m.stream.visible).toBe(false);expect(m.cloth.position.y-.015).toBeCloseTo(.78,7);m.pose(3,0);expect(m.droplets.some(o=>o.visible)).toBe(false);disposeTree(m.root)
})
