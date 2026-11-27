import {it,expect} from 'vitest'
import * as THREE from 'three'
import {createChinowaModel,chinowaHomeDistance,chinowaView} from './model'
import {disposeTree} from '../procedural-kit'
const meshes=(root:THREE.Object3D)=>{const a:THREE.Mesh[]=[];root.traverse(o=>{if((o as THREE.Mesh).isMesh)a.push(o as THREE.Mesh)});return a}
it('builds a kaya hoop and six necessary support solids',()=>{
 const model=createChinowaModel(),items=meshes(model.root);expect(items.map(o=>o.name).sort()).toEqual(['chinowa-hoop','chinowa-post-0','chinowa-post-1','chinowa-foot-0','chinowa-foot-1','chinowa-tie-0','chinowa-tie-1'].sort())
 disposeTree(model.root)
})
it('keeps the real hoop and support geometry fixed, with exact common front checkpoints',()=>{
 const m=createChinowaModel(),items=meshes(m.root),before=items.map(o=>({geometry:o.geometry,position:[...o.geometry.attributes.position!.array],matrix:[...o.matrixWorld.elements]}))
 for(let s=0;s<3;s++)for(let k=0;k<=600;k++){m.pose(s,k/600);items.forEach((o,i)=>{expect(o.geometry).toBe(before[i]!.geometry);expect(o.matrixWorld.elements).toEqual(before[i]!.matrix);expect(o.scale.toArray()).toEqual([1,1,1])})}
 items.forEach((o,i)=>expect([...o.geometry.attributes.position!.array]).toEqual(before[i]!.position));disposeTree(m.root)
})
it.each([.73,.85,1,1.6])('walks each real opening once, left/right/left, and returns exactly at aspect %s',aspect=>{
 const front=chinowaHomeDistance(aspect),home=chinowaView(0,0,front)
 for(let s=0;s<3;s++){let previous=front,crossings=0,minX=0,maxX=0;for(let k=0;k<=1200;k++){const v=chinowaView(s,k/1200,front);expect(v.position.toArray().every(Number.isFinite)).toBe(true);expect(v.quaternion.length()).toBeCloseTo(1,10);expect(v.position.y).toBeGreaterThanOrEqual(1.65);minX=Math.min(minX,v.position.x);maxX=Math.max(maxX,v.position.x);if(previous>0&&v.position.z<=0){crossings++;expect(Math.abs(v.position.x)).toBeLessThan(.001);expect(v.position.y-1.65).toBeGreaterThan(.32)}previous=v.position.z}
  expect(crossings).toBe(1);expect(s===1?maxX:-minX).toBeGreaterThan(3);expect(s===1?minX:maxX).toBe(0);const end=chinowaView(s,1,front);expect(end.position.toArray()).toEqual(home.position.toArray());expect(end.quaternion.toArray()).toEqual(home.quaternion.toArray())
 }
})
it('keeps the hoop center visible while beside the hoop and on the return approach',()=>{
 const front=chinowaHomeDistance(.73),camera=new THREE.PerspectiveCamera(42,.73,.08,120)
 for(const s of [0,1,2])for(let i=0;i<=1200;i++){const t=i/1200,v=chinowaView(s,t,front);if(Math.abs(v.position.x)<3.19&&t<.82)continue;camera.position.copy(v.position);camera.quaternion.copy(v.quaternion);camera.updateMatrixWorld(true);const p=new THREE.Vector3(0,1.55,0).project(camera);expect(Math.abs(p.x)).toBeLessThan(1);expect(Math.abs(p.y)).toBeLessThan(1);expect(p.z).toBeGreaterThan(-1);expect(p.z).toBeLessThan(1)}
})
