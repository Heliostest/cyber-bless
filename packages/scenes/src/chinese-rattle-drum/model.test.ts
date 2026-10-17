import {describe,it,expect} from 'vitest'
import * as THREE from 'three'
import {createRattleDrumModel} from './model'
import {disposeTree} from '../procedural-kit'

const cylinderDistance=(p:THREE.Vector3,r:number,z:number,h:number)=>Math.hypot(Math.max(Math.hypot(p.x,p.y-2)-r,0),Math.max(Math.abs(p.z-z)-h,0))
describe('single toy drum with two pendant bead beaters',()=>{
  it('physically bridges each cotton cord root into the wooden shell with an attached side stud',()=>{
    const m=createRattleDrumModel()
    for(let i=0;i<2;i++){
      const stud=m.subject.getObjectByName('rattle-drum-cord-stud-'+i) as THREE.Mesh
      expect(stud,'side fixing must bridge the cord-to-shell air gap').toBeDefined()
      const box=new THREE.Box3().setFromObject(stud,true),root=m.cords[i]![0]!,side=i===0?-1:1
      expect(box.containsPoint(root)).toBe(true)
      expect(side===1?box.min.x: -box.max.x).toBeLessThan(.74)
      expect(side===1?box.max.x: -box.min.x).toBeGreaterThan(.77)
      const ray=new THREE.Raycaster(new THREE.Vector3(side,2,0),new THREE.Vector3(-side,0,0))
      const entry=ray.intersectObject(stud,false)[0]!
      expect(Math.abs(entry.point.x)).toBeGreaterThan(.77)
    }
    disposeTree(m.subject)
  })
  it('has two closed skins, a hollow wooden shell and two side-attached cord/bead assemblies',()=>{
    const m=createRattleDrumModel(),shell=m.subject.getObjectByName('rattle-drum-shell')!,ray=new THREE.Raycaster(new THREE.Vector3(0,2,0),new THREE.Vector3(1,0,0))
    expect(ray.intersectObject(shell,false)[0]!.distance).toBeCloseTo(.68,3)
    expect(m.beads).toHaveLength(2);expect(m.cords).toHaveLength(2)
    for(const sign of [-1,1]){
      const head=m.subject.getObjectByName('rattle-drum-head-'+sign)!
      ray.set(new THREE.Vector3(0,2,sign),new THREE.Vector3(0,0,-sign))
      expect(ray.intersectObject(head,false)[0]!.distance).toBeCloseTo(.856,4)
    }
    disposeTree(m.subject)
  })
  it('brings opposite beaters just to the front/back skins and swaps their contact faces after the reverse turn',()=>{
    const m=createRattleDrumModel()
    for(const [at,want] of [[1,[1,-1]],[2,[-1,1]]] as const){
      m.pose(at,0)
      m.beads.forEach((b,i)=>{
        expect(Math.sign(b.position.z)).toBe(want[i]);expect(Math.abs(b.position.z)-.144-.11).toBeGreaterThanOrEqual(-.00001);expect(Math.abs(b.position.z)-.144-.11).toBeLessThan(.003)
        expect(Math.hypot(b.position.x,b.position.y-2)).toBeLessThan(.58)
      })
    }
    m.pose(3,0);for(const b of m.beads){expect(b.position.z).toBeCloseTo(0);expect(b.position.y).toBeLessThan(1.2)}
    disposeTree(m.subject)
  })
  it('never sends a wooden beater through either skin or the wooden ring across forward, reverse or lowering motion',()=>{
    const m=createRattleDrumModel()
    for(let at=0;at<3;at++)for(let n=0;n<=200;n++){
      m.pose(at,n/200)
      for(const b of m.beads){
        const p=b.position,r=Math.hypot(p.x,p.y-2),radial=Math.max(.68-r,r-.74,0),axial=Math.max(Math.abs(p.z)-.12,0)
        expect(Math.hypot(radial,axial),`shell at${at} n${n}`).toBeGreaterThanOrEqual(.10999)
        for(const sign of [-1,1])expect(cylinderDistance(p,.69,sign*.135,.009),`skin${sign} at${at} n${n}`).toBeGreaterThanOrEqual(.10999)
      }
    }
    disposeTree(m.subject)
  })
  it('routes cotton cord outside the shell/skins and keeps every attachment continuous',()=>{
    const m=createRattleDrumModel(),v=new THREE.Vector3()
    for(let at=0;at<3;at++)for(let n=0;n<=100;n++){
      m.pose(at,n/100)
      for(let i=0;i<2;i++){
        const points=m.cords[i]!
        expect(points[0]!.x).toBeCloseTo(i===0?-.77:.77);expect(points[0]!.y).toBeCloseTo(2);expect(points[2]!.distanceTo(m.beads[i]!.position)).toBeLessThan(.000001)
        for(let segment=0;segment<2;segment++)for(let k=0;k<=20;k++){
          v.lerpVectors(points[segment]!,points[segment+1]!,k/20)
          const r=Math.hypot(v.x,v.y-2),radial=Math.max(.68-r,r-.74,0),axial=Math.max(Math.abs(v.z)-.12,0)
          expect(Math.hypot(radial,axial),`cord shell at${at} n${n}`).toBeGreaterThanOrEqual(.0119)
          for(const sign of [-1,1])expect(cylinderDistance(v,.69,sign*.135,.009)).toBeGreaterThanOrEqual(.0119)
        }
      }
    }
    disposeTree(m.subject)
  })
  it('conserves two beaters, reusable meshes and exact transforms at every restored checkpoint',()=>{
    const m=createRattleDrumModel(),resources=new Map<THREE.Mesh,THREE.BufferGeometry>()
    m.subject.traverse(o=>{if((o as THREE.Mesh).geometry)resources.set(o as THREE.Mesh,(o as THREE.Mesh).geometry)})
    for(let at=0;at<3;at++){
      m.pose(at,1);const before=new Map<string,number[]>();m.subject.traverse(o=>before.set(o.name,o.matrixWorld.elements.slice()))
      m.pose(at+1,0);m.subject.traverse(o=>o.matrixWorld.elements.forEach((v,i)=>expect(v).toBeCloseTo(before.get(o.name)![i]!,9)))
      for(let n=0;n<=10;n++){m.pose(at,n/10);for(const [mesh,g] of resources){expect(mesh.geometry).toBe(g);expect(mesh.matrixWorld.elements.every(Number.isFinite)).toBe(true)}}
    }
    disposeTree(m.subject)
  })
})
