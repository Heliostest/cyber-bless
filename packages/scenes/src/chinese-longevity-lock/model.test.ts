import{describe,it,expect}from'vitest'
import * as THREE from'three'
import{createToonSurfaces}from'../../../scene-runtime/src/toon-surfaces'
import{createLongevityLockModel,LOCK_COLORS,LOCK_LAYOUT}from'./model'

const physical=(o:THREE.Object3D):o is THREE.Mesh=>(o as THREE.Mesh).isMesh&&!o.userData.longevityOutline
const points=(o:THREE.Object3D)=>{o.updateWorldMatrix(true,true);const result:THREE.Vector3[]=[];o.traverse(n=>{if(physical(n)){const p=n.geometry.getAttribute('position');for(let i=0;i<p.count;i++)result.push(new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(n.matrixWorld))}});return result}
const box=(o:THREE.Object3D)=>{const b=new THREE.Box3();for(const p of points(o))b.expandByPoint(p);return b}
const necklace=(m:ReturnType<typeof createLongevityLockModel>)=>[m.lock,m.bail,m.cord,...m.drops,...m.links]
const luminance=(hex:number)=>{const c=new THREE.Color(hex);return .2126*c.r+.7152*c.g+.0722*c.b}

describe('silver lock necklace and supported gift presentation',()=>{
 it('rests the lock, bail, cord, links and flower drops on the velvet board and seats the board on the stand and in the case',()=>{const m=createLongevityLockModel(),L=LOCK_LAYOUT,top=box(m.velvet).max.y
  for(const o of necklace(m))expect(Math.min(...points(o).map(p=>p.y)),o.name).toBeCloseTo(top,5)
  // Every necklace part lies inside the flat velvet top, never over its rounded edge.
  const half=[(L.board.width-.06)/2-.024,(L.board.depth-.06)/2-.024]
  for(const o of necklace(m))for(const p of points(o)){const q=m.actor.worldToLocal(p.clone());if(Math.abs(q.x)>half[0]||Math.abs(q.z)>half[1])throw Error(o.name+' leaves the velvet top')}
  m.pose(0,0);expect(box(m.board).min.y).toBeCloseTo(box(m.stand).max.y,6)
  m.pose(3,0);const board=box(m.board),pad=box(m.pad),cavity=[L.case.width/2-L.case.wall,L.case.depth/2-L.case.wall]
  expect(board.min.y).toBeCloseTo(pad.max.y,6)
  // The smaller board drops into the case with room on every side and lands on the flat cushion top.
  expect(board.min.x-(L.case.x-cavity[0])).toBeGreaterThan(.04);expect(L.case.x+cavity[0]-board.max.x).toBeGreaterThan(.04)
  expect(board.min.z+cavity[1]).toBeGreaterThan(.04);expect(cavity[1]-board.max.z).toBeGreaterThan(.04)
  expect(board.max.x-board.min.x).toBeLessThan(pad.max.x-pad.min.x-.07);expect(board.max.z-board.min.z).toBeLessThan(pad.max.z-pad.min.z-.07)})
 it('grounds the case and the preparation stand on the courtyard floor',()=>{const m=createLongevityLockModel(),L=LOCK_LAYOUT
  expect(box(m.stand).min.y).toBeCloseTo(0,6);expect(box(m.box).min.y).toBeCloseTo(0,6)
  const base=box(m.root.getObjectByName('longevity-case-base')!);expect(box(m.walls).min.y).toBeCloseTo(base.max.y,6);expect(box(m.pad).min.y).toBeCloseTo(base.max.y,6)
  // A deeper case than the old shallow tray, still open, with the cushion below the rim.
  expect(box(m.walls).max.y).toBeCloseTo(L.case.top,6);expect(L.case.top).toBeGreaterThan(.45);expect(box(m.pad).max.y).toBeLessThan(L.case.top-.1)})
 it('keeps the rigid carrier clear of the stand, case walls and cushion across all 603 sampled poses',()=>{const m=createLongevityLockModel(),L=LOCK_LAYOUT,K=L.case,S=L.stand
  m.pose(0,0);const local=points(m.actor).map(p=>m.actor.worldToLocal(p))
  const outer=[K.width/2,K.depth/2],inner=[K.width/2-K.wall,K.depth/2-K.wall],stand=[S.width/2,S.depth/2]
  // The existing lift height still clears the raised walls before the board is lowered.
  expect(L.carry-K.top).toBeGreaterThan(.15)
  let checked=0
  for(const step of[0,1,2])for(let i=0;i<=200;i++){m.pose(step,i/200)
   expect(m.actor.quaternion.angleTo(new THREE.Quaternion())).toBe(0);expect(m.actor.scale.toArray()).toEqual([1,1,1]);expect(m.motion.matrix.equals(new THREE.Matrix4())).toBe(true)
   const o=m.actor.position
   for(const q of local){const x=q.x+o.x,y=q.y+o.y,z=q.z+o.z;checked++
    if(y<S.top-1e-6)throw Error('below the support')
    if(Math.abs(x-S.x)<stand[0]-1e-6&&Math.abs(z-S.z)<stand[1]-1e-6&&y<S.top-1e-6)throw Error('stand penetration')
    const inCase=Math.abs(x-K.x)<outer[0]+1e-6&&Math.abs(z-K.z)<outer[1]+1e-6
    if(inCase&&y<K.top+1e-6&&(Math.abs(x-K.x)>inner[0]-1e-6||Math.abs(z-K.z)>inner[1]-1e-6))throw Error('case wall penetration')
    if(inCase&&y<K.cushion-1e-6)throw Error('cushion penetration')
    if(step===0&&x>K.x-outer[0]-.08)throw Error('lift hits case')
    if(step===1&&y<L.carry-1e-6)throw Error('case wall clearance')
    if(step===2&&(Math.abs(x-K.x)>inner[0]-.03||Math.abs(z-K.z)>inner[1]-.03))throw Error('inside case clearance')}}
  expect(checked).toBeGreaterThan(1_000_000)})
 it('models the neck cord as an actual closed loop with a clear centre, threaded through the bail',()=>{const m=createLongevityLockModel(),P=m.plate;m.root.updateMatrixWorld(true)
  const ray=(x:number,z:number,target:THREE.Object3D)=>new THREE.Raycaster(m.motion.localToWorld(new THREE.Vector3(x,2,z)),new THREE.Vector3(0,-1,0)).intersectObject(target,false)[0]
  expect(ray(0,P.bailZ-.30,m.cord)).toBeUndefined();expect(ray(0,P.bailZ-.30,m.velvet)).toBeDefined()
  const strand=ray(.49,P.bailZ-.33,m.cord);expect(strand).toBeDefined();expect(m.motion.worldToLocal(strand!.point).y).toBeCloseTo(P.boardTop+.06,2)
  // A rounded cross-section: the strand's top is a curve, not a flat ribbon.
  const side=ray(.49+.02,P.bailZ-.33,m.cord);expect(side).toBeDefined();expect(m.motion.worldToLocal(side!.point).y).toBeLessThan(P.boardTop+.06-.004)
  const bail=box(m.bail),run=points(m.cord).filter(p=>{const q=m.motion.worldToLocal(p.clone());return Math.abs(q.x)<.08&&Math.abs(q.z-P.bailZ)<.1});expect(run.length).toBeGreaterThan(0)
  for(const p of run){expect(p.z).toBeGreaterThan(bail.min.z-1e-6);expect(p.z).toBeLessThan(bail.max.z+1e-6);expect(p.y).toBeLessThan(bail.max.y+1e-6)}})
 it('domes the closed silver plate inside a raised rim, with the small-seal relief raised on its face',()=>{const m=createLongevityLockModel(),P=m.plate
  const plate=box(m.lock);expect(plate.max.y-plate.min.y).toBeGreaterThan(.1)
  // Across the plate's waist: a raised rim near the edge, a shallow channel inside it, a fuller dome at the centre.
  const heights:[number,number][]=[];for(let x=.545;x>=0;x-=.0025)heights.push([x,m.face(x,P.z)-P.boardTop])
  const rim=Math.max(...heights.filter(([x])=>x>.47).map(([,h])=>h)),rimAt=heights.find(([,h])=>h===rim)![0]
  const channel=Math.min(...heights.filter(([x])=>x<rimAt&&x>.40).map(([,h])=>h)),centre=heights.at(-1)![1]
  expect(rim-channel).toBeGreaterThan(.008);expect(centre-rim).toBeGreaterThan(.02);expect(centre).toBeGreaterThan(.1)
  const bail=box(m.bail),cord=box(m.cord)
  for(const name of['longevity-letter-long','longevity-letter-ming']){const letter=m.motion.getObjectByName(name) as THREE.Mesh;expect(letter?.isMesh,name).toBe(true)
   expect(letter.children,name).toHaveLength(0)
   const p=letter.geometry.getAttribute('position'),gap:number[]=[];for(let i=0;i<p.count;i+=7){const v=new THREE.Vector3().fromBufferAttribute(p,i);gap.push(v.y-m.face(v.x,v.z))}
   // Metal relief above the face, seated into it rather than floating.
   expect(Math.max(...gap),name).toBeGreaterThan(P.stroke*1.2);expect(Math.min(...gap),name).toBeLessThan(0)
   const b=box(letter);expect(b.min.z,name).toBeGreaterThan(bail.max.z+.05);expect(b.min.z,name).toBeGreaterThan(cord.max.z+.05)
   expect(b.max.z,name).toBeLessThan(plate.max.z-.12);expect(b.min.x,name).toBeGreaterThan(plate.min.x+.15);expect(b.max.x,name).toBeLessThan(plate.max.x-.15)}
  // Left "長" and right "命" stay clear of each other and keep upright small-seal proportions.
  const longMesh=m.motion.getObjectByName('longevity-letter-long') as THREE.Mesh,mingMesh=m.motion.getObjectByName('longevity-letter-ming') as THREE.Mesh
  const longBox=box(longMesh),mingBox=box(mingMesh),plateCenterX=(plate.min.x+plate.max.x)/2
  expect(longBox.max.x-plateCenterX).toBeLessThan(-.05);expect(mingBox.min.x-plateCenterX).toBeGreaterThan(.05)
  const mingPos=mingMesh.geometry.getAttribute('position')
  let mingMinZ=Infinity,mingMaxZ=-Infinity
  for(let i=0;i<mingPos.count;i++){const z=mingPos.getZ(i);mingMinZ=Math.min(mingMinZ,z);mingMaxZ=Math.max(mingMaxZ,z)}
  let topMinX=Infinity,topMaxX=-Infinity,botMinX=Infinity,botMaxX=-Infinity
  const mingMidZ=(mingMinZ+mingMaxZ)/2
  for(let i=0;i<mingPos.count;i++){const x=mingPos.getX(i),z=mingPos.getZ(i);if(z<mingMidZ){topMinX=Math.min(topMinX,x);topMaxX=Math.max(topMaxX,x)}else if(z>mingMaxZ-.08){botMinX=Math.min(botMinX,x);botMaxX=Math.max(botMaxX,x)}}
  // Small-seal "命" has its wide roof toward -z (cord side) and narrow stem at +z (drop side).
  expect(topMaxX-topMinX).toBeGreaterThan((botMaxX-botMinX)*2.5)
  const relief=longMesh.material as THREE.ShaderMaterial;expect(relief.userData.longevityToon).toBe('relief')
  expect((relief.uniforms.uBands!.value as THREE.Vector2).y).toBeGreaterThan(.85);expect(relief.uniforms.uSide!.value).toBeGreaterThan(.3)
  const silver=m.lock.material as THREE.ShaderMaterial;expect(silver.userData.longevityToon).toBe('silver');expect(silver.uniforms.uLit).toBeDefined()})
 it('keeps three original five-petal flower drops, each joined to the plate by a short silver link',()=>{const m=createLongevityLockModel();expect(m.drops).toHaveLength(3);expect(m.links).toHaveLength(3)
  for(const[i,drop]of m.drops.entries()){const p=drop.geometry.getAttribute('position'),floor:[number,number][]=[]
   for(let j=0;j<p.count;j++)if(Math.abs(p.getY(j))<1e-7&&Math.hypot(p.getX(j),p.getZ(j))>.05)floor.push([Math.atan2(p.getZ(j),p.getX(j)),Math.hypot(p.getX(j),p.getZ(j))])
   const ring=[...new Map(floor.map(([a,r])=>[a.toFixed(4),r])).entries()].map(([a,r])=>[Number(a),r]as[number,number]).sort((a,b)=>a[0]-b[0])
   let peaks=0;for(let j=0;j<ring.length;j++){const r=ring[j]![1],a=ring[(j-1+ring.length)%ring.length]![1],b=ring[(j+1)%ring.length]![1];if(r>a&&r>=b)peaks++}
   expect(peaks,drop.name).toBe(5)
   const link=box(m.links[i]!),plate=box(m.lock),flower=box(drop),x=(link.min.x+link.max.x)/2
   const down=(z:number,target:THREE.Object3D)=>new THREE.Raycaster(new THREE.Vector3(x,2,z),new THREE.Vector3(0,-1,0)).intersectObject(target,false)[0]
   // Both ends sink into a real solid: the plate edge and the flower's notch.
   const plateHit=down(link.min.z+.006,m.lock),flowerHit=down(link.max.z-.006,drop)
   expect(plateHit,drop.name).toBeDefined();expect(flowerHit,drop.name).toBeDefined();expect(link.max.y).toBeLessThan(plateHit!.point.y);expect(link.max.y).toBeLessThan(flowerHit!.point.y)
   expect(link.max.z-link.min.z).toBeLessThan(.12);expect(flower.min.z).toBeGreaterThan(plate.min.z)}})
 it('keeps every checkpoint continuous without reallocating or deforming geometry',()=>{const m=createLongevityLockModel(),buffers=new Map<THREE.Mesh,{geometry:THREE.BufferGeometry;data:THREE.BufferAttribute;values:number[]}>();m.root.traverse(o=>{const p=o as THREE.Mesh;if(p.isMesh){const data=p.geometry.getAttribute('position') as THREE.BufferAttribute;buffers.set(p,{geometry:p.geometry,data,values:Array.from(data.array)})}});for(let step=0;step<3;step++){m.pose(step,1);const a=points(m.actor);m.pose(step+1,0);points(m.actor).forEach((p,i)=>expect(p.distanceTo(a[i]!)).toBeLessThan(1e-10))}for(const[p,old]of buffers){expect(p.geometry).toBe(old.geometry);expect(p.geometry.getAttribute('position')).toBe(old.data);expect(Array.from(old.data.array)).toEqual(old.values)}})
 it('carries the board, velvet and necklace on one inner motion node under the placement root',()=>{const m=createLongevityLockModel()
  expect(m.motion.parent).toBe(m.actor);expect(m.actor.children).toEqual([m.motion])
  for(const o of[m.board,m.velvet,...necklace(m),m.motion.getObjectByName('longevity-letter-long')!,m.motion.getObjectByName('longevity-letter-ming')!]){let node:THREE.Object3D|null=o;while(node&&node!==m.motion)node=node.parent;expect(node,o.name).toBe(m.motion)}
  for(const step of[0,1,2,3]){m.pose(step,.5);expect(m.motion.position.lengthSq()).toBe(0);expect(m.motion.quaternion.angleTo(new THREE.Quaternion())).toBe(0)}})
 it('keeps its cel shading, outlines and picking apart from the shared toon adapter, with silver the brightest tone',()=>{const m=createLongevityLockModel(),scene=new THREE.Scene();scene.add(m.root)
  const before=new Map<THREE.Mesh,THREE.Material>();m.root.traverse(o=>{const mesh=o as THREE.Mesh;if(mesh.isMesh)before.set(mesh,mesh.material as THREE.Material)})
  for(const material of before.values())expect(material).toBeInstanceOf(THREE.ShaderMaterial)
  const surfaces=createToonSurfaces('toon-soft','chinese-longevity-lock'),frame=surfaces.apply(scene);try{for(const[mesh,material]of before)expect(mesh.material,mesh.name).toBe(material);expect(frame.outlined).toEqual([])}finally{frame.restore();surfaces.dispose()}
  const lines=[...before.keys()].filter(mesh=>mesh.userData.longevityOutline);expect(lines.map(l=>l.name)).toEqual(expect.arrayContaining(['longevity-silver-lock-line','longevity-cotton-neck-cord-line','longevity-carrier-board-line','longevity-case-walls-line']))
  for(const line of lines){expect(line.castShadow).toBe(false);expect((line.material as THREE.Material).side).toBe(THREE.BackSide);const hits:THREE.Intersection[]=[];line.raycast(new THREE.Raycaster(new THREE.Vector3(0,5,0),new THREE.Vector3(0,-1,0)),hits);expect(hits).toEqual([]);expect((line.parent as THREE.Mesh).isMesh,line.name).toBe(true)
   const own=(line.parent as THREE.Mesh).geometry;own.computeBoundingBox();line.geometry.computeBoundingBox();expect(line.geometry.boundingBox!.min.distanceTo(own.boundingBox!.min)+line.geometry.boundingBox!.max.distanceTo(own.boundingBox!.max),line.name).toBeLessThan(1e-5)}
  // Value hierarchy: the silver is the lightest layer; velvet and dark wood sit far below it.
  const C=LOCK_COLORS;for(const dark of[C.velvet.lit,C.wood.lit,C.stand.lit,C.cord.base])expect(luminance(C.silver.shade)).toBeGreaterThan(luminance(dark))
  for(const dark of[C.velvet.lit,C.wood.lit])expect(luminance(dark)).toBeLessThan(.08)
  expect(luminance(C.silver.base)).toBeGreaterThan(luminance(C.cord.lit))})
 it('simulates only the closed cotton neck cord with Rapier, keeps bail threading and outline match, and sleeps calmly',async()=>{
  const m=createLongevityLockModel(),L=LOCK_LAYOUT,cordPos=m.cord.geometry.getAttribute('position'),cordBuf=cordPos.array
  const lockBefore=Array.from(m.lock.geometry.getAttribute('position').array)
  const cordLine=m.cord.children.find(c=>c.name==='longevity-cotton-neck-cord-line') as THREE.Mesh
  const lineBuf=cordLine.geometry.getAttribute('position').array
  await m.startCordPhysics()
  expect(m.cordRapierReady).toBe(true)
  // Lift and sweep carrier across into the case to excite gravity & inertia on the soft cord without kinking.
  const restBox=box(m.cord)
  for(let i=1;i<=12;i++){m.pose(0,i/12);m.stepCord(1/30)}
  for(let i=1;i<=12;i++){m.pose(1,i/12);m.stepCord(1/30)}
  const sweptBox=box(m.cord)
  // During the rapid slide, the loop stays smoothly open (never collapsing or bunching past 12% width distortion).
  expect(Math.abs((sweptBox.max.x-sweptBox.min.x)-(restBox.max.x-restBox.min.x))).toBeLessThan(.12)
  const lifted=Array.from(cordBuf)
  for(let i=0;i<60;i++)m.stepCord(1/60)
  expect(m.cord.geometry.getAttribute('position').array).toBe(cordBuf)
  expect(cordLine.geometry.getAttribute('position').array).toBe(lineBuf)
  // Silver lock geometry was never modified.
  expect(Array.from(m.lock.geometry.getAttribute('position').array)).toEqual(lockBefore)
  expect(lifted.every(Number.isFinite)).toBe(true)
  // Cord stays inside flat velvet top and on/above velvet surface, outline box stays synced.
  const half=[(L.board.width-.06)/2-.024,(L.board.depth-.06)/2-.024]
  for(const p of points(m.cord)){const q=m.actor.worldToLocal(p.clone());expect(Math.abs(q.x)).toBeLessThanOrEqual(half[0]+1e-4);expect(Math.abs(q.z)).toBeLessThanOrEqual(half[1]+1e-4);expect(q.y).toBeGreaterThanOrEqual(m.plate.boardTop-1e-4)}
  m.cord.geometry.computeBoundingBox();cordLine.geometry.computeBoundingBox()
  expect(cordLine.geometry.boundingBox!.min.distanceTo(m.cord.geometry.boundingBox!.min)+cordLine.geometry.boundingBox!.max.distanceTo(m.cord.geometry.boundingBox!.max)).toBeLessThan(1e-5)
  m.dispose()
 })
})
