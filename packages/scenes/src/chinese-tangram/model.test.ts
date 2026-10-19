import {describe,it,expect} from 'vitest'
import * as THREE from 'three'
import {createTangramModel} from './model'
import {disposeTree} from '../procedural-kit'

const names=['large-0','large-1','medium','small-1','square','small-2','parallelogram']
describe('seven wooden tangram pieces',()=>{
  it('separates every pair of actual convex wood volumes throughout lift, travel and lowering',()=>{
    const m=createTangramModel()
    for(let at=0;at<3;at++)for(let n=0;n<=200;n++){
      m.pose(at,n/200)
      const bodies=m.pieces.map(p=>{
        const shell=p.children[0] as THREE.Mesh,vertices=shell.geometry.getAttribute('position'),points:THREE.Vector2[]=[],keys=new Set<string>(),v=new THREE.Vector3()
        for(let i=0;i<vertices.count;i++)if(vertices.getY(i)>.079){
          v.fromBufferAttribute(vertices,i).applyMatrix4(shell.matrixWorld);const key=v.x.toFixed(6)+','+v.z.toFixed(6)
          if(!keys.has(key)){keys.add(key);points.push(new THREE.Vector2(v.x,v.z))}
        }
        const center=points.reduce((s,p)=>s.add(p),new THREE.Vector2()).divideScalar(points.length)
        points.sort((a,b)=>Math.atan2(a.y-center.y,a.x-center.x)-Math.atan2(b.y-center.y,b.x-center.x))
        return {points,box:new THREE.Box3().setFromObject(shell,true),name:p.name}
      })
      for(let i=0;i<7;i++)for(let j=i+1;j<7;j++){
        const a=bodies[i]!,b=bodies[j]!
        if(Math.min(a.box.max.y,b.box.max.y)-Math.max(a.box.min.y,b.box.min.y)<.00001)continue
        let separate=false
        for(const poly of [a.points,b.points])for(let k=0;k<poly.length;k++){
          const edge=poly[(k+1)%poly.length]!.clone().sub(poly[k]!),axis=new THREE.Vector2(-edge.y,edge.x).normalize(),ap=a.points.map(p=>p.dot(axis)),bp=b.points.map(p=>p.dot(axis))
          if(Math.max(...ap)<=Math.min(...bp)+.000001||Math.max(...bp)<=Math.min(...ap)+.000001)separate=true
        }
        expect(separate,`step${at} t${n/200}: ${a.name}/${b.name}`).toBe(true)
      }
    }
    disposeTree(m.subject)
  })
  it('supports every resting piece on the cloth throughout the checkpoint states',()=>{
    const m=createTangramModel(),mat=new THREE.Box3().setFromObject(m.subject.getObjectByName('tangram-cotton-mat')!,true)
    for(let at=0;at<=3;at++){m.pose(at,0);for(const p of m.pieces){const b=new THREE.Box3().setFromObject(p,true);expect(b.min.x,p.name).toBeGreaterThan(mat.min.x);expect(b.max.x,p.name).toBeLessThan(mat.max.x);expect(b.min.z,p.name).toBeGreaterThan(mat.min.z);expect(b.max.z,p.name).toBeLessThan(mat.max.z)}}
    disposeTree(m.subject)
  })
  it('conserves five triangular prisms, one square and one parallelogram with standard area ratios',()=>{
    const m=createTangramModel();m.pose(3,0)
    expect(m.pieces).toHaveLength(7)
    const areas=m.pieces.map(p=>{
      const mesh=p.getObjectByName(p.name+'-shell') as THREE.Mesh,g=mesh.geometry,pos=g.getAttribute('position'),normal=g.getAttribute('normal');let area=0
      const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3()
      for(let i=0;i<pos.count;i+=3)if(normal.getY(i)>.99){a.fromBufferAttribute(pos,i);b.fromBufferAttribute(pos,i+1);c.fromBufferAttribute(pos,i+2);area+=b.sub(a).cross(c.sub(a)).length()/2}
      return area
    })
    areas.forEach((a,i)=>expect(a/areas[3]!).toBeCloseTo([4,4,2,1,2,1,2][i]!,4))
    for(const name of names){const p=m.subject.getObjectByName('tangram-'+name)!,box=new THREE.Box3().setFromObject(p,true);expect(box.max.y-box.min.y).toBeGreaterThan(.075);expect(box.min.y).toBeCloseTo(.045,4)}
    disposeTree(m.subject)
  })
  it('fills a square once with seven disjoint top faces and small physical seams',()=>{
    const m=createTangramModel();m.pose(3,0)
    const shells=m.pieces.map(p=>p.getObjectByName(p.name+'-shell')!),ray=new THREE.Raycaster(),hits=new Set<string>();let covered=0
    for(let x=-1.19;x<1.2;x+=.027)for(let z=-1.19;z<1.2;z+=.029){
      ray.set(new THREE.Vector3(x,2,z),new THREE.Vector3(0,-1,0));const hit=ray.intersectObjects(shells,false);const bodies=new Set(hit.map(h=>h.object.id))
      expect(bodies.size).toBeLessThanOrEqual(1);if(hit.length){covered++;hits.add(hit[0]!.object.name)}
    }
    expect(hits.size).toBe(7);expect(covered/(89*83)).toBeGreaterThan(.93)
    disposeTree(m.subject)
  })
  it('moves only the active piece, restores every checkpoint and keeps lifted wood above the board',()=>{
    const m=createTangramModel(),moving=['small-1','square','parallelogram']
    for(let at=0;at<3;at++){
      m.pose(at,0);const starts=m.pieces.map(p=>p.matrixWorld.clone())
      m.pose(at,.5);expect(m.subject.getObjectByName('tangram-'+moving[at])!.position.y).toBeGreaterThan(.3)
      for(let i=0;i<m.pieces.length;i++)if(!m.pieces[i]!.name.endsWith(moving[at]!))expect(m.pieces[i]!.matrixWorld.elements).toEqual(starts[i]!.elements)
      for(let n=0;n<=30;n++){m.pose(at,n/30);for(const p of m.pieces)expect(new THREE.Box3().setFromObject(p,true).min.y).toBeGreaterThanOrEqual(.0449)}
      m.pose(at,1);const end=m.pieces.map(p=>p.matrixWorld.clone());m.pose(at+1,0);m.pieces.forEach((p,i)=>p.matrixWorld.elements.forEach((v,j)=>expect(v).toBeCloseTo(end[i]!.elements[j]!,8)))
    }
    disposeTree(m.subject)
  })
  it('reuses all geometry during slide and rotation and never intersects neighboring pieces',()=>{
    const m=createTangramModel(),geometries=m.pieces.map(p=>(p.children[0] as THREE.Mesh).geometry),ray=new THREE.Raycaster()
    for(let at=0;at<3;at++)for(let n=0;n<=30;n++){
      m.pose(at,n/30)
      m.pieces.forEach((p,i)=>{expect((p.children[0] as THREE.Mesh).geometry).toBe(geometries[i]);expect(p.matrixWorld.elements.every(Number.isFinite)).toBe(true)})
      const shells=m.pieces.map(p=>p.children[0]!),boxes=shells.map(p=>new THREE.Box3().setFromObject(p,true))
      // Vertically separated motion can pass above settled pieces. Near the plane,
      // sample both wood volumes along vertical rays to catch shared interior.
      for(let x=-2.35;x<2.4;x+=.10)for(let z=-1.4;z<2.5;z+=.10){
        ray.set(new THREE.Vector3(x,2,z),new THREE.Vector3(0,-1,0));const hit=ray.intersectObjects(shells,false),ids=[...new Set(hit.map(h=>shells.indexOf(h.object)))]
        for(let a=0;a<ids.length;a++)for(let b=a+1;b<ids.length;b++){const aa=boxes[ids[a]!]!,bb=boxes[ids[b]!]!;expect(Math.min(aa.max.y,bb.max.y)-Math.max(aa.min.y,bb.min.y)).toBeLessThan(.0001)}
      }
    }
    disposeTree(m.subject)
  })
})
