import * as THREE from 'three'

/** A modern replica wishing tree, a paper wish and its plastic orange weight. */
export function createLamTsuenModel() {
 const root=new THREE.Group();root.name='lamtsuen-root'
 const subject=new THREE.Group();subject.name='lamtsuen-subject';root.add(subject)
 const mat=(color:number,roughness=.8)=>new THREE.MeshStandardMaterial({color,roughness})
 const bark=mat(0x987456,.72),leaf=mat(0x79a45c),lightLeaf=mat(0xa3bd67),stone=mat(0xd8c7a1),red=mat(0xd85243),ink=mat(0xffe5a3),orange=mat(0xf79831,.4),cordMat=mat(0xc54230),green=mat(0x557b49)
 const mesh=(g:THREE.BufferGeometry,m:THREE.Material,p:THREE.Object3D,name:string)=>{const o=new THREE.Mesh(g,m);o.name=name;o.castShadow=true;o.receiveShadow=true;p.add(o);return o}
 const link=(a:THREE.Vector3,b:THREE.Vector3,r:number,m:THREE.Material,p:THREE.Object3D,name:string)=>{const o=mesh(new THREE.CylinderGeometry(r,r,a.distanceTo(b),12),m,p,name);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());return o}
 const v=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z)
 const paving=mesh(new THREE.BoxGeometry(2.4,.1,2.5),stone,subject,'lamtsuen-paving');paving.position.set(0,-.015,.20)
 link(v(-.78,.035,-.85),v(-.78,1.55,-.85),.14,bark,subject,'lamtsuen-trunk')
 link(v(-.78,1.50,-.85),v(-.78,1.55,-.10),.09,bark,subject,'lamtsuen-fork')
 const branch=link(v(-.78,1.55,-.10),v(.82,1.55,-.10),.07,bark,subject,'lamtsuen-wish-branch')
 link(v(-.78,1.45,-.85),v(-.52,2.12,-.95),.075,bark,subject,'lamtsuen-crown-stem')
 link(v(-.55,1.99,-.95),v(.65,2.02,-.95),.045,bark,subject,'lamtsuen-crown-bough')
 for(const [i,p] of [[-.83,2.12,-.95],[-.40,2.23,-1.0],[.08,2.19,-.95],[.52,2.15,-.95],[.83,2.03,-.95]].entries()){
  const o=mesh(new THREE.IcosahedronGeometry(1,1),i%2?lightLeaf:leaf,subject,`lamtsuen-leaf-cluster-${i}`);o.scale.set(.39,.24,.30);o.position.set(...p as [number,number,number])
 }
 const paperRoot=new THREE.Group();paperRoot.name='lamtsuen-paper-root';subject.add(paperRoot)
 const paper=mesh(new THREE.BoxGeometry(.55,.85,.012),red,paperRoot,'lamtsuen-paper')
 const paperKnot=mesh(new THREE.SphereGeometry(.014,16,12),cordMat,paperRoot,'lamtsuen-paper-knot');paperKnot.position.set(0,.418,.009)
 // The two fixed characters are this scene's example wish, not a prescribed formula.
 const strokes:number[][]=[[-.15,.29,.15,.29],[-.15,.18,.15,.18],[0,.31,0,-.02],[-.10,.25,-.06,.21],[.10,.25,.06,.21],[-.03,-.10,.03,-.14],[-.15,-.17,.15,-.17],[-.15,-.17,-.15,-.22],[.15,-.17,.15,-.22],[-.13,-.26,.13,-.26],[-.03,-.20,-.10,-.33],[-.10,-.33,.12,-.38],[.08,-.23,.03,-.32],[.03,-.32,-.12,-.38]]
 const letters=strokes.map(([x1,y1,x2,y2],i)=>link(v(x1!,y1!,.008),v(x2!,y2!,.008),.009,ink,paperRoot,`lamtsuen-ink-${i}`))
 const orangeRoot=new THREE.Group();orangeRoot.name='lamtsuen-orange-root';subject.add(orangeRoot)
 const fruit=mesh(new THREE.SphereGeometry(.21,32,20),orange,orangeRoot,'lamtsuen-orange')
 const seam=mesh(new THREE.TorusGeometry(.209,.0015,6,48),orange,orangeRoot,'lamtsuen-plastic-seam');seam.rotation.x=Math.PI/2
 const stem=mesh(new THREE.CylinderGeometry(.018,.025,.05,10),green,orangeRoot,'lamtsuen-orange-stem');stem.position.y=.225
 const loop=mesh(new THREE.TorusGeometry(.030,.009,8,24),cordMat,orangeRoot,'lamtsuen-orange-tie');loop.position.y=.27
 const segments=Array.from({length:32},(_,i)=>mesh(new THREE.CylinderGeometry(.009,.009,1,8),cordMat,subject,`lamtsuen-cord-${i}`))
 const saddle=mesh(new THREE.SphereGeometry(.009,16,12),cordMat,subject,'lamtsuen-cord-saddle')
 const paperStart=v(-.48,.041,.89),orangeStart=v(.40,.245,.48),paperEnd=v(.35,.675,.18),orangeEnd=v(.35,.94,-.40)
 const unitY=v(0,1,0),points=Array.from({length:33},()=>v(0,0,0))
 const finalCord=(u:number)=>{
  const k=u*32,r=.079/Math.cos(Math.PI/24)
  if(k<10)return v(.35,THREE.MathUtils.lerp(1.1,1.55,k/10),THREE.MathUtils.lerp(.194,-.10+r,k/10))
  if(k<=22){const a=(k-10)/12*Math.PI;return v(.35,1.55+r*Math.sin(a),-.10+r*Math.cos(a))}
  return v(.35,THREE.MathUtils.lerp(1.55,1.24,(k-22)/10),THREE.MathUtils.lerp(-.10-r,-.40,(k-22)/10))
 }
 const pose=(step:number,n:number)=>{
  const t=Number.isFinite(n)?THREE.MathUtils.clamp(n,0,1):0,flight=step>=3?1:step===2?t:0,writing=step>0?1:step===0?t:0,tying=step>1?1:step===1?t:0
  const arc=flight===0||flight===1?0:1.7*Math.sin(Math.PI*flight)
  paperRoot.position.lerpVectors(paperStart,paperEnd,flight);paperRoot.position.y+=arc
  paperRoot.rotation.set(-Math.PI/2*(1-flight),0,0)
  orangeRoot.position.lerpVectors(orangeStart,orangeEnd,THREE.MathUtils.clamp((flight-.25)/.35,0,1));orangeRoot.position.y=THREE.MathUtils.lerp(orangeStart.y,orangeEnd.y,flight)+arc
  letters.forEach((o,i)=>{o.visible=writing>i/letters.length});loop.visible=tying>0;paperKnot.visible=tying>0
  root.updateMatrixWorld(true)
  const start=paperRoot.localToWorld(v(0,.425,.014)),end=orangeRoot.localToWorld(v(0,.30,0))
  points.forEach((p,i)=>{const u=i/32,finish=finalCord(u);p.lerpVectors(start,end,u);p.lerp(finish,flight);p.y+=arc*flight})
  // Endpoints follow the real attachment points throughout the flight.
  points[0]!.copy(start);points[32]!.copy(end)
  segments.forEach((o,i)=>{const a=points[i]!,b=points[i+1]!,d=b.clone().sub(a);o.visible=tying>(i/32);o.position.copy(a).add(b).multiplyScalar(.5);o.scale.y=d.length();o.quaternion.setFromUnitVectors(unitY,d.normalize())})
  saddle.visible=tying>.5;saddle.position.copy(points[16]!);saddle.position.y-=(.079/Math.cos(Math.PI/24)-.079)*flight
  root.updateMatrixWorld(true)
 }
 pose(0,0)
 return {root,subject,targets:[paper,fruit,fruit],roots:[paperRoot,orangeRoot,orangeRoot],anchors:[[0,0,.007],[0,.08,.19],[0,.08,.19]] as [number,number,number][],pose,branch,points}
}
