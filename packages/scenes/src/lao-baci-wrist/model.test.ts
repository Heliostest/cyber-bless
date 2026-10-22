import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createBaciModel } from './model'

describe('Baci white cotton wrist blessing', () => {
  it('moves a continuous white thread from the mat to around the recipient wrist', () => {
    const m = createBaciModel()
    const beginning = m.thread.position.clone()
    m.pose(0, 1)
    expect(m.thread.position.y).toBeGreaterThan(beginning.y + .2)
    m.pose(1, 1)
    expect(m.thread.position.x).toBeCloseTo(m.wrist.x)
    m.pose(2, 1)
    const points = m.threadPoints()
    expect(points.length).toBeGreaterThan(60)
    expect(points.some(p => p.y < m.wrist.y)).toBe(true)
    expect(points.some(p => p.y > m.wrist.y)).toBe(true)
    expect(points.some(p => p.z < -.12)).toBe(true)
    expect(points.some(p => p.z > .12)).toBe(true)
    for (let i = 1; i < points.length; i++) expect(points[i]!.distanceTo(points[i-1]!)).toBeLessThan(.08)
    for (const p of points) expect((p.y-m.wrist.y)**2/.145**2 + p.z**2/.18**2).toBeGreaterThan(.97)
  })
  it('restores each checkpoint to exactly the preceding settled pose', () => {
    const m = createBaciModel()
    for (let n = 0; n < 3; n++) {
      m.pose(n, 1); const end = m.threadPoints().map(p => p.toArray())
      m.pose(n+1, 0); expect(m.threadPoints().map(p => p.toArray())).toEqual(end)
    }
  })
  it('keeps finite geometry and reachable thread targets through the entire motion', () => {
    const m = createBaciModel()
    for (let n = 0; n < 3; n++) for (let i = 0; i <= 20; i++) {
      m.pose(n, i/20)
      for (const p of m.threadPoints()) expect(p.toArray().every(Number.isFinite)).toBe(true)
      expect(m.targets[n]).toBe(m.thread)
      const position = (m.thread.children[0] as THREE.Mesh).geometry.getAttribute('position')
      expect(position.count).toBeGreaterThan(400)
    }
  })
  it('never sweeps cotton through the forearm while wrapping', () => {
    const m=createBaciModel(), skin=m.root.getObjectByName('baci-forearm')!,inverse=skin.matrixWorld.clone().invert(),p=new THREE.Vector3();let clearance=Infinity
    for(let i=0;i<=100;i++){
      m.pose(1,i/100)
      const tube=m.thread.children[0] as THREE.Mesh,vertices=tube.geometry.getAttribute('position')
      for(let j=0;j<vertices.count;j++){
        p.fromBufferAttribute(vertices,j).applyMatrix4(tube.matrixWorld).applyMatrix4(inverse)
        clearance=Math.min(clearance,p.lengthSq())
      }
    }
    expect(clearance).toBeGreaterThan(1)
  })
  it('separates the wrist loop and knot crossing instead of sharing a center point',()=>{
    const m=createBaciModel();m.pose(2,1);const points=m.threadPoints()
    for(let i=0;i<points.length;i++)for(let j=i+12;j<points.length;j++)expect(points[i]!.distanceTo(points[j]!),`${i}/${j}`).toBeGreaterThan(.024)
  })
  it('clears the actual angled thumb throughout the return to the wrist',()=>{
    const m=createBaciModel(),thumb=m.root.getObjectByName('baci-thumb')!,inverse=thumb.matrixWorld.clone().invert(),p=new THREE.Vector3();let clearance=Infinity
    for(let i=0;i<=100;i++){
      m.pose(1,i/100);const tube=m.thread.children[0] as THREE.Mesh,vertices=tube.geometry.getAttribute('position')
      for(let j=0;j<vertices.count;j++){p.fromBufferAttribute(vertices,j).applyMatrix4(tube.matrixWorld).applyMatrix4(inverse);clearance=Math.min(clearance,p.lengthSq())}
    }
    expect(clearance).toBeGreaterThan(1.1)
  })
  it('rests the loose strand above the woven mat and clears it during lifting',()=>{
    const m=createBaciModel(),p=new THREE.Vector3();let lowest=Infinity
    for(let i=0;i<=100;i++){
      m.pose(0,i/100);const tube=m.thread.children[0] as THREE.Mesh,vertices=tube.geometry.getAttribute('position')
      for(let j=0;j<vertices.count;j++){p.fromBufferAttribute(vertices,j).applyMatrix4(tube.matrixWorld);lowest=Math.min(lowest,p.y)}
    }
    expect(lowest).toBeGreaterThan(.008)
  })
})
