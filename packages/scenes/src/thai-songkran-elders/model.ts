import * as THREE from 'three'

const V=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z)
const smooth=(x:number)=>{const t=THREE.MathUtils.clamp(x,0,1);return t*t*(3-2*t)}
const vessel=(profile:number[][])=>{const g=new THREE.LatheGeometry(profile.map(([x,y])=>new THREE.Vector2(x!,y!)),48).toNonIndexed();g.computeVertexNormals();return g}

/** A seated elder, a hollow water bowl and a supported catch basin. Furniture and gesture timing are product staging. */
export function createSongkranModel(){
 const root=new THREE.Group();root.name='songkran-subject'
 const make=(name:string,g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D=root)=>{const o=new THREE.Mesh(g,m);o.name='songkran-'+name;o.castShadow=o.receiveShadow=true;parent.add(o);return o}
 const matte=(color:number,roughness=.9)=>new THREE.MeshStandardMaterial({color,roughness})
 const skin=matte(0xd49a73),shirt=matte(0xf5e7bb),pants=matte(0x468b8a),wood=matte(0x9c6c43),hair=matte(0xe1e0d3),dark=matte(0x55595a),stone=matte(0xdacfc0),metal=new THREE.MeshStandardMaterial({color:0x9dc2c3,metalness:.35,roughness:.42})
 const box=(name:string,size:number[],p:number[],m:THREE.Material,parent:THREE.Object3D=root)=>{const o=make(name,new THREE.BoxGeometry(...size as [number,number,number]),m,parent);o.position.set(...p as [number,number,number]);return o}
 const sphere=(name:string,p:number[],scale:number[],m:THREE.Material,parent:THREE.Object3D=root)=>{const o=make(name,new THREE.SphereGeometry(1,20,12),m,parent);o.position.set(...p as [number,number,number]);o.scale.set(...scale as [number,number,number]);return o}
 const link=(name:string,a:THREE.Vector3,b:THREE.Vector3,r:number,m:THREE.Material,parent:THREE.Object3D)=>{const o=make(name,new THREE.CapsuleGeometry(r,a.distanceTo(b),4,12),m,parent);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(V(0,1,0),b.clone().sub(a).normalize());return o}
 const bench=new THREE.Group();bench.name='songkran-bench';root.add(bench)
 box('bench-seat',[1.04,.08,.64],[0,.56,-.46],wood,bench)
 for(const x of[-.40,.40])for(const z of[-.68,-.24])box('bench-leg-'+x+'-'+z,[.09,.52,.09],[x,.26,z],wood,bench)
 const elder=new THREE.Group();elder.name='songkran-elder';root.add(elder)
 sphere('torso',[0,.95,-.46],[.34,.35,.22],shirt,elder)
 sphere('hips',[0,.68,-.43],[.30,.08,.20],pants,elder)
 for(const side of[-1,1]){
  const x=side*.19
  link('thigh-'+side,V(x,.70,-.42),V(x,.70,.04),.10,pants,elder)
  link('shin-'+side,V(x,.60,.04),V(x,.16,.04),.09,pants,elder)
  sphere('shoe-'+side,[x,.065,.10],[.105,.065,.17],dark,elder)
  link('sleeve-'+side,V(side*.26,1.07,-.42),V(side*.38,.88,-.13),.105,shirt,elder)
  link('forearm-'+side,V(side*.38,.88,-.12),V(side*.105,.91,.31),.055,skin,elder)
 }
 link('neck',V(0,1.17,-.46),V(0,1.27,-.46),.09,skin,elder)
 const head=sphere('head',[0,1.43,-.46],[.225,.25,.205],skin,elder)
 // Hair is a closed fitted scalp, rather than a detached decorative cap.
 const capGeometry=new THREE.SphereGeometry(1,24,16),capPos=capGeometry.getAttribute('position')
 for(let i=0;i<capPos.count;i++){const y=capPos.getY(i);capPos.setY(i,Math.max(y,-.02))}capGeometry.computeVertexNormals()
 const scalp=make('hair',capGeometry,hair,elder);scalp.position.set(0,1.47,-.485);scalp.scale.set(.228,.215,.201)
 for(const side of[-1,1]){sphere('ear-'+side,[side*.225,1.42,-.45],[.036,.055,.025],skin,elder);sphere('eye-'+side,[side*.073,1.44,-.264],[.014,.009,.007],dark,elder);sphere('brow-'+side,[side*.073,1.48,-.272],[.038,.009,.01],hair,elder)}
 sphere('nose',[0,1.40,-.249],[.026,.037,.023],skin,elder)
 sphere('smile',[0,1.345,-.263],[.040,.008,.008],dark,elder)
 const hands:THREE.Mesh[]=[]
 for(const side of[-1,1]){
  const x=side*.093
  hands.push(sphere('palm-'+side,[x,.922,.425],[.098,.037,.13],skin,elder))
  for(let i=0;i<4;i++){const fx=x+(i-1.5)*.042;hands.push(link('finger-'+side+'-'+i,V(fx,.926,.51),V(fx,.926,.60+(i===1||i===2?.025:0)),.020,skin,elder))}
  hands.push(link('thumb-'+side,V(x+side*.07,.919,.37),V(x+side*.13,.922,.46),.025,skin,elder))
 }
 const basin=make('basin',vessel([[0,0],[.40,0],[.46,.025],[.50,.18],[.474,.18],[.438,.035],[.39,.024],[0,.024]]),metal);basin.position.set(0,0,.80)
 const pad=make('pad',new THREE.CylinderGeometry(.30,.32,.06,40),stone);pad.position.set(-.80,.03,.60)
 const cup=new THREE.Group();cup.name='songkran-cup-root';root.add(cup)
 const bowl=make('bowl',vessel([[0,0],[.12,0],[.155,.018],[.26,.18],[.244,.18],[.138,.026],[.115,.018],[0,.018]]),metal,cup)
 const home=V(-.80,.06,.60),lifted=V(-.80,.74,.60),ready=V(-.38,1.15,.425)
 const waterMaterial=new THREE.MeshStandardMaterial({color:0x93d8e6,transparent:true,opacity:.62,roughness:.15,metalness:.1,side:THREE.DoubleSide,depthWrite:false})
 const waterGeometry=new THREE.BufferGeometry();waterGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(256*9),3));waterGeometry.setDrawRange(0,0)
 const water=make('water-surface',waterGeometry,waterMaterial);water.userData.effect=true;water.castShadow=false
 const caught=make('caught-water',new THREE.CircleGeometry(.422,48),waterMaterial);caught.rotation.x=-Math.PI/2;caught.position.set(0,.027,.80);caught.userData.effect=true;caught.castShadow=false
 const stream=make('pour-stream',new THREE.CylinderGeometry(.005,.005,1,12),waterMaterial);stream.userData.effect=true;stream.castShadow=false
 const runoff=make('runoff',new THREE.CylinderGeometry(.003,.003,1,12),waterMaterial);runoff.userData.effect=true;runoff.castShadow=false
 const lipGeometry=new THREE.BufferGeometry();lipGeometry.setAttribute('position',new THREE.Float32BufferAttribute([.244,.1801,-.005,.28,.1801,-.005,.28,.1801,.005,.244,.1801,-.005,.28,.1801,.005,.244,.1801,.005],3));lipGeometry.computeVertexNormals()
 const lipFlow=make('lip-flow',lipGeometry,waterMaterial,cup);lipFlow.userData.effect=true;lipFlow.castShadow=false
 const handFlowGeometry=new THREE.BufferGeometry();handFlowGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(256*18),3));handFlowGeometry.setDrawRange(0,0)
 const handFlow=make('hand-flow',handFlowGeometry,waterMaterial);handFlow.userData.effect=true;handFlow.castShadow=false
 const streamStart=V(0,0,0),streamEnd=V(0,0,0),runoffStart=V(0,0,0),runoffEnd=V(0,0,0)
 const setFlow=(mesh:THREE.Mesh,a:THREE.Vector3,b:THREE.Vector3)=>{mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.scale.y=a.distanceTo(b);mesh.quaternion.setFromUnitVectors(V(0,1,0),b.clone().sub(a).normalize())}
 // Intersect the hollow bowl's inner truncated cone with a WORLD-horizontal water plane.
 // All polygon vertices stay on the interior; the level never rises above the low rim while pouring.
 function liquid(fill:number){
  cup.updateMatrixWorld(true);const rings=[{y:.026,r:.138},{y:.18,r:.244}].map(({y,r})=>Array.from({length:48},(_,i)=>V(Math.cos(i/48*Math.PI*2)*r,y,Math.sin(i/48*Math.PI*2)*r).applyMatrix4(cup.matrixWorld)))
  const low=Math.min(...rings[1]!.map(p=>p.y)),level=Math.min(cup.position.y+(.12-fill*.065)*Math.cos(cup.rotation.z),low),points:THREE.Vector3[]=[]
  const add=(p:THREE.Vector3)=>{if(!points.some(q=>q.distanceToSquared(p)<1e-16))points.push(p)}
  const edge=(a:THREE.Vector3,b:THREE.Vector3)=>{if(Math.abs(a.y-level)<1e-9)add(a.clone());if(Math.abs(b.y-level)<1e-9)add(b.clone());if((a.y-level)*(b.y-level)<0)add(a.clone().lerp(b,(level-a.y)/(b.y-a.y)))}
  for(let i=0;i<48;i++){const j=(i+1)%48;edge(rings[0]![i]!,rings[1]![i]!);edge(rings[0]![i]!,rings[0]![j]!);edge(rings[1]![i]!,rings[1]![j]!)}
  const center=points.reduce((sum,p)=>sum.add(p),V(0,0,0)).divideScalar(Math.max(1,points.length));points.sort((a,b)=>Math.atan2(a.z-center.z,a.x-center.x)-Math.atan2(b.z-center.z,b.x-center.x))
  const pos=waterGeometry.getAttribute('position');pos.array.fill(0);let n=0
  for(let i=0;i<points.length;i++)for(const p of[center,points[(i+1)%points.length]!,points[i]!]){pos.setXYZ(n++,p.x,p.y,p.z)}
  waterGeometry.setDrawRange(0,n);pos.needsUpdate=true;waterGeometry.computeVertexNormals();waterGeometry.computeBoundingSphere();water.visible=n>0
 }
 function pose(checkpoint:number,amount:number,effects=true){
  if(checkpoint<3&&amount>=1){pose(checkpoint+1,0,effects);return}
  const t=THREE.MathUtils.clamp(Number.isFinite(amount)?amount:0,0,1);cup.position.copy(home);cup.rotation.set(0,0,0);stream.visible=runoff.visible=lipFlow.visible=handFlow.visible=false
  for(const o of[stream,runoff]){o.position.set(0,0,0);o.quaternion.identity();o.scale.set(1,1,1)}
  for(const p of[streamStart,streamEnd,runoffStart,runoffEnd])p.set(0,0,0)
  const flowPos=handFlowGeometry.getAttribute('position');flowPos.array.fill(0);flowPos.needsUpdate=true;handFlowGeometry.setDrawRange(0,0)
  let fill=checkpoint>=3?1:0
  if(checkpoint===0)cup.position.lerp(lifted,t)
  if(checkpoint===1)cup.position.copy(lifted).lerp(ready,t)
  if(checkpoint===2){
   cup.position.copy(ready)
   if(t<=.72){const tilt=smooth(t/.24)*(1-smooth((t-.58)/.14));cup.rotation.z=-.75*tilt;cup.position.x+=.16*smooth((t-.24)/.34);fill=smooth((t-.20)/.42)}
   else{fill=1;const u=(t-.72)/.28;if(u<.55)cup.position.copy(ready).add(V(.16,0,0)).lerp(lifted,u/.55);else cup.position.copy(lifted).lerp(home,(u-.55)/.45)}
   stream.visible=runoff.visible=t>.22&&t<.60&&cup.rotation.z<-.55
  }
  root.updateMatrixWorld(true);if(!effects)return
  liquid(fill);caught.position.y=.027+fill*.026
  if(stream.visible){
   // Water crosses the low lip on a thin surface sheet before falling outside the wall.
   lipFlow.visible=true;streamStart.copy(V(.28,.1801,0).applyMatrix4(cup.matrixWorld));
   const ray=new THREE.Raycaster(streamStart,V(0,-1,0));const hit=ray.intersectObjects(hands,false)[0]
   if(hit){
    streamEnd.copy(hit.point);setFlow(stream,streamStart,streamEnd)
    const path=[hit.point.clone().add(V(0,.004,0))]
    // Follow one actual finger from the palm, rather than falling through the gap between fingers.
    const palmSide=hit.object.name==='songkran-palm--1'?-1:1
    const fingerIndex=THREE.MathUtils.clamp(Math.round((hit.point.x-palmSide*.093)/.042+1.5),0,3),fingerX=palmSide*.093+(fingerIndex-1.5)*.042
    for(let z=hit.point.z+.002;z<.67;z+=.002){const x=THREE.MathUtils.lerp(hit.point.x,fingerX,smooth((z-hit.point.z)/.075)),p=new THREE.Raycaster(V(x,1.1,z),V(0,-1,0)).intersectObjects(hands,false)[0];if(!p)break;path.push(p.point.clone().add(V(0,.004,0)))}
    runoffStart.copy(path[path.length-1]!).add(V(0,0,.006));path.push(runoffStart.clone())
    const side=(p:THREE.Vector3,dx:number)=>{const q=p.clone().add(V(dx,0,0)),h=new THREE.Raycaster(V(q.x,1.1,q.z),V(0,-1,0)).intersectObjects(hands,false)[0];if(h)q.y=Math.max(q.y,h.point.y+.004);return q}
    const edges=path.map(p=>[side(p,-.002),side(p,.002)]);let n=0
    const last=edges[edges.length-1]!;runoffStart.copy(last[0]!).lerp(last[1]!,.5);runoffEnd.set(runoffStart.x,caught.position.y,runoffStart.z);setFlow(runoff,runoffStart,runoffEnd)
    for(let i=1;i<edges.length;i++){const a=edges[i-1]!,b=edges[i]!;for(const p of[a[0]!,b[0]!,b[1]!,a[0]!,b[1]!,a[1]!])flowPos.setXYZ(n++,p.x,p.y,p.z)}
    handFlowGeometry.setDrawRange(0,n);handFlowGeometry.computeVertexNormals();handFlowGeometry.computeBoundingSphere();handFlow.visible=true
   }else stream.visible=runoff.visible=lipFlow.visible=false
  }
  root.updateMatrixWorld(true)
 }
 pose(0,0)
 return{root,elder,head,hands,bench,basin,pad,cup,bowl,water,caught,stream,runoff,lipFlow,handFlow,streamStart,streamEnd,runoffStart,runoffEnd,home,lifted,ready,pose,tick:(_dt:number)=>{},targets:[bowl,bowl,bowl],roots:[cup,cup,cup],anchors:[V(0,.018,0),V(0,.018,0),V(0,.018,0)]}
}
