import {applyCraftSurface} from '@wbr/scene-runtime/craft-surfaces'
import * as THREE from 'three'
import {createStylizedWater} from '@wbr/scene-runtime/stylized-water'
import {createLivingPourStream} from '@wbr/scene-runtime/vessel-liquid'

function buildPolarDiscXY(radius:number,rings:number,sides:number){
 const pos:number[]=[0,0,0],uv:number[]=[.5,.5],idx:number[]=[]
 for(let j=1;j<=rings;j++){
  const r=radius*(j/rings)
  for(let k=0;k<sides;k++){
   const a=(k/sides)*Math.PI*2,cs=Math.cos(a),sn=Math.sin(a)
   pos.push(r*cs,r*sn,0);uv.push(.5+.5*(j/rings)*cs,.5+.5*(j/rings)*sn)
  }
 }
 for(let k=0;k<sides;k++)idx.push(0,1+k,1+(k+1)%sides)
 for(let j=1;j<rings;j++)for(let k=0;k<sides;k++){
  const a=1+(j-1)*sides+k,b=1+(j-1)*sides+(k+1)%sides,c=1+j*sides+k,d=1+j*sides+(k+1)%sides
  idx.push(a,c,d,a,d,b)
 }
 const g=new THREE.BufferGeometry()
 g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3))
 g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2))
 g.setIndex(idx);g.computeVertexNormals();return g
}

export function createShishiOdoshiModel(){
 const subject=new THREE.Group(),fixed=new THREE.Group(),pivot=new THREE.Group(),feed=new THREE.Group()
 subject.name='sozu-subject';fixed.name='sozu-fixed';pivot.name='sozu-pivot';feed.name='sozu-feed';subject.add(fixed,pivot,feed);pivot.position.y=1.15
 const bambooWet=applyCraftSurface(new THREE.MeshPhysicalMaterial({color:'#93a655',roughness:.46,clearcoat:.32,clearcoatRoughness:.28,specularIntensity:.68,vertexColors:true}),{kind:'bamboo',strength:.48,scale:.85,axis:'x'})
 const bambooUpright=applyCraftSurface(new THREE.MeshPhysicalMaterial({color:'#8ca050',roughness:.54,clearcoat:.25,clearcoatRoughness:.34,specularIntensity:.62,vertexColors:true}),{kind:'bamboo',strength:.48,scale:.85,axis:'y'})
 const cut=applyCraftSurface(new THREE.MeshStandardMaterial({color:'#e5d8a1',roughness:.86}),{kind:'bamboo',strength:.30,scale:.9,axis:'x'})
 const node=applyCraftSurface(new THREE.MeshPhysicalMaterial({color:'#6f7f3d',roughness:.56,clearcoat:.22,clearcoatRoughness:.36,specularIntensity:.56}),{kind:'bamboo',strength:.40,scale:.9,axis:'x'})
 const stone=new THREE.MeshStandardMaterial({color:'#8c9a98',roughness:.98,vertexColors:true})
 const pinMat=applyCraftSurface(new THREE.MeshPhysicalMaterial({color:'#bd9e6b',roughness:.66,clearcoat:.14,clearcoatRoughness:.42,specularIntensity:.50}),{kind:'wood',strength:.45,scale:.8,axis:'y'})
 const waterMat=new THREE.MeshPhysicalMaterial({color:'#70c9c5',transparent:true,opacity:.70,roughness:.20,depthWrite:false,side:THREE.DoubleSide})
 waterMat.userData.waterRendering=true
 const tintBamboo=(g:THREE.BufferGeometry,axis:'x'|'y',waterlineY?:number,nodes:number[]=[])=>{
  const p=g.attributes.position!,a=new Float32Array(p.count*3),c=new THREE.Color(),damp=new THREE.Color('#779654'),bloom=new THREE.Color('#eef4dc')
  for(let i=0;i<p.count;i++){
   const px=p.getX(i),py=p.getY(i),pz=p.getZ(i)
   const angle=axis==='x'?Math.atan2(pz,py):Math.atan2(pz,px)
   const striation=.985+.025*Math.sin(angle*7)+.016*Math.cos(angle*13+.8)
   c.setRGB(striation,striation,striation)
   for(const nx of nodes){
    const d=px-nx
    const bloomAmt=Math.exp(-(((d-.045)/.045)**2))
    c.lerp(bloom,bloomAmt*.24)
    if(Math.abs(d)<.04)c.multiplyScalar(.92+.08*(Math.abs(d)/.04))
   }
   if(axis==='x'&&px>.55)c.lerp(damp,THREE.MathUtils.clamp((px-.55)/.75,0,1)*.18)
   if(waterlineY!==undefined&&py<waterlineY)c.lerp(damp,THREE.MathUtils.clamp((waterlineY-py)/.28,0,1)*.30)
   a.set([Math.min(1,c.r),Math.min(1,c.g),Math.min(1,c.b)],i*3)
  }
  g.setAttribute('color',new THREE.BufferAttribute(a,3))
 }
 const mesh=(name:string,g:THREE.BufferGeometry,mat:THREE.Material|THREE.Material[],parent:THREE.Object3D,x=0,y=0,z=0)=>{
  if((mat as THREE.MeshStandardMaterial).vertexColors&&!g.attributes.color){const p=g.attributes.position!,a=new Float32Array(p.count*3);for(let i=0;i<p.count;i++){const v=.94+.035*Math.sin(p.getX(i)*31+p.getY(i)*8+p.getZ(i)*17);a.set([v,v,v],i*3)}g.setAttribute('color',new THREE.BufferAttribute(a,3))}
  const m=new THREE.Mesh(g,mat);m.name=name;m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m
 }
 // Closed wall, solid tail and internal node. The upward-facing mouth is a real opening.
 const positions:number[]=[],normals:number[]=[]
 const lipN=new THREE.Vector3(1,.6,0).normalize().toArray()
 const triN=(a:number[],b:number[],c:number[],na:number[],nb:number[],nc:number[])=>{positions.push(...a,...b,...c);normals.push(...na,...nb,...nc)}
 const quadN=(a:number[],b:number[],c:number[],d:number[],na:number[],nb:number[],nc:number[],nd:number[])=>{triN(a,b,c,na,nb,nc);triN(a,c,d,na,nc,nd)}
 const ring=(r:number,t:number,x:number|null)=>{const y=r*Math.cos(t);return[x??1.2-.6*y,y,r*Math.sin(t)]}
 for(let i=0;i<32;i++){
  const a=i*Math.PI/16,b=(i+1)*Math.PI/16,oa=ring(.16,a,-.9),ob=ring(.16,b,-.9),oc=ring(.16,b,null),od=ring(.16,a,null),ia=ring(.125,a,-.08),ib=ring(.125,b,-.08),ic=ring(.125,b,null),id=ring(.125,a,null)
  const noa=[0,Math.cos(a),Math.sin(a)],nob=[0,Math.cos(b),Math.sin(b)],nia=[0,-Math.cos(a),-Math.sin(a)],nib=[0,-Math.cos(b),-Math.sin(b)]
  quadN(oa,ob,oc,od,noa,nob,nob,noa);quadN(ia,id,ic,ib,nia,nia,nib,nib);quadN(od,oc,ic,id,lipN,lipN,lipN,lipN)
  triN([-.9,0,0],ob,oa,[-1,0,0],[-1,0,0],[-1,0,0]);triN([-.08,0,0],ia,ib,[1,0,0],[1,0,0],[1,0,0])
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3))
 tintBamboo(geometry,'x',undefined,[-.48,.30])
 for(let i=0;i<32;i++){geometry.addGroup(i*24,6,0);geometry.addGroup(i*24+6,18,1)}
 const tube=mesh('sozu-tube',geometry,bambooWet,pivot);tube.material=[bambooWet,cut]
 for(const [i,x]of[-.48,.30].entries()){const band=mesh('sozu-node-band-'+i,new THREE.TorusGeometry(.162,.010,8,32),node,pivot,x);band.rotation.y=Math.PI/2}
 // Axle and two legs are the required fulcrum; no added furniture or panel.
 for(const[i,z]of[-.25,.25].entries()){const legGeo=new THREE.CylinderGeometry(.045,.065,1.15,20,8);tintBamboo(legGeo,'y',-.28);mesh('sozu-support-'+i,legGeo,bambooUpright,fixed,0,.575,z)}
 const axle=mesh('sozu-axle',new THREE.CylinderGeometry(.033,.033,.66,16),pinMat,fixed,0,1.15,0);axle.rotation.x=Math.PI/2
 const stemGeo=new THREE.CylinderGeometry(.07,.08,1.65,20,8);tintBamboo(stemGeo,'y',-.58);mesh('sozu-feed-stem',stemGeo,bambooUpright,fixed,2.65,.825,0)
 const supplyGeometry=new THREE.LatheGeometry([new THREE.Vector2(.043,-.525),new THREE.Vector2(.061,-.525),new THREE.Vector2(.061,.525),new THREE.Vector2(.043,.525),new THREE.Vector2(.043,-.525)],32);supplyGeometry.rotateZ(-Math.PI/2);tintBamboo(supplyGeometry,'x');mesh('sozu-feed-supply',supplyGeometry,bambooWet,fixed,2.125,1.65,0)
 const sleeveGeometry=new THREE.LatheGeometry([new THREE.Vector2(.065,-.35),new THREE.Vector2(.09,-.35),new THREE.Vector2(.09,.35),new THREE.Vector2(.065,.35),new THREE.Vector2(.065,-.35)],32);sleeveGeometry.rotateZ(-Math.PI/2);tintBamboo(sleeveGeometry,'x')
 const sleeve=mesh('sozu-feed-sleeve',sleeveGeometry,bambooWet,feed,1.52,1.65,0)
 const strikePoint=new THREE.Vector3(-.9*Math.cos(.2)+.16*Math.sin(.2),1.15-.9*Math.sin(.2)-.16*Math.cos(.2),0)
 const strike=mesh('sozu-strike-stone',new THREE.SphereGeometry(1,32,24),stone,fixed,strikePoint.x,strikePoint.y/2,0);strike.scale.set(.38,strikePoint.y/2,.32)
 const basinProfile=[[1.16,.02],[1.18,.30],[1.43,.32],[1.50,0],[1.16,0],[1.16,.02]].map(([x,y])=>new THREE.Vector2(x,y))
 mesh('sozu-pool-rim',new THREE.LatheGeometry(basinProfile.reverse(),64),stone,fixed,1.0,0,0)
 const pool=createStylizedWater({geometry:buildPolarDiscXY(1.17,16,64),depth:.16,color:'#63c4c0',shallowColor:'#a2e5da',deepColor:'#2c6e75',bedColor:'#bcc6a2',foamColor:'#f5f4e6',opacity:.50,radius:1.17,waveScale:1.15,waveAmplitude:.0065,causticScale:4.2,flowDirection:[.88,-.47],flowSpeed:.24,rippleSpeed:.86,rippleWavelength:.22});pool.surface.name='sozu-pool-water';pool.bed.name='sozu-pool-bed';pool.surface.rotation.x=-Math.PI/2;pool.surface.position.set(1.0,.18,0);fixed.add(pool.surface)
 const liquid=mesh('sozu-contained-water',new THREE.PlaneGeometry(1,1,32,1),waterMat,subject);liquid.castShadow=false;liquid.renderOrder=2;liquid.userData.toonSurface={outline:false}
 const inletStream=createLivingPourStream({preset:'clear-water',topRadius:.0165,bottomRadius:.0105,segments:12,radialSegments:10,arcForward:0,showSplashCrown:false,color:'#70c9c5',opacity:.70,roughness:.16,name:'sozu-inlet-water',waterRendering:true})
 const outletStream=createLivingPourStream({preset:'clear-water',topRadius:.0205,bottomRadius:.0125,segments:16,radialSegments:10,arcForward:0,showSplashCrown:true,splashRadius:.056,color:'#70c9c5',opacity:.70,roughness:.16,name:'sozu-outlet-water',waterRendering:true})
 const inlet=inletStream.mesh,outlet=outletStream.mesh
 subject.add(inlet,outlet)
 outletStream.splashCrown.position.set(1.0,.184,0)
 fixed.add(outletStream.splashCrown)
 const spillGeometry=new THREE.BufferGeometry();spillGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(36),3));const spill=mesh('sozu-spill-film',spillGeometry,waterMat,subject);spill.castShadow=false;spill.userData.toonSurface={outline:false}
 const lastInletA=new THREE.Vector3(),lastInletB=new THREE.Vector3(),lastOutletA=new THREE.Vector3(),lastOutletB=new THREE.Vector3()
 let waterClock=0,outletRippleTimer=.12
 const liquidPose=(theta:number,height:number,show:boolean)=>{
  const c=Math.cos(theta),s=Math.sin(theta),r=.12425
  let lo=-.0799,hi=(1.2-.6*(height-1.15)/c)/(1-.6*s/c)
  if(Math.abs(s)>1e-10){const a=(height-1.15-r*c)/s,b=(height-1.15+r*c)/s;lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b))}
  hi=Math.min(hi,1.275);lo+=.00002;hi-=.00002;liquid.visible=show&&hi>lo&&Number.isFinite(hi)&&(Math.abs(s)>1e-10||Math.abs(height-1.15)<r)
  if(!liquid.visible){(liquid.geometry.attributes.position as THREE.BufferAttribute).array.fill(0);liquid.geometry.attributes.position!.needsUpdate=true;liquid.geometry.computeVertexNormals();liquid.geometry.computeBoundingSphere();return}
  const p=liquid.geometry.attributes.position as THREE.BufferAttribute
  for(let i=0;i<=32;i++){const x=lo+(hi-lo)*i/32,y=(height-1.15-x*s)/c,z=Math.sqrt(Math.max(0,r*r-y*y)),wx=x*c-y*s;p.setXYZ(i,wx,height,-z);p.setXYZ(i+33,wx,height,z)}
  p.needsUpdate=true;liquid.geometry.computeVertexNormals();liquid.geometry.computeBoundingSphere()
 }
 const pose=(at:number,n:number)=>{
  const step=Number.isFinite(at)?THREE.MathUtils.clamp(Math.floor(at),0,3):0,t=Number.isFinite(n)?THREE.MathUtils.clamp(n,0,1):0
  const theta=step===1?.2-.75*t:step===2?-.55+.75*t:.2;pivot.rotation.z=theta
  feed.position.x=step===0?.45*(1-Math.min(t/.5,1)):0
  const initialHeight=1.16,lip=1.15+1.275*Math.sin(theta)-.125*Math.cos(theta)
  const height=step===0?1.013+(initialHeight-1.013)*Math.max(0,(t-.5)/.5):step===1?Math.min(initialHeight,lip-.003)-.10*t:0
  liquidPose(theta,height,(step===0&&t>.5)||(step===1&&t<1))
  const inletOn=step===0&&t>.5&&t<1,outletOn=step===1&&t>.12&&t<.82
  lastInletA.set(1.17+feed.position.x,1.56,0)
  lastInletB.set(1.17+feed.position.x,1.15+(1.17+feed.position.x)*Math.tan(.2)-.125/Math.cos(.2)+.008,0)
  inletStream.updateArc(lastInletA,lastInletB,1,0,true)
  inlet.visible=inletOn
  const axis=new THREE.Vector3(0,0,1),normal=new THREE.Vector3(1,.6,0).normalize().applyAxisAngle(axis,theta)
  const innerLip=new THREE.Vector3(1.275,-.125,0).applyAxisAngle(axis,theta).add(pivot.position),outerLip=new THREE.Vector3(1.296,-.16,0).applyAxisAngle(axis,theta).add(pivot.position)
  const path=[innerLip.addScaledVector(normal,.002),outerLip.clone().addScaledVector(normal,.002),outerLip.clone().add(new THREE.Vector3(.035,0,0))]
  const sheet:number[]=[];for(let i=0;i<2;i++){const a=path[i]!,b=path[i+1]!,ap=a.clone().add(new THREE.Vector3(0,0,.013)),am=a.clone().add(new THREE.Vector3(0,0,-.013)),bp=b.clone().add(new THREE.Vector3(0,0,.013)),bm=b.clone().add(new THREE.Vector3(0,0,-.013));sheet.push(...ap.toArray(),...am.toArray(),...bm.toArray(),...ap.toArray(),...bm.toArray(),...bp.toArray())}
  ;(spill.geometry.attributes.position as THREE.BufferAttribute).array.set(sheet);spill.geometry.attributes.position!.needsUpdate=true;spill.geometry.computeVertexNormals();spill.geometry.computeBoundingSphere();spill.visible=outletOn
  lastOutletA.copy(path[2]!);lastOutletB.set(path[2]!.x,.182,path[2]!.z)
  outletStream.updateArc(lastOutletA,lastOutletB,1,0,true)
  outlet.visible=outletOn
  if(!outletOn){outletStream.splashCrown.visible=false;outletStream.splashCrown.position.set(1.0,.184,0);outletStream.splashCrown.scale.set(1,1,1);outletStream.splashCrown.rotation.set(0,0,0)}
  subject.updateMatrixWorld(true)

 }
 const tailContact=()=>{subject.updateMatrixWorld(true);return pivot.localToWorld(new THREE.Vector3(-.9,-.16,0))}
 const updateWater=(dt:number,reduced:boolean)=>{
  pool.update(dt,reduced)
  if(reduced||!Number.isFinite(dt)||dt<=0)return
  const stepDt=Math.min(dt,.05)
  waterClock+=stepDt
  if(inlet.visible)inletStream.updateArc(lastInletA,lastInletB,1,waterClock,false)
  if(outlet.visible){
   outletStream.updateArc(lastOutletA,lastOutletB,1,waterClock,false)
   outletRippleTimer+=stepDt
   if(outletRippleTimer>=.11){
    outletRippleTimer=0
    pool.triggerRipple(lastOutletB.x,lastOutletB.z,.95,1.12)
   }
  }else{
   outletRippleTimer=.12
  }
 }
 const triggerStrikeRipple=()=>{
  pool.triggerRipple(.52,0,.78,1.15)
  pool.triggerRipple(1.0,0,.44,1.08)
 }
 const disposeWater=()=>{pool.dispose();inletStream.dispose();outletStream.dispose()}
 pose(0,0)
 return{subject,fixed,pivot,tube,feed,sleeve,axle,strike,strikePoint,tailContact,liquid,inlet,outlet,spill,pool,pose,targets:[sleeve,tube,tube],roots:[sleeve,tube,tube],anchors:[[-.12,0,.09],[.75,0,.16],[-.75,0,.16]] as[number,number,number][],updateWater,triggerStrikeRipple,disposeWater}
}
