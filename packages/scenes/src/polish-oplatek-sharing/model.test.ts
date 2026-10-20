import {describe,it,expect} from 'vitest'
import * as THREE from 'three'
import {createOplatekModel,mainOutline,pieceOutline} from './model'
import {disposeTree} from '../procedural-kit'

const area=(p:[number,number][])=>Math.abs(p.reduce((s,[x,z],i)=>{const q=p[(i+1)%p.length]!;return s+x*q[1]-q[0]*z},0))/2
const snapshot=(m:ReturnType<typeof createOplatekModel>)=>{m.root.updateMatrixWorld(true);const out:number[]=[];m.root.traverse(o=>out.push(...o.matrixWorld.elements));return out}
describe('Oplatek physical sharing',()=>{
  it('clears the receiving fingertips before lifting and detects the former immediate-lift penetration',()=>{
    const m=createOplatekModel(),ray=new THREE.Raycaster()
    const penetrations=()=>{let count=0;m.root.updateMatrixWorld(true);m.recipientHand.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh||!mesh.name.includes('finger-'))return
      const p=mesh.geometry.getAttribute('position');for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);ray.set(v.clone().add(new THREE.Vector3(0,1,0)),new THREE.Vector3(0,-1,0));const top=ray.intersectObject(m.main)[0]?.point.y
        if(top!==undefined&&v.y>top-.03+1e-7&&v.y<top-1e-7)count++}
    });return count}
    for(const t of [.43,.5,.6,.7]){m.pose(1,t);expect(penetrations()).toBe(0)}
    m.pose(1,.5);const fraction=(m.pieceCarrier.position.x-m.holder.position.x)/.18;m.recipient.position.y=m.holder.position.y+.08*fraction
    expect(penetrations()).toBeGreaterThan(0);disposeTree(m.root)
  })
  it('supports the real volume centre of the wafer inside the actual hand contact hull',()=>{
    const m=createOplatekModel(),cross=(a:number[],b:number[],c:number[])=>(b[0]!-a[0]!)*(c[1]!-a[1]!)-(b[1]!-a[1]!)*(c[0]!-a[0]!)
    for(const at of [0,2]){
      m.pose(at,0);let mass=0;const centre=new THREE.Vector3()
      m.root.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh||!/^oplatek-(main|star|rim-|line-)/.test(mesh.name)&&!(at===0&&mesh===m.piece))return
        const p=mesh.geometry.getAttribute('position'),index=mesh.geometry.index,count=index?.count??p.count
        for(let i=0;i<count;i+=3){const v=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i+k):i+k).applyMatrix4(mesh.matrixWorld)),vol=v[0]!.dot(v[1]!.clone().cross(v[2]!))/6
          mass+=vol;centre.add(v[0]!.clone().add(v[1]!).add(v[2]!).multiplyScalar(vol/4))}
      });centre.divideScalar(mass)
      const supports:THREE.Object3D[]=[];m.holderHand.traverse(o=>{if((o as THREE.Mesh).isMesh)supports.push(o)})
      const ray=new THREE.Raycaster(),points:number[][]=[]
      for(let xi=-10;xi<=10;xi++)for(let zi=-13;zi<=13;zi++){
        const origin=m.holder.localToWorld(new THREE.Vector3(xi*.05,1,zi*.05));ray.set(origin,new THREE.Vector3(0,-1,0))
        const w=ray.intersectObjects(at===0?[m.main,m.piece]:[m.main],false)[0],h=ray.intersectObjects(supports,false)[0]
        if(w&&h&&Math.abs(w.point.y-.03-h.point.y)<1e-6)points.push([h.point.x,h.point.z])
      }
      points.sort((a,b)=>a[0]!-b[0]!||a[1]!-b[1]!);const hull:number[][]=[]
      for(const p of points){while(hull.length>1&&cross(hull[hull.length-2]!,hull[hull.length-1]!,p)<=0)hull.pop();hull.push(p)}
      const lower=hull.length;for(let i=points.length-2;i>=0;i--){const p=points[i]!;while(hull.length>lower&&cross(hull[hull.length-2]!,hull[hull.length-1]!,p)<=0)hull.pop();hull.push(p)}hull.pop()
      expect(hull.length).toBeGreaterThan(3);hull.forEach((p,i)=>expect(cross(p,hull[(i+1)%hull.length]!,[centre.x,centre.z])).toBeGreaterThan(0))
    }disposeTree(m.root)
  })
  it('partitions one thin rectangle into exactly complementary closed wafers',()=>{
    const m=createOplatekModel();expect(area(mainOutline)+area(pieceOutline)).toBeCloseTo(1.1*1.4,12)
    for(const mesh of [m.main,m.piece]){
      const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone(),p=g.getAttribute('position'),edges=new Map<string,number>();let volume=0
      const point=(i:number)=>new THREE.Vector3().fromBufferAttribute(p,i)
      for(let i=0;i<p.count;i+=3){const v=[point(i),point(i+1),point(i+2)];volume+=v[0]!.dot(v[1]!.clone().cross(v[2]!))/6
        for(let j=0;j<3;j++){const key=[v[j]!,v[(j+1)%3]!].map(v=>v.toArray().map(n=>n.toFixed(6)).join(',')).sort().join('|');edges.set(key,(edges.get(key)??0)+1)}
      }
      expect([...edges.values()].every(n=>n===2)).toBe(true)
      expect(Math.abs(volume)).toBeCloseTo(area(mesh===m.main?mainOutline:pieceOutline)*.03,7);g.dispose()
    }disposeTree(m.root)
  })
  it('keeps the whole wafer joined until the other family member makes contact',()=>{
    const m=createOplatekModel();for(let i=0;i<=42;i++){const t=i/100;m.pose(1,t);expect(m.pieceCarrier.position.distanceTo(m.holder.position)).toBe(0)
      if(t<.38)expect(m.recipient.position.y).toBeLessThan(m.holder.position.y)
    }m.pose(1,.38);expect(m.recipient.position.distanceTo(m.holder.position)).toBe(0);disposeTree(m.root)
  })
  it('keeps the receiver palm in actual surface contact under the separated piece throughout movement',()=>{
    const m=createOplatekModel(),ray=new THREE.Raycaster(),palm=m.root.getObjectByName('oplatek-receiver-palm')!
    for(const step of [1,2,3])for(let i=0;i<=50;i++){
      const n=step===1?.38+i/50*.62:i/50;m.pose(step,n)
      const origin=m.recipientHand.localToWorld(new THREE.Vector3(0,1,0));ray.set(origin,new THREE.Vector3(0,-1,0))
      const a=ray.intersectObject(m.piece)[0],b=ray.intersectObject(palm)[0];expect(a).toBeDefined();expect(b).toBeDefined()
      expect(b!.point.y).toBeCloseTo(a!.point.y-.03,7)
    }disposeTree(m.root)
  })
  it.each([0,1,2])('has no jump when action %i reaches its saved checkpoint',step=>{
    const m=createOplatekModel();m.pose(step,1-1e-6);const approaching=snapshot(m);m.pose(step+1,0);const restored=snapshot(m)
    expect(Math.max(...approaching.map((v,i)=>Math.abs(v-restored[i]!)))).toBeLessThan(1e-5);disposeTree(m.root)
  })
  it('keeps both distinct hands and their continuous sleeves present in every checkpoint',()=>{
    const m=createOplatekModel();for(let at=0;at<4;at++){m.pose(at,0);for(const name of ['giver','receiver'])for(const part of ['palm','wrist','forearm','sleeve'])expect(m.root.getObjectByName(`oplatek-${name}-${part}`)?.visible).toBe(true)}
    expect(m.holderHand.rotation.y).not.toBe(m.recipientHand.rotation.y);disposeTree(m.root)
  })
  it('keeps rigid finite geometry at every sampled pose',()=>{
    const m=createOplatekModel();for(let step=0;step<3;step++)for(let i=0;i<=50;i++){m.pose(step,i/50);m.root.traverse(o=>{expect(o.matrixWorld.elements.every(Number.isFinite)).toBe(true);expect(o.scale.toArray()).toEqual([1,1,1])})}disposeTree(m.root)
  })
})
