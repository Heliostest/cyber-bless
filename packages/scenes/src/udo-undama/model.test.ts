import {it,expect} from 'vitest'
import * as THREE from 'three'
import {createUndamaModel} from './model'
import {disposeTree} from '../procedural-kit'
const meshes=(r:THREE.Object3D)=>{const a:THREE.Mesh[]=[];r.traverse(o=>{if((o as THREE.Mesh).isMesh)a.push(o as THREE.Mesh)});return a}
it('anchors both stones below the transparent sea bed instead of floating above it',()=>{const m=createUndamaModel();for(const o of[m.rock,m.ledge]){o.geometry.computeBoundingBox();expect(o.geometry.boundingBox!.min.y,o.name).toBeLessThanOrEqual(-.28)}disposeTree(m.root)})
it('has a real concave square rock, supported clay ball and only necessary stone edge',()=>{const m=createUndamaModel();expect(meshes(m.subject).map(o=>o.name).sort()).toEqual(['undama-ball','undama-ledge','undama-rock']);expect(m.targets).toEqual([m.ball,m.ball,m.ball]);expect(m.roots).toEqual([m.ball,m.ball,m.ball]);disposeTree(m.root)})
it('has an open recess with a lower solid floor and a higher rim',()=>{const m=createUndamaModel(),cast=(x:number,z:number)=>new THREE.Raycaster(new THREE.Vector3(x,4,z),new THREE.Vector3(0,-1,0)).intersectObject(m.rock,false)[0]!.point.y;expect(cast(.65,-.45)).toBeCloseTo(.25,7);expect(cast(1.10,-.45)).toBeGreaterThan(.55);disposeTree(m.root)})
it('restores exact endpoint transforms and keeps buffers and materials stable',()=>{const m=createUndamaModel(),objects:THREE.Object3D[]=[];m.root.traverse(o=>objects.push(o));const solid=meshes(m.root),snap=solid.map(o=>({g:o.geometry,mat:o.material,p:o.geometry.attributes.position!,a:o.geometry.attributes.position!.array,values:[...o.geometry.attributes.position!.array]}));for(let s=0;s<3;s++){m.pose(s,1);const end=objects.map(o=>o.matrixWorld.toArray());m.pose(0,.31);m.pose(s+1,0);objects.forEach((o,i)=>expect(o.matrixWorld.toArray()).toEqual(end[i]))}for(let s=0;s<3;s++)for(let i=0;i<=100;i++){m.pose(s,i/100);for(const o of objects){expect(o.scale.toArray()).toEqual([1,1,1]);expect(o.matrixWorld.elements.every(Number.isFinite)).toBe(true)}solid.forEach((o,j)=>{const a=snap[j]!;expect(o.geometry).toBe(a.g);expect(o.material).toBe(a.mat);expect(o.geometry.attributes.position).toBe(a.p);expect(o.geometry.attributes.position!.array).toBe(a.a);expect([...a.a]).toEqual(a.values)})}disposeTree(m.root)})
it('leaves the ball in front during held windup and lands on the recess floor only after the throw',()=>{const m=createUndamaModel();m.pose(2,.25);expect(m.ball.position.z).toBeGreaterThan(.9);m.pose(2,1);const p=new THREE.Vector3();m.ball.geometry.computeBoundingBox();expect(m.ball.position.x).toBe(.65);expect(m.ball.position.z).toBe(-.45);expect(m.ball.position.y+m.ball.geometry.boundingBox!.min.y).toBeCloseTo(.25,9);disposeTree(m.root)})
it('keeps the clay sphere outside actual rock triangles through the whole assisted throw',()=>{const m=createUndamaModel(),g=m.rock.geometry,a=g.attributes.position!,idx=g.index!,triangles=[];for(let i=0;i<idx.count;i+=3)triangles.push(new THREE.Triangle(...[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(a,idx.getX(i+j)).applyMatrix4(m.rock.matrixWorld)) as [THREE.Vector3,THREE.Vector3,THREE.Vector3]));const q=new THREE.Vector3();for(let k=0;k<=600;k++){m.pose(2,k/600);let distance=Infinity;for(const t of triangles)distance=Math.min(distance,t.closestPointToPoint(m.ball.position,q).distanceTo(m.ball.position));expect(distance,'throw sample'+k).toBeGreaterThanOrEqual(m.radius-1e-6)}disposeTree(m.root)})
it('normalizes nonfinite amounts without changing materials or producing invalid positions',()=>{const m=createUndamaModel();for(const n of [NaN,Infinity,-Infinity,-2,2]){m.pose(2,n);expect(m.ball.position.toArray().every(Number.isFinite)).toBe(true)}disposeTree(m.root)})
it('renders an anti-aliased 256x256 Yuji Syuku 運 stamp texture with clay grain and mipmaps',()=>{
 const m=createUndamaModel()
 expect(m.stamp).toBeInstanceOf(THREE.DataTexture)
 expect(m.stamp.image.width).toBe(256)
 expect(m.stamp.image.height).toBe(256)
 expect(m.stamp.minFilter).toBe(THREE.LinearMipmapLinearFilter)
 expect(m.stamp.magFilter).toBe(THREE.LinearFilter)
 expect(m.stamp.generateMipmaps).toBe(true)
 const data=m.stamp.image.data as Uint8Array
 let inkPixels=0,softEdgePixels=0,clayPixels=0
 for(let i=0;i<data.length;i+=4){
  const r=data[i]!
  if(r<158)inkPixels++
  else if(r<186)softEdgePixels++
  else clayPixels++
 }
 expect(inkPixels).toBeGreaterThan(250)
 expect(softEdgePixels).toBeGreaterThan(60)
 expect(clayPixels).toBeGreaterThan(40000)
 m.stamp.dispose()
 disposeTree(m.root)
})
