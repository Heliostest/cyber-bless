import {describe,it,expect} from 'vitest'
import * as THREE from 'three'
import {createRatchetModel} from './model'
import {disposeTree} from '../procedural-kit'

const pointToSegment=(p:THREE.Vector2,a:THREE.Vector2,b:THREE.Vector2)=>{const v=b.clone().sub(a),t=THREE.MathUtils.clamp(p.clone().sub(a).dot(v)/v.lengthSq(),0,1);return p.distanceTo(a.clone().addScaledVector(v,t))}
describe('real wooden cog and free-frame tongue',()=>{
 it('has11teeth, realgear/bearing/washerholes and clearance around the fixed axle',()=>{
  const m=createRatchetModel();expect(m.polygon).toHaveLength(33);expect(m.cheeks).toHaveLength(2)
  for(const mesh of [m.gear,...m.cheeks])expect((mesh.geometry.parameters.shapes as THREE.Shape).holes).toHaveLength(1)
  expect(m.halfGearDepth).toBe(.11);expect(m.cheeks[0]!.position.z).toBe(-.20);expect(m.cheeks[1]!.position.z).toBe(.20)
  expect(m.cheekDepth/2+m.halfGearDepth).toBeLessThan(.20)
  for(const washer of m.washers)expect(washer.geometry.type).toBe('ExtrudeGeometry');disposeTree(m.subject)
 })
 it('keeps every tongue segment and rounded cap outside the actual rotating tooth polygon in1803poses',()=>{
  const m=createRatchetModel();let minFace=Infinity,minCap=Infinity,maxContact=0,minD=Infinity,maxD=-Infinity
  const sampleWeight=(y:number)=>{const q=y/m.length*(m.rowCount-1),i=THREE.MathUtils.clamp(Math.floor(q),0,m.rowCount-2);return THREE.MathUtils.lerp(m.weights[i]!,m.weights[i+1]!,q-i)}
  for(let step=0;step<3;step++)for(let k=0;k<=600;k++){
   m.pose(step,k/600);const poly=m.polygon.map(p=>p.clone().rotateAround(new THREE.Vector2(),-m.frame.rotation.z)),d=m.state.d
   minD=Math.min(minD,d);maxD=Math.max(maxD,d)
   for(let i=0;i<poly.length;i++){
    const a=poly[i]!,b=poly[(i+1)%poly.length]!
    for(let row=0;row<m.rowCount;row++){
     const y=m.length*row/(m.rowCount-1);if(y<Math.min(a.y,b.y)||y>Math.max(a.y,b.y)||Math.abs(b.y-a.y)<1e-12)continue
     const x=THREE.MathUtils.lerp(a.x,b.x,(y-a.y)/(b.y-a.y));minFace=Math.min(minFace,m.anchorX+d*m.weights[row]!-m.halfWidth-x)
    }
    if(a.y>=0&&a.y<=m.length)minFace=Math.min(minFace,m.anchorX+d*sampleWeight(a.y)-m.halfWidth-a.x)
    minCap=Math.min(minCap,pointToSegment(new THREE.Vector2(m.anchorX+d,0),a,b)-m.capRadius)
   }
   maxContact=Math.max(maxContact,m.state.contactGap)
   const root=m.spring.geometry.attributes.position!;expect(root.getX((m.rowCount-1)*4)).toBeCloseTo(m.anchorX-m.halfWidth,6)
  }
  expect(minFace).toBeGreaterThanOrEqual(.00099);expect(minCap).toBeGreaterThan(.0001);expect(maxContact).toBeLessThan(.00101);expect(maxD-minD).toBeGreaterThan(.008)
  disposeTree(m.subject)
 })
 it('rotates only the frame and spring while wheel, handle and axle remain fixed',()=>{
  const m=createRatchetModel(),matrices=[m.gear,m.handle,m.axle].map(o=>o.matrixWorld.elements.slice())
  m.pose(0,.5);expect(m.frame.rotation.z).toBeCloseTo(-Math.PI/3,12)
  for(const [i,o]of[m.gear,m.handle,m.axle].entries())expect(o.matrixWorld.elements).toEqual(matrices[i])
  expect(m.spring.geometry.attributes.position!.version).toBeGreaterThan(0);disposeTree(m.subject)
 })
 it('has exact checkpoint meshes and returns home without accumulated rotations',()=>{
  const m=createRatchetModel(),snap=()=>[m.frame.rotation.z,...m.spring.geometry.attributes.position!.array]
  const home=snap()
  for(let step=0;step<3;step++){m.pose(step,1);const end=snap();m.pose(step+1,0);expect(snap()).toEqual(end)}
  expect(snap()).toEqual(home);m.pose(0,-1);expect(snap()).toEqual(home);disposeTree(m.subject)
 })
})
