import * as THREE from 'three'

const V=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z),R=.52,H=.24,half=Math.PI/6
const outline=()=>[new THREE.Vector2(0,0),...Array.from({length:33},(_,i)=>{const a=half-i*2*half/32;return new THREE.Vector2(R*Math.sin(a),R*Math.cos(a))})]
// This side-opening cavity is an authored way to reveal a baked-in coin after serving.
const uv=(u:number,v:number)=>new THREE.Vector2(.5*u-Math.sqrt(3)/2*v,Math.sqrt(3)/2*u+.5*v)
function footprint(notch=false){const p=outline();if(notch)p.splice(1,0,uv(.22,0),uv(.22,.21),uv(.44,.21),uv(.44,0));return p}
function prism(points:THREE.Vector2[],bottom:number,height:number){
 const shape=new THREE.Shape(points),g=new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false,steps:1,curveSegments:1});
 // Shape x/y becomes world x/-z; flip its second coordinate to preserve winding.
 g.rotateX(-Math.PI/2);g.scale(1,1,-1);const index=g.index;
 if(index){for(let i=0;i<index.count;i+=3){const b=index.getX(i+1);index.setX(i+1,index.getX(i+2));index.setX(i+2,b)}}else{for(const attribute of Object.values(g.attributes)){for(let i=0;i<attribute.count;i+=3)for(let k=0;k<attribute.itemSize;k++){const a=attribute.array,one=(i+1)*attribute.itemSize+k,two=(i+2)*attribute.itemSize+k,tmp=a[one]!;a[one]=a[two]!;a[two]=tmp}}}
 g.translate(0,bottom,0);g.computeVertexNormals();g.computeBoundingBox();return g
}
function plateGeometry(_inner:number,outer:number){return new THREE.LatheGeometry([[0,0],[outer-.02,0],[outer,.009],[outer,.021],[outer-.01,.028],[0,.028]].map(p=>new THREE.Vector2(...p as [number,number])),64)}

/** Precut Vasilopita, a real supported cake server, a side cavity and a removable coin. */
export function createVasilopitaModel(){
 const root=new THREE.Group();root.name='vasilopita-subject';const subject=root
 const bread=new THREE.MeshStandardMaterial({color:0xe8bd70,roughness:.94}),crust=new THREE.MeshStandardMaterial({color:0xb66c35,roughness:.85}),sugar=new THREE.MeshStandardMaterial({color:0xfff5d9,roughness:.96}),ceramic=new THREE.MeshStandardMaterial({color:0xeee6ce,roughness:.52}),blue=new THREE.MeshStandardMaterial({color:0x3c9292,roughness:.66}),wood=new THREE.MeshStandardMaterial({color:0xa87548,roughness:.91}),metal=new THREE.MeshStandardMaterial({color:0xbdc5c1,metalness:.72,roughness:.3}),gold=new THREE.MeshStandardMaterial({color:0xd7af50,metalness:.66,roughness:.3})
 const make=(name:string,g:THREE.BufferGeometry,m:THREE.Material|THREE.Material[],parent:THREE.Object3D=root)=>{const mesh=new THREE.Mesh(g,m);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh}
 const table=make('vasilopita-table',new THREE.BoxGeometry(3,.10,3),wood);table.position.set(0,.45,.4)
 const legs=[[-1.28,-.88],[1.28,-.88],[-1.28,1.68],[1.28,1.68]].map(([x,z],i)=>{const m=make('vasilopita-leg-'+i,new THREE.BoxGeometry(.15,.4,.15),wood);m.position.set(x!,.2,z!);return m})
 const platter=make('vasilopita-platter',plateGeometry(.56,.67),ceramic);platter.position.set(-.58,.50,-.2)
 const familyPlate=make('vasilopita-family-plate',plateGeometry(.49,.59),ceramic);familyPlate.position.set(.65,.50,.2)
 const cake=new THREE.Group();cake.name='vasilopita-cake';cake.position.set(-.58,.528,-.2);root.add(cake)
 const pieces:THREE.Mesh[]=[];for(let i=1;i<6;i++){const piece=make('vasilopita-cake-piece-'+i,prism(footprint(),0,H),[crust,bread],cake);piece.rotation.y=i*Math.PI/3;pieces.push(piece)}
 const slice=new THREE.Group();slice.name='vasilopita-family-slice';root.add(slice)
 const sliceBottom=make('vasilopita-slice-bottom',prism(footprint(),0,.025),bread,slice)
 const sliceMiddle=make('vasilopita-slice-pocket',prism(footprint(true),.025,.20),bread,slice)
 const sliceTop=make('vasilopita-slice-top',prism(footprint(),.225,.015),crust,slice)
 // Thin closed sugar sectors sit on the actual top surfaces; no floating decals.
 for(let i=0;i<6;i++){const g=prism(outline().map(p=>p.clone().multiplyScalar(.91)),0,.0025);const m=make('vasilopita-sugar-'+i,g,sugar,i===0?slice:cake);m.position.y=H;m.rotation.y=i*Math.PI/3}
 const server=new THREE.Group();server.name='vasilopita-server-root';root.add(server)
 const blade=make('vasilopita-server-blade',prism(outline().map(p=>p.clone().multiplyScalar(.92)),-.008,.008),metal,server)
 const neck=make('vasilopita-server-neck',new THREE.BoxGeometry(.045,.008,.20),metal,server);neck.position.set(0,-.004,.55)
 const grip=make('vasilopita-grip',new THREE.CapsuleGeometry(.045,.26,6,12),blue,server);grip.rotation.x=Math.PI/2;grip.position.set(0,.038,.79)
 const rivet=make('vasilopita-grip-rivet',new THREE.CylinderGeometry(.013,.013,.003,12),metal,server);rivet.position.set(0,.082,.79)
 const coin=make('vasilopita-coin',new THREE.CylinderGeometry(.09,.09,.008,40),gold,slice)
 const coinMark=make('vasilopita-coin-ring',new THREE.TorusGeometry(.064,.002,6,40),gold,coin);coinMark.rotation.x=Math.PI/2;coinMark.position.y=.004
 const outward=V(Math.sqrt(3)/2,0,-.5),upright=new THREE.Quaternion().setFromUnitVectors(V(0,1,0),outward),flat=new THREE.Quaternion()
 // Seat the actual faceted coin on the cavity floor, including its rim geometry.
 coin.quaternion.copy(upright);root.updateMatrixWorld(true);const coinFloor=new THREE.Box3().setFromObject(coin,true).min.y
 const home=V(-.58,.536,-.2),lifted=home.clone().add(V(0,.34,0)),served=V(.65,.528,-.01),coinHome2=uv(.33,.10),coinHome=V(coinHome2.x,.025-coinFloor,coinHome2.y),coinEnd=V(1.03,.532,.24)
 const lerp=(a:THREE.Vector3,b:THREE.Vector3,t:number)=>a.clone().lerp(b,t)
 function pose(checkpoint:number,amount:number){
  if(checkpoint<3&&amount>=1){pose(checkpoint+1,0);return}
  const t=THREE.MathUtils.clamp(Number.isFinite(amount)?amount:0,0,1);slice.position.copy(home);server.position.copy(home);coin.position.copy(coinHome);coin.quaternion.copy(upright)
  if(checkpoint===0){slice.position.lerp(lifted,t);server.position.copy(slice.position)}
  else if(checkpoint===1){
   const over=served.clone().add(V(0,.348,0));
   if(t<=.45){slice.position.copy(lerp(lifted,over,t/.45));server.position.copy(slice.position)}
   else if(t<=.65){slice.position.copy(lerp(over,served.clone().add(V(0,.008,0)),(t-.45)/.2));server.position.copy(slice.position)}
   else{const u=(t-.65)/.35,drop=Math.max(0,(u-.8)/.2);slice.position.copy(served).add(V(0,.008*(1-drop),0));server.position.copy(served).add(V(0,.008,.86*Math.min(1,u/.8)));if(u>.8)server.position.y-=.028*drop}
  }else{
   slice.position.copy(served);server.position.copy(served).add(V(0,-.020,.86));
   const n=checkpoint>=3?1:t,worldHome=served.clone().add(coinHome),out=worldHome.clone().addScaledVector(outward,.22),raised=out.clone().add(V(0,.18,0));
   let p:THREE.Vector3;if(n<.35)p=lerp(worldHome,out,n/.35);else if(n<.55)p=lerp(out,raised,(n-.35)/.2);else if(n<.8)p=lerp(raised,coinEnd.clone().add(V(0,.18,0)),(n-.55)/.25);else p=lerp(coinEnd.clone().add(V(0,.18,0)),coinEnd,(n-.8)/.2)
   coin.position.copy(p.sub(served));
   coin.quaternion.slerp(flat,THREE.MathUtils.clamp((n-.55)/.25,0,1))
  }
  root.updateMatrixWorld(true)
 }
 pose(0,0)
 return{root,subject,table,legs,platter,familyPlate,cake,pieces,slice,sliceBottom,sliceMiddle,sliceTop,server,blade,neck,grip,coin,coinMark,home,lifted,served,coinHome,coinEnd,outward,pose,targets:[grip,grip,coin],roots:[server,server,coin],anchors:[V(0,0,0),V(0,0,0),V(0,.004,0)]}
}
