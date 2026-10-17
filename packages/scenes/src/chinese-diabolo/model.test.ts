import {describe,it,expect} from 'vitest'
import * as THREE from 'three'
import {createDiaboloModel} from './model'
import {disposeTree} from '../procedural-kit'

describe('hollow double-wheel diabolo on a two-stick cord',()=>{
  it('has two separate hollow wheels, a spanning axle, two handsticks and real open whistle slots',()=>{
    const m=createDiaboloModel(),rotor=m.subject.getObjectByName('diabolo-rotor')!
    expect(rotor.children.filter(o=>/^diabolo-wheel-/.test(o.name))).toHaveLength(2)
    expect(m.subject.children.filter(o=>/^diabolo-(left|right)-stick$/.test(o.name))).toHaveLength(2)
    for(const [index,z] of [-.48,.48].entries()){
      // Slot faces along +x at wheel mid-depth. A ray through the slot must reach the opposite inner wall, not a solid plug.
      const from=rotor.localToWorld(new THREE.Vector3(.8,0,z)),direction=new THREE.Vector3(-1,0,0).transformDirection(rotor.matrixWorld)
      const hits=new THREE.Raycaster(from,direction).intersectObject(rotor.getObjectByName('diabolo-wheel-'+index)!,true)
      expect(hits[0]!.distance).toBeGreaterThan(1.1)
      const capFrom=rotor.localToWorld(new THREE.Vector3(.2,0,z+.4))
      const capDirection=new THREE.Vector3(0,0,-1).transformDirection(rotor.matrixWorld)
      expect(new THREE.Raycaster(capFrom,capDirection).intersectObject(rotor,true)[0]!.distance).toBeLessThan(.31)
    }
    disposeTree(m.subject)
  })
  it('raises the right stick and rotates the physical wheels during the first pull',()=>{
    const m=createDiaboloModel(),right=m.subject.getObjectByName('diabolo-right-stick')!,rotor=m.subject.getObjectByName('diabolo-rotor')!
    m.pose(0,0);const start=right.position.y,q=rotor.quaternion.clone()
    m.pose(0,.5);expect(right.position.y-start).toBeGreaterThan(.12);expect(rotor.quaternion.angleTo(q)).toBeGreaterThan(.5)
    m.pose(1,0);expect(right.position.y-start).toBeGreaterThan(.3)
    disposeTree(m.subject)
  })
  it('separates the spinning diabolo from the cord in flight and catches it on the axle again',()=>{
    const m=createDiaboloModel(),rotor=m.subject.getObjectByName('diabolo-rotor')!,left=m.subject.getObjectByName('diabolo-left-stick')!
    m.pose(1,0);const home=rotor.position.y,x=left.position.x
    m.pose(1,.5);expect(rotor.position.y-home).toBeGreaterThan(1);expect(left.position.x).toBeLessThan(x-.2)
    const cord=m.subject.getObjectByName('diabolo-cord-16')!;expect(rotor.position.y-new THREE.Box3().setFromObject(cord,true).max.y).toBeGreaterThan(.9)
    m.pose(2,0);expect(rotor.position.y).toBeCloseTo(.85)
    const caught=m.subject.getObjectByName('diabolo-cord-16')!;expect(rotor.position.y-new THREE.Box3().setFromObject(caught,true).max.y).toBeGreaterThan(.065);expect(rotor.position.y-new THREE.Box3().setFromObject(caught,true).max.y).toBeLessThan(.11)
    disposeTree(m.subject)
  })
  it('keeps cord ends connected to stick tips and both wheels above the ground through every action',()=>{
    const m=createDiaboloModel(),v=new THREE.Vector3()
    for(const at of [0,1,2,3])for(const n of [0,.25,.5,.75,1]){
      m.pose(at,n)
      const rotor=m.subject.getObjectByName('diabolo-rotor')!;expect(new THREE.Box3().setFromObject(rotor,true).min.y).toBeGreaterThan(.09)
      for(const [side,index,end] of [['left',0,-.5],['right',31,.5]] as const){
        const segment=m.subject.getObjectByName('diabolo-cord-'+index)!,stick=m.subject.getObjectByName('diabolo-'+side+'-stick')!
        const tip=stick.localToWorld(new THREE.Vector3(0,0,-.5));segment.localToWorld(v.set(0,end,0));expect(v.distanceTo(tip)).toBeLessThan(.00001)
      }
    }
    disposeTree(m.subject)
  })
  it('lowers both sticks and the diabolo while preserving every mesh and geometry',()=>{
    const m=createDiaboloModel(),rotor=m.subject.getObjectByName('diabolo-rotor')!,right=m.subject.getObjectByName('diabolo-right-stick')!,resources=new Map<THREE.Mesh,THREE.BufferGeometry>()
    m.pose(2,0);const start=rotor.position.y,hand=right.position.y
    m.subject.traverse(o=>{if((o as THREE.Mesh).geometry)resources.set(o as THREE.Mesh,(o as THREE.Mesh).geometry)})
    m.pose(3,0);expect(rotor.position.y).toBeLessThan(start-.15);expect(right.position.y).toBeLessThan(hand-.3)
    for(const at of [0,1,2,3])for(const n of [0,.3,.7,1]){m.pose(at,n);for(const [mesh,g] of resources){expect(mesh.geometry).toBe(g);expect(mesh.matrixWorld.elements.every(Number.isFinite)).toBe(true)}}
    disposeTree(m.subject)
  })
})
