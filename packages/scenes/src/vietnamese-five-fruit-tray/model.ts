import * as THREE from 'three'

// Original spread-out preparation layout, not a replica of a stacked altar tray.
export function createVietnameseFiveFruitTrayModel(){
 const root=new THREE.Group();root.name='vietnamese-five-fruit-tray-root'
 const subject=new THREE.Group();subject.name='vietnamese-five-fruit-tray-subject';root.add(subject)
 const material=(color:number,roughness=.65)=>new THREE.MeshStandardMaterial({color,roughness})
 const orangeMat=material(0xe69331,.55),appleMat=material(0x83aa48,.48),pearMat=material(0xd4b75f,.68),pomeloMat=material(0xb6bf4e,.68),bananaMat=material(0x7fa24c,.72),leafMat=material(0x477642,.85),stemMat=material(0x6f5430,.88),red=material(0x974936,.55),gold=material(0xc6a35b,.4),stone=material(0xc0bca5,.96),ceramic=material(0x77928a,.78)
 const mesh=(parent:THREE.Object3D,name:string,g:THREE.BufferGeometry,mat:THREE.Material,x=0,y=0,z=0)=>{const m=new THREE.Mesh(g,mat);m.name=name;m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m}
 mesh(subject,'fruit-stone-base',new THREE.BoxGeometry(4.6,.12,2.6),stone,0,-.06,0)
 mesh(subject,'fruit-preparation-board',new THREE.BoxGeometry(.72,.05,2.1),ceramic,-1.5,.025,0)
 const trayProfile=[[0,0],[.5,0],[.72,.04],[1.10,.065],[1.18,.12],[1.15,.15],[1.10,.10],[0,.10]].map(([r,y])=>new THREE.Vector2(r,y))
 mesh(subject,'fruit-red-tray',new THREE.LatheGeometry(trayProfile,64),red,.65,0,0)
 const rim=mesh(subject,'fruit-tray-rim',new THREE.TorusGeometry(1.165,.012,8,80),gold,.65,.125,0);rim.rotation.x=Math.PI/2
 const leafShape=new THREE.Shape();leafShape.moveTo(0,0);leafShape.quadraticCurveTo(.10,.075,.23,.02);leafShape.quadraticCurveTo(.12,-.055,0,0)
 const leafGeo=new THREE.ExtrudeGeometry(leafShape,{depth:.006,bevelEnabled:true,bevelThickness:.001,bevelSize:.001,bevelSegments:1,curveSegments:10});leafGeo.translate(0,0,-.003)
 const fruit=(name:string,profile:number[][],mat:THREE.Material,top:number)=>{
  const f=new THREE.Group();f.name=name;subject.add(f)
  mesh(f,name+'-skin',new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),40),mat)
  mesh(f,name+'-stem',new THREE.CylinderGeometry(.012,.017,.05,8),stemMat,0,top+.025,0)
  const leaf=mesh(f,name+'-leaf',leafGeo,leafMat,0,top+.025,0);leaf.rotation.y=.5
  return f
 }
 const orange=fruit('orange',[[0,0],[.055,0],[.13,.025],[.20,.09],[.225,.20],[.21,.31],[.15,.39],[.065,.425],[0,.43]],orangeMat,.43)
 const apple=fruit('apple',[[0,0],[.065,0],[.155,.025],[.22,.12],[.23,.24],[.21,.34],[.15,.40],[.065,.405],[0,.39]],appleMat,.39)
 const pear=fruit('pear',[[0,0],[.055,0],[.145,.04],[.21,.15],[.205,.25],[.145,.35],[.09,.44],[.075,.51],[.045,.55],[0,.56]],pearMat,.56)
 const pomelo=fruit('pomelo',[[0,0],[.08,0],[.18,.035],[.27,.13],[.30,.26],[.27,.40],[.18,.50],[.07,.55],[0,.56]],pomeloMat,.56);pomelo.position.set(.85,.10,-.35)
 const bunch=new THREE.Group();bunch.name='banana-bunch';subject.add(bunch)
 const bananaGeometry=(offset:number)=>{
  const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(-.27,.08,offset),new THREE.Vector3(-.12,.08,offset),new THREE.Vector3(.08,.12,offset),new THREE.Vector3(.30,.40,offset)])
  const segments=24,sides=10,frames=curve.computeFrenetFrames(segments,false),positions:number[]=[],indices:number[]=[]
  for(let i=0;i<=segments;i++){const t=i/segments,c=curve.getPoint(t),radius=.008+.048*Math.pow(Math.sin(Math.PI*t),.38);for(let j=0;j<sides;j++){const theta=j/sides*Math.PI*2,p=c.clone().addScaledVector(frames.normals[i]!,Math.cos(theta)*radius).addScaledVector(frames.binormals[i]!,Math.sin(theta)*radius);positions.push(p.x,p.y,p.z)}}
  for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides,c=(i+1)*sides+j,d=(i+1)*sides+(j+1)%sides;indices.push(a,b,c,b,d,c)}
  for(const end of[0,segments]){const p=curve.getPoint(end/segments),center=positions.length/3;positions.push(p.x,p.y,p.z);for(let j=0;j<sides;j++){const a=end*sides+j,b=end*sides+(j+1)%sides;indices.push(...(end===0?[center,b,a]:[center,a,b]))}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g
 }
 for(let i=0;i<4;i++){const offset=(i-1.5)*.16;mesh(bunch,'banana-'+i,bananaGeometry(offset),bananaMat);mesh(bunch,'banana-tip-'+i,new THREE.SphereGeometry(.012,10,8),stemMat,.30,.40,offset)}
 const stalk=mesh(bunch,'banana-joined-stem',new THREE.CylinderGeometry(.024,.020,.52,12),stemMat,-.27,.08,0);stalk.rotation.x=Math.PI/2
 const bottom=new THREE.Box3().setFromObject(bunch).min.y;for(const child of bunch.children)child.position.y-=bottom
 bunch.position.set(.10,.10,-.35)
 const fruits=[orange,apple,pear];fruits.forEach(f=>f.name='prepared-fruit-'+f.name)
 const initial=[[-1.60,.05,-.65],[-1.38,.05,0],[-1.55,.05,.65]],goals=[[.05,.10,.38],[.72,.10,.47],[1.40,.10,.04]]
 function pose(step:number,n:number){const s=THREE.MathUtils.clamp(Math.floor(step),0,3),t=THREE.MathUtils.clamp(n,0,1);fruits.forEach((f,i)=>{const a=initial[i]!,b=goals[i]!;if(i<s||i===s&&t===1)f.position.set(b[0]!,b[1]!,b[2]!);else if(i>s||t===0)f.position.set(a[0]!,a[1]!,a[2]!);else if(t<=.25)f.position.set(a[0]!,a[1]!+.85*t*4,a[2]!);else if(t<=.75){const u=(t-.25)*2;f.position.set(a[0]!+(b[0]!-a[0]!)*u,a[1]!+(b[1]!-a[1]!)*u+.85,a[2]!+(b[2]!-a[2]!)*u)}else f.position.set(b[0]!,b[1]!+.85*(1-(t-.75)*4),b[2]!) });root.updateMatrixWorld(true)}
 pose(0,0)
 return{root,subject,fruits,targets:fruits,roots:fruits,anchors:[[0,.27,.18],[0,.27,.18],[0,.27,.18]]as[number,number,number][],pose}
}
