import {describe,it,expect} from 'vitest'
import * as THREE from 'three'
import {createYutnoriModel} from './model'
import {disposeTree} from '../procedural-kit'

describe('four wooden sticks and a single two-space turn',()=>{
  it('keeps four solid half-round sticks, one moving token and29distinct board stations',()=>{
    const m=createYutnoriModel(),sticks=m.subject.children.filter(o=>o.name==='yut-sticks')[0]!
    expect(sticks.children.filter(o=>/^yut-stick-\d$/.test(o.name))).toHaveLength(4)
    const stations:THREE.Object3D[]=[];m.subject.traverse(o=>{if(/^yut-station-\d+$/.test(o.name))stations.push(o)})
    expect(stations).toHaveLength(29);expect(new Set(stations.map(o=>o.position.toArray().join(','))).size).toBe(29)
    for(let i=0;i<4;i++){
      const shell=m.subject.getObjectByName(`yut-stick-${i}-shell`) as THREE.Mesh
      const ray=new THREE.Raycaster(new THREE.Vector3(0,1,0),new THREE.Vector3(0,-1,0));shell.updateWorldMatrix(true,false)
      const from=shell.localToWorld(new THREE.Vector3(0,1,0));ray.set(from,new THREE.Vector3(0,-1,0))
      expect(ray.intersectObject(shell,false).length).toBeGreaterThan(0)
      const g=shell.geometry;g.computeBoundingBox();expect(g.boundingBox!.max.x-g.boundingBox!.min.x).toBeGreaterThan(.20);expect(g.boundingBox!.max.y-g.boundingBox!.min.y).toBeLessThan(.16)
    }
    disposeTree(m.subject)
  })
  it('gathers the sticks and makes all four airborne before landing two flat faces upward',()=>{
    const m=createYutnoriModel(),stick=(i:number)=>m.subject.getObjectByName(`yut-stick-${i}`)!
    m.pose(0,0);const spread=stick(3).position.x-stick(0).position.x
    m.pose(1,0);expect(stick(3).position.x-stick(0).position.x).toBeLessThan(spread-.25)
    m.pose(1,.5);for(let i=0;i<4;i++)expect(new THREE.Box3().setFromObject(stick(i),true).min.y).toBeGreaterThan(.8)
    m.pose(2,0)
    expect([0,1,2,3].map(i=>new THREE.Vector3(0,-1,0).applyQuaternion(stick(i).quaternion).y>0)).toEqual([true,false,true,false])
    for(let i=0;i<4;i++)expect(new THREE.Box3().setFromObject(stick(i),true).min.y).toBeCloseTo(0,4)
    disposeTree(m.subject)
  })
  it('never sinks the wooden sticks through the playing mat or intersects adjacent sticks',()=>{
    const m=createYutnoriModel(),sticks=[0,1,2,3].map(i=>m.subject.getObjectByName(`yut-stick-${i}`)!)
    for(const at of [0,1,2])for(let i=0;i<=40;i++){
      m.pose(at,i/40);const boxes=sticks.map(s=>new THREE.Box3().setFromObject(s,true))
      for(const b of boxes)expect(b.min.y).toBeGreaterThan(-.0001)
      // Neighbor projections have a real air gap at every pose, including roll midpoints.
      for(let j=1;j<4;j++)expect(boxes[j]!.min.x-boxes[j-1]!.max.x).toBeGreaterThan(.005)
    }
    disposeTree(m.subject)
  })
  it('advances the token across exactly the first two outer stations and leaves every stick settled',()=>{
    const m=createYutnoriModel(),token=m.subject.getObjectByName('yut-token')!,sticks=m.subject.getObjectByName('yut-sticks')!
    m.pose(2,0);expect(token.position.x).toBeCloseTo(1.2);expect(token.position.z).toBeCloseTo(1)
    const before=sticks.children.map(o=>o.matrixWorld.clone())
    m.pose(2,.5);expect(token.position.z).toBeCloseTo(.52);expect(token.position.x).toBeCloseTo(1.2)
    m.pose(3,0);expect(token.position.z).toBeCloseTo(.04);expect(token.position.x).toBeCloseTo(1.2)
    sticks.children.forEach((o,i)=>expect(o.matrixWorld.elements).toEqual(before[i]!.elements))
    const station=m.subject.getObjectByName('yut-station-2')!;expect(token.position.x).toBeCloseTo(station.position.x);expect(token.position.z).toBeCloseTo(station.position.z)
    expect(new THREE.Box3().setFromObject(token,true).min.y).toBeCloseTo(.028,4)
    disposeTree(m.subject)
  })
  it('reuses all meshes and geometries throughout the turn',()=>{
    const m=createYutnoriModel(),resources=new Map<THREE.Mesh,THREE.BufferGeometry>()
    m.subject.traverse(o=>{if((o as THREE.Mesh).geometry)resources.set(o as THREE.Mesh,(o as THREE.Mesh).geometry)})
    for(const at of [0,1,2,3])for(const n of [0,.25,.5,.75,1]){m.pose(at,n);for(const [mesh,g] of resources){expect(mesh.geometry).toBe(g);expect(mesh.matrixWorld.elements.every(Number.isFinite)).toBe(true)}}
    disposeTree(m.subject)
  })
})
