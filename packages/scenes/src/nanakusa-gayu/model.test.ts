import {describe,it,expect}from'vitest'
import * as THREE from'three'
import {createNanakusaModel}from'./model'
import {disposeTree}from'../procedural-kit'
describe('porridge, ladle and receiving bowl',()=>{
 it('keeps every checkpoint continuous and names unique, including hidden contents',()=>{
  const m=createNanakusaModel(),names:string[]=[];m.root.traverse(o=>names.push(o.name));expect(new Set(names).size).toBe(names.length)
  for(let step=0;step<3;step++){m.pose(step,1);const end=new Map<string,{matrix:number[];visible:boolean}>();m.root.traverse(o=>end.set(o.name,{matrix:[...o.matrixWorld.elements],visible:o.visible}));m.pose(step+1,0);m.root.traverse(o=>{o.matrixWorld.elements.forEach((v,i)=>expect(v,o.name).toBeCloseTo(end.get(o.name)!.matrix[i]!,7));expect(o.visible,o.name).toBe(end.get(o.name)!.visible)})}
  disposeTree(m.root)
 })
 it('rests both vessels and the parked ladle on real support surfaces',()=>{
  const m=createNanakusaModel(),board=new THREE.Box3().setFromObject(m.board,true)
  for(const vessel of[m.pot,m.bowl])expect(new THREE.Box3().setFromObject(vessel,true).min.y).toBeCloseTo(board.max.y,6)
  for(const step of[0,3]){m.pose(step,0);expect(new THREE.Box3().setFromObject(m.head,true).min.y).toBeCloseTo(new THREE.Box3().setFromObject(m.headRest,true).max.y,6)}
  expect(new THREE.Box3().setFromObject(m.handle,true).intersectsBox(new THREE.Box3().setFromObject(m.bowl,true))).toBe(false)
  expect(new THREE.Box3().setFromObject(m.tailRest,true).intersectsBox(new THREE.Box3().setFromObject(m.bowl,true))).toBe(false)
  expect(m.ladle.position.distanceTo(m.park)).toBeLessThan(1e-7);disposeTree(m.root)
 })
 it('keeps the ladle head inside the open pot while submerged and clears solid supports across 603 poses',()=>{
  const m=createNanakusaModel(),v=new THREE.Vector3()
  for(let step=0;step<3;step++)for(let i=0;i<=200;i++){m.pose(step,i/200);const box=new THREE.Box3().setFromObject(m.head,true);expect(box.min.y).toBeGreaterThanOrEqual(.07-1e-6)
   const p=m.head.geometry.getAttribute('position');for(let j=0;j<p.count;j++){v.fromBufferAttribute(p,j).applyMatrix4(m.head.matrixWorld);const r=Math.hypot(v.x-m.pot.position.x,v.z-m.pot.position.z);if(v.y<.77-1e-5&&r<.74)expect(r,'head clears inner ceramic wall').toBeLessThan(.645)}
  }disposeTree(m.root)
 })
 it('connects each visible stream to the actual lip and current bowl surface, then leaves a served bowl',()=>{
  const m=createNanakusaModel(),tip=new THREE.Vector3()
  for(let i=0;i<=200;i++){m.pose(2,i/200);if(m.stream.visible){tip.copy(m.spout).applyMatrix4(m.ladle.matrixWorld);expect(m.stream.position.x).toBeCloseTo(tip.x,6);expect(m.stream.position.z).toBeCloseTo(tip.z,6);expect(m.stream.position.y+m.stream.scale.y/2).toBeCloseTo(tip.y,6);expect(m.stream.position.y-m.stream.scale.y/2).toBeCloseTo(m.bowlSurface(),6);expect(Math.hypot(tip.x-m.bowl.position.x,tip.z-m.bowl.position.z)).toBeLessThan(.38)}}
  m.pose(3,0);expect(m.served.visible).toBe(true);expect(m.payload.visible).toBe(false);expect(m.stream.visible).toBe(false);expect(m.bowlSurface()).toBeGreaterThan(.20);disposeTree(m.root)
 })
 it('uses closed finite positive-volume nondegenerate geometry',()=>{
  const m=createNanakusaModel();let count=0;m.root.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;count++;const p=mesh.geometry.getAttribute('position'),edges=new Map<string,{count:number;balance:number}>();let volume=0;const key=(v:THREE.Vector3)=>v.toArray().map(n=>Math.round(n*1e5)).join(',')
   for(let i=0;i<p.count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(p,i),b=new THREE.Vector3().fromBufferAttribute(p,i+1),c=new THREE.Vector3().fromBufferAttribute(p,i+2);expect([...a,...b,...c].every(Number.isFinite),mesh.name).toBe(true);expect(new THREE.Triangle(a,b,c).getArea(),mesh.name).toBeGreaterThan(1e-12);volume+=a.dot(b.clone().cross(c))/6;const vs=[a,b,c];for(let k=0;k<3;k++){const x=key(vs[k]!),y=key(vs[(k+1)%3]!),name=[x,y].sort().join('|'),e=edges.get(name)??{count:0,balance:0};e.count++;e.balance+=x<y?1:-1;edges.set(name,e)}}
   expect(volume,mesh.name).toBeGreaterThan(0);expect([...edges.values()].every(e=>e.count===2&&e.balance===0),mesh.name).toBe(true)
  });expect(count).toBeGreaterThan(50);disposeTree(m.root)
 })
 it('keeps every loaded food vertex inside the hollow wooden ladle',()=>{
  const m=createNanakusaModel(),v=new THREE.Vector3()
  for(const[step,t]of[[1,.4],[2,.40],[2,.55],[2,.68]]){m.pose(step!,t!);m.payload.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;const p=mesh.geometry.getAttribute('position');for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);m.ladle.worldToLocal(v);const r=Math.hypot(v.x,v.z),limit=v.y<-.04?(v.y+.055)*8:v.y<.025?.12+(v.y+.04)*(.05/.065):.17+(v.y-.025)*(.015/.055);expect(v.y,mesh.name).toBeGreaterThanOrEqual(-.055-1e-6);expect(v.y,mesh.name).toBeLessThanOrEqual(.08+1e-6);expect(r,mesh.name).toBeLessThanOrEqual(limit+1e-5)}})}disposeTree(m.root)
 })
 it('exposes loaded rice and greens above their porridge surface while keeping them in contact',()=>{
  const m=createNanakusaModel();m.pose(1,.4);m.payload.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh||!mesh.name.startsWith('loaded-'))return;mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrix);expect(box.max.y,mesh.name).toBeGreaterThan(.027);expect(box.min.y,mesh.name).toBeLessThanOrEqual(.027)})
  disposeTree(m.root)
 })
 it('keeps every serving vertex inside the bowl above its inner floor throughout filling',()=>{
  const m=createNanakusaModel(),v=new THREE.Vector3()
  let lowest=Infinity,largestOverrun=-Infinity
  for(let n=1;n<=200;n++){m.pose(2,.34+.36*n/200);m.served.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;const p=mesh.geometry.getAttribute('position');for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);const r=Math.hypot(v.x-m.bowl.position.x,v.z-m.bowl.position.z),inner=.34+(v.y-.17)*(.09/.15);lowest=Math.min(lowest,v.y);largestOverrun=Math.max(largestOverrun,r-inner)}})}
  expect(lowest).toBeGreaterThanOrEqual(.17-1e-6);expect(largestOverrun).toBeLessThanOrEqual(1e-5);disposeTree(m.root)
 })
 it('reuses geometry buffers throughout the full sequence',()=>{
  const m=createNanakusaModel(),buffers=new Map<THREE.Mesh,unknown>();m.root.traverse(o=>{const mesh=o as THREE.Mesh;if(mesh.isMesh)buffers.set(mesh,mesh.geometry.getAttribute('position').array)})
  for(let step=0;step<3;step++)for(let i=0;i<=100;i++){m.pose(step,i/100);for(const[mesh,buffer]of buffers)expect(mesh.geometry.getAttribute('position').array).toBe(buffer)}disposeTree(m.root)
 })
})
