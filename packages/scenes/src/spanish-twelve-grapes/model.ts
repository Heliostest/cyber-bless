import * as THREE from 'three'

// Original static 11:55 dial, neither a clock-tower replica nor a timer.
const clockPixels=(()=>{
 const size=128,data=new Uint8Array(size*size*4)
 const distance=(x:number,y:number,ax:number,ay:number,bx:number,by:number)=>{const dx=bx-ax,dy=by-ay,t=THREE.MathUtils.clamp(((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy),0,1);return Math.hypot(x-ax-t*dx,y-ay-t*dy)}
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const px=(x/(size-1)-.5)*2,py=(y/(size-1)-.5)*2,r=Math.hypot(px,py)
  let ink=r>.88&&r<.92
  for(let j=0;j<12;j++){const a=j*Math.PI/6;ink ||= distance(px,py,Math.sin(a)*.72,Math.cos(a)*.72,Math.sin(a)*.83,Math.cos(a)*.83)<.018}
  ink ||= distance(px,py,0,0,-.32,.554)<.022 || distance(px,py,0,0,-.019,.43)<.032 || r<.055
  const i=(y*size+x)*4;data.set(ink?[74,85,63,255]:[245,231,191,255],i)
 }
 return data
})()

export function createSpanishTwelveGrapesModel(){
 const root=new THREE.Group();root.name='spanish-twelve-grapes-root'
 const subject=new THREE.Group();subject.name='spanish-twelve-grapes-subject';root.add(subject)
 const stone=new THREE.MeshStandardMaterial({color:0xcab99e,roughness:.95}),wood=new THREE.MeshStandardMaterial({color:0x936542,roughness:.85}),ceramic=new THREE.MeshStandardMaterial({color:0xffe9bf,roughness:.42}),platform=new THREE.MeshStandardMaterial({color:0xbba180,roughness:.85}),green=new THREE.MeshStandardMaterial({color:0x9cab49,roughness:.4})
 const add=(parent:THREE.Object3D,name:string,size:[number,number,number],position:[number,number,number],material:THREE.Material|THREE.Material[])=>{const m=new THREE.Mesh(new THREE.BoxGeometry(...size),material);m.name=name;m.position.set(...position);m.castShadow=m.receiveShadow=true;parent.add(m);return m}
 add(subject,'grapes-stone-base',[4.6,.12,3.4],[0,-.06,.20],stone)
 add(subject,'grapes-serving-platform',[2.75,.14,.96],[.45,.07,.65],platform)
 const initial=[new THREE.Vector3(-1.45,.10,-.65),new THREE.Vector3(-1.45,.10,.15),new THREE.Vector3(-1.45,.10,.95)],goal=[new THREE.Vector3(-.45,.14,.65),new THREE.Vector3(.45,.14,.65),new THREE.Vector3(1.35,.14,.65)]
 for(let i=0;i<3;i++)add(subject,'grapes-preparation-pad-'+i,[.85,.10,.74],[-1.45,.05,initial[i]!.z],wood)
 add(subject,'grapes-clock-foot',[1.15,.20,.40],[.65,.10,-.85],wood)
 const dial=new THREE.DataTexture(clockPixels.slice(),128,128);dial.colorSpace=THREE.SRGBColorSpace;dial.needsUpdate=true
 const face=new THREE.MeshStandardMaterial({map:dial,roughness:.85})
 add(subject,'grapes-clock',[1,1,.08],[.65,.70,-.85],[wood,wood,wood,wood,face,wood])
 const grapeGeometry=new THREE.SphereGeometry(.14,20,12),position=grapeGeometry.getAttribute('position')
 // A broad closed flat foot is a digital support simplification.
 for(let i=0;i<position.count;i++)position.setY(i,Math.max(position.getY(i),-.115)+.115)
 grapeGeometry.computeVertexNormals()
 const portions:THREE.Group[]=[],grapes:THREE.Mesh[]=[]
 for(let i=0;i<3;i++){
  const portion=new THREE.Group();portion.name='grapes-portion-'+i;subject.add(portion);portions.push(portion)
  add(portion,'grapes-plate-'+i,[.74,.06,.70],[0,.03,0],ceramic)
  for(const x of[-.18,.18])for(const z of[-.16,.16]){const grape=new THREE.Mesh(grapeGeometry,green);grape.name='grapes-fruit-'+grapes.length;grape.position.set(x,.06,z);grape.castShadow=grape.receiveShadow=true;portion.add(grape);grapes.push(grape)}
 }
 const roots=portions,anchors:[number,number,number][]=[[0,.06,0],[0,.06,0],[0,.06,0]]
 const pose=(step:number,n:number)=>{
  n=THREE.MathUtils.clamp(Number.isFinite(n)?n:0,0,1)
  portions.forEach((portion,i)=>{
   const start=initial[i]!,end=goal[i]!,highStart=new THREE.Vector3(start.x,1.45,start.z),highEnd=new THREE.Vector3(end.x,1.45,end.z)
   if(step>i||(step===i&&n===1))portion.position.copy(end)
   else if(step<i||n===0)portion.position.copy(start)
   else if(n<.25)portion.position.copy(start).lerp(highStart,n*4)
   else if(n<.75)portion.position.copy(highStart).lerp(highEnd,(n-.25)*2)
   else portion.position.copy(highEnd).lerp(end,(n-.75)*4)
  });root.updateMatrixWorld(true)
 }
 pose(0,0);return{root,subject,portions,grapes,roots,targets:roots,anchors,pose,dialTexture:dial}
}
